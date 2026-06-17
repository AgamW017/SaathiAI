import { randomUUID } from 'node:crypto';

export class JobService {
  constructor({ store }) {
    this.store = store;
  }

  async matchJobs({ trade, district, limit = 50 }) {
    const jobs = await this.store.listJobs();

    // Also query active vacancies from the employer portal
    // Use ILIKE for fuzzy trade matching at SQL level
    let vacancies = [];
    try {
      const tradePattern = `%${(trade ?? '').trim()}%`;
      const rows = await this.store.query(
        `SELECT v.id, v.title, v.trade_required, v.salary_min, v.salary_max, v.district, v.state, v.openings, v.naps_eligible, v.created_at,
                e.company_name
         FROM vacancies v
         LEFT JOIN employers e ON e.id = v.employer_id
         WHERE v.status = 'active'
         ORDER BY v.created_at DESC`
      );
      vacancies = (rows ?? []).map((r) => ({
        id: r.id,
        role: r.title,
        trade: r.trade_required,
        employerName: r.company_name ?? 'Employer',
        salaryMin: r.salary_min,
        salaryMax: r.salary_max,
        district: r.district ?? '',
        location: r.district ?? '',
        state: r.state ?? '',
        openings: r.openings ?? 1,
        type: r.naps_eligible ? 'apprenticeship' : 'regular',
        verified: true,
        distanceKm: null,
        postedText: timeAgo(r.created_at),
        is_active: true,
      }));
    } catch (err) {
      // If vacancies table doesn't exist yet, just continue with jobs table
      console.error('[JobService] Vacancies query failed:', err.message);
    }

    const allJobs = uniqueJobs([...vacancies, ...jobs]);
    // Support multiple trades (comma-separated in the trade field)
    const learnerTrades = (trade ?? '').split(',').map(t => normalize(t.trim())).filter(Boolean);
    const normalizedDistrict = normalize(district);

    // Only filter by trade — location is used for sorting priority, not exclusion
    // Match against both trade_required AND job title, for ANY of learner's trades
    const tradeMatched = allJobs.filter((job) => 
      learnerTrades.some(lt => tradeMatches(job.trade, lt) || tradeMatches(job.role, lt))
    );

    // Sort: local jobs first, then rest
    const local = tradeMatched.filter((job) => locationMatches(job, normalizedDistrict));
    const remote = tradeMatched.filter((job) => !locationMatches(job, normalizedDistrict));

    const result = uniqueJobs([...local, ...remote]).slice(0, limit);
    const vacancyTrades = vacancies.map(v => v.trade).join(', ');
    console.log(`[JobService] matchJobs: learnerTrades="${learnerTrades.join(', ')}" learnerDistrict="${district}" | vacancies=${vacancies.length} (trades: ${vacancyTrades}) jobs=${jobs.length} | tradeMatched=${tradeMatched.length} local=${local.length} total=${result.length}`);
    return result;
  }

  async apply({ phone, learnerId, job, cardUrl }) {
    return this.store.saveApplication({
      id: randomUUID(),
      phone,
      learnerId,
      jobId: job.id,
      employerName: job.employerName,
      cardUrl,
      status: 'interested',
      createdAt: new Date().toISOString()
    });
  }
}

function compareJobs(a, b) {
  const distanceA = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.MAX_SAFE_INTEGER;
  const distanceB = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.MAX_SAFE_INTEGER;
  if (distanceA !== distanceB) return distanceA - distanceB;

  const salaryA = Number.isFinite(a.salaryMax) ? a.salaryMax : 0;
  const salaryB = Number.isFinite(b.salaryMax) ? b.salaryMax : 0;
  if (salaryA !== salaryB) return salaryB - salaryA;

  return Number(b.verified) - Number(a.verified);
}

function uniqueJobs(jobs) {
  const seenIds = new Set();
  return jobs.filter((job) => {
    // Dedupe by ID only — each job/vacancy has a unique ID
    const key = job.id ?? `${normalize(job.role)}|${normalize(job.employerName)}|${normalize(job.location || job.district)}|${job.salaryMin ?? ''}`;
    if (seenIds.has(key)) return false;
    seenIds.add(key);
    return true;
  });
}

function normalize(value = '') {
  return value.toString().trim().toLowerCase();
}

function matchesDistrict(job, normalizedDistrict) {
  if (!normalizedDistrict) return true;
  const jobDistrict = normalize(job.district);
  const jobLocation = normalize(job.location);
  if (!jobDistrict && !jobLocation) return true;
  return jobDistrict === normalizedDistrict || jobDistrict.includes(normalizedDistrict) || normalizedDistrict.includes(jobDistrict) || jobLocation.includes(normalizedDistrict);
}

/**
 * Location matching that handles:
 * - District to district (exact or substring)
 * - State to state
 */
function locationMatches(job, normalizedLearnerLocation) {
  if (!normalizedLearnerLocation) return true;

  const jobDistrict = normalize(job.district);
  const jobLocation = normalize(job.location);
  const jobState = normalize(job.state ?? '');

  // No location data on job = matches everyone
  if (!jobDistrict && !jobLocation && !jobState) return true;

  // Direct match on any location field
  if (jobDistrict === normalizedLearnerLocation) return true;
  if (jobLocation === normalizedLearnerLocation) return true;
  if (jobState === normalizedLearnerLocation) return true;

  if (jobDistrict && (jobDistrict.includes(normalizedLearnerLocation) || normalizedLearnerLocation.includes(jobDistrict))) return true;
  if (jobLocation && (jobLocation.includes(normalizedLearnerLocation) || normalizedLearnerLocation.includes(jobLocation))) return true;
  if (jobState && (jobState.includes(normalizedLearnerLocation) || normalizedLearnerLocation.includes(jobState))) return true;

  return false;
}

/**
 * Fuzzy trade matching — handles cases like:
 * "Electrician" vs "Electrical", "Fitter" vs "Fitter", "COPA" vs "copa"
 * Uses substring inclusion both ways to handle partial matches.
 */
function tradeMatches(jobTrade, normalizedLearnerTrade) {
  const normalizedJobTrade = normalize(jobTrade);
  if (!normalizedJobTrade || !normalizedLearnerTrade) return false;

  // Exact match
  if (normalizedJobTrade === normalizedLearnerTrade) return true;

  // One contains the other (handles "electrician" in "electrical" or vice versa)
  if (normalizedJobTrade.includes(normalizedLearnerTrade) || normalizedLearnerTrade.includes(normalizedJobTrade)) return true;

  // First 5 chars match (handles "elect..." matching "electrician"/"electrical")
  if (normalizedJobTrade.length >= 5 && normalizedLearnerTrade.length >= 5) {
    if (normalizedJobTrade.slice(0, 5) === normalizedLearnerTrade.slice(0, 5)) return true;
  }

  return false;
}

function withinDistance(job, maxDistanceKm) {
  return !Number.isFinite(job.distanceKm) || job.distanceKm <= maxDistanceKm;
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Recently';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
