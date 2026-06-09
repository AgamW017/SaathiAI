import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

import { authRouter } from './routes/auth.js';
import { learnersRouter } from './routes/learners.js';
import { placementsRouter } from './routes/placements.js';
import { dashboardRouter } from './routes/dashboard.js';
import { internalRouter } from './routes/internal.js';

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

// ─── API routes ────────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/learners', learnersRouter);
app.use('/placements', placementsRouter);
app.use('/dashboard', dashboardRouter);
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
