import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabase as _supabase } from '../db/client.js';
import { logger } from '../config/logger.js';
import { triggerRiskScoreUpdate, computeProfileCompleteness } from '../services/riskService.js';
import { config } from '../config/env.js';

const supabase = _supabase as any;
const router = Router();

const BOT_INTERNAL_URL =
  process.env.BOT_INTERNAL_URL || `http://localhost:${config.bot.adminWsPort}`;

/**
 * POST /api/cohorts
 *
 * Creates a new cohort and bulk-inserts the provided learners.
 * Deduplicates by phone number (existing learners are skipped).
 * Does NOT trigger WhatsApp onboarding.
 *
 * @body name     - Cohort display name (string, required)
 * @body learners - Array of ExtractedLearner records (only valid rows should be sent)
 * @returns { cohortId, cohortName, inserted, skipped }
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, learners } = req.body as {
      name?: string;
      learners?: Array<{ name?: string; phone: string; trade?: string }>;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: '`name` is required' });
      return;
    }

    if (!Array.isArray(learners) || learners.length === 0) {
      res.status(400).json({ error: '`learners` must be a non-empty array' });
      return;
    }

    const officerId = req.user!.sub;

    // Fetch officer district / state for learner records
    const { data: officer } = await supabase
      .from('users')
      .select('district, state')
      .eq('id', officerId)
      .single();

    const district = officer?.district ?? null;
    const state = officer?.state ?? null;

    // Create cohort
    const { data: cohort, error: cohortError } = await supabase
      .from('cohorts')
      .insert({ name: name.trim(), officer_id: officerId })
      .select('id, name, created_at')
      .single();

    if (cohortError) {
      logger.error({ cohortError }, 'Failed to create cohort');
      res.status(500).json({ error: cohortError.message });
      return;
    }

    let inserted = 0;
    let skipped = 0;
    const newLearners: Array<{ id: string; phone: string }> = [];

    for (const l of learners) {
      if (!l.phone) continue;

      const { data: existing } = await supabase
        .from('learners')
        .select('id')
        .eq('phone', l.phone)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { data: inserted_row, error: insertError } = await supabase.from('learners').insert({
        phone: l.phone,
        full_name: l.name ?? null,
        trade: l.trade ?? null,
        district,
        state,
        cohort_id: cohort.id,
        status: 'active',
        risk_score: 0,
        officer_id: officerId,
      }).select('id').single();

      if (!insertError) {
        inserted++;
        if (inserted_row?.id) {
          newLearners.push({ id: inserted_row.id, phone: l.phone });
          triggerRiskScoreUpdate(inserted_row.id, {
            days_since_last_response: 0,
            status: 'active',
            profile_completeness: computeProfileCompleteness({
              full_name: l.name,
              trade: l.trade,
              district,
              phone: l.phone,
            }),
            days_to_cohort_end: 90,
          });
        }
      } else {
        logger.warn({ insertError, phone: l.phone }, 'Failed to insert learner');
      }
    }

    // Trigger bot onboarding for newly created learners (fire-and-forget)
    if (newLearners.length > 0) {
      fetch(`${BOT_INTERNAL_URL}/internal/trigger-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learners: newLearners }),
      }).catch((error) => {
        logger.error({ error }, 'Failed to reach bot service for onboarding trigger');
      });
    }

    res.status(201).json({
      cohortId: cohort.id,
      cohortName: cohort.name,
      inserted,
      skipped,
      total: learners.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create cohort';
    logger.error({ err }, 'POST /api/cohorts failed');
    res.status(500).json({ error: message });
  }
});

export { router as cohortsApiRouter };
