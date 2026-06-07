export class RuntimeStats {
  constructor() {
    this.totalMessages = 0;
    this.apiCalls = 0;
    this.sentMessages = 0;
    this.startTime = Date.now();
    this.status = 'starting';
  }

  incrementMessages() {
    this.totalMessages += 1;
  }

  incrementSentMessages(count = 1) {
    this.sentMessages += count;
  }

  incrementApiCalls() {
    this.apiCalls += 1;
  }

  setStatus(status) {
    this.status = status;
  }

  snapshot() {
    return {
      totalMessages: this.totalMessages,
      sentMessages: this.sentMessages,
      apiCalls: this.apiCalls,
      startTime: this.startTime,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      status: this.status
    };
  }
}
