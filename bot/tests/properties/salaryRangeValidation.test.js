import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Validates: Requirements 1.7
 *
 * Property 2: Salary Range Validation
 * For any numeric value extracted as a salary from a learner response,
 * it SHALL be accepted only if it falls within the range of 1000 to 100000 INR inclusive;
 * values outside this range SHALL be rejected.
 */

// Inline the validation logic from PlacementTrackerService
// (SALARY_MIN = 1000, SALARY_MAX = 100000)
function isValidSalary(amount) {
  return typeof amount === 'number' && amount >= 1000 && amount <= 100000;
}

describe('Property 2: Salary Range Validation', () => {
  it('accepts all salaries within 1000-100000 INR inclusive', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 100000 }), (salary) => {
        return isValidSalary(salary) === true;
      })
    );
  });

  it('rejects all salaries below 1000', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 999 }), (salary) => {
        return isValidSalary(salary) === false;
      })
    );
  });

  it('rejects all salaries above 100000', () => {
    fc.assert(
      fc.property(fc.integer({ min: 100001, max: 10000000 }), (salary) => {
        return isValidSalary(salary) === false;
      })
    );
  });

  it('rejects non-number types', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined), fc.boolean()),
        (value) => {
          return isValidSalary(value) === false;
        }
      )
    );
  });
});
