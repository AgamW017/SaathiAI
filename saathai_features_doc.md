# SaathiAI — Complete Feature Documentation

> **Generated from codebase analysis of the SaathiAI monorepo.**
> All four services analysed: `frontend`, `backend`, `bot`, `aiserver`.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [Backend — Express + tRPC API](#4-backend--express--trpc-api)
   - 4.1 Authentication (`auth.*`)
   - 4.2 Officer Dashboard (`dashboard.*`)
   - 4.3 Employer Portal (`employer.*`)
   - 4.4 Messaging (`messaging.*`)
   - 4.5 MIS Reports (`reports.*`)
   - 4.6 Cohort Management (`cohort.*`, `cohorts.*`)
   - 4.7 Officer Onboarding (`officer.*`)
   - 4.8 District Console (`district.*`)
   - 4.9 REST Routes (Documents, Cohorts, Internal/Bot)
5. [Backend Services](#5-backend-services)
6. [Frontend — Next.js Web Application](#6-frontend--nextjs-web-application)
   - 6.1 Authentication & Login
   - 6.2 Officer Dashboard
   - 6.3 Employer Portal
   - 6.4 Messaging Interface
   - 6.5 MIS Reports
   - 6.6 Public Skill Cards
   - 6.7 i18n / Internationalisation
7. [Bot — WhatsApp Conversational Engine](#7-bot--whatsapp-conversational-engine)
   - 7.1 Onboarding Flow
   - 7.2 Aadhaar KYC via Sandbox
   - 7.3 Skill Extraction
   - 7.4 Job Matching
   - 7.5 Interview Practice
   - 7.6 Placement Tracking
   - 7.7 Retention Checks
   - 7.8 Employer Ping & Relay
   - 7.9 Opportunity Alerts
   - 7.10 Content Safety
   - 7.11 Multilingual Support
8. [AI Server — Python/FastAPI](#8-ai-server--pythonfastapi)
   - 8.1 Document Conversion (Docling)
   - 8.2 Risk Score Prediction (Random Forest)
9. [External Integrations & DPI](#9-external-integrations--dpi)
10. [Cross-Cutting Concerns](#10-cross-cutting-concerns)

---

## 1. System Overview

**SaathiAI** is a WhatsApp-native placement orchestration platform designed for India's vocational skilling ecosystem. It bridges:

- **Learners** (ITI / PMKVY graduates) — interact exclusively via WhatsApp voice + text
- **Placement Officers** (ITI staff) — manage cohorts, track placements, message learners, generate reports
- **Employers** (MSMEs) — post vacancies, browse candidates, manage a recruitment pipeline, register for NAPS
- **DSSDO/District Officers** — district-level analytics and oversight

The platform integrates with India's Digital Public Infrastructure (DPI):
- **Sandbox.co.in** — Aadhaar OTP KYC + Entity Locker for business verification
- **Skill India Digital Hub (SIDH)** — live job feed via API
- **NAPS** — National Apprenticeship Promotion Scheme registration & claims

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│   Learner (WhatsApp)                                     │
│   Voice / Text / Images                                  │
└──────────────────────────┬──────────────────────────────┘
                           │ whatsapp-web.js
                           ▼
┌─────────────────────────────────────────────────────────┐
│   BOT  (Node.js)                                         │
│   ConversationEngine ← PlacementTrackerService           │
│   EmployerPingService  GeminiClient / SarvamASR          │
│   ExtractionService    DocumentStorageService            │
└───────────────┬──────────────────────────────────────────┘
                │ REST (HTTP)
       ┌────────┴────────┐
       ▼                 ▼
┌──────────────┐   ┌─────────────────────────────────────┐
│  AISERVER    │   │  BACKEND  (Node.js / Express / tRPC) │
│  (FastAPI)   │   │  Auth, Dashboard, Employer, Msgs,    │
│  /convert    │   │  Reports, Cohorts, Officer, District │
│  /predict    │   │                                      │
└──────────────┘   └────────────────┬────────────────────┘
                                    │ Supabase (PostgreSQL)
                                    ▼
┌─────────────────────────────────────────────────────────┐
│   FRONTEND  (Next.js 14, App Router)                     │
│   Officer Dashboard | Employer Portal | Cohort Mgmt      │
│   MIS Reports | Messaging | Public Skill Cards           │
└─────────────────────────────────────────────────────────┘
```

### Service Ports (default)

| Service    | Port  | Tech Stack                       |
|-----------|-------|----------------------------------|
| Backend   | 3000  | Node.js, Express, tRPC, Supabase |
| Bot       | 3001  | Node.js, whatsapp-web.js         |
| Frontend  | 3002  | Next.js 14 (App Router)          |
| AI Server | 5000  | Python, FastAPI, Docling, sklearn |

---

## 3. Database Schema

All tables live in Supabase (PostgreSQL). Migrations are ordered `001` → `007`.

### Core Tables (Migration 001)

| Table         | Description |
|--------------|-------------|
| `users`       | Mirror of `auth.users`. Stores `role` (employer/trainee/officer/dssdo/admin), phone, email, full_name, district |
| `learners`    | Core learner profile: phone (UNIQUE), trade, district, state, cohort, status (active/placed/dropped/at_risk), risk_score (0–100), officer_id |
| `sessions`    | WhatsApp bot session state per learner. Stores `step` and a `data` JSONB blob |
| `jobs`        | Basic job listings (title, company, location, trade, is_active, posted_by) |
| `applications`| Learner × Job application with status (applied/shortlisted/interviewed/hired/rejected). UNIQUE(learner_id, job_id) |
| `skill_cards` | AI-generated skill cards per learner (trade, skills[], certificate_type, verification_status) |
| `placements`  | Confirmed placements (learner_id, job_id, confirmed_by, placement_date, salary, notes) |
| `events`      | Append-only audit log (learner_id, event_type, source=bot/backend/manual, metadata JSONB) |

### Cohorts (Migration 002)

| Table    | Description |
|---------|-------------|
| `cohorts` | Cohort entity (name, officer_id, start_date, end_date, batch_year, district, trade, total_learners, is_active) |

### Job Flow (Migration 002b)

| Table               | Description |
|--------------------|-------------|
| `matches`           | Vacancy × Learner pipeline state machine (stage enum, timeline JSONB, skill_card_token, offer_salary) |
| `messages`          | Officer/employer ↔ learner WhatsApp messaging log (direction, content, source, status, reply_to_id) |
| `retention_checks`  | Post-placement check-ins at day 7 (salary), 30, 60, 90 (retention) |

### Employer Portal (Migration 003)

| Table        | Description |
|-------------|-------------|
| `employers`  | 1:1 with users WHERE role='employer'. Stores company_name, udyam_number, gstin, district, state, total_employees, trade_categories, verification_status, employer_risk_score, naps_registered |
| `vacancies`  | Structured job postings (title, trade_required, nsqf_level_min/max, salary_min/max, location, shift_type, naps_eligible, openings, minimum_wage_compliant, status, expires_at) |
| `naps_claims`| Monthly NAPS stipend claims (employer_id, vacancy_id, learner_id, stipend_amount=1500, claim_month YYYY-MM, status, submission_ref) |

### Additional Migrations

| Migration | Feature |
|----------|---------|
| 004 — Aadhaar KYC | Adds aadhaar_number, aadhaar_name, dob, gender, address JSON, aadhaar_photo_url to `learners` |
| 005 — Employer Verification | Adds verification_type (none/aadhaar/entitylocker) to employers; entity KYC fields |
| 006 — Language Placement | Adds language, script fields to learners and sessions for multilingual bot |
| 007 — Placement Loop | Adds placement_company, placement_role, placement_salary, placement_location, placement_date, placement_reported_at, current_salary, salary_reported, retention_status, left_at, tenure_days to `placements` and `learners` |

### Key Indexes

- `learners`: phone, status, district, trade, cohort, risk_score, officer_id, full_name (trigram for fuzzy search)
- `vacancies`: employer_id, status, trade_required
- `matches`: employer_id, learner_id, vacancy_id, stage
- `events`: learner_id, event_type, source, created_at

---

## 4. Backend — Express + tRPC API

The backend is a Node.js/Express application using **tRPC** for type-safe RPC between frontend and backend. All tRPC procedures are mounted at `/trpc`.

### 4.1 Authentication (`auth.*`)

#### `auth.signin` — Public Mutation
Signs in a user with email/phone + password + role.

- Role-specific identifier routing: learners use phone, officers/employers use email
- Validates the role in DB matches what was passed
- Returns: `{ access_token, refresh_token, user: { id, role, email, phone, full_name } }`

#### `auth.signup` — Public Mutation
Role-discriminated union signup with strict Zod validation.

**Learner signup**: phone + password + full_name  
**Employer signup**: email/phone + password + company_name + contact_name + optional Udyam number + optional KYC data (aadhaar_kyc or entity_data)  
**Officer signup**: email + password + full_name + iti_name + district  
**DSSDO signup**: email + password + full_name + district  
**Admin signup**: email + password + full_name

Creates Supabase `auth.users` entry then writes to `public.users` with role-specific fields.

#### `auth.refresh` — Public Mutation
Refreshes an expired JWT using a valid refresh token.

#### `auth.signout` — Protected Mutation
Revokes the current session from Supabase auth.

#### `auth.me` — Protected Query
Returns the current user's profile from JWT context.

#### `auth.employerAadhaarOtp` — Public Mutation
Sends an Aadhaar OTP via Sandbox.co.in for employer KYC.
Input: `{ aadhaarNumber: string (exactly 12 digits) }`
Returns: `{ referenceId, transactionId }`

#### `auth.employerAadhaarVerify` — Public Mutation
Verifies the Aadhaar OTP. Returns full KYC data: name, dob, gender, address, base64 photo.
Throws `BAD_REQUEST` for invalid OTP, `BAD_GATEWAY` for Sandbox errors.

#### `auth.initEntityLockerSession` — Public Mutation
Initiates an EntityLocker (business KYC) session via Sandbox.
Input: `{ redirectUrl: string (HTTPS URL) }`
Returns: `{ authorizationUrl, sessionId }`
Session expires after 2 hours.

#### `auth.getEntityLockerDetails` — Public Query
Fetches entity details after EntityLocker OAuth consent.
Returns: `{ id, name, email, mobile, dateOfIncorporation, verifiedBy: 'pan'|'ud'|'cin' }`

---

### 4.2 Officer Dashboard (`dashboard.*`)

All procedures require `officerProcedure` (role = officer/dssdo/admin).

#### `dashboard.cohortStats` — Query
Top-level KPI stats for the dashboard header.
Filters: `cohort_id?`, `district?`
Returns: `{ total, placed, at_risk, active, dropped, placement_rate }`

#### `dashboard.priorityInbox` — Query
Learners ranked by risk score needing officer attention TODAY.
Filters: `cohort_id?`, `district?`, `limit` (default 10)
Returns list with: `{ id, full_name, phone, status, risk_score, trade, district, cohort, days_since_update, reason, urgency: 'critical'|'follow_up'|'check_in' }`

Urgency logic:
- `critical` → risk_score > 70 OR status = 'at_risk'
- `follow_up` → risk_score > 40 OR days_since_update > 7
- `check_in` → everything else

#### `dashboard.cohortTimeline` — Query
All learners mapped to their journey stage for a funnel view.
Stage pipeline: `onboarded → verified → first_match_sent → interest_expressed → interview_confirmed → placed`
Includes: stage_index, placement_date, applications_count

#### `dashboard.recentPlacements` — Query
Recently confirmed placements with salary discrepancy detection.
Parameters: `days` (default 14), `limit` (default 20)
Each placement includes: reported_salary, discrepancy (`{ flagged, percentage, gap }`), photo_url, retention_status

#### `dashboard.learner.list` — Query
Paginated learner list with filters: status, cohort_id, district, trade, risk_score_min/max
Returns paginated list ordered by risk_score descending

#### `dashboard.learner.byId` — Query
Full learner profile: learner row + applications (match history) + placements + AI summary + suggestedAction
- Computes salary discrepancy between claimed and reported salary
- Generates contextual `suggestedAction` based on learner state

#### `dashboard.learner.updateStatus` — Mutation
Updates learner status (active/placed/dropped/at_risk)

#### `dashboard.learner.addNote` — Mutation
Appends an officer note to the events log (event_type = 'officer_note')

#### `dashboard.placements.confirm` — Mutation
Confirms a learner placement: inserts placement record, updates learner status to 'placed', logs event.
Source options: 'saathai_match'|'officer_direct'|'learner_self'

#### `dashboard.placements.list` — Query
Paginated list of placements with optional filters (learner_id, date range)
Enriches each row with salary discrepancy and retention_status

#### `dashboard.employers.list` — Query
Employer directory with job counts and verification status

#### `dashboard.employers.byId` — Query
Employer detail: user info + all jobs + all placements + verification status

#### `dashboard.employers.createManualMatch` — Mutation
Officer-initiated manual match between a learner and a job
Creates an application record with '[Officer Match]' note

#### `dashboard.cohort.activate` — Mutation
Activates a new cohort by bulk-inserting learners (dedup by phone).
Returns: `{ cohort, inserted, skipped, total }`
Triggers risk score update for each new learner.

#### `dashboard.reports.cohortHealth` — Query
Weighted cohort health score (0–100).
Formula: `placement_rate * 0.6 + (1 - atRiskRatio) * 100 * 0.4`
Returns: `{ total, placed, at_risk, active, dropped, placement_rate, health_score, health_label: 'Good'|'Fair'|'Needs Attention' }`

---

### 4.3 Employer Portal (`employer.*`)

All `employer.*` procedures require `employerProcedure` (role = employer).

#### `employer.profile.get` — Query
Fetches the authenticated employer's profile from the `employers` table.
Returns null if profile not yet created (graceful for new users).

#### `employer.profile.upsert` — Mutation
Creates or updates the employer profile.
If Udyam number is provided, it calls `verifyUdyam()` (mocked) to populate company_name, trade_categories, gstin, total_employees, district, state from the registry.
Sets `verification_status`: `phone_verified` → `udyam_verified` on success.

#### `employer.profile.computeRiskScore` — Mutation
Re-computes the employer's risk score using `computeEmployerRiskScore()` service.
Stores the result back in `employers.employer_risk_score`.

#### `employer.vacancies.list` — Query
Paginated list of the employer's own vacancies.
Filters: status (draft/active/paused/closed/flagged), trade, naps_eligible
Ordered by created_at descending.

#### `employer.vacancies.get` — Query
Get a single vacancy by ID (with ownership check).

#### `employer.vacancies.create` — Mutation
Creates a new job vacancy. Features:
- **Minimum Wage Compliance Check**: Validates salary_min against state minimum wage table for the trade. If non-compliant, sets status = 'flagged'.
- Auto-creates minimal employer profile if one doesn't exist yet.
- Returns `minimum_wage_warning` object if flagged.

Vacancy fields: title, trade_required, nsqf_level_min/max, salary_min/max, location, district, state, description, working_hours, shift_type (day/night/rotational), naps_eligible, openings, status (draft/active)

#### `employer.vacancies.update` — Mutation
Updates a vacancy (with ownership check). Re-runs minimum wage compliance check if salary or trade changed.

#### `employer.vacancies.delete` — Mutation
Soft-deletes a vacancy by setting status = 'closed'.

#### `employer.vacancies.previewTargetCount` — Query
Returns the count of active learners matching the given filters (trade, district, location).
Used to preview audience size before broadcasting.

#### `employer.vacancies.broadcast` — Mutation
**The core matching engine.** Broadcasts a vacancy to all matching active learners.

Full flow:
1. Verifies vacancy ownership
2. **Rate limit**: Max 5 broadcasts per employer per calendar day (IST)
3. Queries learners matching: trade (fuzzy ilike + prefix matching), district, location
4. Optionally excludes learners with existing match records (`exclude_applied`)
5. Creates `matches` rows with stage = 'new_match' (upsert, ignores duplicates)
6. Calls bot `/internal/broadcast` API to deliver WhatsApp notifications to all matching learner phones
7. On bot failure: rolls back match records to maintain consistency
8. Returns: `{ count, broadcast_at }`

Trade matching is fuzzy: splits by comma, does ilike on each trade, then also tries 5-char prefix matches (e.g., "Elect" matches "Electrician" and "Electronics").

#### `employer.pipeline.list` — Query
The hiring pipeline for the employer.
Filters: vacancy_id, stage
Returns matches with joined learner data (full_name, phone, trade, district, risk_score, aadhaar_photo_url) and vacancy data.
Also returns `employer_verification_status` attached to each match.

#### `employer.pipeline.transition` — Mutation
Advances a match through the pipeline state machine.

**Stages**: `new_match → skill_card_viewed → interest_expressed → interview_scheduled → interview_completed → offer_extended → hired → rejected`

- Validates the transition is legal (enforced state machine)
- Appends a timeline event to `matches.timeline` (stage, timestamp, actor, note)
- Optionally records `interview_at` and `offer_salary`
- **On 'hired' stage**: Triggers a cascade:
  - Creates a `jobs` row for the placement
  - Creates a `placements` row (idempotent)
  - Updates `learners.status = 'placed'` + placement fields
  - Logs 'placement_confirmed' event
  - Fire-and-forget: calls bot `/internal/schedule-retention` to set up 7/30/60/90-day check-ins
- Fires Supabase Realtime broadcast event `pipeline:transition` for live officer dashboard updates

#### `employer.pipeline.getCandidateDetail` — Query
Full candidate detail for a specific match, including skill_cards.

#### `employer.naps.status` — Query
NAPS registration status and eligibility check.
Returns: `{ registered, registration_ref, total_employees, eligibility: { eligible, minEmployees, reason }, claims[] }`

#### `employer.naps.napsCompliance` — Query
NAPS compliance checklist + heuristic compliance score (0–100).
Checklist items:
1. NAPS registration (30 pts)
2. Registration reference on file (20 pts)
3. NAPS-eligible active vacancies (25 pts)
4. Approved reimbursement claims (25 pts)
Returns: `{ score, registered, checklist[{ item, status: 'ok'|'pending'|'missing', detail }], claims_summary }`

#### `employer.naps.register` — Mutation
Registers employer for NAPS.
- Minimum 4 employees required for eligibility
- Calls `submitNapsRegistration()` service
- Returns confirmation with registration reference
- Message includes: "Government will reimburse ₹1,500/month per apprentice"

#### `employer.naps.submitClaim` — Mutation
Submits a monthly NAPS reimbursement claim.
- Validates NAPS registration first
- Prevents duplicate claims for same (employer, vacancy, month)
- Input: `{ vacancy_id, learner_id?, claim_month: 'YYYY-MM' }`

#### `employer.analytics.*` — Analytics sub-router
Employer-specific analytics derived from matches and placements.
Returns pipeline funnel data: counts at each match stage, conversion rates, response rate metrics.

#### `skillCard.*` — Public router (no auth)
Validates a time-limited token from match.skill_card_token, returns the learner's skill card.
Used when employer clicks "View Skill Card" in the pipeline.

#### `employer.messaging.*`
Sub-router for employer-to-learner messaging (sends pings via the bot).
Rate limit: 5 pings per employer per learner per day.

---

### 4.4 Messaging (`messaging.*`)

All procedures require `officerProcedure`.

#### `messaging.sendPing` — Mutation
Sends a WhatsApp ping from an officer to a learner.
- Validates learner exists
- **Rate limit**: 20 pings per officer per learner per calendar day (IST)
- Inserts message record in `messages` table (direction='to_learner', source='dashboard')
- Calls bot `/internal/send-ping` to deliver via WhatsApp
- On bot failure: updates message status to 'failed'
- Returns: `{ success, messageId, createdAt }`

#### `messaging.getThread` — Query
Fetches the conversation thread between officer and learner.
Returns messages ordered chronologically (ascending).
Supports pagination with limit (max 200) and offset.

#### `messaging.updateMessageStatus` — Mutation
Updates delivery status of messages (sent/delivered/read/failed).
Accepts up to 100 message IDs per call.

---

### 4.5 MIS Reports (`reports.*`)

#### `reports.generate` — Mutation (officerProcedure)
Generates a comprehensive MIS (Management Information System) report.
- Validates date range (start ≤ end)
- Validates officer/dssdo/admin role
- 30-second timeout enforced
- Returns `{ hasData, data }`

Report data includes:
- **Summary**: total, placed, active, at_risk, dropped
- **Placement Rate**: percentage (2 decimal places)
- **Average Salary**: COALESCE priority — current_salary (bot 90-day) > salary_reported (bot 7-day) > salary (officer-confirmed)
- **Retention Rates**: at 30, 60, 90 days (% retained among checks performed)
- **Employer Breakdown**: count of placements per company, sorted descending
- **Trade Distribution**: count of learners per trade, sorted descending
- `generatedAt` timestamp + filter params echoed back

#### `reports.list` — Query (officerProcedure)
Lists previously generated reports for the officer (from `mis_reports` table).

#### `reports.download` — Query (officerProcedure)
Generates and returns a downloadable report (PDF/HTML via `reportRendererService`).

---

### 4.6 Cohort Management (`cohort.*`, `cohorts.*`)

#### `cohort.create` — Mutation
Creates a cohort from an uploaded document.
Accepts: PDF, JPEG, PNG, DOCX, CSV
Uses `documentParserService` to extract text, then LLM to identify learner records.
Auto-enrolls parsed learners.

#### `cohort.list` — Query
Lists all cohorts with learner counts and status.

#### `cohort.get` — Query
Fetches single cohort details with full learner list.

#### `cohorts.*` — CRUD sub-router
Full CRUD for cohort management from the officer dashboard:
- `cohorts.list`: Lists all cohorts for the officer
- `cohorts.create`: Creates a named cohort
- `cohorts.update`: Updates cohort metadata
- `cohorts.delete`: Removes an empty cohort

---

### 4.7 Officer Onboarding (`officer.*`)

#### `officer.enrollLearner` — Mutation
Manually enrolls a single learner into a cohort.
Input: `{ phone, full_name, trade, district, cohort_id }`
Deduplicates by phone; assigns the creating officer's ID.

---

### 4.8 District Console (`district.*`)

Procedures accessible to `dssdo` and `admin` roles.

- `district.stats`: Cross-district aggregated stats (total learners, placements, at-risk counts)
- `district.learners`: District-filtered learner list
- `district.analyticsOverview`: District-level analytics using `getDistrictAnalytics()` service

---

### 4.9 REST Routes

#### `POST /api/documents/upload`
Accepts file upload (multipart/form-data), runs through `documentParserService`, returns:
```json
{ "validEntries": [...], "invalidEntries": [...], "totalExtracted": N }
```
Supports: CSV, PDF, JPEG, PNG, DOCX. Max 10MB.

For CSV: fuzzy header matching (name/phone/trade columns)  
For PDF/DOCX: Docling OCR → LLM extraction  
For images: concurrent Docling processing → concatenated → LLM extraction

#### `GET /api/cohorts` / `POST /api/cohorts`
REST cohort CRUD (legacy, parallel to tRPC cohorts router).

#### `POST /admin/broadcast` or `POST /internal/broadcast`
Bot webhook: broadcasts a vacancy notification to a list of learner IDs.
Called by the employer portal's `broadcast` tRPC mutation.

#### `POST /internal/send-ping`
Bot webhook: delivers a WhatsApp ping to a learner by learnerId.

#### `POST /internal/schedule-retention`
Bot webhook: schedules salary capture (day 7) and retention checks (days 30, 60, 90) for a newly hired learner.

#### `POST /internal/extract-aadhaar`
Accepts a base64-encoded Aadhaar card image (up to 15MB), extracts the Aadhaar number using the AI server + LLM.

---

## 5. Backend Services

### `authService.ts`
- `loginWithEmailPassword(email?, phone?, password)`: Supabase Auth sign-in
- `signupUser(input)`: Role-discriminated signup — creates Supabase auth user + public.users row + role-specific data (employer profile, officer profile, etc.)
- `refreshAccessToken(refresh_token)`: Supabase token refresh
- `revokeSession(userId)`: Supabase sign-out

### `sandboxService.ts`
Sandbox.co.in API client with in-memory token caching (23-hour TTL, 5-minute early refresh):
- `generateAadhaarOtp(aadhaarNumber)` → `{ referenceId, transactionId }`
- `verifyAadhaarOtp(referenceId, otp)` → `{ aadhaarNumber, name, dob, gender, address, photo }` (base64 JPEG)
  - Handles Sandbox's quirk of returning 200 for invalid OTPs (checks message/status fields)
  - Strips `data:image/...;base64,` prefix from photo
- `initEntityLockerSession(flow, redirectUrl, consentExpiry)` → `{ authorizationUrl, sessionId }`
- `getEntityDetails(sessionId)` → `{ id, name, email, mobile, dateOfIncorporation, verifiedBy }`

### `documentParserService.ts`
Handles document-to-learner-records extraction pipeline:
- **CSV**: Fuzzy header matching (name/phone/trade synonyms) → structured rows
- **PDF/DOCX**: Docling REST API → text + structured tables → LLM extraction
- **Images (JPEG/PNG)**: Parallel Docling calls → concatenated with PAGE BREAK delimiters → LLM extraction
- **Table-based extraction**: LLM maps column headers to name/phone/trade fields (with caching)
- **Text-based extraction**: LEARNER_EXTRACTION_PROMPT → Gemini/Groq JSON response
- Validates Indian mobile numbers (10 digits, starts with 6–9)
- Strips +91/91 prefixes from phones
- Flags low-confidence extractions (< 0.7 threshold)

### `llmService.ts`
Unified LLM client with Groq (primary) + Gemini (fallback):
- `generateContent(prompt)`: Text generation
- `mapTableColumns(headerRow, sampleRow)`: Returns `{ status: 'HEADER'|'DATA'|'SKIP', mapping: { name?, phone?, trade? } }`
- Provider selection based on `LLM_PROVIDER` env var

### `misReportService.ts`
- `generateReport(params)`: Full MIS report with 30-second timeout
- Validates officer role from DB
- Computes: placement rate, average salary (bot-captured preferred), retention rates at 30/60/90 days, employer breakdown, trade distribution

### `analyticsService.ts`
- `getDashboardStats()`: Aggregate KPIs (total, active, placed, at_risk, dropped learners; jobs; applications; placements; placement_rate)
- `getDistrictAnalytics(district?, from?, to?)`: District-grouped stats with top-5 trades per district

### `employerService.ts`
- `verifyUdyam(udyamNumber)`: Validates Udyam number format, returns mock company data
- `submitNapsRegistration(udyam, companyName, totalEmployees)`: Mock NAPS registration → returns `{ success, registration_ref }`
- `getNapsEligibility(totalEmployees)`: Returns `{ eligible: boolean, minEmployees: 4, reason }`
- `checkMinimumWageCompliance(salaryMin, trade, state)`: Checks against state minimum wage table
- `getMinimumWage(trade, state)`: Returns minimum monthly wage for trade × state combination
- `computeEmployerRiskScore(employerId)`: Heuristic risk score (0–100) based on vacancy behaviour, compliance, claims
- `isValidTransition(from, to)`: Pipeline state machine validator
- `appendTimelineEvent(timeline, stage, actor, note)`: Appends a timestamped event to match timeline JSON

### `riskService.ts`
- `triggerRiskScoreUpdate(learnerId, input)`: Calls AI server `/predict-risk`, stores result in `learners.risk_score`
- `computeProfileCompleteness(profile)`: Returns 0–100 based on filled fields (name, trade, district, phone)

### `sidhScrapingService.ts`
SIDH (Skill India Digital Hub) live job feed integration:
- `classifySector(jobTitle)`: LLM maps job title → SIDH sector (from 30 official sector names)
- `fetchJobsFromApi(sector, state, pageSize, pageNumber)`: Direct POST to SIDH internal API (`https://api-fe.skillindiadigital.gov.in/api/jobs/filter`)
- `fetchJobsForLearner(jobTitle, state)`: Combined classify + fetch
- Returns structured `SidhJob[]`: sidhId, detailUrl, title, company, source, venue, date, location, sector, joiningType, salaryText, vacancyCount, minEduQual

### `reportRendererService.ts`
Renders MIS reports as HTML/PDF using a templating approach. Produces formatted output for download.

### `eventService.ts`
Helper to insert events into the `events` table.

### `learnerService.ts`
Helper for learner CRUD operations.

### `placementService.ts`
Helper for placement record operations.

---

## 6. Frontend — Next.js Web Application

Built with **Next.js 14 (App Router)**, TypeScript, vanilla CSS, Framer Motion, tRPC client.

### 6.1 Authentication & Login (`/signin`, `/`)

**File**: `src/components/auth/LoginPage.tsx` (1,927 lines)

Full-featured multi-role login/signup page:

#### Login Form
- Role selector with animated cards: Job Seeker 🎓 (green), Employer 🏢 (orange), Trainer 🧑‍🏫 (blue), Admin 🛡️ (purple)
- Role-specific identifier field: phone for learners, email for others
- Password strength meter (5-level: Too Weak → Very Strong)
- Animated left panel with floating stat cards (stat values from i18n)
- Mobile-responsive: collapsing stat pill with rotating carousel

#### Employer Signup Flow (multi-step)
Step 1: **Verification Method Selection**
  - Option 1: No verification (basic signup)
  - Option 2: Aadhaar KYC (individual verification)
  - Option 3: Entity Locker (business verification via Sandbox)

Step 2a: **Aadhaar KYC**
  - Aadhaar number input (12-digit validation)
  - OTP request → OTP entry
  - On success: pre-fills name from KYC data

Step 2b: **Entity Locker**
  - Redirects to Sandbox authorization URL
  - Polls/reads session ID from URL params after redirect
  - Fetches entity details (company name, mobile, email pre-filled)

Step 3: **Contact + Password Form**
  - Company name display (from KYC)
  - Full name, email, mobile inputs
  - Password with confirmation + strength meter
  - Terms acceptance

All steps use `react-hook-form` + Zod validation. Smooth `AnimatePresence` transitions between steps.

### 6.2 Officer Dashboard

#### `/dashboard/officer` — Overview Page
**KPI Cards**: Total Learners, Placed (with placement rate %), At Risk, Active  
**Priority Action Inbox**: Ranked learner list with urgency badges (Critical/Follow Up/Check In), click-to-navigate  
**Cohort Health Score**: Animated SVG donut chart showing weighted score (0–100) + label  
**Cohort Journey Timeline**: Horizontal funnel bars for 6 stages, animated progress fill  

All data via tRPC with loading skeletons (shimmer animation).

#### `/dashboard/officer/learners/[id]` — Learner Profile
Full learner profile with:
- Basic info, risk score, trade, district, cohort
- Aadhaar photo (if available)
- AI-generated summary text
- Suggested action card
- Application history
- Placement history with salary discrepancy flag
- Officer notes (add note button → `dashboard.learner.addNote`)
- Status update controls

#### `/dashboard/officer/cohorts` — Cohort Management
- List of all cohorts with learner counts
- Create cohort via document upload
- View cohort details + learner list
- Export functionality

#### `/dashboard/officer/placements` — Placements View
Paginated list of confirmed placements.
Each row shows: learner photo, name, company, role, salary (claimed vs reported), discrepancy flag, retention status.

#### `/dashboard/officer/employers` — Employer Directory
Searchable/filterable employer list.
Each employer shows: company name, verification status badge, active job count, trade categories.
Click-through to employer detail with hiring history.

#### `/dashboard/officer/search` — Global Search
Cross-entity search across learners, employers, jobs.

#### `/dashboard/officer/onboard` — Manual Onboarding
Form to manually enroll a learner: name, phone, trade, district, cohort assignment.

### 6.3 Employer Portal

#### `/dashboard/employer` — Employer Overview
Quick stats: active vacancies, pipeline matches, NAPS status badge  
Navigation sidebar with tabs: Vacancies, Pipeline, NAPS, Analytics

#### `/dashboard/employer/vacancies` — Vacancy Management
List of vacancies with status chips (draft/active/paused/closed/flagged).

**`/dashboard/employer/vacancies/new`** — Create Vacancy Form  
Fields: title, trade, NSQF level (1–8), salary range, location, shift type, NAPS-eligible toggle, openings count  
Live minimum-wage warning if salary_min is below state minimum.

**`/dashboard/employer/vacancies/[id]`** — Vacancy Detail  
Full vacancy detail + edit form + broadcast controls.

**SmartTargetingPanel** (`src/components/employer/SmartTargetingPanel.tsx`):
- Employer-facing audience targeting UI
- Inputs: trade, district, location filters
- Live audience preview count via `employer.vacancies.previewTargetCount`
- `exclude_applied` toggle
- Broadcast button → `employer.vacancies.broadcast`

**VacancyActionsMenu** (`src/components/employer/VacancyActionsMenu.tsx`):
- Context menu for vacancy actions: edit, broadcast, pause, close, NAPS claim

#### `/dashboard/employer/pipeline` — Hiring Pipeline
Kanban-style or list view of all match records.
Filters: by vacancy, by stage.  
Each candidate card: learner name, trade, district, risk score, Aadhaar photo.

**`/dashboard/employer/pipeline/[matchId]`** — Candidate Detail  
Full candidate view (skill cards, match timeline).  
Pipeline action buttons: Express Interest, Schedule Interview, Extend Offer, Hire, Reject.  
Each action calls `employer.pipeline.transition` with optional `interview_at` and `offer_salary`.

#### `/dashboard/employer/naps` — NAPS Management
Shows: registration status, eligibility check, compliance checklist with score.  
Register button → `employer.naps.register`.  
Submit claim button per NAPS-eligible placement.

#### `/dashboard/employer/analytics` — Employer Analytics
Pipeline funnel visualization: counts and conversion rates at each stage.
Hire rate, response rate, average time-to-hire metrics.

### 6.4 Messaging Interface

#### `/messaging` — Message Center (Officer)
Thread view for officer ↔ learner conversations.
- List of recent threads
- Send message button → `messaging.sendPing`
- Message thread with timestamps and delivery status

### 6.5 MIS Reports

#### `/reports` — Reports Page
Generate report form: officer's cohort, date range (from/to).  
On submit → `reports.generate`.  
Report display:
- Summary KPI cards
- Placement rate
- Average salary
- Retention funnel (30/60/90 day rates)
- Employer breakdown table
- Trade distribution chart
- Download as PDF button

### 6.6 Public Skill Cards (`/s/[token]`)

Token-validated public skill card page (no login required).
- Token from `matches.skill_card_token`
- Expires at `matches.skill_card_token_exp`
- Shows: learner name (partial), trade, skills list, certificate type, verification badge

### 6.7 i18n / Internationalisation

**File**: `src/lib/i18n.ts`
- Supports: English, Hindi (हिंदी), Hinglish (Roman Hindi)
- `messages/` directory with JSON translation files per locale
- `LocaleContext` with `useLocale()` hook
- `LanguageSwitcher` component in the navbar
- Login page fully translates all labels, stats, error messages
- Detects browser preference, allows manual override

---

## 7. Bot — WhatsApp Conversational Engine

The bot uses **whatsapp-web.js** to connect as a WhatsApp Web client. The core logic is in `ConversationEngine.js` (1,473 lines) which handles a multi-step state machine.

### Session & State Management

Each learner has a `session` object stored in Supabase (`sessions` table):
```js
{
  phone, learnerId, step, script, language,
  placementStatus, collected: { name, trade, district, state, certificateType, skills },
  cardUrl, context: { ... }, lastProcessedMessageIds: [],
  createdAt, lastInteractionAt
}
```

**Chat history**: Last 10 exchanges stored in `session.context.chatHistory` for AI context.

**Duplicate detection**: `lastProcessedMessageIds` (last 5 IDs) prevents double-processing.

**Steps** (state machine):
```
NEW → LANGUAGE_SELECT → ONBOARDING_NAME → ONBOARDING_TRADE →
ONBOARDING_CERTIFICATE → ONBOARDING_DOCUMENTS → AADHAAR_OTP_SENT →
SKILL_EXTRACTION → SKILL_CARD_SHOWN → JOBS_SHOWN → JOB_APPLIED →
INTERVIEW_Q1 → INTERVIEW_Q2 → INTERVIEW_Q3 →
EMPLOYER_PING_REPLY → PLACEMENT_DETAILS →
SALARY_CAPTURE → SALARY_RETRY →
RETENTION_CHECK → RETENTION_RETRY →
PLACED → STOPPED → TRACKING
```

### 7.1 Onboarding Flow

1. **Language Select**: User picks from 6 options (English, Hindi, Hinglish, Marathi, Gujarati, Bengali). Script detection auto-chooses Devanagari vs Roman script based on Unicode analysis.

2. **Name Collection** (`ONBOARDING_NAME`): LLM extracts proper name from natural text. Handles "yes/no" responses gracefully. Re-prompts on unclear input.

3. **Trade & District** (`ONBOARDING_TRADE`): LLM `extractProfile()` parses trade, district, state from conversational text (e.g., "Main Varanasi mein Electrician hoon"). Handles missing fields with targeted re-prompts.

4. **Certificate** (`ONBOARDING_CERTIFICATE`): LLM `extractCertificate()` identifies certificate type (ITI/PMKVY/JSS/NSQF etc.). Profile confirmation step shows summary for user to confirm/correct.
   - If trade conflicts with previous trade: asks whether to merge (add both) or replace.

### 7.2 Aadhaar KYC via Sandbox (`ONBOARDING_DOCUMENTS`)

Conditional on `isDocumentUploadEnabled()` feature flag.

**Phase: `number`**
- User sends Aadhaar card photo (JPEG/PNG/PDF) → extracted via `sandboxKycService.extractAadhaarNumber()`
- Or types the 12-digit Aadhaar number directly
- Validates format (exactly 12 digits)
- Calls `generateAadhaarOtp()` → transitions to `otp` phase

**Phase: `otp`** (`AADHAAR_OTP_SENT`)
- User types the OTP sent to their Aadhaar-registered mobile
- Up to 3 OTP entry attempts
- On 3rd failure: 1 OTP re-generation allowed (new OTP sent)
- On success: KYC data saved to DB via `store.saveKycData()`, Aadhaar photo uploaded to Supabase Storage
- Transitions to `certificate` phase

**Phase: `certificate`**
- User uploads their training certificate (ITI marksheet, PMKVY certificate, etc.)
- Stored via `documentStorageService.uploadDocument()`
- Transitions to SKILL_EXTRACTION

### 7.3 Skill Extraction (`SKILL_EXTRACTION`)

LLM-powered extraction of skills from conversational description.
Prompt: ask user to describe what they can do, tools they've used, machines they've operated.
`extractionService.extractSkills()` parses response into structured skills array.
Generates a **Skill Card** via `skillCardService.generateSkillCard()`.
Skill card URL stored and sent to user.

### 7.4 Job Matching (`JOBS_SHOWN`)

After skill card:
- Queries SIDH API via `sidhScrapingService.fetchJobsForLearner(trade, state)` for live jobs
- Falls back to internal `jobs` table if SIDH returns nothing
- Shows up to 5 job options (numbered list)
- User picks a number → confirms interest → creates application record

**`jobService.verificationLabel()`**: generates human-readable verification badge text for job listings.

### 7.5 Interview Practice (`INTERVIEW_Q1/Q2/Q3`)

Activated by keyword "PRACTICE" or `keyword === 'practice'`.
3-question mock interview:
- Q1: Why do you want this job?
- Q2: What skills do you have?
- Q3: When can you start?

User answers stored in session. At end, AI evaluates and gives feedback.
Uses `interviewService.js` for question generation and evaluation.

### 7.6 Placement Tracking (`PlacementTrackerService`)

After a learner is confirmed placed (either by employer hire or officer confirm):

**Day 7 — Salary Capture**:
- Bot sends: "Nayi job mein monthly salary kitni hai?"
- LLM `_extractSalaryViaLLM()` extracts INR amount from Hindi/Hinglish text
  - Handles: "15000", "15 hazar", "pandraa hazaar", "15k", daily wage → monthly, annual → monthly
- Validates range: ₹1,000 – ₹1,00,000
- On success: updates `placements.salary_reported`
- On failure after 2 attempts: marks `retention_status = 'unknown'` for officer review
- 48-hour timeout: if no response, marks 'no_response'

**Days 30, 60, 90 — Retention Checks**:
- Bot sends retention check in learner's language (Devanagari/Roman/English)
- LLM `_classifyRetentionResponse()` classifies: `retained | left | unclear`
  - Handles: "haan", "yes", "kaam kar raha hoon" (retained); "nahi", "chhod diya", "fired" (left)
- **Retained**: Logs event, updates check record. At day 90: asks if salary changed (additional salary capture sub-flow)
- **Left**: Updates `placements.retention_status = 'left'`, records `left_at`, `tenure_days`. Cancels remaining pending checks. Resets session to JOBS_SHOWN for re-matching.
- **Unclear**: One re-prompt. After retry: marks 'no_response'.
- 48-hour timeout + reminder system: sends reminder message 48h after check is sent; marks final 'no_response' 24h after reminder.

**Polling Loop**: `startPolling()` runs every 5 minutes via `setInterval`:
1. Checks for due salary nudges (check_day=7, status='pending', now ≥ placement_date + 7 days)
2. Checks for due retention checks (days 30/60/90, status='pending', now ≥ placement_date + N days)
3. Checks for salary timeouts (48h without response)
4. Checks for retention timeouts (48h + 24h)

### 7.7 Employer Ping & Relay

**EmployerPingService** — WhatsApp-native employer messaging:

**Employer-to-learner ping**:
Command format: `msg learner:<10-digit-phone>: <message>`
1. Parses command with regex
2. Validates Indian mobile format (starts 6–9)
3. Verifies sender is a registered employer in DB
4. Validates learner exists
5. Rate limit: 10 pings per employer per learner per day (IST)
6. Content safety filter (checks for spam/abuse patterns)
7. Looks up employer's company name from `jobs` table
8. Relays message: `"[Company Name] says: <message>"`
9. Stores in `messages` table
10. Returns confirmation: "Message delivered to <learner name>."

**Learner reply forwarding**:
When a learner replies within 24 hours of receiving a ping:
1. Looks up recent ping (within 24h)
2. Content safety check on reply
3. Forwards to employer's WhatsApp: `"[Learner Name] replies: <text>"`
4. Stores reply in `messages` table with `reply_to_id`

### 7.8 Opportunity Alerts (`opportunityAlertService.js`)

Sends proactive job opportunity notifications to matched learners when a new vacancy is broadcast.
Called by the backend's `/internal/broadcast` webhook.

### 7.9 Content Safety (`contentSafetyService.js`)

Rule-based content safety filter for employer ping messages:
- Checks for banned keywords (harassment, scam patterns)
- Returns `{ safe: boolean, reasons: string[] }`
- Applied to both employer → learner messages and learner reply forwards

### 7.10 Multilingual Support

- **6 languages**: English, Hindi (Devanagari), Hinglish (Roman), Marathi, Gujarati, Bengali
- `templates/messages.js`: All bot messages defined with `t(script).messageName` pattern
- `utils/scriptDetector.js`: Detects Devanagari vs Roman script from Unicode range analysis
- `utils/text.js`: `isAffirmative()`, `isNegative()`, `normalizeText()`, `parseNumberChoice()` — all multilingual-aware
- Language locked per learner once selected; stored in session and learner DB row

### 7.11 AI Clients

**GeminiClient** (`geminiClient.js`):
- Primary AI provider (Google Gemini)
- `draftReply()`: Structured reply generation with script/intent/brief/facts
- `generateJson()`: JSON-schema-constrained responses (for salary extraction, retention classification)
- `extractProfile()`, `extractName()`, `extractCertificate()`, `extractSkills()`
- Handles API timeouts and retries

**GroqClient** (`groqClient.js`):
- Secondary AI provider (Groq + Llama/Mixtral)
- Same interface as Gemini; used as fallback in `llmClient.js`

**SarvamASR** (`transcriptionService.js`):
- Speech-to-text for voice notes
- Sarvam AI ASR API (Indian languages optimized)
- Returns transcript or null on failure
- Configurable: can be disabled if `SARVAM_API_KEY` not set

**`extractionService.js`**:
- Unified extraction interface wrapping GeminiClient
- `extractName(text, { script })`: Name extraction with AI flags
- `extractProfile(text, existing)`: Trade + district + state extraction
- `extractCertificate(text)`: Certificate type normalization
- `extractSkills(text)`: Skills array extraction
- All methods return `{ result, flags: [{ code, severity, reason, field }] }` for audit

---

## 8. AI Server — Python/FastAPI

A FastAPI microservice exposing two main endpoints.

### 8.1 Document Conversion (`POST /convert`)

Accepts: PDF, JPEG, PNG, DOCX (multipart/form-data)

Uses **Docling** library for document parsing:
- GPU-accelerated (CUDA) with CPU fallback
- 4 threads per conversion
- Returns: `{ text, pages, tables[], metadata }`
  - `text`: Markdown-formatted extracted text
  - `tables`: List of tables as 2D string arrays `[columns, ...rows]`

Used by `documentParserService.ts` in the backend for:
- Learner cohort document upload
- Aadhaar card parsing

### 8.2 Risk Score Prediction (`POST /predict-risk`)

Input:
```json
{
  "learner_id": "string",
  "days_since_last_response": 0,
  "status": "active|placed|at_risk|dropped",
  "profile_completeness": 100.0,
  "days_to_cohort_end": 90
}
```

Output: `{ "score": 0.0 }` (0–100, higher = more at-risk)

**Model**: Trained Random Forest (`risk_model.pkl`, ~7MB) loaded at startup with joblib.

**Features**:
- days_since_last_response
- status (encoded: placed=0, active=1, at_risk=2, dropped=3)
- profile_completeness
- days_to_cohort_end

**Fallback heuristic** (if model file absent):
```
score = min(days_silent × 2.5, 40)
      + status_base_score (placed=0, active=10, at_risk=30, dropped=50)
      + (1 - completeness/100) × 20
      + max(0, (30 - days_to_end) / 3)
```

`/health` endpoint returns `{"status": "ok"}` for liveness checks.

---

## 9. External Integrations & DPI

### Sandbox.co.in (via `sandboxService.ts`)

| Endpoint | Usage |
|---------|-------|
| `POST /authenticate` | OAuth token (cached 23h) |
| `POST /kyc/aadhaar/okyc/otp` | Generate Aadhaar OTP |
| `POST /kyc/aadhaar/okyc/otp/verify` | Verify OTP → KYC data + photo |
| `POST /kyc/entitylocker/sessions/init` | Initiate EntityLocker session |
| `GET /kyc/entitylocker/sessions/{id}/entity` | Fetch entity details |

Environment: `SANDBOX_BASE_URL`, `SANDBOX_API_KEY`, `SANDBOX_API_SECRET`  
Default: `https://test-api.sandbox.co.in` (sandbox mode)

### Skill India Digital Hub (SIDH)

- Direct POST to `https://api-fe.skillindiadigital.gov.in/api/jobs/filter`
- Filters: PageSize, PageNumber, JobStatus, State[], Sector[]
- 30-second timeout
- Returns structured job data with UUIDs for deep linking to `https://www.skillindiadigital.gov.in/job/detail/{Id}`

### Supabase

- PostgreSQL database (managed)
- Supabase Auth (JWT-based)
- Supabase Realtime channels for live pipeline transition broadcasts
- Supabase Storage for document/photo uploads

### Gemini API (Google AI)

Used by both bot (GeminiClient) and backend (llmService → Gemini fallback) for:
- Name/profile/certificate extraction
- Skill extraction
- Salary extraction from Hindi/Hinglish
- Retention response classification
- Table column mapping
- SIDH sector classification
- Freeform conversational responses

### Sarvam AI

- ASR (Automatic Speech Recognition) for WhatsApp voice notes
- Optimized for Indian languages (Hindi, Bengali, Tamil, etc.)
- Used via `transcriptionService.js`

### Groq API

- LLM API (Llama/Mixtral models)
- Primary LLM provider in `llmService.ts` (Groq first, Gemini fallback)
- Used for document parsing extraction prompts

---

## 10. Cross-Cutting Concerns

### Rate Limiting

| Context | Limit | Scope |
|--------|-------|-------|
| Employer vacancy broadcast | 5/day | Per employer (IST calendar day) |
| Officer ping to learner | 20/day | Per officer per learner (IST) |
| Employer WhatsApp ping to learner | 10/day | Per employer per learner (IST) |
| Employer dashboard messaging | 5/day | Per employer per learner |

### Error Handling

- tRPC errors use standard codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`, `TOO_MANY_REQUESTS`, `BAD_GATEWAY`
- `handleSupabaseError()` translates Supabase errors to tRPC errors
- Bot errors are non-fatal where possible (placement bootstrap failures logged but don't block pipeline transitions)
- AI failures always have fallbacks (heuristic risk model, simplified replies)

### Logging

- Backend: **pino** structured JSON logging
- Bot: **pino** with context fields (phone, learnerId, step)
- AI Server: Python standard `logging` module

### Authentication & Authorization

- JWT from Supabase Auth (`Authorization: Bearer <token>`)
- `createContext()` in tRPC extracts and validates JWT
- Role-based guards:
  - `protectedProcedure`: any authenticated user
  - `officerProcedure`: role = officer, dssdo, or admin
  - `employerProcedure`: role = employer
- Bot ↔ Backend communication via HTTP to internal endpoints (no auth, trusted network)

### Type Safety

- Full end-to-end TypeScript type safety via tRPC
- `AppRouter` type exported from backend, imported by frontend for `createTRPCReact()`
- Zod schemas for all API inputs with clear validation messages
- `db/types.ts` exports TypeScript interfaces for all DB rows

### Deployment

- Frontend deployed to **Netlify** (`netlify.toml` present)
- Bot runs as persistent Node.js process with `whatsapp-web.js` auth stored in `.wwebjs_auth/`
- AI Server runs as Python FastAPI with uvicorn
- Monorepo with **pnpm workspaces**

### Feature Flags

- `isDocumentUploadEnabled()`: Toggles Aadhaar/certificate upload in bot onboarding
- Controlled via environment variable

---

## Key Files Reference

| File | Description |
|-----|-------------|
| [`backend/src/index.ts`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/backend/src/index.ts) | Express app entry point |
| [`backend/src/trpc/router.ts`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/backend/src/trpc/router.ts) | Root tRPC router |
| [`backend/src/trpc/routers/employer.ts`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/backend/src/trpc/routers/employer.ts) | Employer portal (1,407 lines) |
| [`backend/src/trpc/routers/dashboard.ts`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/backend/src/trpc/routers/dashboard.ts) | Officer dashboard (881 lines) |
| [`backend/src/trpc/routers/auth.ts`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/backend/src/trpc/routers/auth.ts) | Auth + KYC router |
| [`backend/src/services/documentParserService.ts`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/backend/src/services/documentParserService.ts) | Document → learners extraction |
| [`backend/src/services/sandboxService.ts`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/backend/src/services/sandboxService.ts) | Sandbox KYC client |
| [`backend/src/services/sidhScrapingService.ts`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/backend/src/services/sidhScrapingService.ts) | SIDH live job feed |
| [`backend/src/services/misReportService.ts`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/backend/src/services/misReportService.ts) | MIS report generation |
| [`bot/src/conversation/conversationEngine.js`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/bot/src/conversation/conversationEngine.js) | Main bot state machine (1,473 lines) |
| [`bot/src/services/placementTrackerService.js`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/bot/src/services/placementTrackerService.js) | Salary + retention tracking (1,043 lines) |
| [`bot/src/services/employerPingService.js`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/bot/src/services/employerPingService.js) | Employer ↔ learner relay |
| [`aiserver/server.py`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/aiserver/server.py) | FastAPI endpoints |
| [`aiserver/risk_model.py`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/aiserver/risk_model.py) | Risk score model + heuristic |
| [`frontend/src/components/auth/LoginPage.tsx`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/frontend/src/components/auth/LoginPage.tsx) | Login/signup (1,927 lines) |
| [`frontend/src/app/dashboard/officer/page.tsx`](file:///home/saaransh-garg/Documents/code/SaathiAI/SaathiAI/frontend/src/app/dashboard/officer/page.tsx) | Officer overview dashboard |

---

*Documentation generated from source analysis of all files in `/frontend`, `/backend`, `/bot`, and `/aiserver` directories.*
