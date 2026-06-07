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

If `SAATHI_AI_API_URL` is set, extraction/feedback calls are sent there. Otherwise, local deterministic extractors are used for reliable development.

If `SARVAM_API_KEY` is set, voice notes are converted from WhatsApp OGG/Opus to 16k WAV and uploaded to Sarvam Saaras through `speechToTextJob`. Otherwise the bot asks the learner to send the answer as text. The default model is `saaras:v3`; configure `SARVAM_LANGUAGE_CODE`, `SARVAM_SAMPLE_RATE`, and `SARVAM_AUDIO_ENCODING` if your audio pipeline differs.

## Production Notes

The local JSON store is good for demos and debugging. For production, implement the repository interfaces in `src/storage/` with Redis for active sessions and Postgres for learners, cards, applications, jobs, and event logs.
