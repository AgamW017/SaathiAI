import { config } from '../config/env.js';
import { supabase } from '../db/client.js';
import { logger } from '../config/logger.js';

export interface RiskPayload {
  days_since_last_response: number;
  status: string;
  profile_completeness: number;
  days_to_cohort_end: number;
}

/**
 * Fire-and-forget: calls aiserver /predict-risk, then writes the score back to the
 * learner row. Never throws — a timeout or unreachable aiserver is silently ignored
 * so that learner onboarding is never blocked.
 */
export function triggerRiskScoreUpdate(learnerId: string, payload: RiskPayload): void {
  // Intentionally not awaited by the caller
  void (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      let resp: Response;
      try {
        resp = await fetch(`${config.aiserver.url}/predict-risk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ learner_id: learnerId, ...payload }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!resp.ok) {
        logger.warn({ learnerId, status: resp.status }, 'aiserver /predict-risk non-2xx');
        return;
      }

      const { score } = (await resp.json()) as { score: number };
      if (typeof score !== 'number' || !Number.isFinite(score)) return;

      const { error } = await (supabase as any)
        .from('learners')
        .update({ risk_score: Math.round(score) })
        .eq('id', learnerId);

      if (error) {
        logger.warn({ learnerId, error }, 'Failed to persist risk_score');
      } else {
        logger.info({ learnerId, score }, 'risk_score updated');
      }
    } catch {
      // AbortError (timeout) or network failure — silently swallow
    }
  })();
}

/**
 * Compute profile completeness (0–100) from available learner fields at insert time.
 */
export function computeProfileCompleteness(fields: {
  full_name?: string | null;
  trade?: string | null;
  district?: string | null;
  phone?: string | null;
}): number {
  const checks = [fields.full_name, fields.trade, fields.district, fields.phone];
  const filled = checks.filter((v) => v != null && v.trim() !== '').length;
  return Math.round((filled / checks.length) * 100);
}
