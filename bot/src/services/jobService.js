import { randomUUID } from 'node:crypto';

export class JobService {
  constructor({ store }) {
    this.store = store;
  }

  async matchJobs({ trade, district, limit = 3 }) {
    const jobs = await this.store.listJobs();
    const normalizedTrade = normalize(trade);
    const normalizedDistrict = normalize(district);

    const hardMatches = jobs
      .filter((job) => normalize(job.trade) === normalizedTrade)
      .filter((job) => matchesDistrict(job, normalizedDistrict) && withinDistance(job, 25))
      .sort(compareJobs);

    const expandedMatches = jobs
      .filter((job) => normalize(job.trade) === normalizedTrade)
      .filter((job) => matchesDistrict(job, normalizedDistrict) && withinDistance(job, 50))
      .sort(compareJobs);

    const fallbackTradeMatches = jobs
      .filter((job) => normalize(job.trade) === normalizedTrade)
      .sort(compareJobs);

    return uniqueJobs([...hardMatches, ...expandedMatches, ...fallbackTradeMatches]).slice(0, limit);
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
  const seen = new Set();
  return jobs.filter((job) => {
    if (seen.has(job.id)) return false;
    seen.add(job.id);
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
  return !jobDistrict || jobDistrict === normalizedDistrict || jobLocation.includes(normalizedDistrict);
}

function withinDistance(job, maxDistanceKm) {
  return !Number.isFinite(job.distanceKm) || job.distanceKm <= maxDistanceKm;
}
