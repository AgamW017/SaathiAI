/**
 * db:init — Runs all SQL migrations in order against Supabase via pg connection.
 * Usage: pnpm run db:init
 */
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Dynamically import pg (postgres driver)
  let pgClient: typeof import('pg').Client;
  try {
    const pg = await import('pg');
    pgClient = pg.default.Client ?? pg.Client;
  } catch {
    console.error('pg package not found. Install it: pnpm add pg');
    process.exit(1);
    return;
  }

  const client = new pgClient({ connectionString: databaseUrl });
  await client.connect();
  console.log('✅ Connected to database');

  // Create migrations tracking table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public._migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const migrationsDir = join(__dirname, '../migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT id FROM public._migrations WHERE filename = $1',
      [file]
    );
    if (rows.length > 0) {
      console.log(`⏭  Skipping (already applied): ${file}`);
      continue;
    }

    console.log(`▶  Applying migration: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    await client.query(sql);
    await client.query('INSERT INTO public._migrations(filename) VALUES($1)', [file]);
    console.log(`✅ Applied: ${file}`);
  }

  await client.end();
  console.log('\n🎉 All migrations applied successfully');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
