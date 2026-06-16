import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 7.5
 *
 * Property 17: MIS Report Breakdown Partitioning
 * For any MIS report, the employer-wise placement breakdown SHALL partition
 * placed learners such that each placed learner appears in exactly one employer
 * group, and the trade-wise distribution SHALL similarly partition all learners
 * by trade.
 */

// --- Types ---

interface PlacedLearner {
  learner_id: string;
  job_id: string;
}

interface Job {
  id: string;
  company: string;
}

interface Learner {
  id: string;
  trade: string | null;
}

interface EmployerBreakdownEntry {
  employer: string;
  count: number;
}

interface TradeDistributionEntry {
  trade: string;
  count: number;
}

// --- Pure computation functions (mirrors MISReportService logic) ---

/**
 * Compute employer-wise placement breakdown.
 * Each placed learner appears in exactly one employer group.
 * Uses a Set to ensure deduplication by learner_id (first placement wins).
 */
function computeEmployerBreakdown(
  placements: PlacedLearner[],
  jobs: Job[]
): EmployerBreakdownEntry[] {
  const jobMap = new Map<string, string>();
  for (const job of jobs) {
    jobMap.set(job.id, job.company);
  }

  const seen = new Set<string>();
  const employerCounts = new Map<string, number>();

  for (const placement of placements) {
    if (seen.has(placement.learner_id)) continue;
    seen.add(placement.learner_id);

    const company = jobMap.get(placement.job_id) ?? 'Unknown';
    employerCounts.set(company, (employerCounts.get(company) ?? 0) + 1);
  }

  return [...employerCounts.entries()]
    .map(([employer, count]) => ({ employer, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Compute trade-wise distribution.
 * Each learner appears in exactly one trade group.
 * Null trades are grouped as 'Unknown'.
 */
function computeTradeDistribution(
  learners: Learner[]
): TradeDistributionEntry[] {
  const tradeCounts = new Map<string, number>();

  for (const learner of learners) {
    const trade = learner.trade ?? 'Unknown';
    tradeCounts.set(trade, (tradeCounts.get(trade) ?? 0) + 1);
  }

  return [...tradeCounts.entries()]
    .map(([trade, count]) => ({ trade, count }))
    .sort((a, b) => b.count - a.count);
}

// --- Arbitraries ---

const learnerIdArb = fc.uuid();
const jobIdArb = fc.uuid();
const companyArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);
const tradeArb = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0)
);

/**
 * Generates a list of unique learner IDs with associated placements and jobs.
 * Each learner has exactly one job/employer assignment (unique learner_ids).
 */
const employerScenarioArb = fc
  .array(
    fc.record({
      learner_id: learnerIdArb,
      job_id: jobIdArb,
      company: companyArb,
    }),
    { minLength: 1, maxLength: 50 }
  )
  .map((entries) => {
    // Ensure unique learner IDs in the input set
    const seenLearners = new Set<string>();
    const uniqueEntries = entries.filter((e) => {
      if (seenLearners.has(e.learner_id)) return false;
      seenLearners.add(e.learner_id);
      return true;
    });

    const placements: PlacedLearner[] = uniqueEntries.map((e) => ({
      learner_id: e.learner_id,
      job_id: e.job_id,
    }));

    // Ensure unique job IDs map to company names
    const jobMap = new Map<string, string>();
    for (const e of uniqueEntries) {
      if (!jobMap.has(e.job_id)) {
        jobMap.set(e.job_id, e.company);
      }
    }
    const jobs: Job[] = [...jobMap.entries()].map(([id, company]) => ({
      id,
      company,
    }));

    return { placements, jobs, uniqueLearnerCount: uniqueEntries.length };
  });

/**
 * Generates placements that may have duplicate learner_ids (multiple placements
 * per learner) to test that the deduplication logic works correctly.
 */
const duplicatePlacementScenarioArb = fc
  .record({
    learnerIds: fc.array(learnerIdArb, { minLength: 1, maxLength: 20 }),
    jobIds: fc.array(jobIdArb, { minLength: 1, maxLength: 10 }),
    companies: fc.array(companyArb, { minLength: 1, maxLength: 10 }),
  })
  .chain(({ learnerIds, jobIds, companies }) => {
    // Create jobs from jobIds and companies
    const jobs: Job[] = jobIds.map((id, i) => ({
      id,
      company: companies[i % companies.length],
    }));

    // Generate placements that reuse learner IDs (simulating multiple placements)
    return fc
      .array(
        fc.record({
          learner_id: fc.constantFrom(...learnerIds),
          job_id: fc.constantFrom(...jobIds),
        }),
        { minLength: 1, maxLength: 50 }
      )
      .map((placements) => ({
        placements,
        jobs,
        uniqueLearnerIds: new Set(placements.map((p) => p.learner_id)),
      }));
  });

const learnerListArb = fc.array(
  fc.record({ id: learnerIdArb, trade: tradeArb }),
  { minLength: 1, maxLength: 50 }
);

// --- Tests ---

describe('Property 17: MIS Report Breakdown Partitioning', () => {
  describe('Employer-wise placement breakdown', () => {
    it('sum of all employer group counts equals total unique placed learners', () => {
      fc.assert(
        fc.property(employerScenarioArb, ({ placements, jobs, uniqueLearnerCount }) => {
          const breakdown = computeEmployerBreakdown(placements, jobs);
          const totalInBreakdown = breakdown.reduce((sum, entry) => sum + entry.count, 0);
          expect(totalInBreakdown).toBe(uniqueLearnerCount);
        }),
        { numRuns: 200 }
      );
    });

    it('each placed learner appears in exactly one employer group (no duplicates, no omissions)', () => {
      fc.assert(
        fc.property(
          duplicatePlacementScenarioArb,
          ({ placements, jobs, uniqueLearnerIds }) => {
            const breakdown = computeEmployerBreakdown(placements, jobs);
            const totalInBreakdown = breakdown.reduce(
              (sum, entry) => sum + entry.count,
              0
            );
            // Total in breakdown equals the number of unique learner IDs
            expect(totalInBreakdown).toBe(uniqueLearnerIds.size);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('breakdown entries have non-zero counts and cover all employers represented', () => {
      fc.assert(
        fc.property(employerScenarioArb, ({ placements, jobs }) => {
          const breakdown = computeEmployerBreakdown(placements, jobs);
          // Every entry must have count > 0
          for (const entry of breakdown) {
            expect(entry.count).toBeGreaterThan(0);
          }
          // No duplicate employer names in the breakdown
          const employers = breakdown.map((e) => e.employer);
          expect(new Set(employers).size).toBe(employers.length);
        }),
        { numRuns: 200 }
      );
    });
  });

  describe('Trade-wise distribution', () => {
    it('sum of all trade group counts equals total learners', () => {
      fc.assert(
        fc.property(learnerListArb, (learners) => {
          const distribution = computeTradeDistribution(learners);
          const totalInDistribution = distribution.reduce(
            (sum, entry) => sum + entry.count,
            0
          );
          expect(totalInDistribution).toBe(learners.length);
        }),
        { numRuns: 200 }
      );
    });

    it('each learner appears in exactly one trade group', () => {
      fc.assert(
        fc.property(learnerListArb, (learners) => {
          const distribution = computeTradeDistribution(learners);

          // Manually verify: for each learner, its effective trade exists as a group
          const tradeCountsManual = new Map<string, number>();
          for (const learner of learners) {
            const trade = learner.trade ?? 'Unknown';
            tradeCountsManual.set(trade, (tradeCountsManual.get(trade) ?? 0) + 1);
          }

          // Distribution should match the manual count exactly
          expect(distribution.length).toBe(tradeCountsManual.size);
          for (const entry of distribution) {
            expect(entry.count).toBe(tradeCountsManual.get(entry.trade));
          }
        }),
        { numRuns: 200 }
      );
    });

    it('distribution entries have non-zero counts and no duplicate trade names', () => {
      fc.assert(
        fc.property(learnerListArb, (learners) => {
          const distribution = computeTradeDistribution(learners);
          for (const entry of distribution) {
            expect(entry.count).toBeGreaterThan(0);
          }
          const trades = distribution.map((e) => e.trade);
          expect(new Set(trades).size).toBe(trades.length);
        }),
        { numRuns: 200 }
      );
    });

    it('null trades are grouped under "Unknown"', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({ id: learnerIdArb, trade: fc.constant(null) }),
            { minLength: 1, maxLength: 20 }
          ),
          (learners) => {
            const distribution = computeTradeDistribution(learners);
            expect(distribution.length).toBe(1);
            expect(distribution[0].trade).toBe('Unknown');
            expect(distribution[0].count).toBe(learners.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
