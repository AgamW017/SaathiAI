import 'dotenv/config';
import path from 'node:path';

function readNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function loadConfig() {
  const rootDir = process.cwd();
  return {
    env: process.env.NODE_ENV ?? 'development',
    port: readNumber('PORT', 3000),
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'https://yourdomain.com',
    botDisplayName: process.env.BOT_DISPLAY_NAME ?? 'SaathiAI',
    dataDir: path.resolve(rootDir, process.env.DATA_DIR ?? './data/runtime'),
    jobDataPath: path.resolve(rootDir, process.env.JOB_DATA_PATH ?? './data/jobs.json'),
    ai: {
      baseUrl: process.env.SAATHI_AI_API_URL ?? '',
      apiKey: process.env.SAATHI_AI_API_KEY ?? ''
    },
    sarvam: {
      apiKey: process.env.SARVAM_API_KEY ?? '',
      model: process.env.SARVAM_MODEL ?? 'saaras:v3',
      languageCode: process.env.SARVAM_LANGUAGE_CODE ?? 'hi-IN',
      sampleRate: readNumber('SARVAM_SAMPLE_RATE', 16000),
      streamTimeoutMs: readNumber('SARVAM_STREAM_TIMEOUT_MS', 5000),
      audioEncoding: process.env.SARVAM_AUDIO_ENCODING ?? ''
    },
    whatsapp: {
      puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '',
      puppeteerArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--memory-pressure-off'
      ]
    }
  };
}
