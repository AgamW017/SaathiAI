import morgan from 'morgan';
import { logger } from '../config/logger.js';
import type { StreamOptions } from 'morgan';

const stream: StreamOptions = {
  write: (message) => logger.info(message.trimEnd()),
};

// Concise format in development, combined in production
const format =
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev';

export const requestLogger = morgan(format, { stream });
