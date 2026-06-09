import pino from 'pino';
import { config } from './env.js';

export const logger = pino({
  level: config.log.level,
  transport:
    config.env !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

export type Logger = typeof logger;
