import { loadConfig } from './config/env.js';
import { createLogger } from './logger.js';
import { JsonStore } from './storage/jsonStore.js';
import { SupabaseStore } from './storage/supabaseStore.js';
import { BotStore } from './storage/botStore.js';
import { EventLog } from './storage/eventLog.js';
import { RuntimeStats } from './runtime/stats.js';
import { DashboardServer } from './dashboard/server.js';
import { GeminiClient } from './services/geminiClient.js';
import { ExtractionService } from './services/extractionService.js';
import { TranscriptionService } from './services/transcriptionService.js';
import { SkillCardService } from './services/skillCardService.js';
import { JobService } from './services/jobService.js';
import { InterviewService } from './services/interviewService.js';
import { ConversationEngine } from './conversation/conversationEngine.js';
import { WhatsAppBot } from './whatsapp/whatsappBot.js';

const config = loadConfig();
const logger = createLogger(config);
const stats = new RuntimeStats();

logger.info('Initializing SaathiAI WhatsApp Bot with Web Interface');

const aiClient = new GeminiClient(config.gemini);
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

const engine = new ConversationEngine({
  store,
  eventLog,
  extractionService,
  skillCardService,
  jobService,
  interviewService,
  transcriptionService,
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
