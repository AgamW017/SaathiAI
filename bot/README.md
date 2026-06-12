# SaathiAI WhatsApp Bot

Modular WhatsApp companion bot for learner onboarding, skill-card generation, job matching, interview practice, and placement tracking.

## Quick Start

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000` to scan the WhatsApp QR code and watch bot health/logs.

## Chrome / Puppeteer

`whatsapp-web.js` controls WhatsApp Web through Chrome. If startup says Chrome cannot be found, install Puppeteer's browser:

```bash
pnpm exec puppeteer browsers install chrome
```

Or point the bot to an existing Linux Chrome/Chromium binary:

```env
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

Common WSL paths are `/usr/bin/google-chrome`, `/usr/bin/chromium`, or `/usr/bin/chromium-browser`.

## Architecture

- `src/whatsapp/` owns `whatsapp-web.js` integration and QR/dashboard events.
- `src/conversation/` contains the state machine and keyword overrides.
- `src/services/` contains domain services for extraction, skill cards, jobs, interview practice, and transcription.
- `src/storage/` contains JSON-backed repositories. These are intentionally adapter-shaped so Redis/Postgres can replace them without changing the bot flow.
- `src/templates/` contains fixed messages in Devanagari, Roman Hinglish, and simple English.

The bot logs interaction events without storing full message content, matching the privacy boundary in the spec.

## Environment

`PUBLIC_BASE_URL` controls generated skill-card URLs.

Learners, skill cards, applications, jobs, and events are always read/written through the backend Supabase Postgres schema. Bot-only runtime state, such as active WhatsApp sessions and duplicate message IDs, stays in local JSON under `DATA_DIR`.

The bot is server-side, so it can use the service-role key, but keep it only in `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PUBLIC_BASE_URL=http://localhost:3000
```

Gemini is required. SaathiAI uses Gemini for final learner-facing replies, name validation, trade/location classification, certificate normalization, skill extraction, interview feedback, and ambiguity/risk flags:

```env
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-3.5-flash
```

The bot will fail fast at startup if `GEMINI_API_KEY` is missing.

If `SARVAM_API_KEY` is set, voice notes are converted from WhatsApp OGG/Opus to 16k WAV and uploaded to Sarvam Saaras through `speechToTextJob`. Otherwise the bot asks the learner to send the answer as text. The default model is `saaras:v3`; configure `SARVAM_LANGUAGE_CODE`, `SARVAM_SAMPLE_RATE`, and `SARVAM_AUDIO_ENCODING` if your audio pipeline differs.

## Production Notes

The local JSON store is good for demos and debugging. For production, implement the repository interfaces in `src/storage/` with Redis for active sessions and Postgres for learners, cards, applications, jobs, and event logs.
