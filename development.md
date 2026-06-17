# SaathiAI Development Guide

This document lists all the commands needed to run the various components of the SaathiAI monorepo.

## Global Prerequisites
- **Node.js**: v18+ 
- **pnpm**: v8+
- **Supabase**: Access to a Supabase project
- **Gemini API Key**: For AI Extraction & Bot Features

## 1. Backend API (`/backend`)
The backend is a stateless Node.js/Express API that interfaces with Supabase.

**Setup:**
```bash
cd backend
cp .env.example .env.local
pnpm install
```

**Commands:**
- `pnpm run dev`: Start the development server on port 4000 with hot-reload.
- `pnpm run build`: Compile TypeScript to `dist/`.
- `pnpm run start`: Run compiled production build.
- `pnpm run db:init`: Run all pending migrations against Supabase.
- `pnpm run db:seed`: Populate the database with test data (users, learners, jobs).

## 2. Frontend (`/frontend`)
The frontend is a Next.js application that provides the dashboards for Officers, Employers, and DSSDOs.

**Setup:**
```bash
cd frontend
pnpm install
```

**Commands:**
- `pnpm run dev`: Start the Next.js development server on port 3000.
- `pnpm run build`: Build the Next.js application for production.
- `pnpm run start`: Start the Next.js production server.
- `pnpm run lint`: Run ESLint.

## 3. WhatsApp Bot (`/bot`)
The WhatsApp companion bot handles all learner interactions via whatsapp-web.js and LLM integrations.

**Setup:**
```bash
cd bot
cp .env.example .env
pnpm install
# If puppeteer fails to find Chrome:
pnpm exec puppeteer browsers install chrome
```

**Commands:**
- `pnpm start`: Start the bot. Open `http://localhost:3000` to scan the WhatsApp QR code.
- `pnpm run test`: Run Vitest tests for the bot logic.

## 4. Document Processing Pipeline (`/document_processing_pipeline`)
*Note: This component is currently pending implementation. It will be used for AI Video Scoring and Credential extraction.*
