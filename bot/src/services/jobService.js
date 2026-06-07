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
      .filter((job) => normalize(job.district) === normalizedDistrict && job.distanceKm <= 25)
      .sort(compareJobs);

    const expandedMatches = jobs
      .filter((job) => normalize(job.trade) === normalizedTrade)
      .filter((job) => normalize(job.district) === normalizedDistrict && job.distanceKm <= 50)
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
  if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
  if (a.salaryMax !== b.salaryMax) return b.salaryMax - a.salaryMax;
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
