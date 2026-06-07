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

    let preparedAudio;

    try {
      preparedAudio = await this.prepareAudioFile(media);
      if (!preparedAudio) return null;

      const transcript = await withTimeout(
        this.runBatchTranscription(preparedAudio.filePath, preparedAudio.outputDir),
        this.config.jobTimeoutMs,
        `Sarvam transcription job did not complete within ${this.config.jobTimeoutMs}ms`
      );

      if (!transcript) {
        this.lastError = 'Sarvam job completed but no transcript was found in outputs';
      }
      return transcript;
    } catch (error) {
      this.lastError = error?.message ?? 'Unknown Sarvam transcription error';
      this.logger.warn({ error }, 'Voice transcription failed');
      return null;
    } finally {
      if (preparedAudio?.cleanup) await preparedAudio.cleanup();
    }
  }

  async runBatchTranscription(filePath, outputDir) {
    const job = await this.client.speechToTextJob.createJob({
      model: this.config.model,
      mode: 'transcribe',
      languageCode: this.config.languageCode,
      withDiarization: this.config.withDiarization,
      numSpeakers: this.config.numSpeakers
    });

    await job.uploadFiles([filePath]);
    await job.start();
    await job.waitUntilComplete();

    const fileResults = await job.getFileResults();
    const failed = fileResults?.failed ?? [];
    if (failed.length > 0 && (fileResults?.successful ?? []).length === 0) {
      this.lastError = failed.map((file) => `${file.file_name}: ${file.error_message}`).join('; ');
      return null;
    }

    const transcriptFromResults = extractTranscript(fileResults);
    if (transcriptFromResults) return transcriptFromResults;

    await job.downloadOutputs(outputDir);
    return this.readTranscriptFromOutputDir(outputDir);
  }

  async prepareAudioFile(media) {
    if (this.shouldConvertToWav(media.mimetype)) {
      return this.convertToWav(media);
    }

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'saathiai-voice-'));
    const inputPath = path.join(workDir, `input.${extensionForMime(media.mimetype)}`);
    const outputDir = path.join(workDir, 'sarvam-output');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(inputPath, Buffer.from(media.data, 'base64'));

    return {
      filePath: inputPath,
      outputDir,
      cleanup: async () => {
        await fs.rm(workDir, { recursive: true, force: true });
      }
    };
  }

  shouldConvertToWav(mimetype = '') {
    if (!ffmpegPath) {
      this.lastError = 'ffmpeg-static did not provide an ffmpeg binary';
      return false;
    }

    const sourceEncoding = inferEncoding(mimetype);
    return sourceEncoding !== 'audio/wav' && this.config.audioEncoding === 'audio/wav';
  }

  async convertToWav(media) {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'saathiai-voice-'));
    const inputPath = path.join(workDir, `input.${extensionForMime(media.mimetype)}`);
    const outputPath = path.join(workDir, 'output.wav');
    const outputDir = path.join(workDir, 'sarvam-output');

    try {
      await fs.mkdir(outputDir, { recursive: true });
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

      return {
        filePath: outputPath,
        outputDir,
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

  resolveEncoding(mimetype = '') {
    if (this.config.audioEncoding) return this.config.audioEncoding;
    return inferEncoding(mimetype);
  }

  async readTranscriptFromOutputDir(outputDir) {
    const files = await listFiles(outputDir);
    for (const filePath of files) {
      const raw = await fs.readFile(filePath, 'utf8').catch(() => null);
      if (!raw) continue;

      const transcript = extractTranscript(raw) ?? raw.trim();
      if (transcript) return transcript;
    }

    return null;
  }
}

function extractTranscript(response) {
  const payload = parsePayload(response);
  if (Array.isArray(payload)) {
    return payload.map(extractTranscript).find(Boolean) ?? null;
  }

  return (
    payload?.transcript ??
    payload?.text ??
    payload?.transcription ??
    payload?.transcript_text ??
    payload?.data?.transcript ??
    payload?.data?.text ??
    payload?.data?.transcription ??
    payload?.result?.transcript ??
    payload?.result?.text ??
    payload?.result?.transcription ??
    payload?.results?.[0]?.transcript ??
    payload?.results?.[0]?.text ??
    payload?.successful?.[0]?.transcript ??
    payload?.successful?.[0]?.text ??
    null
  );
}

function inferEncoding(mimetype = '') {
  const normalized = mimetype.toLowerCase();
  if (normalized.includes('wav')) return 'audio/wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'audio/mpeg';
  if (normalized.includes('webm')) return 'audio/webm';
  if (normalized.includes('ogg') || normalized.includes('opus')) return 'audio/ogg';
  return 'audio/wav';
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

function extensionForMime(mimetype = '') {
  const normalized = mimetype.toLowerCase();
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('ogg') || normalized.includes('opus')) return 'ogg';
  return 'audio';
}

async function listFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    })
  );

  return nested.flat();
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}
