import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

import { internalRouter } from './routes/internal.js';
import { appRouter } from './trpc/router.js';
import { createContext } from './trpc/context.js';

const app = express();

// ─── Core middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.cors.origins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── tRPC router ───────────────────────────────────────────────────────────
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ path, error }) {
      logger.error({ path, error }, 'tRPC error');
    },
  })
);

// ─── Internal REST routes (bot webhooks — not migrated to tRPC) ────────────
app.use('/admin', internalRouter);
app.use('/internal', internalRouter);

// ─── Error handling ────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start server ──────────────────────────────────────────────────────────
app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.env },
    'SaathiAI Backend API server started'
  );
});

export { app };
