import { TRPCError } from '@trpc/server';
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc';
import { logger } from '../config/logger.js';

/**
 * Supabase/PostgREST error shape — the `error` object returned from
 * `await supabase.from(...).select(...)` etc.
 */
interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Maps a Supabase/Postgres error into the appropriate tRPC error code and
 * throws a TRPCError with a user-friendly message.
 *
 * The original error details are logged server-side for debugging but NOT
 * exposed to the client beyond a sanitized message.
 *
 * @param error   - The Supabase error object
 * @param context - Optional string identifying the calling procedure (e.g. "employer.vacancies.list")
 * @throws TRPCError — always throws, return type is `never`
 */
export function handleSupabaseError(error: SupabaseError, context?: string): never {
  // Log full details server-side
  logger.error({ supabaseError: error, context }, `Supabase error in ${context ?? 'unknown'}`);

  const code = error.code ?? '';
  const message = error.message ?? 'Unknown database error';

  // ─── Postgres error code classification ───────────────────────────────────

  // 42P01 — undefined_table
  if (code === '42P01') {
    const tableMatch = message.match(/relation "([^"]+)"/);
    const table = tableMatch?.[1] ?? 'unknown';
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Database table '${table}' not found. Please run migrations.`,
    });
  }

  // 23505 — unique_violation
  if (code === '23505') {
    const detail = error.details ?? message;
    // Try to extract the constraint/field name
    const fieldMatch = detail.match(/Key \(([^)]+)\)/);
    const field = fieldMatch?.[1] ?? 'record';
    throw new TRPCError({
      code: 'CONFLICT',
      message: `A duplicate ${field} already exists.`,
    });
  }

  // 23503 — foreign_key_violation
  if (code === '23503') {
    const detail = error.details ?? message;
    const refMatch = detail.match(/Key \(([^)]+)\).*not present in table "([^"]+)"/);
    const field = refMatch?.[1] ?? 'reference';
    const refTable = refMatch?.[2] ?? 'related table';
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid reference: ${field} does not exist in ${refTable}.`,
    });
  }

  // 42501 — insufficient_privilege
  if (code === '42501') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Insufficient database permissions for this operation.',
    });
  }

  // PGRST116 — PostgREST "not found" (from .single() when 0 rows)
  if (code === 'PGRST116') {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'The requested record was not found.',
    });
  }

  // PGRST301 — PostgREST connection error
  if (code === 'PGRST301' || code === '08000' || code === '08003' || code === '08006') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database connection failed. Please try again later.',
    });
  }

  // 57014 — query_canceled (timeout)
  if (code === '57014') {
    throw new TRPCError({
      code: 'TIMEOUT',
      message: 'The database query timed out. Please try again or narrow your request.',
    });
  }

  // 23502 — not_null_violation
  if (code === '23502') {
    const columnMatch = message.match(/column "([^"]+)"/);
    const column = columnMatch?.[1] ?? 'field';
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Required field '${column}' is missing.`,
    });
  }

  // 23514 — check_violation
  if (code === '23514') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'A data validation constraint was violated.',
    });
  }

  // ─── Heuristic matching for network/timeout errors ────────────────────────

  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out')) {
    throw new TRPCError({
      code: 'TIMEOUT',
      message: 'The database query timed out. Please try again later.',
    });
  }

  if (
    lowerMsg.includes('connection') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('network')
  ) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database connection failed. Please try again later.',
    });
  }

  // ─── Fallback: generic internal error ─────────────────────────────────────

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: context
      ? `Database error in ${context}. Please try again or contact support.`
      : 'An unexpected database error occurred. Please try again or contact support.',
  });
}
