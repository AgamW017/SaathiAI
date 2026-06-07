import { randomUUID } from 'node:crypto';

export class SkillCardService {
  constructor({ store, publicBaseUrl }) {
    this.store = store;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
  }

  async create({ phone, learner, collected }) {
    const id = randomUUID();
    const url = `${this.publicBaseUrl}/card/${id}`;
    const card = {
      id,
      phone,
      learnerId: learner.id,
      url,
      name: collected.name,
      trade: collected.trade,
      district: collected.district,
      state: collected.state,
      certificateType: collected.certificateType,
      skills: collected.skills ?? [],
      verificationStatus: 'self_reported',
      createdAt: new Date().toISOString()
    };
    await this.store.saveSkillCard(card);
    await this.store.upsertLearner(phone, {
      ...collected,
      skillCardId: id,
      cardUrl: url,
      placementStatus: 'CARD_READY'
    });
    return card;
  }
}
