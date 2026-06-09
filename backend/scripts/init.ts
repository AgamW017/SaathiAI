/**
 * db:init — Alias that runs all migrations.
 * This just re-runs migrate.ts via the pnpm script.
 * Usage: pnpm run db:init
 */

// Import main from migrate and run it
import './migrate.js';
