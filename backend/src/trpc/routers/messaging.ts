import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, officerProcedure } from '../trpc.js';
import { supabase as _supabase } from '../../db/client.js';
import { config } from '../../config/env.js';
import { handleSupabaseError } from '../errors.js';

const supabase = _supabase as any;

/**
 * Bot internal API base URL for sending pings.
 * Falls back to localhost:3001 for local development.
 */
const BOT_INTERNAL_URL =
  process.env.BOT_INTERNAL_URL || `http://localhost:${config.bot.adminWsPort}`;

/**
 * Dashboard rate limit: max 20 pings per officer per learner per calendar day (IST).
 */
const DASHBOARD_PING_RATE_LIMIT = 20;

/**
 * Returns today's date boundaries in IST (midnight-to-midnight).
 */
function getTodayISTBounds(): { start: string; end: string } {
  // IST is UTC+5:30
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  // Start of day in IST → convert back to UTC
  const istMidnight = new Date(istNow);
  istMidnight.setUTCHours(0, 0, 0, 0);
  const utcStart = new Date(istMidnight.getTime() - istOffset);

  // End of day in IST → convert back to UTC
  const istEndOfDay = new Date(istNow);
  istEndOfDay.setUTCHours(23, 59, 59, 999);
  const utcEnd = new Date(istEndOfDay.getTime() - istOffset);

  return {
    start: utcStart.toISOString(),
    end: utcEnd.toISOString(),
  };
}

/** Valid status transitions for message delivery. */
const VALID_STATUSES = ['sent', 'delivered', 'read', 'failed'] as const;
type MessageStatus = (typeof VALID_STATUSES)[number];

// ─── Messaging Router ─────────────────────────────────────────────────────────

export const messagingRouter = router({
  /**
   * Send a ping message from an officer to a learner via the bot.
   * Validates officer role (handled by officerProcedure), learner existence,
   * rate limit (20/officer/learner/day), stores message, and triggers delivery.
   *
   * Requirements: 4.1, 4.5, 4.6, 4.8
   */
  sendPing: officerProcedure
    .input(
      z.object({
        learnerId: z.string().uuid(),
        message: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const officerId = ctx.user.sub;
      const officerName = ctx.user.email ?? 'Officer';

      // 1. Validate learner exists
      const { data: learner, error: learnerError } = await supabase
        .from('learners')
        .select('id, phone, full_name')
        .eq('id', input.learnerId)
        .single();

      if (learnerError || !learner) {
        if (learnerError && learnerError.code !== 'PGRST116') {
          handleSupabaseError(learnerError, 'messaging.sendPing.learnerLookup');
        }
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Learner not found',
        });
      }

      // 2. Enforce rate limit: 20 pings per officer per learner per calendar day (IST)
      const { start, end } = getTodayISTBounds();

      const { count, error: countError } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', officerId)
        .eq('receiver_learner_id', input.learnerId)
        .eq('direction', 'to_learner')
        .gte('created_at', start)
        .lte('created_at', end);

      if (countError) {
        handleSupabaseError(countError, 'messaging.sendPing.rateLimit');
      }

      if ((count ?? 0) >= DASHBOARD_PING_RATE_LIMIT) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Daily ping limit reached (${DASHBOARD_PING_RATE_LIMIT} per learner per day)`,
        });
      }

      // 3. Store message record in messages table
      const { data: messageRecord, error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: officerId,
          receiver_learner_id: input.learnerId,
          direction: 'to_learner',
          content: input.message,
          source: 'dashboard',
          status: 'sent',
        })
        .select('id, created_at')
        .single();

      if (insertError) {
        handleSupabaseError(insertError, 'messaging.sendPing.insert');
      }

      // 4. Call bot internal API POST /internal/send-ping
      try {
        const response = await fetch(`${BOT_INTERNAL_URL}/internal/send-ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            learnerId: input.learnerId,
            message: input.message,
            senderName: officerName,
            source: 'dashboard',
          }),
        });

        if (!response.ok) {
          // Update message status to 'failed' if bot delivery fails
          await supabase
            .from('messages')
            .update({ status: 'failed' })
            .eq('id', messageRecord.id);

          const errorBody = await response.json().catch(() => ({}));
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Bot delivery failed: ${(errorBody as any).error ?? response.statusText}`,
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        // Network error — bot might be down
        await supabase
          .from('messages')
          .update({ status: 'failed' })
          .eq('id', messageRecord.id);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unable to reach bot service for message delivery',
        });
      }

      // 5. Return success
      return {
        success: true,
        messageId: messageRecord.id,
        createdAt: messageRecord.created_at,
      };
    }),

  /**
   * Get the conversation thread between an officer/employer and a learner.
   * Returns messages ordered by timestamp ascending.
   *
   * Requirements: 4.4
   */
  getThread: officerProcedure
    .input(
      z.object({
        learnerId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const officerId = ctx.user.sub;

      // Return messages where this officer is the sender OR
      // messages from the learner that are replies in threads started by this officer
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_learner_id, direction, content, source, status, reply_to_id, created_at')
        .eq('receiver_learner_id', input.learnerId)
        .or(`sender_id.eq.${officerId},direction.eq.from_learner`)
        .order('created_at', { ascending: true })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        handleSupabaseError(error, 'messaging.getThread');
      }

      return {
        messages: messages ?? [],
        learnerId: input.learnerId,
      };
    }),

  /**
   * Update the delivery status of one or more messages.
   * Used by the bot (via internal call) to report delivery confirmations or failures.
   *
   * Requirements: 4.3, 4.7
   */
  updateMessageStatus: officerProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().uuid()).min(1).max(100),
        status: z.enum(VALID_STATUSES),
      })
    )
    .mutation(async ({ input }) => {
      const { messageIds, status } = input;

      const { data, error } = await supabase
        .from('messages')
        .update({ status })
        .in('id', messageIds)
        .select('id, status');

      if (error) {
        handleSupabaseError(error, 'messaging.updateMessageStatus');
      }

      return {
        updated: data?.length ?? 0,
        status,
      };
    }),
});
