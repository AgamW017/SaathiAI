# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SaathiAI is a WhatsApp-native orchestration layer connecting ITI vocational graduates, placement officers, and MSME employers via India's DPI (DigiLocker, SIDH, NAPS). It is a pnpm monorepo with four components: `backend`, `frontend`, `bot`, and `aiserver`.

## Commands

### Backend (`/backend`) — Node.js/Express + tRPC + Supabase, port 4000
```bash
cd backend && pnpm run dev          # hot-reload dev server
cd backend && pnpm run build        # compile TypeScript → dist/
cd backend && pnpm run db:init      # run all pending SQL migrations
cd backend && pnpm run db:seed      # seed test data
cd backend && pnpm test             # vitest
```

### Frontend (`/frontend`) — Next.js 16, port 3006
```bash
cd frontend && pnpm run dev         # dev server
cd frontend && pnpm run build       # production build
cd frontend && pnpm run lint        # ESLint
cd frontend && pnpm run type-check  # tsc --noEmit
cd frontend && pnpm test            # vitest
```

### Bot (`/bot`) — whatsapp-web.js + Gemini/Sarvam, port 3001
```bash
cd bot && pnpm start                # production
cd bot && pnpm run dev              # --watch mode
# Scan QR at http://localhost:3000 (bot serves its own dashboard there)
# If puppeteer missing Chrome: pnpm exec puppeteer browsers install chrome
cd bot && pnpm test                 # vitest
```

### AI Server (`/aiserver`) — Python FastAPI, port 5000
```bash
cd aiserver && pip install -r requirements.txt
cd aiserver && python train_risk_model.py   # one-time: generates risk_model.pkl
cd aiserver && uvicorn server:app --port 5000 --reload
```

## Architecture

### Data flow
```
WhatsApp (learner) → bot/whatsapp-web.js → ConversationEngine
                                               ↓
                               backend REST /internal + /admin
                                               ↓
                                      Supabase (Postgres + Storage)
                                               ↑
          frontend (Next.js) ← tRPC over HTTP ─┘
```

### Backend (`backend/src/`)
- **`trpc/router.ts`** — root tRPC `AppRouter`. Namespaces: `auth`, `dashboard`, `messaging`, `cohort`, `cohorts`, `reports`, `employer`, `skillCard`, `officer`, `district`.
- **`trpc/context.ts`** — JWT verification; sets `ctx.user` (null when unauthenticated).
- **`routes/`** — REST-only routes: `documents` (multipart upload → aiserver), `cohortsApi` (CSV upload), `internal` (bot webhooks, not yet migrated to tRPC, mounted at `/admin` and `/internal`).
- **`services/`** — Business logic layer (`learnerService`, `employerService`, `placementService`, `sandboxService` for Aadhaar KYC, `llmService`, `riskService`, etc.).
- **`db/client.ts`** — service-role Supabase client (bypasses RLS). Never expose to frontend.
- **`db/types.ts`** — hand-maintained `Database` interface mirroring Supabase schema.
- **`migrations/`** — numbered SQL files; run via `db:init`. Current: 001–007.

### Frontend (`frontend/src/`)
- Next.js App Router at `src/app/`. Pages by user role:
  - `dashboard/officer/*` — ITI Placement Officer views (cohorts, learners, placements, employers, MIS reports, messaging)
  - `dashboard/employer/*` — Employer portal (vacancies, pipeline/matchmaking, NAPS, analytics)
  - `employer/register` + `employer/login` — employer onboarding with Sandbox KYC (EntityLocker, Aadhaar, Unverified tabs)
  - `cohorts/` — cohort management and CSV upload
  - `card/[id]` — public learner skill card (no auth)
  - `s/[token]` — short-link redirect
- **`lib/trpc/client.ts`** — tRPC React client. Imports `AppRouter` type directly from `backend/src/trpc/router` for compile-time type safety. Use `trpc.<namespace>.<procedure>.useQuery/useMutation` everywhere.
- **`lib/trpc/provider.tsx`** — wraps app with tRPC + React Query providers.
- **i18n:** `next-intl` with messages in `messages/`. Bilingual Hindi/English; design decisions tested for Devanagari rendering.

### Bot (`bot/src/`)
- **`conversation/conversationEngine.js`** — stateful step machine. Entry: `processIncoming(incoming)`. Supports multilingual (English, Hindi, Hinglish, Marathi, Gujarati, Bengali).
- **`storage/`**: `JsonStore` (local JSON for runtime session state) + `SupabaseStore` (persistent backend sync) composed via `BotStore`.
- **`services/`**: `extractionService` (LLM profile extraction from voice/text), `transcriptionService` (Sarvam AI STT), `sandboxKycService` (Aadhaar OTP), `placementTrackerService`, `employerPingService`, `skillCardService`.
- **`whatsapp/whatsappBot.js`** — whatsapp-web.js wrapper + QR dashboard.
- **`dashboard/`** — Socket.io dashboard served at port 3000 showing bot status and QR.
- LLM: Groq primary, Gemini fallback (configured in `services/llmClient.js`).

### AI Server (`aiserver/`)
- `server.py` — FastAPI. Endpoints: `POST /convert` (Docling doc parsing), `POST /predict-risk` (dropout risk ML), `GET /health`.
- `train_risk_model.py` → `risk_model.pkl`. Must run before starting the server.
- Backend calls `/predict-risk` fire-and-forget after learner creation; failure is non-blocking.

## Key Conventions

- **Auth:** JWT issued by backend `auth.signin`. tRPC context reads `Authorization: Bearer <token>`. Protected procedures call `requireAuth(ctx)` which throws `UNAUTHORIZED` if `ctx.user` is null.
- **No RLS on backend:** Backend uses service-role Supabase key; RLS is not enforced server-side. Access control is in tRPC middleware.
- **Migrations:** Add new SQL files to `backend/migrations/` with incrementing prefix. Run `pnpm run db:init` from `/backend`.
- **Bot ↔ Backend:** Bot posts to `/internal/*` (or `/admin/*`) with `BOT_INTERNAL_SECRET` header. These are REST, not tRPC.
- **Frontend Next.js version:** See `frontend/AGENTS.md` — this Next.js version has breaking changes vs common training data. Check `node_modules/next/dist/docs/` before writing App Router code.
- **Design tokens:** Defined in `frontend/SAATHI_DESIGN.md` and `frontend/saathi_theme.css`. Primary palette: `--color-cream-canvas` (#fff8f1) background, `--color-saathi-teal` (#004038) brand, `--color-action-flame` (#fa5d00) CTAs.

## Environment Setup

Copy `backend/.env.example` → `backend/.env.local`. Key vars:
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`
- `GROQ_API_KEY` (primary LLM), `GEMINI_API_KEY` (fallback)
- `SANDBOX_API_KEY`, `SANDBOX_API_SECRET`, `SANDBOX_BASE_URL` (use `https://test-api.sandbox.co.in` for dev)
- `BOT_INTERNAL_URL=http://localhost:3001`, `BOT_INTERNAL_SECRET`
- `AISERVER_URL=http://localhost:5000`
- `CORS_ORIGINS=http://localhost:3006` (frontend dev port)
