import { loadConfig } from './config/env.js';
import { createLogger } from './logger.js';
import { JsonStore } from './storage/jsonStore.js';
import { SupabaseStore } from './storage/supabaseStore.js';
import { BotStore } from './storage/botStore.js';
import { EventLog } from './storage/eventLog.js';
import { RuntimeStats } from './runtime/stats.js';
import { DashboardServer } from './dashboard/server.js';
import { LlmClient } from './services/llmClient.js';
import { ExtractionService } from './services/extractionService.js';
import { TranscriptionService } from './services/transcriptionService.js';
import { SkillCardService } from './services/skillCardService.js';
import { JobService } from './services/jobService.js';
import { InterviewService } from './services/interviewService.js';
import { DocumentStorageService } from './services/documentStorageService.js';
import { SandboxKycService } from './services/sandboxKycService.js';
import { ConversationEngine } from './conversation/conversationEngine.js';
import { WhatsAppBot } from './whatsapp/whatsappBot.js';
import { createClient } from '@supabase/supabase-js';


const config = loadConfig();
const logger = createLogger(config);
const stats = new RuntimeStats();

logger.info('Initializing SaathiAI WhatsApp Bot with Web Interface');

const aiClient = new LlmClient({
  groq: config.groq,
  gemini: config.gemini
}, logger);
const runtimeStore = new JsonStore({ dataDir: config.dataDir, jobDataPath: config.jobDataPath });
const backendStore = new SupabaseStore({ supabase: config.supabase, publicBaseUrl: config.publicBaseUrl });
const store = new BotStore({ runtimeStore, backendStore });
await store.init();

const eventLog = new EventLog(store);
const dashboard = new DashboardServer({ config, stats, store, logger });
dashboard.start();

const extractionService = new ExtractionService({ aiClient, logger });
const transcriptionService = new TranscriptionService({ config: config.sarvam, logger });
const skillCardService = new SkillCardService({ store, publicBaseUrl: config.publicBaseUrl });
const jobService = new JobService({ store });
const interviewService = new InterviewService();

// Create Supabase JS client for storage access (document uploads)
let documentStorageService = null;
if (config.supabase.url && config.supabase.serviceKey) {
  const supabaseClient = createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  documentStorageService = new DocumentStorageService({ supabaseClient, logger });
  logger.info('DocumentStorageService initialized');
} else {
  logger.warn('SUPABASE_URL or SUPABASE_SERVICE_KEY not set — document upload disabled');
}

// Create SandboxKycService (requires BACKEND_INTERNAL_URL to be reachable)
const sandboxKycService = new SandboxKycService();
logger.info('SandboxKycService initialized (calls backend KYC proxy)');

const engine = new ConversationEngine({
  store,
  eventLog,
  extractionService,
  skillCardService,
  jobService,
  interviewService,
  transcriptionService,
  documentStorageService,
  sandboxKycService,
  logger
});

const bot = new WhatsAppBot({ config, engine, eventLog, stats, dashboard, logger });

try {
  await bot.initializeWithRetry(3);
  logger.info('WhatsApp client initialization started');
} catch (error) {
  logger.fatal({ error }, 'All WhatsApp initialization attempts failed');
  dashboard.emit('log', 'All initialization attempts failed');
  process.exit(1);
}
