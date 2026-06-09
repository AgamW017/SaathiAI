import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import type { UserRole } from '../db/types.js';

export interface JwtPayload {
  sub: string;       // Supabase user ID
  email: string | null;
  phone: string | null;
  role: UserRole;
  district: string | null;
  iat?: number;
  exp?: number;
}

// Augment express Request to carry the decoded token
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Extracts and verifies the Bearer JWT from Authorization header.
 * Attaches the decoded payload to req.user.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';
    res.status(401).json({ error: message });
  }
}

/**
 * Returns middleware that checks req.user.role is in the allowed list.
 * Must be called AFTER authenticate().
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        required: roles,
        actual: req.user.role,
      });
      return;
    }
    next();
  };
}

/**
 * Validates the shared Bot ↔ Backend internal secret.
 * Used on /internal/* endpoints instead of JWT.
 */
export function requireBotSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-bot-secret'];
  if (!secret || secret !== config.bot.internalSecret) {
    res.status(401).json({ error: 'Invalid bot secret' });
    return;
  }
  next();
}
