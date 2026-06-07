import { SarvamAIClient } from 'sarvamai';

export class TranscriptionService {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.lastError = null;
    this.client = config.apiKey
      ? new SarvamAIClient({
          apiSubscriptionKey: config.apiKey
        })
      : null;
  }

  isConfigured() {
    return Boolean(this.client);
  }

  getStatus() {
    if (!this.config.apiKey) {
      return {
        configured: false,
        reason: 'SARVAM_API_KEY is missing'
      };
    }

    return {
      configured: true,
      reason: null
    };
  }

  getLastError() {
    return this.lastError;
  }

  async transcribe(media) {
    this.lastError = null;

    if (!this.isConfigured()) {
      this.lastError = this.getStatus().reason;
      return null;
    }

    if (!media?.data) {
      this.lastError = 'WhatsApp media download did not include audio data';
      return null;
    }

    let socket;

    try {
      socket = await this.connectSocket();
      const transcriptPromise = this.waitForTranscript(socket);

      socket.on('open', () => {
        socket.transcribe({
          audio: media.data,
          sample_rate: this.config.sampleRate,
          encoding: this.resolveEncoding(media.mimetype)
        });
      });

      await socket.waitForOpen();
      const transcript = await transcriptPromise;
      if (!transcript) {
        this.lastError = `No final transcript from Sarvam within ${this.config.streamTimeoutMs}ms`;
      }
      return transcript;
    } catch (error) {
      this.lastError = error?.message ?? 'Unknown Sarvam transcription error';
      this.logger.warn({ error }, 'Voice transcription failed');
      return null;
    } finally {
      if (socket) closeSocket(socket);
    }
  }

  async connectSocket() {
    return this.client.speechToTextStreaming.connect({
      model: this.config.model,
      mode: 'transcribe',
      'language-code': this.config.languageCode,
      high_vad_sensitivity: 'true'
    });
  }

  waitForTranscript(socket) {
    return new Promise((resolve, reject) => {
      let latestTranscript = null;

      const timeout = setTimeout(() => {
        resolve(latestTranscript);
      }, this.config.streamTimeoutMs);

      socket.on('message', (response) => {
        const transcript = extractTranscript(response);
        if (!transcript) return;

        latestTranscript = transcript;
        if (isFinalResponse(response)) {
          clearTimeout(timeout);
          resolve(transcript);
        }
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  resolveEncoding(mimetype = '') {
    if (this.config.audioEncoding) return this.config.audioEncoding;
    const normalized = mimetype.toLowerCase();
    if (normalized.includes('wav')) return 'audio/wav';
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'audio/mpeg';
    if (normalized.includes('webm')) return 'audio/webm';
    if (normalized.includes('ogg') || normalized.includes('opus')) return 'audio/ogg';
    return 'audio/wav';
  }
}

function extractTranscript(response) {
  const payload = parsePayload(response);
  return (
    payload?.transcript ??
    payload?.text ??
    payload?.data?.transcript ??
    payload?.data?.text ??
    payload?.result?.transcript ??
    payload?.result?.text ??
    null
  );
}

function isFinalResponse(response) {
  const payload = parsePayload(response);
  return Boolean(payload?.is_final ?? payload?.isFinal ?? payload?.final ?? payload?.data?.is_final ?? payload?.data?.isFinal);
}

function parsePayload(response) {
  if (!response) return null;
  if (typeof response !== 'string') return response;

  try {
    return JSON.parse(response);
  } catch {
    return { transcript: response };
  }
}

function closeSocket(socket) {
  try {
    socket.close();
  } catch {
    // Socket is already closed or failed before opening.
  }
}
