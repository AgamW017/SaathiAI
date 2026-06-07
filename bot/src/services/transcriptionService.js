import { SarvamAIClient } from 'sarvamai';

export class TranscriptionService {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.client = config.apiKey
      ? new SarvamAIClient({
          apiSubscriptionKey: config.apiKey
        })
      : null;
  }

  isConfigured() {
    return Boolean(this.client);
  }

  async transcribe(media) {
    if (!this.isConfigured()) return null;

    const socket = await this.connectSocket();
    const transcriptPromise = this.waitForTranscript(socket);

    try {
      socket.on('open', () => {
        socket.transcribe({
          audio: media.data,
          sample_rate: this.config.sampleRate,
          encoding: this.resolveEncoding(media.mimetype)
        });
      });

      await socket.waitForOpen();
      return await transcriptPromise;
    } catch (error) {
      this.logger.warn({ error }, 'Voice transcription failed');
      return null;
    } finally {
      closeSocket(socket);
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
