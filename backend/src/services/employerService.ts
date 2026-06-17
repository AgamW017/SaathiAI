import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { supabase } from '../db/client.js';
import type {
  EmployerRow,
  VacancyRow,
  MatchRow,
  MatchStage,
  VacancyStatus,
} from '../db/types.js';

// ─── Mock Config ──────────────────────────────────────────────────────────────

const MOCK_EXTERNAL = process.env.MOCK_EXTERNAL_APIS !== 'false';

// ─── State Minimum Wage Table (mocked, INR/month) ────────────────────────────

const STATE_MIN_WAGE: Record<string, Record<string, number>> = {
  'Uttar Pradesh': {
    default: 10280,
    Electrician: 11500,
    Welder: 11000,
    Plumber: 10500,
    Mason: 10500,
    default_skilled: 11500,
  },
  'Maharashtra': {
    default: 12816,
    Electrician: 14000,
    Welder: 13500,
    Plumber: 13000,
    Mason: 13000,
    default_skilled: 14000,
  },
  'Karnataka': {
    default: 12140,
    default_skilled: 13000,
  },
  'Rajasthan': {
    default: 9918,
    default_skilled: 10800,
  },
};

/**
 * Returns the monthly minimum wage in INR for a given trade + state.
 * Falls back to state default, then national floor of ₹9,000.
 */
export function getMinimumWage(trade: string, state: string): number {
  const stateWages = STATE_MIN_WAGE[state];
  if (!stateWages) return 9000;
  return stateWages[trade] ?? stateWages['default_skilled'] ?? stateWages['default'] ?? 9000;
}

/**
 * Check if salary_min meets the state minimum wage for a given trade.
 */
export function checkMinimumWageCompliance(
  salaryMin: number,
  trade: string,
  state: string
): boolean {
  const minWage = getMinimumWage(trade, state);
  return salaryMin >= minWage;
}

// ─── Udyam Verification (mocked) ─────────────────────────────────────────────

export interface UdyamVerificationResult {
  valid: boolean;
  company_name?: string;
  trade_categories?: string[];
  total_employees?: number;
  district?: string;
  state?: string;
  gstin?: string;
}

/**
 * Mock Udyam API verification.
 * In production, call https://udyamregistration.gov.in or the NIC Udyam API.
 */
export async function verifyUdyam(udyamNumber: string): Promise<UdyamVerificationResult> {
  if (MOCK_EXTERNAL) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 300));

    // Any valid-format Udyam number passes
    const valid = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(udyamNumber);
    if (!valid) return { valid: false };

    return {
      valid: true,
      company_name: 'Mock Enterprises Pvt Ltd',
      trade_categories: ['Electrician', 'Welder'],
      total_employees: 12,
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      gstin: '09AABCU9603R1Z5',
    };
  }

  // TODO: Real Udyam API call
  throw new Error('Real Udyam API not configured. Set MOCK_EXTERNAL_APIS=false only when ready.');
}

// ─── NAPS Registration (mocked) ──────────────────────────────────────────────

export interface NapsRegistrationResult {
  success: boolean;
  registration_ref?: string;
  error?: string;
}

/**
 * Mock NAPS portal submission.
 * In production, call NAPS portal API via MSDE.
 */
export async function submitNapsRegistration(
  udyamNumber: string,
  companyName: string,
  employeeCount: number
): Promise<NapsRegistrationResult> {
  if (MOCK_EXTERNAL) {
    await new Promise(r => setTimeout(r, 500));
    const ref = `NAPS-${Date.now()}-MOCK`;
    return { success: true, registration_ref: ref };
  }
  throw new Error('Real NAPS API not configured.');
}

/**
 * Check NAPS eligibility: ≥4 employees → eligible for 1 apprentice per 4 employees.
 */
export function getNapsEligibility(totalEmployees: number): {
  eligible: boolean;
  maxApprentices: number;
  stipendPerApprentice: number;
  annualSavings: number;
} {
  const eligible = totalEmployees >= 4;
  const maxApprentices = eligible ? Math.floor(totalEmployees / 4) : 0;
  const stipendPerApprentice = 1500; // ₹1,500/month government reimbursement
  const annualSavings = maxApprentices * stipendPerApprentice * 12;
  return { eligible, maxApprentices, stipendPerApprentice, annualSavings };
}

