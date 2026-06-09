import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = (err as { status?: number })?.status ?? 500;
  const message =
    err instanceof Error ? err.message : 'An unexpected error occurred';

  logger.error({ err, method: req.method, url: req.url, status }, 'Request error');

  // Don't leak stack traces in production
  const body: Record<string, unknown> = { error: message };
  if (process.env.NODE_ENV !== 'production' && err instanceof Error && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
}
