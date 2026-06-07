import { randomUUID } from 'node:crypto';

export class EventLog {
  constructor(store) {
    this.store = store;
  }

  async record({ learnerId, phone, eventType, stepBefore, stepAfter, metadata = {} }) {
    return this.store.appendEvent({
      id: randomUUID(),
      learnerId: learnerId ?? null,
      phone,
      timestamp: new Date().toISOString(),
      eventType,
      stepBefore,
      stepAfter,
      metadata
    });
  }
}
