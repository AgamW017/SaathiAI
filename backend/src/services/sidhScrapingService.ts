/**
 * SIDH Job Service
 *
 * Pipeline:
 *   1. classifySector(jobTitle) — Groq maps job title → SIDH sector name
 *   2. fetchJobsFromApi(sector, state) — direct POST to SIDH's internal JSON API,
 *      returns structured job data including the UUID needed for the detail link
 *   3. fetchJobsForLearner(jobTitle, state) — combines both steps
 *
 * The SIDH detail link pattern is:
 *   https://www.skillindiadigital.gov.in/job/detail/{Id}
 */

import { llmService } from './llmService.js';
import { logger } from '../config/logger.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDH_API_URL = 'https://api-fe.skillindiadigital.gov.in/api/jobs/filter';
const SIDH_DETAIL_BASE = 'https://www.skillindiadigital.gov.in/job/detail';

// ─── Sector list ──────────────────────────────────────────────────────────────
// These are the exact sector names accepted by the SIDH API's Sector filter field.
export const SIDH_SECTORS = [
  'Agriculture',
  'Aerospace & Aviation',
  'Automotive',
  'Banking, Financial Services & Insurance (BFSI)',
  'Beauty & Wellness',
  'Capital Goods',
  'Chemical & Petrochemical',
  'Construction',
  'Domestic Workers',
  'Education',
  'Electronics & Hardware',
  'Food Processing',
  'Furniture & Fittings',
  'Gems & Jewellery',
  'Green Jobs',
  'Handicrafts & Carpet',
  'Healthcare',
  'Infrastructure Equipment',
  'Iron & Steel',
  'IT-ITeS',
  'Leather',
  'Life Sciences',
  'Logistics',
  'Management & Entrepreneurship',
  'Manufacturing',
  'Media & Entertainment',
  'Mining',
  'Paints & Coatings',
  'Plumbing',
  'Power',
  'Retail',
  'Rubber',
  'Security',
  'Sports, Physical Education, Fitness & Leisure',
  'Telecom',
  'Textile & Apparel',
  'Tourism & Hospitality',
  'Transportation & Logistics',
] as const;

export type SidhSector = (typeof SIDH_SECTORS)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SidhJob {
  sidhId: string | null;        // UUID from the API — used to build detailUrl
  detailUrl: string | null;     // https://www.skillindiadigital.gov.in/job/detail/{sidhId}
  title: string | null;
  company: string | null;
  source: string | null;        // SourceSystem from API (e.g. "NSDC JobX", "NCS")
  venue: string | null;         // District-level location
  date: string | null;          // PostedOn formatted as DD Mon YYYY
  location: string | null;      // State
  sector: string | null;
  joiningType: string | null;
  salaryText: string | null;
  vacancyCount: number | null;
  minEduQual: string | null;
}

export interface SidhSearchResult {
  sector: string;
  jobs: SidhJob[];
}

// ─── Raw API response shape (partial) ─────────────────────────────────────────

interface SidhApiResult {
  Id: string;
  JobTitle: string;
  CompanyName: string;
  MinCtcMonthly: number | null;
  MaxCtcMonthly: number | null;
  PostedOn: string | null;
  SectorName: string | null;
  JoiningPriority: string | null;
  JobLocations: string | null;
  JobLocationState: string | null;
  JobLocationDistrict: string | null;
  SourceSystem: string | null;
  SourceId: string | null;
  VacancyCount: string | null;
  MinEduQual: string | null;
}

interface SidhApiResponse {
  IsSuccess: boolean;
  Data?: {
    Results?: SidhApiResult[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  if (min && max && min !== max) return `${fmt(min)} - ${fmt(max)} / month`;
  if (min) return `${fmt(min)} / month`;
  if (max) return `${fmt(max)} / month`;
  return null;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// ─── Sector classification ────────────────────────────────────────────────────

export async function classifySector(jobTitle: string): Promise<string> {
  const prompt = `You are a job sector classifier for India's Skill India Digital Hub (SIDH).

Given a job title or trade, return ONLY the single most relevant sector name from this exact list (copy it verbatim, no extra text):

${SIDH_SECTORS.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Job title / trade: "${jobTitle}"

Respond with only the sector name, nothing else.`;

  let raw: string;
  try {
    raw = await llmService.generateContent(prompt);
  } catch (err) {
    logger.warn({ err, jobTitle }, 'LLM sector classification failed, defaulting to Manufacturing');
    return 'Manufacturing';
  }

  const cleaned = raw.trim().replace(/^["']|["']$/g, '');

  const exact = SIDH_SECTORS.find(s => s.toLowerCase() === cleaned.toLowerCase());
  if (exact) return exact;

  const partial = SIDH_SECTORS.find(
    s => s.toLowerCase().includes(cleaned.toLowerCase()) || cleaned.toLowerCase().includes(s.toLowerCase())
  );
  if (partial) return partial;

  logger.warn({ cleaned, jobTitle }, 'Could not map LLM response to a SIDH sector, defaulting to Manufacturing');
  return 'Manufacturing';
}

// ─── SIDH API call ────────────────────────────────────────────────────────────

export async function fetchJobsFromApi(
  sector: string,
  state: string,
  pageSize = 18,
  pageNumber = 1
): Promise<SidhJob[]> {
  logger.info({ sector, state, pageSize }, 'Calling SIDH jobs API');

  const resp = await fetch(SIDH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'language': 'en',
      'accept': 'application/json, text/plain, */*',
      'referer': 'https://www.skillindiadigital.gov.in/',
      'origin': 'https://www.skillindiadigital.gov.in',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      PageSize: pageSize,
      PageNumber: pageNumber,
      JobStatus: 'Active',
      State: [state],
      Sector: [sector],
      SearchString: '',
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    throw new Error(`SIDH API returned HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as SidhApiResponse;

  if (!data.IsSuccess || !data.Data?.Results) {
    logger.info({ sector, state }, 'SIDH API returned no results');
    return [];
  }

  const jobs: SidhJob[] = data.Data.Results.map((r) => ({
    sidhId: r.Id ?? null,
    detailUrl: r.Id ? `${SIDH_DETAIL_BASE}/${r.Id}` : null,
    title: r.JobTitle ?? null,
    company: r.CompanyName ?? null,
    source: r.SourceSystem ?? r.SourceId ?? 'Skill India Digital Hub',
    venue: r.JobLocationDistrict ?? r.JobLocations ?? null,
    date: formatDate(r.PostedOn),
    location: r.JobLocationState ?? state,
    sector: r.SectorName ?? sector,
    joiningType: r.JoiningPriority ?? null,
    salaryText: formatSalary(r.MinCtcMonthly, r.MaxCtcMonthly),
    vacancyCount: r.VacancyCount ? parseInt(r.VacancyCount, 10) || null : null,
    minEduQual: r.MinEduQual && r.MinEduQual !== 'NA' ? r.MinEduQual : null,
  }));

  logger.info({ count: jobs.length, sector, state }, 'SIDH API fetch complete');
  return jobs;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchJobsForLearner(
  jobTitle: string,
  state: string,
  pageSize = 18
): Promise<SidhSearchResult> {
  const sector = await classifySector(jobTitle);
  logger.info({ jobTitle, sector, state }, 'Classified sector, calling SIDH API');
  const jobs = await fetchJobsFromApi(sector, state, pageSize);
  return { sector, jobs };
}
