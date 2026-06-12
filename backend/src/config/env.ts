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

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: readNum('BACKEND_PORT', 4000),

  supabase: {
    url: requireEnv('SUPABASE_URL'),
    // serviceKey: requireEnv('SUPABASE_SERVICE_KEY'),
    secretKey: requireEnv('SUPABASE_SECRET_KEY'), 
    // anon key is used for oauth flows only
    // anonKey: process.env.SUPABASE_ANON_KEY ?? '',
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },

  bot: {
    internalSecret: requireEnv('BOT_INTERNAL_SECRET'),
    adminWsPort: readNum('BOT_ADMIN_WS_PORT', 3001),
    internalWsPort: readNum('BOT_INTERNAL_WS_PORT', 3002),
  },

  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
  },

  log: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
} as const;

export type Config = typeof config;
