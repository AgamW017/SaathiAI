# SaathiAI Backend

Stateless Node.js/Express API server that handles **all data operations** for SaathiAI through Supabase. The frontend should **never** talk to Supabase directly — every request goes through this backend.

## Architecture

```
Frontend (Next.js)
    │
    │  HTTP (JWT auth)
    ▼
Backend API (Express, port 4000)
    │
    │  Supabase service-role client (bypasses RLS)
    ▼
Supabase (Postgres + Auth + Storage)
    
Bot Server (WhatsApp, port 3000)
    │  admin WS (port 3001) → admin dashboard
    │  internal events WS (port 3002) → internal services
    │  POST /internal/bot-events → Backend API
    ▼
Backend API records events → Supabase
```

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env.local
# Fill in SUPABASE_URL, SUPABASE_SECRET_KEY, JWT_SECRET, BOT_INTERNAL_SECRET
```

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Initialize database

Run all migrations against your Supabase project:

```bash
# Requires DATABASE_URL in .env.local
pnpm run db:init
```

This creates all tables, enums, indexes, and RLS policies.

### 4. Seed test data

```bash
pnpm run db:seed
```

Creates test users (all with password `SaathiTest@123`):
- `admin@saathi.in` — Admin
- `dssdo@saathi.in` — DSSDO
- `officer1@saathi.in`, `officer2@saathi.in`, `officer3@saathi.in` — Officers
- 20 learners, 5 jobs, applications, 1 placement

### 5. Start the server

```bash
pnpm run dev    # Development with hot reload
pnpm run start  # Production (after pnpm run build)
```

Server starts on `http://localhost:4000`.

---

## Available Scripts

| Script | Description |
|---|---|
| `pnpm run dev` | Development server with hot reload (tsx watch) |
| `pnpm run build` | Compile TypeScript to `dist/` |
| `pnpm run start` | Run compiled production build |
| `pnpm run db:init` | Run all pending migrations |
| `pnpm run db:seed` | Populate test data |
| `pnpm run migrate` | Alias for db:init |
| `pnpm run openapi:gen` | Generate `openapi.json` from schemas |
| `pnpm run types:gen` | Generate TypeScript types from openapi.json (for frontend) |

---

## API Reference

### Authentication

All protected endpoints require `Authorization: Bearer <jwt>` header.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | None | Email/phone + password login |
| POST | `/auth/refresh` | None | Refresh access token |
| POST | `/auth/logout` | JWT | Invalidate session |
| POST | `/auth/google/callback` | None | Google OAuth code exchange |
| GET | `/auth/me` | JWT | Get current user profile |

**Login request:**
```json
{
  "email": "officer1@saathi.in",
  "password": "SaathiTest@123"
}
```
Or with phone:
```json
{
  "phone": "9800000001",
  "password": "SaathiTest@123"
}
```

**Login response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 604800,
  "user": {
    "id": "uuid",
    "email": "officer1@saathi.in",
    "role": "officer",
    "full_name": "Officer Ranchi"
  }
}
```

### Learners (requires `officer`, `dssdo`, or `admin` role)

| Method | Path | Description |
|---|---|---|
| GET | `/learners` | Paginated list with filters |
| GET | `/learners/:id` | Single learner profile |

**Query filters for `/learners`:**
- `status` — `active`, `placed`, `dropped`, `at_risk`
- `cohort` — e.g. `2024-Q1`
- `district` — district name
- `trade` — trade name
- `risk_score_min` / `risk_score_max` — 0–100
- `page` — default 1
- `limit` — default 20, max 100

### Placements (requires `officer`, `dssdo`, `admin`)

| Method | Path | Description |
|---|---|---|
| POST | `/placements` | Confirm a learner placement |

### Dashboard

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/dashboard/stats` | officer, dssdo, admin | Aggregate stats |
| GET | `/dashboard/district/analytics` | dssdo, admin | District breakdown |

### Internal / Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/internal/bot-events` | Bot secret (`X-Bot-Secret`) | Bot → Backend event ingestion |
| GET | `/admin/bot-status` | admin JWT | Proxy bot connection status + QR |
| GET | `/admin/events` | admin, dssdo JWT | Audit event log |

---

## Roles

| Role | Access |
|---|---|
| `admin` | Everything, including bot status |
| `dssdo` | All learners, district analytics, event log |
| `officer` | Learners in their district, placements |
| `employer` | Job postings (future) |
| `trainee` | Own profile (future self-service) |

---

## Bot Server Extensions

The bot server (`../bot`) has been extended with:

### Port 3001 — Admin HTTP + WebSocket
- `GET /admin/status` — Returns `{ status, connected, qr, stats }`
- WebSocket events: `bot_status`, `stats`, `backend_event`

### Port 3002 — Internal Events WebSocket
- Receives `POST /internal/events` from backend
- Broadcasts `event` to connected internal clients

All existing bot behavior (port 3000 dashboard, WhatsApp processing) is **fully preserved**.

---

## Database Schema

### Tables

| Table | Key Columns |
|---|---|
| `users` | id (auth.users FK), email, phone, role, district |
| `learners` | id, phone (unique), status, risk_score, officer_id |
| `sessions` | id, learner_id, step, data (JSONB) |
| `jobs` | id, title, company, trade, is_active |
| `applications` | learner_id + job_id (unique), status |
| `skill_cards` | learner_id, trade, skills[], verification_status |
| `placements` | learner_id, job_id, confirmed_by, placement_date |
| `events` | learner_id, event_type, source, metadata (JSONB) |

### RLS Policies

- **Officers** see learners only in their district
- **DSSDO** sees all learners, all events
- **Trainees** see only their own data
- **Backend** uses service-role key → bypasses RLS entirely

---

## Generating Frontend Types

```bash
# 1. Generate the OpenAPI spec
pnpm run openapi:gen

# 2. Generate TypeScript types for the frontend
pnpm run types:gen
# → src/db/openapi-types.ts (import into frontend)
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `BACKEND_PORT` | No (default: 4000) | Server port |
| `SUPABASE_URL` | **Yes** | Supabase project URL |
| `SUPABASE_SECRET_KEY` | **Yes** | Service role key (bypasses RLS) |
| `SUPABASE_ANON_KEY` | No | Anon key (OAuth only) |
| `DATABASE_URL` | Yes (for migrations) | Direct Postgres connection |
| `JWT_SECRET` | **Yes** | 64-byte hex secret for JWT signing |
| `JWT_EXPIRES_IN` | No (default: 7d) | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | No (default: 30d) | Refresh token lifetime |
| `BOT_INTERNAL_SECRET` | **Yes** | Shared secret for bot auth |
| `BOT_INTERNAL_URL` | No (default: http://localhost:3001) | Bot admin URL |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `LOG_LEVEL` | No (default: info) | Pino log level |
