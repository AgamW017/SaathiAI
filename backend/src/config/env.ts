import 'dotenv/config';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function readNum(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: readNum('BACKEND_PORT', 4000),

  supabase: {
    url: requireEnv('SUPABASE_URL'),
    secretKey: requireEnv('SUPABASE_SECRET_KEY'),
  },

  jwt: {
    // In dev, fall back to a generated secret so the server boots without .env
    secret: optionalEnv(
      'JWT_SECRET',
      'dev-insecure-secret-change-in-production-32charmin'
    ),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },

  bot: {
    internalSecret: optionalEnv('BOT_INTERNAL_SECRET', 'dev-bot-secret'),
    adminWsPort: readNum('BOT_ADMIN_WS_PORT', 3001),
    internalWsPort: readNum('BOT_INTERNAL_WS_PORT', 3002),
  },

  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3000').split(','),
  },

  log: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
} as const;

export type Config = typeof config;
