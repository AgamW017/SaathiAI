import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, employerProcedure } from '../trpc.js';
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
 * Dashboard rate limit: max 20 pings per employer per learner per calendar day (IST).
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

// ─── Employer Messaging Router ────────────────────────────────────────────────

export const employerMessagingRouter = router({
  /**
   * Get the conversation thread between an employer and a learner.
   * Returns messages ordered by created_at ascending where the employer
   * is sender or the learner is replying.
   *
   * Requirements: 3.1
   */
  getThread: employerProcedure
    .input(
      z.object({
        learnerId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const employerId = ctx.user.sub;

      // Return messages where this employer is the sender (direction: to_learner)
      // OR messages from the learner (direction: from_learner) in this thread
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_learner_id, direction, content, source, status, reply_to_id, created_at')
        .eq('receiver_learner_id', input.learnerId)
        .or(`sender_id.eq.${employerId},direction.eq.from_learner`)
        .order('created_at', { ascending: true })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        handleSupabaseError(error, 'employer.messaging.getThread');
      }

      return {
        messages: messages ?? [],
        learnerId: input.learnerId,
      };
    }),

  /**
   * Send a ping message from an employer to a learner via the bot.
   * Validates:
   *   1. Learner exists
   *   2. Learner is in employer's pipeline
   *   3. Rate limit (20/employer/learner/day IST)
   * Stores message record and triggers WhatsApp delivery via bot internal API.
   *
   * Requirements: 3.2, 3.3, 3.4, 3.6
   */
  sendPing: employerProcedure
    .input(
      z.object({
        learnerId: z.string().uuid(),
        message: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const employerId = ctx.user.sub;
      const employerName = ctx.user.email ?? 'Employer';

      // 1. Validate learner exists
      const { data: learner, error: learnerError } = await supabase
        .from('learners')
        .select('id, phone, full_name')
        .eq('id', input.learnerId)
        .single();

      if (learnerError || !learner) {
        if (learnerError && learnerError.code !== 'PGRST116') {
          handleSupabaseError(learnerError, 'employer.messaging.sendPing.learnerLookup');
        }
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Learner not found',
        });
      }

      // 2. Validate learner is in employer's pipeline
      const { data: pipelineMatch, error: pipelineError } = await supabase
        .from('matches')
        .select('id')
        .eq('employer_id', employerId)
        .eq('learner_id', input.learnerId)
        .limit(1)
        .single();

      if (pipelineError || !pipelineMatch) {
        if (pipelineError && pipelineError.code !== 'PGRST116') {
          handleSupabaseError(pipelineError, 'employer.messaging.sendPing.pipelineCheck');
        }
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only message learners in your pipeline',
        });
      }

      // 3. Enforce rate limit: 20 pings per employer per learner per calendar day (IST)
      const { start, end } = getTodayISTBounds();

      const { count, error: countError } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', employerId)
        .eq('receiver_learner_id', input.learnerId)
        .eq('direction', 'to_learner')
        .gte('created_at', start)
        .lte('created_at', end);

      if (countError) {
        handleSupabaseError(countError, 'employer.messaging.sendPing.rateLimit');
      }

      if ((count ?? 0) >= DASHBOARD_PING_RATE_LIMIT) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Daily message limit reached for this learner',
        });
      }

      // 4. Store message record in messages table
      const { data: messageRecord, error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: employerId,
          receiver_learner_id: input.learnerId,
          direction: 'to_learner',
          content: input.message,
          source: 'dashboard',
          status: 'sent',
        })
        .select('id, created_at')
        .single();

      if (insertError) {
        handleSupabaseError(insertError, 'employer.messaging.sendPing.insert');
      }

      // 5. Call bot internal API POST /internal/send-ping for WhatsApp delivery
      try {
        const response = await fetch(`${BOT_INTERNAL_URL}/internal/send-ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            learnerId: input.learnerId,
            message: input.message,
            senderName: employerName,
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
            message: `Message delivery failed`,
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
          message: 'Unable to reach messaging service',
        });
      }

      // 6. Return success
      return {
        success: true,
        messageId: messageRecord.id,
        createdAt: messageRecord.created_at,
      };
    }),
});
