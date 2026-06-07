import fs from 'node:fs/promises';
import path from 'node:path';

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

export class JsonStore {
  constructor({ dataDir, jobDataPath }) {
    this.dataDir = dataDir;
    this.jobDataPath = jobDataPath;
    this.paths = {
      sessions: path.join(dataDir, 'sessions.json'),
      learners: path.join(dataDir, 'learners.json'),
      skillCards: path.join(dataDir, 'skillCards.json'),
      applications: path.join(dataDir, 'applications.json'),
      events: path.join(dataDir, 'events.json')
    };
  }

  async init() {
    await ensureDir(this.dataDir);
    await Promise.all([
      writeJsonIfMissing(this.paths.sessions, {}),
      writeJsonIfMissing(this.paths.learners, {}),
      writeJsonIfMissing(this.paths.skillCards, {}),
      writeJsonIfMissing(this.paths.applications, []),
      writeJsonIfMissing(this.paths.events, [])
    ]);
  }

  async getSession(phone) {
    const sessions = await readJson(this.paths.sessions, {});
    return sessions[phone] ?? null;
  }

  async saveSession(session) {
    const sessions = await readJson(this.paths.sessions, {});
    sessions[session.phone] = { ...session, updatedAt: new Date().toISOString() };
    await writeJson(this.paths.sessions, sessions);
    return sessions[session.phone];
  }

  async getLearnerByPhone(phone) {
    const learners = await readJson(this.paths.learners, {});
    return learners[phone] ?? null;
  }

  async upsertLearner(phone, patch) {
    const learners = await readJson(this.paths.learners, {});
    const existing = learners[phone] ?? {
      id: `learner_${phone.replace(/\D/g, '') || Date.now()}`,
      phone,
      createdAt: new Date().toISOString()
    };
    const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined && value !== null));
    learners[phone] = {
      ...existing,
      ...cleanPatch,
      phone,
      updatedAt: new Date().toISOString()
    };
    await writeJson(this.paths.learners, learners);
    return learners[phone];
  }

  async saveSkillCard(card) {
    const cards = await readJson(this.paths.skillCards, {});
    cards[card.id] = card;
    await writeJson(this.paths.skillCards, cards);
    return card;
  }

  async getLatestSkillCardByPhone(phone) {
    const cards = await readJson(this.paths.skillCards, {});
    return (
      Object.values(cards)
        .filter((card) => card.phone === phone)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ?? null
    );
  }

  async getSkillCardById(id) {
    const cards = await readJson(this.paths.skillCards, {});
    return cards[id] ?? null;
  }

  async listJobs() {
    return readJson(this.jobDataPath, []);
  }

  async saveApplication(application) {
    const applications = await readJson(this.paths.applications, []);
    applications.push(application);
    await writeJson(this.paths.applications, applications);
    return application;
  }

  async appendEvent(event) {
    const events = await readJson(this.paths.events, []);
    events.push(event);
    await writeJson(this.paths.events, events);
    return event;
  }

  async recentEvents(limit = 50) {
    const events = await readJson(this.paths.events, []);
    return events.slice(-limit);
  }
}

async function writeJsonIfMissing(filePath, fallback) {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeJson(filePath, fallback);
  }
}
