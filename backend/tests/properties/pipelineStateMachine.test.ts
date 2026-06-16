import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property tests for the employer pipeline state machine transitions.
 *
 * The pipeline has a strict forward-only flow:
 *   new_match → skill_card_viewed → interest_expressed → interview_scheduled
 *   → interview_completed → offer_extended → hired
 *
 * At any stage (except hired/rejected), a transition to 'rejected' is allowed.
 * Terminal states (hired, rejected) have no outgoing transitions.
 */

// ─── Replicate the state machine logic from employerService.ts ───────────────

type MatchStage =
  | 'new_match'
  | 'skill_card_viewed'
  | 'interest_expressed'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'offer_extended'
  | 'hired'
  | 'rejected';

const ALL_STAGES: MatchStage[] = [
  'new_match',
  'skill_card_viewed',
  'interest_expressed',
  'interview_scheduled',
  'interview_completed',
  'offer_extended',
  'hired',
  'rejected',
];

const VALID_TRANSITIONS: Record<MatchStage, MatchStage[]> = {
  new_match: ['skill_card_viewed', 'rejected'],
  skill_card_viewed: ['interest_expressed', 'rejected'],
  interest_expressed: ['interview_scheduled', 'rejected'],
  interview_scheduled: ['interview_completed', 'rejected'],
  interview_completed: ['offer_extended', 'rejected'],
  offer_extended: ['hired', 'rejected'],
  hired: [],
  rejected: [],
};

function isValidTransition(from: MatchStage, to: MatchStage): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const stageArb = fc.constantFrom(...ALL_STAGES);

const nonTerminalStageArb = fc.constantFrom<MatchStage>(
  'new_match',
  'skill_card_viewed',
  'interest_expressed',
  'interview_scheduled',
  'interview_completed',
  'offer_extended'
);

const terminalStageArb = fc.constantFrom<MatchStage>('hired', 'rejected');

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Pipeline State Machine — isValidTransition', () => {
  it('terminal states (hired, rejected) have no valid outgoing transitions', () => {
    fc.assert(
      fc.property(terminalStageArb, stageArb, (from, to) => {
        expect(isValidTransition(from, to)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('every non-terminal stage can transition to rejected', () => {
    fc.assert(
      fc.property(nonTerminalStageArb, (from) => {
        expect(isValidTransition(from, 'rejected')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('self-transitions are never valid', () => {
    fc.assert(
      fc.property(stageArb, (stage) => {
        expect(isValidTransition(stage, stage)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('backward transitions are never valid (higher index to lower index in the pipeline)', () => {
    const FORWARD_ORDER: MatchStage[] = [
      'new_match',
      'skill_card_viewed',
      'interest_expressed',
      'interview_scheduled',
      'interview_completed',
      'offer_extended',
      'hired',
    ];

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: FORWARD_ORDER.length - 1 }),
        fc.integer({ min: 0, max: FORWARD_ORDER.length - 2 }),
        (fromIdx, toIdx) => {
          // Ensure fromIdx > toIdx for a backward transition
          if (fromIdx <= toIdx) return; // skip — not a backward case
          const from = FORWARD_ORDER[fromIdx];
          const to = FORWARD_ORDER[toIdx];
          expect(isValidTransition(from, to)).toBe(false);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('each non-terminal stage has exactly one forward transition (besides rejected)', () => {
    fc.assert(
      fc.property(nonTerminalStageArb, (from) => {
        const validTargets = VALID_TRANSITIONS[from].filter((s) => s !== 'rejected');
        expect(validTargets).toHaveLength(1);
      }),
      { numRuns: 100 }
    );
  });

  it('skip transitions (jumping more than one forward step) are invalid', () => {
    const FORWARD_ORDER: MatchStage[] = [
      'new_match',
      'skill_card_viewed',
      'interest_expressed',
      'interview_scheduled',
      'interview_completed',
      'offer_extended',
      'hired',
    ];

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: FORWARD_ORDER.length - 3 }),
        fc.integer({ min: 2, max: 6 }),
        (fromIdx, skip) => {
          const toIdx = fromIdx + skip;
          if (toIdx >= FORWARD_ORDER.length) return;
          const from = FORWARD_ORDER[fromIdx];
          const to = FORWARD_ORDER[toIdx];
          expect(isValidTransition(from, to)).toBe(false);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('valid transitions from the ordered list are exactly the next stage + rejected', () => {
    const FORWARD_ORDER: MatchStage[] = [
      'new_match',
      'skill_card_viewed',
      'interest_expressed',
      'interview_scheduled',
      'interview_completed',
      'offer_extended',
      'hired',
    ];

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: FORWARD_ORDER.length - 2 }),
        (fromIdx) => {
          const from = FORWARD_ORDER[fromIdx];
          const nextStage = FORWARD_ORDER[fromIdx + 1];

          // The next stage should be a valid transition
          expect(isValidTransition(from, nextStage)).toBe(true);

          // rejected should also be valid from non-terminal
          expect(isValidTransition(from, 'rejected')).toBe(true);

          // All other stages should be invalid
          const invalidTargets = ALL_STAGES.filter(
            (s) => s !== nextStage && s !== 'rejected' && s !== from
          );
          for (const target of invalidTargets) {
            expect(isValidTransition(from, target)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
