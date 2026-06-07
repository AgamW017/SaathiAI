export class ExternalAiClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  async runTask(task, payload) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({ task, payload })
    });

    if (!response.ok) {
      throw new Error(`AI API failed with ${response.status}`);
    }

    return response.json();
  }
}
