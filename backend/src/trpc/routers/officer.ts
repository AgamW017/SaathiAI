import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, officerProcedure } from '../trpc.js';
import { supabase } from '../../db/client.js';
import { handleSupabaseError } from '../errors.js';
import { logger } from '../../config/logger.js';

const db = supabase as any;

/**
 * Bot internal API base URL for sending WhatsApp notifications.
 * Falls back to localhost:3001 for local development.
 */
const BOT_INTERNAL_URL =
  process.env.BOT_INTERNAL_URL || 'http://localhost:3001';

// ─── Input Schema ─────────────────────────────────────────────────────────────

const documentSchema = z.object({
  filename: z.string(),
  base64: z.string(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
  sizeBytes: z.number().max(10 * 1024 * 1024),
});

export const onboardLearnerInput = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  trades: z.array(z.string().min(1)).min(1),
  district: z.string().min(1),
  state: z.string().min(1),
  certificateType: z.string().optional(),
  skills: z.array(z.string()).default([]),
  aadhaarDocument: documentSchema,
  certificateDocument: documentSchema,
});

// ─── Officer Onboarding Router ────────────────────────────────────────────────

export const officerRouter = router({
  /**
   * Onboard a learner manually via the officer dashboard form.
   *
   * 1. Checks phone not already registered
   * 2. Creates learner record (step = SKILL_CARD_SHOWN)
   * 3. Uploads documents to Supabase Storage
   * 4. Creates skill card
   * 5. Queries matching jobs by trade + district
   * 6. Sends WhatsApp notification via bot internal API
   * 7. Returns result (notification failure is non-fatal)
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
   */
  onboardLearner: officerProcedure
    .input(onboardLearnerInput)
    .mutation(async ({ ctx, input }) => {
      const { name, phone, trades, district, state, certificateType, skills, aadhaarDocument, certificateDocument } = input;

      // 1. Check phone not already in learners table
      const { data: existingLearner } = await db
        .from('learners')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (existingLearner) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Learner with phone ${phone} is already registered.`,
        });
      }

      // 2. Insert learner record with step = 'SKILL_CARD_SHOWN' (value 5)
      const { data: learner, error: learnerError } = await db
        .from('learners')
        .insert({
          phone,
          full_name: name,
          trade: trades.join(', '),
          district,
          state,
          status: 'active',
          officer_id: ctx.user.sub,
        })
        .select()
        .single();

      if (learnerError) handleSupabaseError(learnerError, 'officer.onboardLearner.insertLearner');

      // 3. Upload documents to Supabase Storage (aadhaar + certificate)
      const uploadedDocs: { aadhaar?: { url: string; path: string }; certificate?: { url: string; path: string } } = {};

      const docsToUpload = [
        { doc: aadhaarDocument, type: 'aadhaar' as const },
        { doc: certificateDocument, type: 'certificate' as const },
      ];

      for (const { doc, type } of docsToUpload) {
        const timestamp = Date.now();
        const storagePath = `documents/${phone}/${type}_${timestamp}_${doc.filename}`;

        const buffer = Buffer.from(doc.base64, 'base64');
        const { error: uploadError } = await supabase.storage
          .from('cohort-documents')
          .upload(storagePath, buffer, {
            contentType: doc.mimeType,
            upsert: false,
          });

        if (uploadError) {
          logger.error({ uploadError, path: storagePath, type }, 'Document upload failed');
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('cohort-documents')
          .getPublicUrl(storagePath);

        uploadedDocs[type] = {
          url: urlData.publicUrl,
          path: storagePath,
        };
      }

      // Create a session record with step = SKILL_CARD_SHOWN (5)
      await db
        .from('sessions')
        .insert({
          learner_id: learner.id,
          step: '5',
          data: {
            context: {
              fullName: name,
              phone,
              trade: trades[0],
              district,
              state,
              certificateType: certificateType ?? null,
              skills,
              onboardedBy: 'officer',
              documents: [
                {
                  documentType: 'aadhaar',
                  url: uploadedDocs.aadhaar?.url ?? null,
                  path: uploadedDocs.aadhaar?.path ?? null,
                },
                {
                  documentType: 'certificate',
                  url: uploadedDocs.certificate?.url ?? null,
                  path: uploadedDocs.certificate?.path ?? null,
                },
              ],
            },
          },
        });

      // 4. Create skill card in skill_cards table
      const { data: skillCard, error: skillCardError } = await db
        .from('skill_cards')
        .insert({
          learner_id: learner.id,
          trade: trades[0],
          skills: skills.length > 0 ? skills : trades,
          certificate_type: certificateType ?? null,
          verification_status: 'pending',
        })
        .select()
        .single();

      if (skillCardError) {
        logger.error({ skillCardError }, 'Skill card creation failed');
        handleSupabaseError(skillCardError, 'officer.onboardLearner.insertSkillCard');
      }

      // Generate skill card URL (public page at /skill-card/{id})
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const skillCardUrl = `${frontendUrl}/skill-card/${skillCard.id}`;

      // 5. Query matching jobs by trade + district
      let jobsMatched = 0;
      try {
        // Query active vacancies matching trade + district
        let jobQuery = db
          .from('vacancies')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active');

        // Match any of the learner's trades using ilike
        const tradeFilter = trades.map(t => `trade_required.ilike.%${t}%`).join(',');
        jobQuery = jobQuery.or(tradeFilter);

        // District filter (optional, broadens results if not matched)
        if (district) {
          jobQuery = jobQuery.ilike('district', `%${district}%`);
        }

        const { count, error: jobError } = await jobQuery;
        if (!jobError) {
          jobsMatched = count ?? 0;
        }
      } catch (err) {
        logger.error({ err }, 'Job matching query failed');
        // Non-fatal — continue with 0 jobs matched
      }

      // 6. Send WhatsApp notification via bot's /internal/send-ping endpoint
      // Ask the learner for any profile details the officer did not supply, so
      // the bot can complete the profile conversationally.
      const missing: string[] = [];
      if (!skills || skills.length === 0) missing.push('your key skills');
      if (!certificateType) missing.push('your certificate/qualification');
      if (!state) missing.push('your state');
      const missingPrompt = missing.length > 0
        ? `\n\n📝 To finish your profile, please reply with ${missing.join(', ')}. A voice note is fine!`
        : '';

      let whatsappNotified = false;
      try {
        const notificationPayload = {
          phone,
          message: `🎉 Welcome to SaathiAI, ${name}! Your profile has been created and your Skill Card is ready.\n\n📋 View your Skill Card: ${skillCardUrl}${jobsMatched > 0 ? `\n\n💼 We found ${jobsMatched} job${jobsMatched > 1 ? 's' : ''} matching your skills in ${district}!` : ''}${missingPrompt}`,
          type: 'officer_onboarding',
        };

        const response = await fetch(`${BOT_INTERNAL_URL}/internal/send-ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notificationPayload),
        });

        if (response.ok) {
          whatsappNotified = true;
        } else {
          const body = await response.text().catch(() => '');
          logger.warn(
            { status: response.status, body, phone },
            'WhatsApp notification delivery failed'
          );
        }
      } catch (err) {
        // 7. Log notification failure but still return success
        logger.warn({ err, phone }, 'WhatsApp notification send failed (network error)');
      }

      // 8. Return result
      return {
        learner: {
          id: learner.id,
          phone: learner.phone,
          full_name: learner.full_name,
        },
        skillCardUrl,
        jobsMatched,
        whatsappNotified,
      };
    }),
});
