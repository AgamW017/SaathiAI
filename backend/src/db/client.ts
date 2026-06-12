import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';
import type { Database } from './types.js';
import WebSocket from 'ws';

/**
 * Service-role Supabase client — bypasses RLS.
 * Use ONLY inside backend routes/services (never expose to frontend).
 */
export const supabase = createClient<Database>(
  config.supabase.url,
  config.supabase.secretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: WebSocket as unknown as any,
    },
  }
);

/**
 * Supabase Admin Auth client — used for user management ops.
 */
export const supabaseAdmin = supabase.auth.admin;
