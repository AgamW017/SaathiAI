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
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3006',
    botDisplayName: process.env.BOT_DISPLAY_NAME ?? 'SaathiAI',
    dataDir: path.resolve(rootDir, process.env.DATA_DIR ?? './data/runtime'),
    jobDataPath: path.resolve(rootDir, process.env.JOB_DATA_PATH ?? './data/jobs.json'),
    supabase: {
      databaseUrl: process.env.DATABASE_URL ?? '',
      url: process.env.SUPABASE_URL ?? '',
      serviceKey: process.env.SUPABASE_SERVICE_KEY ?? ''
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY ?? '',
      model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      timeoutMs: readNumber('GROQ_TIMEOUT_MS', 30000)
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? '',
      model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'
    },
    sarvam: {
      apiKey: process.env.SARVAM_API_KEY ?? '',
      model: process.env.SARVAM_MODEL ?? 'saaras:v3',
      languageCode: process.env.SARVAM_LANGUAGE_CODE ?? 'unknown',
      sampleRate: readNumber('SARVAM_SAMPLE_RATE', 16000),
      jobTimeoutMs: readNumber('SARVAM_JOB_TIMEOUT_MS', 120000),
      withDiarization: (process.env.SARVAM_WITH_DIARIZATION ?? 'false').toLowerCase() === 'true',
      numSpeakers: readNumber('SARVAM_NUM_SPEAKERS', 1),
      audioEncoding: process.env.SARVAM_AUDIO_ENCODING ?? 'audio/wav'
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
