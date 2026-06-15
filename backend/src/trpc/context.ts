import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import type { JwtPayload } from '../middleware/auth.js';

export interface Context {
  user: JwtPayload | null;
}

/**
 * Creates tRPC context from incoming Express request.
 * Reads the Bearer token and verifies it. Sets ctx.user = null on missing/invalid token.
 */
export async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return { user: null };
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    return { user: payload };
  } catch {
    return { user: null };
  }
}
