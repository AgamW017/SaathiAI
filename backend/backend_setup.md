# SaathiAI Backend — Setup Summary

## What was built

### New: `backend/` workspace package
Complete stateless Express + TypeScript backend. Frontend never touches Supabase directly.

## File Map

```
backend/
├── src/
│   ├── index.ts                    ← Express app entry point
│   ├── config/
│   │   ├── env.ts                  ← Centralised env config loader
│   │   └── logger.ts               ← Pino logger instance
│   ├── db/
│   │   ├── client.ts               ← Supabase service-role client
│   │   └── types.ts                ← Full DB type definitions
│   ├── middleware/
│   │   ├── auth.ts                 ← JWT auth + role-based authorize()
│   │   ├── errorHandler.ts         ← Centralized error + 404 handling
│   │   ├── logger.ts               ← Morgan → Pino HTTP logger
│   │   └── validate.ts             ← Zod validateBody() / validateQuery()
│   ├── routes/
│   │   ├── auth.ts                 ← /auth/* (login, refresh, logout, google, me)
│   │   ├── learners.ts             ← /learners (list + single)
│   │   ├── placements.ts           ← /placements (confirm placement)
│   │   ├── dashboard.ts            ← /dashboard/stats + /district/analytics
│   │   └── internal.ts             ← /internal/bot-events + /admin/*
│   ├── schemas/
│   │   └── index.ts                ← All Zod schemas
│   ├── services/
│   │   ├── authService.ts          ← Supabase Auth + JWT issuance
│   │   ├── learnerService.ts       ← Learner CRUD + pagination
│   │   ├── placementService.ts     ← Placement confirmation
│   │   ├── analyticsService.ts     ← Dashboard + district analytics
│   │   └── eventService.ts         ← Bot event ingestion
│   └── utils/
│       └── helpers.ts              ← httpError, paginate, compact
├── migrations/
│   └── 001_initial_schema.sql      ← All tables, enums, indexes, triggers
├── scripts/
│   ├── init.ts                     ← pnpm run db:init
│   ├── migrate.ts                  ← pnpm run migrate
│   ├── seed.ts                     ← pnpm run db:seed
│   └── genOpenApi.ts               ← pnpm run openapi:gen
├── .env.example
├── .env.local                      ← Fill in your secrets
├── package.json
├── tsconfig.json
└── README.md
```

## Bot Changes (non-breaking)

`bot/src/dashboard/server.js` — **3 servers now**:
| Port | Purpose |
|------|---------|
| `config.port` (3000) | Existing dashboard (unchanged) |
| 3001 (`ADMIN_WS_PORT`) | New: admin HTTP + WebSocket. Exposes `GET /admin/status` |
| 3002 (`INTERNAL_WS_PORT`) | New: internal events WS. Receives `POST /internal/events` from backend |

`bot/src/whatsapp/whatsappBot.js` — calls `dashboard.setQr()` and `dashboard.setConnectionStatus()` so admin clients get real-time updates.

`bot/src/config/env.js` — Added `adminWsPort` and `internalWsPort`.

## Getting Started

### 1. Fill in `backend/.env.local`

```bash
# Get from Supabase dashboard → Settings → API
SUPABASE_URL=https://khuxbwwjyqmjwscmnghu.supabase.co
SUPABASE_SECRET_KEY=<service-role-key>
DATABASE_URL=postgresql://postgres:<password>@db.khuxbwwjyqmjwscmnghu.supabase.co:5432/postgres

# Generate:
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
BOT_INTERNAL_SECRET=any-random-string
```

### 2. Initialize database

```bash
cd backend
pnpm run db:init     # Creates all tables
pnpm run db:seed     # Creates test users + data
```

### 3. Start backend

```bash
pnpm run dev         # Hot reload dev server on :4000
```

### 4. Generate OpenAPI + frontend types

```bash
pnpm run openapi:gen  # → openapi.json
pnpm run types:gen    # → src/db/openapi-types.ts (for frontend)
```

## API Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/auth/login` | Public | Email/phone + password |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | any JWT | Invalidate session |
| POST | `/auth/google/callback` | Public | Google OAuth |
| GET | `/auth/me` | any JWT | Current user |
| GET | `/learners` | officer, dssdo, admin | Paginated list + filters |
| GET | `/learners/:id` | officer, dssdo, admin | Single learner |
| POST | `/placements` | officer, dssdo, admin | Confirm placement |
| GET | `/dashboard/stats` | officer, dssdo, admin | Aggregate stats |
| GET | `/dashboard/district/analytics` | dssdo, admin | District breakdown |
| POST | `/internal/bot-events` | bot secret | Receive bot events |
| GET | `/admin/bot-status` | admin | Bot QR + status |
| GET | `/admin/events` | admin, dssdo | Event audit log |

## Seeded Test Users (password: `SaathiTest@123`)

| Email | Role |
|-------|------|
| admin@saathi.in | admin |
| dssdo@saathi.in | dssdo |
| officer1@saathi.in | officer (Ranchi) |
| officer2@saathi.in | officer (Dhanbad) |
| officer3@saathi.in | officer (Bokaro) |

> [!IMPORTANT]
> The `SUPABASE_SECRET_KEY` must only exist server-side. Never expose it to the frontend. The backend is the single source of truth for all data.

> [!NOTE]
> Bot ports 3001 and 3002 are configurable via `ADMIN_WS_PORT` and `INTERNAL_WS_PORT` env vars in `bot/.env`.