// ─── Skill Card Token ─────────────────────────────────────────────────────────

const SKILL_CARD_SECRET = config.jwt.secret + ':skill_card';

export interface SkillCardTokenPayload {
  match_id: string;
  employer_id: string;
  learner_id: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a 30-day skill card JWT tied to a specific match + employer.
 */
export function signSkillCardToken(payload: Omit<SkillCardTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, SKILL_CARD_SECRET, { expiresIn: '30d' });
}

/**
 * Verify and decode a skill card token.
 * Throws if expired or invalid.
 */
export function verifySkillCardToken(token: string): SkillCardTokenPayload {
  return jwt.verify(token, SKILL_CARD_SECRET) as SkillCardTokenPayload;
}

// ─── Employer Risk Score ──────────────────────────────────────────────────────

/**
 * Compute employer_risk_score (0–100, lower is less risky).
 * Scoring factors:
 *   - Udyam verified: -30 points (reduces risk)
 *   - Account tenure > 90 days: -10 points
 *   - Dropout rate from hired matches: +2 per dropout in last 6 months
 *   - Open complaints (flags): +10 per flagged vacancy
 */
export async function computeEmployerRiskScore(employerId: string): Promise<number> {
  const { data: employer } = await (supabase as any)
    .from('employers')
    .select('verification_status, created_at')
    .eq('id', employerId)
    .single();

  const { data: matches } = await (supabase as any)
    .from('matches')
    .select('stage')
    .eq('employer_id', employerId);

  const { data: vacancies } = await (supabase as any)
    .from('vacancies')
    .select('status')
    .eq('employer_id', employerId);

  let score = 50; // baseline

  if (employer?.verification_status === 'udyam_verified' ||
      employer?.verification_status === 'fully_verified') {
    score -= 30;
  }

  const tenureDays = employer?.created_at
    ? (Date.now() - new Date(employer.created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  if (tenureDays > 90) score -= 10;

  const hiredCount = (matches ?? []).filter((m: MatchRow) => m.stage === 'hired').length;
  const rejectedCount = (matches ?? []).filter((m: MatchRow) => m.stage === 'rejected').length;
  if (hiredCount > 0) {
    const dropoutRate = rejectedCount / (hiredCount + rejectedCount);
    score += Math.round(dropoutRate * 20);
  }

  const flaggedCount = (vacancies ?? []).filter((v: VacancyRow) => v.status === 'flagged').length;
  score += flaggedCount * 10;

  return Math.max(0, Math.min(100, score));
}

// ─── Vacancy Pipeline Transitions ─────────────────────────────────────────────

/** Valid transitions in the pipeline — allows any move except out of 'hired' */
const VALID_TRANSITIONS: Record<MatchStage, MatchStage[]> = {
  // Complete transition map — every possibility explicitly defined
  new_match:            ['skill_card_viewed', 'interest_expressed', 'interview_scheduled', 'rejected'],
  skill_card_viewed:    ['interest_expressed', 'interview_scheduled', 'rejected'],
  interest_expressed:   ['skill_card_viewed', 'interview_scheduled', 'offer_extended', 'rejected'],
  interview_scheduled:  ['interest_expressed', 'offer_extended', 'hired', 'rejected'],
  interview_completed:  ['interview_scheduled', 'offer_extended', 'hired', 'rejected'], // legacy — same as interview_scheduled
  offer_extended:       ['interview_scheduled', 'hired', 'rejected'],
  hired:                [],
  rejected:             ['new_match', 'skill_card_viewed', 'interest_expressed'],
};

export function isValidTransition(from: MatchStage, to: MatchStage): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Append a timeline event to a match's JSONB timeline array.
 */
export function appendTimelineEvent(
  existingTimeline: unknown,
  stage: MatchStage,
  actor: string,
  note?: string
): object[] {
  const timeline = Array.isArray(existingTimeline) ? existingTimeline : [];
  return [
    ...timeline,
    {
      stage,
      timestamp: new Date().toISOString(),
      actor,
      note: note ?? null,
    },
  ];
}
