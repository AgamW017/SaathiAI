/**
 * Creates a typed HTTP error with a status code.
 * Usage: throw httpError(404, 'Learner not found')
 */
export function httpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

/**
 * Paginates an array (for in-memory datasets).
 */
export function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Converts a snake_case string to camelCase.
 */
export function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Strips undefined keys from an object (useful before Supabase upserts).
 */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
