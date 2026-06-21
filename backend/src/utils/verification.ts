// Shared helpers for employer verification tiers and salary-discrepancy detection.
// Used across dashboard + employer routers so badges and red-flags stay consistent.

export type EmployerVerificationStatus =
  | 'unverified'
  | 'phone_verified'
  | 'udyam_verified'
  | 'aadhaar_verified'
  | 'entitylocker_verified'
  | 'fully_verified';

export interface VerificationTier {
  status: EmployerVerificationStatus;
  label: string;
  /** 0 = unverified … 4 = fully verified. Higher = more trustworthy. */
  rank: number;
  /** Short tag for compact UI / WhatsApp. */
  short: string;
}

const TIERS: Record<EmployerVerificationStatus, VerificationTier> = {
  unverified: { status: 'unverified', label: 'Unverified employer', rank: 0, short: 'Unverified' },
  phone_verified: { status: 'phone_verified', label: 'Phone verified', rank: 1, short: 'Phone ✓' },
  udyam_verified: { status: 'udyam_verified', label: 'Udyam (MSME) verified', rank: 2, short: 'Udyam ✓' },
  aadhaar_verified: { status: 'aadhaar_verified', label: 'Aadhaar verified', rank: 3, short: 'Aadhaar ✓' },
  entitylocker_verified: { status: 'entitylocker_verified', label: 'EntityLocker verified', rank: 3, short: 'EntityLocker ✓' },
  fully_verified: { status: 'fully_verified', label: 'Fully verified', rank: 4, short: 'Verified ✓✓' },
};

export function verificationTier(status?: string | null): VerificationTier {
  return TIERS[(status as EmployerVerificationStatus)] ?? TIERS.unverified;
}

/** Salary is flagged when reported pay falls more than this fraction below the claim. */
export const SALARY_DISCREPANCY_THRESHOLD = 0.1; // >10% below claim → red flag

export interface SalaryDiscrepancy {
  claimed: number | null;
  reported: number | null;
  /** reported - claimed (negative = shortfall). null when not comparable. */
  delta: number | null;
  /** fractional shortfall vs claim, e.g. 0.25 = 25% below. null when not comparable. */
  shortfallPct: number | null;
  flagged: boolean;
}

/**
 * Compare the salary claimed at hire against the latest bot-captured salary.
 * `reported` should be current_salary ?? salary_reported.
 */
export function computeSalaryDiscrepancy(
  claimed: number | null | undefined,
  reported: number | null | undefined,
): SalaryDiscrepancy {
  const c = claimed != null ? Number(claimed) : null;
  const r = reported != null ? Number(reported) : null;
  if (c == null || r == null || c <= 0) {
    return { claimed: c, reported: r, delta: null, shortfallPct: null, flagged: false };
  }
  const delta = r - c;
  const shortfallPct = (c - r) / c;
  return {
    claimed: c,
    reported: r,
    delta,
    shortfallPct,
    flagged: shortfallPct > SALARY_DISCREPANCY_THRESHOLD,
  };
}
