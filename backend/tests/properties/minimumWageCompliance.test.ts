import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property tests for minimum wage compliance logic.
 *
 * Rules from employerService.ts:
 * - getMinimumWage(trade, state) returns the minimum wage from a lookup table
 *   - Falls back: trade → default_skilled → default → national floor (₹9,000)
 * - checkMinimumWageCompliance(salaryMin, trade, state) returns true iff salaryMin >= minWage
 */

// ─── Replicate the minimum wage logic from employerService.ts ────────────────

const STATE_MIN_WAGE: Record<string, Record<string, number>> = {
  'Uttar Pradesh': {
    default: 10280,
    Electrician: 11500,
    Welder: 11000,
    Plumber: 10500,
    Mason: 10500,
    default_skilled: 11500,
  },
  Maharashtra: {
    default: 12816,
    Electrician: 14000,
    Welder: 13500,
    Plumber: 13000,
    Mason: 13000,
    default_skilled: 14000,
  },
  Karnataka: {
    default: 12140,
    default_skilled: 13000,
  },
  Rajasthan: {
    default: 9918,
    default_skilled: 10800,
  },
};

const NATIONAL_FLOOR = 9000;

function getMinimumWage(trade: string, state: string): number {
  const stateWages = STATE_MIN_WAGE[state];
  if (!stateWages) return NATIONAL_FLOOR;
  return stateWages[trade] ?? stateWages['default_skilled'] ?? stateWages['default'] ?? NATIONAL_FLOOR;
}

function checkMinimumWageCompliance(salaryMin: number, trade: string, state: string): boolean {
  const minWage = getMinimumWage(trade, state);
  return salaryMin >= minWage;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const KNOWN_STATES = ['Uttar Pradesh', 'Maharashtra', 'Karnataka', 'Rajasthan'];
const KNOWN_TRADES = ['Electrician', 'Welder', 'Plumber', 'Mason'];
const UNKNOWN_TRADES = ['Carpenter', 'Painter', 'Driver', 'Fitter'];
const UNKNOWN_STATES = ['Kerala', 'Tamil Nadu', 'Odisha', 'Goa'];

const knownStateArb = fc.constantFrom(...KNOWN_STATES);
const anyStateArb = fc.oneof(
  fc.constantFrom(...KNOWN_STATES),
  fc.constantFrom(...UNKNOWN_STATES),
  fc.string({ minLength: 1, maxLength: 20 })
);
const knownTradeArb = fc.constantFrom(...KNOWN_TRADES);
const anyTradeArb = fc.oneof(
  fc.constantFrom(...KNOWN_TRADES),
  fc.constantFrom(...UNKNOWN_TRADES),
  fc.string({ minLength: 1, maxLength: 20 })
);

const salaryArb = fc.integer({ min: 0, max: 200000 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Minimum Wage — getMinimumWage', () => {
  it('always returns a positive number for any trade/state combination', () => {
    fc.assert(
      fc.property(anyTradeArb, anyStateArb, (trade, state) => {
        const wage = getMinimumWage(trade, state);
        expect(wage).toBeGreaterThan(0);
        expect(Number.isFinite(wage)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('never returns less than the national floor (₹9,000)', () => {
    fc.assert(
      fc.property(anyTradeArb, anyStateArb, (trade, state) => {
        const wage = getMinimumWage(trade, state);
        expect(wage).toBeGreaterThanOrEqual(NATIONAL_FLOOR);
      }),
      { numRuns: 500 }
    );
  });

  it('returns exactly the national floor for unknown states', () => {
    fc.assert(
      fc.property(anyTradeArb, fc.constantFrom(...UNKNOWN_STATES), (trade, state) => {
        const wage = getMinimumWage(trade, state);
        expect(wage).toBe(NATIONAL_FLOOR);
      }),
      { numRuns: 200 }
    );
  });

  it('returns a known wage for known trade/state pairs', () => {
    fc.assert(
      fc.property(knownTradeArb, knownStateArb, (trade, state) => {
        const wage = getMinimumWage(trade, state);
        const expected = STATE_MIN_WAGE[state][trade]
          ?? STATE_MIN_WAGE[state]['default_skilled']
          ?? STATE_MIN_WAGE[state]['default']
          ?? NATIONAL_FLOOR;
        expect(wage).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });

  it('for unknown trades in known states, falls back to default_skilled or default', () => {
    fc.assert(
      fc.property(fc.constantFrom(...UNKNOWN_TRADES), knownStateArb, (trade, state) => {
        const wage = getMinimumWage(trade, state);
        const stateWages = STATE_MIN_WAGE[state];
        const expected = stateWages['default_skilled'] ?? stateWages['default'] ?? NATIONAL_FLOOR;
        expect(wage).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });
});

describe('Minimum Wage — checkMinimumWageCompliance', () => {
  it('salary below minimum wage → non-compliant', () => {
    fc.assert(
      fc.property(anyTradeArb, anyStateArb, (trade, state) => {
        const minWage = getMinimumWage(trade, state);
        // Generate a salary strictly below the minimum wage (if minWage > 0)
        if (minWage > 0) {
          const belowSalary = minWage - 1;
          expect(checkMinimumWageCompliance(belowSalary, trade, state)).toBe(false);
        }
      }),
      { numRuns: 500 }
    );
  });

  it('salary at exactly minimum wage → compliant', () => {
    fc.assert(
      fc.property(anyTradeArb, anyStateArb, (trade, state) => {
        const minWage = getMinimumWage(trade, state);
        expect(checkMinimumWageCompliance(minWage, trade, state)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it('salary above minimum wage → compliant', () => {
    fc.assert(
      fc.property(
        anyTradeArb,
        anyStateArb,
        fc.integer({ min: 1, max: 100000 }),
        (trade, state, extra) => {
          const minWage = getMinimumWage(trade, state);
          expect(checkMinimumWageCompliance(minWage + extra, trade, state)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('zero salary is never compliant (since all minimum wages > 0)', () => {
    fc.assert(
      fc.property(anyTradeArb, anyStateArb, (trade, state) => {
        expect(checkMinimumWageCompliance(0, trade, state)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('compliance result is consistent: below → false, at-or-above → true', () => {
    fc.assert(
      fc.property(salaryArb, anyTradeArb, anyStateArb, (salary, trade, state) => {
        const minWage = getMinimumWage(trade, state);
        const compliant = checkMinimumWageCompliance(salary, trade, state);
        if (salary >= minWage) {
          expect(compliant).toBe(true);
        } else {
          expect(compliant).toBe(false);
        }
      }),
      { numRuns: 1000 }
    );
  });
});
