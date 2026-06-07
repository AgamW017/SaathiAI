import { SarvamAIClient } from 'sarvamai';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
    let preparedAudio;

    try {
      preparedAudio = await this.prepareAudio(media);
      if (!preparedAudio) return null;
      socket = await this.connectSocket();
      const transcriptPromise = this.waitForTranscript(socket);

      socket.on('open', () => {
        socket.transcribe({
          audio: preparedAudio.data,
          sample_rate: this.config.sampleRate,
          encoding: preparedAudio.encoding
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
      if (preparedAudio?.cleanup) await preparedAudio.cleanup();
    }
  }

  async prepareAudio(media) {
    if (this.shouldConvertToWav(media.mimetype)) {
      return this.convertToWav(media);
    }

    return {
      data: media.data,
      encoding: this.resolveEncoding(media.mimetype),
      cleanup: null
    };
  }

  shouldConvertToWav(mimetype = '') {
    if (!ffmpegPath) {
      this.lastError = 'ffmpeg-static did not provide an ffmpeg binary';
      return false;
    }

    const encoding = this.resolveEncoding(mimetype);
    return encoding !== 'audio/wav' && this.config.audioEncoding === 'audio/wav';
  }

  async convertToWav(media) {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'saathiai-voice-'));
    const inputPath = path.join(workDir, `input.${extensionForMime(media.mimetype)}`);
    const outputPath = path.join(workDir, 'output.wav');

    try {
      await fs.writeFile(inputPath, Buffer.from(media.data, 'base64'));
      await execFileAsync(ffmpegPath, [
        '-y',
        '-i',
        inputPath,
        '-ac',
        '1',
        '-ar',
        String(this.config.sampleRate),
        '-f',
        'wav',
        outputPath
      ]);

      const wav = await fs.readFile(outputPath);
      return {
        data: wav.toString('base64'),
        encoding: 'audio/wav',
        cleanup: async () => {
          await fs.rm(workDir, { recursive: true, force: true });
        }
      };
    } catch (error) {
      await fs.rm(workDir, { recursive: true, force: true });
      this.lastError = `Audio conversion to WAV failed: ${error?.message ?? 'unknown ffmpeg error'}`;
      this.logger.warn({ error, mimetype: media.mimetype }, 'Audio conversion to WAV failed');
      return null;
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

function extensionForMime(mimetype = '') {
  const normalized = mimetype.toLowerCase();
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('ogg') || normalized.includes('opus')) return 'ogg';
  return 'audio';
}
