export class BotStore {
  constructor({ runtimeStore, backendStore }) {
    this.runtimeStore = runtimeStore;
    this.backendStore = backendStore;
  }

  async init() {
    await this.runtimeStore.init();
    await this.backendStore.init();
  }

  async getSession(phone) {
    return (await this.runtimeStore.getSession(phone)) ?? this.backendStore.getSession(phone);
  }

  async saveSession(session) {
    const [runtimeSession] = await Promise.all([this.runtimeStore.saveSession(session), this.backendStore.saveSession(session)]);
    return runtimeSession;
  }

  async getLearnerByPhone(phone) {
    return this.backendStore.getLearnerByPhone(phone);
  }

  async upsertLearner(phone, patch) {
    return this.backendStore.upsertLearner(phone, patch);
  }

  async saveSkillCard(card) {
    return this.backendStore.saveSkillCard(card);
  }

  async getLatestSkillCardByPhone(phone) {
    return this.backendStore.getLatestSkillCardByPhone(phone);
  }

  async getSkillCardById(id) {
    return this.backendStore.getSkillCardById(id);
  }

  async listJobs() {
    return this.backendStore.listJobs();
  }

  async saveApplication(application) {
    return this.backendStore.saveApplication(application);
  }

  async appendEvent(event) {
    return this.backendStore.appendEvent(event);
  }

  async recentEvents(limit = 50) {
    return this.backendStore.recentEvents(limit);
  }

  async query(sql, params = []) {
    return this.backendStore.query(sql, params);
  }

  async queryOne(sql, params = []) {
    return this.backendStore.queryOne(sql, params);
  }
}
