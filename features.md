# SaathiAI — Comprehensive Feature Blueprint
### UI/UX Prototype Architecture Document
**Version 1.0 | Shiksha Hackathon 2026 | Problem Statement 3.5**

---

> **How to use this document**
> This is the single source of truth for every screen, flow, state, component, and AI behaviour that the SaathiAI prototype must contain. It is organised by **product surface** (the four distinct apps), then by **feature group**, then by **individual feature**. For each feature, you will find: what it does, who uses it, which screen(s) it lives on, what the AI does underneath it, and what micro-interactions or edge states need to be designed.

---

## System Architecture Overview

SaathiAI has **four distinct product surfaces**, each serving a different user, each with its own interface paradigm:

| Surface | Primary User | Interface Paradigm | Primary Channel |
|---|---|---|---|
| **SaathiAI Companion** | Ramu — rural ITI/PMKVY graduate | Conversational / voice-first | WhatsApp (primary), PWA (secondary) |
| **Saathi Officer Dashboard** | Placement officer at ITI/training centre | Data dashboard + action inbox | Web PWA, Android app |
| **Saathi Employer Portal** | MSME owner/HR manager | Lightweight card view + WhatsApp | WhatsApp link (primary), micro-portal (secondary) |
| **Saathi District Console** | DSSDO / district policy officer | Analytics and intelligence console | Web dashboard |

All four surfaces feed from and write to the **same underlying intelligence layer**, which is the AI core. The learner's journey flows data upward through all four surfaces automatically.

---

## SURFACE 1 — SaathiAI Companion (Learner-Facing)

> **Design intent:** This surface must feel like talking to a trusted elder sibling who has successfully navigated the job market. Never clinical. Never bureaucratic. Always warm, in Ramu's language, at his pace.

---

### 1.1 ONBOARDING FLOW

#### Feature 1.1.1 — WhatsApp Activation Trigger
- **What it does:** The training centre sends a single templated WhatsApp message to the graduate at certification. The message is the entry point into the entire SaathiAI system.
- **Screen required:** Not a UI screen — but the activation message itself must be designed as a component. Design the WhatsApp message card: training centre name, graduate's name, a warm greeting in Hindi, a single green CTA button "SaathiAI से बात करें".
- **AI behaviour:** None at this stage. This is a trigger only. The AI activates on the learner's first reply.
- **Edge states to design:**
  - What if the learner doesn't respond within 48 hours? → Auto-follow-up message design ("Ramu ji, kya aap ready hain?")
  - What if the phone number is incorrect? → Error flow to officer dashboard (Feature 2.3.2)

#### Feature 1.1.2 — Voice Onboarding Intake
- **What it does:** The very first interaction is a voice-based onboarding conversation in Hindi. The AI asks 5 structured questions via voice message and accepts voice note responses. No typing required.
- **Screen required:** WhatsApp conversation view showing the AI's voice messages as playable audio bubbles, the learner's voice note responses, and a progress indicator ("Step 2 of 5").
- **The 5 onboarding questions (in Hindi):**
  1. आपने कौन सा trade सीखा? (What trade did you learn?)
  2. आप कहाँ रहते हैं — ज़िला और तहसील? (Location — district and tehsil?)
  3. आप घर से कितनी दूर तक काम कर सकते हैं? (Maximum commute radius?)
  4. महीने में कम से कम कितनी कमाई चाहिए? (Minimum monthly salary expectation?)
  5. क्या आप apprenticeship में interested हैं, या सीधे नौकरी चाहिए? (Apprenticeship or direct job?)
- **AI behaviour:** Sarvam AI ASR transcribes voice notes. NLP extracts structured data: `{trade, district, tehsil, radius_km, salary_floor, job_type_preference}`. If any answer is ambiguous, the AI asks one clarifying follow-up (max 1 per question). The AI never repeats a question more than twice.
- **Edge states:**
  - Inaudible voice note → "मैं सुन नहीं पाया, एक बार फिर बोलें" + gentle re-prompt
  - Connectivity drop mid-onboarding → Resume state saved; on next message the AI says "हम रुक गए थे, चलिए आगे बढ़ते हैं" and picks up from the last unanswered question
  - Learner sends text instead of voice → Accepted; AI processes text inputs identically

#### Feature 1.1.3 — Credential Verification Gateway
- **What it does:** After onboarding, the AI asks the learner to share their DigiLocker credentials so SaathiAI can pull and verify their NSQF certificate, link it to their APAAR ID, and build a verified digital skill profile.
- **Screen required:** A special "verification card" message in the WhatsApp conversation — a rich media card with an icon, short explanation in Hindi ("आपका certificate verify करना ज़रूरी है ताकि employers आप पर trust करें"), and a button/link that opens the DigiLocker OAuth flow.
- **AI behaviour:** On successful DigiLocker authorisation, the AI automatically pulls: NSQF level, trade name, issuing body, certificate date, assessment score (if available). It cross-references with SIDH enrollment data via API to confirm training completion. It generates a `VerifiedSkillProfile` object stored in the learner's profile.
- **Micro-interactions to design:**
  - A "verifying…" animated state in the WhatsApp conversation while the API call runs
  - A success confirmation message: "✅ आपका certificate verify हो गया! आप NSQF Level 3 Electrician हैं।" — with a small summary card
  - A failure state with specific guidance: "DigiLocker से connect नहीं हो पाया — कोई बात नहीं, आपके placement officer इसमें help करेंगे" + flag sent to officer dashboard
- **Edge states:**
  - Learner has no DigiLocker account → Alternative flow: upload physical certificate photo; AI uses OCR to extract details; marks profile as "Self-reported, pending verification"
  - APAAR ID not linked → AI provides a 3-step guide to link APAAR to DigiLocker, in Hindi, as a voice message

#### Feature 1.1.4 — Profile Completion Indicator
- **What it does:** After onboarding, the learner receives a WhatsApp "profile card" summarising what SaathiAI knows about them and what is still incomplete.
- **Screen required:** A structured WhatsApp summary card (image or formatted text) showing: Name, Trade, Location, Verified status (yes/no), Profile strength score ("आपकी profile 60% complete है — video task add करने पर employers ज़्यादा interested होंगे").
- **AI behaviour:** AI computes a profile strength score based on: credential verification (30 pts), location precision (10 pts), salary floor set (10 pts), task video submitted (30 pts), trainer endorsement linked (20 pts).

---

### 1.2 JOB MATCHING ENGINE

#### Feature 1.2.1 — Constraint-Based Match Generation
- **What it does:** The AI's core matching engine. After onboarding, the AI immediately queries SIDH, NAPS, and NCS APIs and returns the top 3 matched opportunities within 24 hours. This is proactive — the learner does not need to search.
- **Screen required:** A "match delivery" WhatsApp message — a numbered list of 3 opportunities, each showing: employer name, role, distance from home, salary range, and type (job / apprenticeship / gig). Each has a numbered response button (reply "1", "2", or "3" to express interest).
- **AI behaviour (constraint-based matching logic):**
  - `trade` must match job's required trade (hard filter)
  - `district + tehsil` → calculate distance to employer location; filter by `radius_km` (hard filter)
  - `salary_floor` → filter out roles below threshold (hard filter)
  - `job_type_preference` (apprenticeship vs job) → prefer matching type (soft filter, fallback to mixed if insufficient matches)
  - `shift_preference` (collected later) → filter night shifts for female learners unless explicitly opted in
  - **Rank by:** distance (closest first), then salary (highest first), then employer verification status
- **Edge states:**
  - 0 matches found → "अभी आपके area में matches नहीं मिले — हम हर हफ्ते check करते रहेंगे। क्या आप 10km दूर तक भी देख सकते हैं?" (Offer radius expansion)
  - >3 matches → Show top 3; tell learner there are more: "और 5 matches हैं — 'और दिखाओ' लिखें"
  - Match quality < threshold (no NSQF-matching roles) → Show closest adjacent trades with a note: "Electrician में अभी कम openings हैं, पर Wiring Technician में ये मौके हैं — same skills, थोड़ा अलग title"

#### Feature 1.2.2 — Match Detail Expansion
- **What it does:** When a learner replies to a match with interest (e.g., "1"), the AI sends a detailed breakdown of that opportunity.
- **Screen required:** Expanded match detail card — employer name, full address with Google Maps link, salary range, working hours, contact person name, whether NAPS stipend applies, and what the learner needs to do next (submit video / attend interview / call employer).
- **AI behaviour:** Pulls full employer profile from SIDH/NAPS. Checks employer verification status (Udyam-verified, GSTN-registered). Flags unverified employers with a caution note: "⚠️ यह employer अभी verify नहीं है — आगे बढ़ने से पहले अपने placement officer से पूछें।"

#### Feature 1.2.3 — Weekly Match Refresh
- **What it does:** Every Monday morning, the AI proactively sends new matches to learners who are still unplaced. Matches are refreshed from live SIDH/NAPS/NCS data.
- **Screen required:** A recurring "weekly update" WhatsApp card — designed distinctively with a day-of-week header ("इस हफ्ते के नए मौके 🌟"), new matches listed, and a reminder of previously viewed matches if still active.
- **AI behaviour:** AI checks learner placement status. If placed: stops weekly updates, sends congratulations. If unplaced after 4 weeks: slightly expands radius by 5km and recalculates. After 8 weeks: flags to placement officer dashboard as "long-term at-risk."

#### Feature 1.2.4 — Proactive Opportunity Alerts (Event-Triggered)
- **What it does:** In addition to weekly refreshes, the AI sends immediate alerts when specific events occur that are relevant to the learner.
- **Screen required:** Alert message format — a compact card with alert type icon, one-line reason ("क्योंकि आप Electrician हैं और Varanasi में हैं"), and the opportunity summary.
- **Alert trigger types to design screens for:**
  - New NAPS apprenticeship posted in learner's district matching their trade
  - Job fair within 25km in the next 7 days
  - NSQF certificate approaching 2-year renewal deadline
  - New batch of PMKVY 4.0 upskilling courses open for learner's next NSQF level
  - An employer the learner previously expressed interest in has a new vacancy
  - Salary range for learner's trade increases in their district (labour market signal)

---

### 1.3 SKILL VERIFICATION — VIDEO TASK ASSESSMENT

#### Feature 1.3.1 — Task Video Request
- **What it does:** Before connecting a learner to a specific employer, the AI requests a 2-minute trade task video that becomes the learner's portable proof-of-skill.
- **Screen required:** Task assignment WhatsApp card — shows: what task to perform, specific instructions in Hindi, acceptable video length (1–3 minutes), sample dos and don'ts, and a file/video upload button.
- **Task library (AI selects based on trade):**
  - Electrician → "एक simple circuit में fault ढूंढें और fix करें — camera में explain करें, Hindi में बोलें"
  - Welder → "एक butt joint weld करें — process explain करें"
  - Plumber → "एक leaking joint fix करें"
  - Mason → "Brick laying technique — level और mortar ratio बताएं"
  - Beauty / Wellness → "एक basic facial procedure — steps explain करें"
  - (Full trade library with 40+ tasks)
- **AI behaviour:** Task is selected based on learner's specific trade and NSQF level. The AI provides encouragement before asking: "Employers paper se zyada aapko kaam karte dekhna chahte hain — yeh aapka mauka hai khud ko dikhane ka 💪"
- **Edge states:**
  - Learner refuses → "कोई बात नहीं — आप बाद में भी भेज सकते हैं। बिना video के भी matches मिलेंगे, पर video से ज़्यादा chances बढ़ते हैं।"
  - Video too long (>5 min) → "Video थोड़ी लम्बी है — क्या आप 3 minutes का रख सकते हैं?"
  - Poor lighting / inaudible → AI flags specific issue: "Video में रोशनी कम है — क्या आप बाहर या खिड़की के पास बना सकते हैं?"

#### Feature 1.3.2 — AI Video Scoring Engine
- **What it does:** When a task video is received, the AI automatically scores it against NSQF Standard Operating Procedures for that trade and generates a "Capability Badge."
- **Screen required:** The learner receives a scoring result card — a simple visual showing their score across 3–4 dimensions, a plain-language summary ("आपने circuit fault सही ढूंढा — बहुत अच्छा! Safety precautions और बेहतर हो सकती थीं"), and their badge status.
- **AI behaviour:**
  - Computer vision (MediaPipe) analyses: tool usage technique, safety compliance, task completion
  - Whisper ASR transcribes the learner's verbal explanation
  - LLM scores the explanation against trade SOPs: correctness, completeness, terminology
  - Composite score computed: `{technique: X/10, safety: X/10, explanation: X/10, completion: X/10}`
  - Score mapped to NSQF competency descriptors
  - Badge levels: ✅ **Verified** (>7/10), ⚡ **Developing** (5–7/10), 🔄 **Needs Practice** (<5/10)
- **Micro-interactions:**
  - "Scoring your video…" animated state (15–30 second processing)
  - Encouraging result delivery regardless of score
  - For low scores: specific, actionable improvement tips, not just a number

#### Feature 1.3.3 — Skill Badge Improvement Loop
- **What it does:** If a learner scores below threshold, the AI provides a targeted practice guide and allows resubmission after 48 hours.
- **Screen required:** Improvement guide card — 3 specific tips based on what the AI flagged (not generic), a "practise करें" reminder, and a countdown to when they can resubmit.
- **AI behaviour:** AI generates personalised improvement tips from the specific scoring gaps (not a template). E.g., "आपने earth wire नहीं लगाया — यह safety के लिए बहुत ज़रूरी है। इस video को देखें [link to NSDC learning resource]."

---

### 1.4 INTERVIEW PREPARATION

#### Feature 1.4.1 — Pre-Interview Briefing
- **What it does:** When a learner is confirmed for an interview (by expressing interest in a match), the AI automatically sends an interview preparation briefing 24 hours before.
- **Screen required:** Pre-interview briefing WhatsApp card — employer name, interview time/location, what to bring (original certificate, APAAR printout), 3 likely questions the employer will ask for that specific trade, and a "practice" CTA.
- **AI behaviour:** AI pulls the employer's job description from SIDH/NAPS. It generates 3 trade-specific likely interview questions by analysing: the role requirements, the NSQF level expected, and historical interview patterns for that sector. Questions are in Hindi.

#### Feature 1.4.2 — Voice-Based Mock Interview
- **What it does:** An interactive mock interview session where the learner can practice answering common interview questions via WhatsApp voice exchange with the AI.
- **Screen required:** A dedicated "mock interview mode" conversation thread — starts with a clear "Practice Interview शुरू करते हैं" message, then alternates between AI question (voice) and learner voice note response.
- **AI behaviour:**
  - AI plays the role of a friendly MSME interviewer, asks questions in Hindi
  - Learner responds via voice note
  - AI provides brief, specific feedback on each answer: "अच्छा जवाब — आपने अपना experience mention किया। अगली बार salary expectation भी mention करें।"
  - AI never gives generic feedback — it always references something specific the learner said
  - After 3 practice questions, AI gives an overall summary: confidence areas + one thing to work on
- **Edge states:**
  - Learner says "I don't know" → AI provides a scaffold: "कोई बात नहीं — इस सवाल का एक अच्छा जवाब होगा..."
  - Learner abandons mid-session → AI saves progress; on next message: "क्या हम practice continue करें?"

#### Feature 1.4.3 — Day-Of Interview Reminder
- **What it does:** 2 hours before a confirmed interview, the AI sends a concise reminder with logistics and a short motivational note.
- **Screen required:** Compact reminder card — interview time, employer address (one-tap Google Maps), what to carry, and one sentence of encouragement. No more — the learner is nervous, not seeking a long briefing.
- **Micro-interaction:** Message arrives with a 🟡 clock emoji as visual anchor. If the learner replies "ready" or "haan", the AI responds with one warm, short affirmation.

---

### 1.5 POST-PLACEMENT SUPPORT

#### Feature 1.5.1 — First-Day Check-In
- **What it does:** On the learner's first day at work (date logged when placement confirmed), the AI sends a supportive check-in message.
- **Screen required:** First-day message — warm, brief, asks one question: "कैसा रहा पहला दिन? 😊" — with quick reply options: "अच्छा रहा 👍", "ठीक था", "मुश्किल था 😟".
- **AI behaviour:** If learner says "mushkil tha" or "difficult", AI opens a short support conversation: asks what was hard, provides brief coping guidance, and if the issue is a workplace rights concern (unpaid wage, unsafe conditions), escalates to the placement officer.

#### Feature 1.5.2 — 30-Day Retention Check-In
- **What it does:** At 30 days post-placement, the AI sends a retention check-in to understand if the learner is still employed and satisfied.
- **Screen required:** Check-in card with 3 quick-reply options: "हाँ, काम कर रहा हूँ 👍", "नौकरी बदल रहा हूँ", "नौकरी छोड़ दी". Each triggers a different branch.
- **AI behaviour branches:**
  - Still employed → Positive reinforcement; ask if they want to start their next NSQF upskill path
  - Changing jobs → Ask why (salary/location/environment); if salary, trigger new job search with updated expectations; log retention signal to district dashboard
  - Left job → Compassionate response; re-activate job search; flag to officer as at-risk

#### Feature 1.5.3 — 90-Day Retention and Upskill Prompt
- **What it does:** At 90 days, if the learner is still employed, the AI introduces the next step: upskilling to NSQF Level 4 or a complementary skill.
- **Screen required:** Upskill opportunity card — "आपने 90 दिन पूरे किए — बहुत बढ़िया! अब NSQF Level 4 की training से आपकी salary ₹2,000–3,000 बढ़ सकती है। क्या आप interested हैं?" with Yes/No quick replies.
- **AI behaviour:** AI queries SIDH for next-level courses available near the learner, filtered for part-time/evening options so employment is not disrupted.

#### Feature 1.5.4 — Wage Navigation Support
- **What it does:** The AI proactively informs placed learners about the minimum wage for their trade in their state, ensuring they are not being underpaid.
- **Screen required:** "क्या आप जानते हैं" information card — shows state minimum wage for learner's trade, their current declared salary, and a green/amber/red indicator of compliance.
- **AI behaviour:** If the learner's salary is below the state minimum wage, AI provides a clear, plain-Hindi guide: "आपकी salary state minimum से कम है — यह आपका हक है। आपके placement officer इसमें help कर सकते हैं।" No legal jargon.

---

### 1.6 LANGUAGE AND ACCESSIBILITY

#### Feature 1.6.1 — Language Selection and Persistence
- **What it does:** During onboarding (after the first response), the AI detects the language of the learner's response and automatically switches to that language for all future messages. Learner can override at any time.
- **Languages supported:** Hindi (primary), Bhojpuri, Bengali, Tamil, Telugu, Marathi, Kannada, Malayalam, Odia, Gujarati, Punjabi, Assamese, Urdu (via Sarvam AI + Bhashini)
- **Screen required:** Language detection confirmation message: "मैं देख रहा हूँ आप Hindi में बात कर रहे हैं — क्या यही ठीक है?" with a "हाँ" quick reply and a "भाषा बदलें" option.
- **AI behaviour:** Language detection runs on every incoming message for the first 3 exchanges, then persists. Code-switching (mixing Hindi and English) is handled gracefully.

#### Feature 1.6.2 — SMS Fallback Mode
- **What it does:** In areas with no data connectivity, SaathiAI falls back to SMS. Key nudges (interview reminder, job fair alert, certificate expiry) are sent as SMS.
- **Screen required:** No app screen — but the SMS message templates need to be designed: max 160 characters, Hindi in transliterated ASCII (Roman script Hindi), with a clear call-back number.
- **Trigger logic:** If a learner's WhatsApp messages fail to deliver (2-tick not appearing for 48+ hours), the system automatically switches to SMS fallback for that learner.

#### Feature 1.6.3 — Voice-Only Mode
- **What it does:** Some learners have very low text literacy. Voice-only mode means the AI never sends text messages — only voice notes. All responses are consumed as audio.
- **Screen required:** Voice-only mode toggle in the PWA learner profile (accessible to the placement officer on the learner's behalf). WhatsApp conversation view should show all AI messages as orange "🎙 Voice message" bubbles.
- **AI behaviour:** TTS (Sarvam AI) converts all AI responses to Hindi voice notes before sending via WhatsApp Business API.

#### Feature 1.6.4 — Female Safety Preferences
- **What it does:** For female learners, the AI automatically applies safety filters to job matching: excludes night shifts unless explicitly opted in, flags employer gender diversity data, and surfaces Women's Helpline and support resources proactively.
- **Screen required:** During onboarding, a single additional question for female learners: "क्या आप night shift में काम कर सकती हैं?" — framed neutrally, not presumptively.
- **AI behaviour:** `shift_safety_filter` set to `true` by default for female learners. Applied as a hard filter in the matching engine (Feature 1.2.1).

---

## SURFACE 2 — Saathi Officer Dashboard (Placement Officer)

> **Design intent:** Clean, information-dense, and action-oriented. The officer's primary job is to identify who needs their help today and act on it. The dashboard surfaces the right 3 people — not 200 — who need attention.

---

### 2.1 MAIN DASHBOARD VIEW

#### Feature 2.1.1 — Cohort Health Overview
- **What it does:** The home screen of the officer dashboard. Shows the status of the current cohort at a glance.
- **Screen required:** A top-level summary header with 5 KPI tiles:
  - Total learners in cohort
  - Placed (green, with count and %)
  - In process / active matches (amber, count)
  - At-risk / silent (red, count — **this is the most prominent tile**)
  - Verified profiles (count)
- **AI behaviour:** AI computes cohort health score (0–100) — a weighted index of placement rate, profile completion rate, and response rate. Shown as a single "Cohort Health" number with a colour indicator.

#### Feature 2.1.2 — Priority Action Inbox
- **What it does:** The most important feature of the officer dashboard. A ranked list of learners who need the officer's direct human attention today, with the specific action required for each.
- **Screen required:** An "Action required" inbox — each item shows:
  - Learner name + photo (if available)
  - AI-generated reason for flag (1 line): "14 दिन से reply नहीं — last seen: 3 June"
  - Urgency tag: 🔴 Critical / 🟡 Follow up / 🟢 Check in
  - One-tap actions: "WhatsApp भेजें", "Call करें", "Mark as resolved"
- **AI behaviour:**
  - AI computes a risk score for every learner daily based on: days since last response, placement status, profile completeness, proximity to cohort end date
  - Risk > 70 → 🔴 Critical
  - Risk 40–70 → 🟡 Follow up
  - Risk < 40 → 🟢 Routine check
  - AI generates the action reason in plain Hindi (not code/jargon)
- **Micro-interactions:**
  - Swipe right on an item to mark as resolved
  - Swipe left to snooze 3 days
  - Tap to expand full learner timeline

#### Feature 2.1.3 — Cohort Timeline View
- **What it does:** A Gantt-style view of the entire cohort, showing each learner's journey stage and timeline relative to cohort end date.
- **Screen required:** A horizontal timeline with one row per learner. Columns: Onboarded → Verified → First match sent → Interest expressed → Interview confirmed → Placed. Current stage highlighted. Color-coded by risk level.

---

### 2.2 LEARNER PROFILE DEEP-DIVE

#### Feature 2.2.1 — Individual Learner Profile Card
- **What it does:** Tapping any learner in the cohort view opens their full profile.
- **Screen required:** Learner profile page with:
  - Personal details: name, trade, location, contact
  - Verified credential summary (NSQF level, certificate ID, issuing body)
  - Profile strength score and what's missing
  - Skill badge status (from video assessment)
  - Match history: all matches sent, which ones they expressed interest in, outcomes
  - Communication log: timeline of all SaathiAI ↔ learner messages (summarised)
  - Officer notes field (free text, private to officer)
  - Placement status: unplaced / in process / placed (with employer name and date if placed)

#### Feature 2.2.2 — AI-Generated Learner Summary
- **What it does:** A one-paragraph AI summary of the learner's situation, visible at the top of their profile to give the officer instant context before a call.
- **Screen required:** An amber "AI Summary" card at the top of the learner profile. Example: "Ramu, Electrician (NSQF L3, Varanasi). Verified profile. Expressed interest in 2 matches — Ganesh Electricals interview confirmed for 5 June. Has not responded to pre-interview prep messages. Recommend a check-in call today."
- **AI behaviour:** AI generates this summary fresh every time the officer opens the profile, incorporating the latest interaction data. Not a static template — genuinely dynamic.

#### Feature 2.2.3 — Suggested Officer Action
- **What it does:** Below the AI summary, the AI recommends one specific action for the officer to take for this learner today.
- **Screen required:** A CTA card: "Recommended action: Send Ramu the interview reminder via WhatsApp — interview is tomorrow at 10am." with a one-tap "Send now" button that fires the pre-built message.
- **AI behaviour:** AI selects the single most impactful action from a taxonomy of possible actions: {send_interview_reminder, escalate_credential_issue, introduce_new_match, call_learner, mark_dropout}. One action only — not a list.

---

### 2.3 EMPLOYER AND MATCH MANAGEMENT

#### Feature 2.3.1 — Employer Directory
- **What it does:** A view of all employers in the officer's district who have posted vacancies or are registered on SaathiAI, with their hiring history and engagement status.
- **Screen required:** Employer list with: employer name, trade categories, location, last hire date, number of open vacancies, verification status (Udyam-verified badge). Searchable and filterable by trade.

#### Feature 2.3.2 — Manual Match Override
- **What it does:** The officer can manually suggest a match between a specific learner and a specific employer, bypassing the AI matching engine (for cases where the officer has a personal employer relationship).
- **Screen required:** A "Create manual match" flow — search and select learner → search and select employer → write a note to the learner explaining why this match is being suggested → confirm. The match then enters the learner's SaathiAI conversation as a special "from your placement officer" card.

#### Feature 2.3.3 — Employer Outreach CRM
- **What it does:** Helps the officer track and manage their relationships with local employers — who they've contacted, when, what roles are open, and which learners have been sent to each employer.
- **Screen required:** Simple CRM view — employer list with: last contact date, open roles, learners sent, learners placed. One-tap "Log a call" to record an interaction. 

---

### 2.4 REPORTING AND COMPLIANCE

#### Feature 2.4.1 — Auto-Generated MIS Report
- **What it does:** The officer's most time-consuming task — generating the monthly MIS report for the DSSDO — is automated entirely. The AI generates a ready-to-submit PDF report from the learner interaction and placement data.
- **Screen required:** "Reports" tab with a list of report periods (monthly). Each row shows: period, status (auto-generated / submitted / pending), a "Review" button, and a "Submit to DSSDO" button. The report preview shows: enrolment, placement rate, employer engagement, top trades placed.
- **AI behaviour:** AI aggregates all data from the current period (learner profiles, placement confirmations, match history) and formats it into the MSDE-mandated MIS template. Officer reviews, can edit, then submits with one tap.
- **Micro-interaction:** A "Report ready" push notification each month on report-generation day, with a prominent "Review and submit" CTA.

#### Feature 2.4.2 — Placement Confirmation Logging
- **What it does:** When a learner is placed, the officer (or learner via WhatsApp) confirms the placement. This logs it to the system, triggers post-placement support flows, and updates the district dashboard.
- **Screen required:** Placement confirmation modal — employer name (auto-filled from match history or manual entry), role, start date, monthly salary, source of placement (SaathiAI match / officer direct / learner self). "Confirm placement" button.
- **AI behaviour:** On confirmation, AI automatically triggers: learner congratulations message on WhatsApp, 30-day retention check-in scheduling, district dashboard update, employer "thank you" notification.

#### Feature 2.4.3 — Cohort End Report
- **What it does:** At the end of each cohort, the AI generates a comprehensive cohort performance report — not for compliance, but for the officer's own learning and for the district.
- **Screen required:** A richly visualised cohort summary: placement funnel (enrolled → verified → matched → interviewed → placed), time-to-placement distribution, trade-wise outcomes, employer performance (which employers hired most reliably), learner feedback sentiment summary.

---

### 2.5 BATCH MANAGEMENT

#### Feature 2.5.1 — New Cohort Activation
- **What it does:** When a new batch of learners graduates, the officer activates them on SaathiAI in bulk.
- **Screen required:** "New Cohort" flow — upload a CSV of learner names and phone numbers (or pull directly from SIDH API), preview the list, configure activation message (in Hindi, with training centre name), set cohort end date, and click "Activate". The system sends the WhatsApp activation message to all learners.
- **AI behaviour:** System deduplicates learners against existing profiles (same phone number), flags any SIDH data mismatches for officer review.

---

## SURFACE 3 — Saathi Employer Portal (MSME-Facing)

> **Design intent:** Zero friction. The MSME owner should be able to view a candidate and express interest in under 60 seconds, without creating an account. The entire experience lives in WhatsApp wherever possible.

---

### 3.1 SKILL CARD — THE PRIMARY EMPLOYER EXPERIENCE

#### Feature 3.1.1 — Learner Skill Card (WhatsApp Link)
- **What it does:** When a learner expresses interest in a job, SaathiAI sends the employer a WhatsApp message with a link to the learner's Skill Card — a lightweight, no-login web page.
- **Screen required (web):** The Skill Card page — mobile-optimised, loads in under 2 seconds on 3G. Contents:
  - Learner name, trade, location, NSQF level
  - Verification badge (DigiLocker-verified) with a "verify" link to DigiLocker
  - Skill badge level (Verified / Developing / Needs Practice) from video assessment
  - Capability score breakdown (technique / safety / explanation / completion) as a simple visual
  - 2-minute task video player (inline, autoplay on Wi-Fi, manual play on data)
  - Trainer endorsement note (if submitted)
  - Contact CTA: "मुझे interest है — Saathi के ज़रिए connect करें" (green button) / "Pass करें" (text link)
- **Design notes:** The Skill Card is the single most important design element in the entire product. It must communicate credibility and human warmth simultaneously. No bureaucratic language. Photo of the learner if available. The video must be the centrepiece.

#### Feature 3.1.2 — Employer Interest Response
- **What it does:** When the employer taps "मुझे interest है" on the Skill Card, the system routes the interaction back through WhatsApp — the employer does not need to create an account.
- **Screen required:** Post-tap confirmation page — "धन्यवाद! हमने Ramu को आपकी interest बता दी। वो जल्दी connect करेंगे।" with option to leave a voice note for the learner.
- **AI behaviour:** On employer interest, SaathiAI immediately notifies the learner: "Ganesh Electricals ने आपके profile में interest दिखाई! 🎉 क्या आप उनसे बात करना चाहते हैं?" with Yes/No quick replies.

#### Feature 3.1.3 — Employer Verification Badge
- **What it does:** On the Skill Card, employers see a verification badge for the learner. Symmetrically, learners see a verification badge for the employer (Udyam-registered, GSTN-verified).
- **Screen required:** Employer profile mini-card shown in the learner's SaathiAI conversation when a match is delivered — showing: employer name, type (Pvt Ltd / Partnership / Proprietorship), Udyam registration status, years in business, number of apprentices/employees (from SIDH), and a "verified" or "unverified" badge.

---

### 3.2 EMPLOYER VACANCY MANAGEMENT

#### Feature 3.2.1 — Vacancy Posting via WhatsApp
- **What it does:** MSMEs can post vacancies entirely through WhatsApp — no portal, no form. A conversational flow captures the vacancy details.
- **Screen required (WhatsApp):** Employer-side WhatsApp conversation — SaathiAI asks 5 questions:
  1. किस trade में कितनी vacancies हैं?
  2. Location क्या है?
  3. Salary range क्या है?
  4. Working hours और shifts?
  5. क्या आप NAPS apprenticeship scheme के तहत रखना चाहते हैं?
- **AI behaviour:** AI structures vacancy data, validates NSQF trade codes, posts to internal database. If NAPS opted in: AI initiates the NAPS compliance flow on behalf of the employer (Feature 3.3.1).

#### Feature 3.2.2 — Employer Candidate Pipeline View
- **What it does:** For employers who want more than WhatsApp interaction, a lightweight web portal shows all candidates who have been matched to their vacancies.
- **Screen required:** Simple pipeline view — columns: New Matches / Interested / Interview Scheduled / Hired. Candidate cards show: name, trade, badge level, distance, salary expectation. Drag-and-drop between columns.

---

### 3.3 NAPS APPRENTICESHIP ABSTRACTION

#### Feature 3.3.1 — NAPS Compliance AI Agent
- **What it does:** This is one of the most impactful AI features. The entire NAPS portal compliance workflow — which MSMEs find cumbersome enough to abandon — is handled by SaathiAI on the employer's behalf. The employer answers 5 questions on WhatsApp; the AI does the rest.
- **Screen required (WhatsApp):** A dedicated "NAPS Setup" WhatsApp conversation flow — AI confirms employer's Udyam number, retrieves company details from GSTN via API, calculates apprentice eligibility (based on workforce size), explains the stipend reimbursement amount in plain Hindi, and confirms the employer's intent. AI then submits the NAPS registration via API.
- **AI behaviour:**
  - Calls NAPS portal API to check existing registration status
  - If already registered → pulls existing data, skips re-registration
  - If new → submits registration programmatically, confirms submission reference number to employer
  - Schedules stipend claim reminders: "अगले महीने की 5 तारीख को stipend claim करना है — हम remind करेंगे"
- **Edge states:**
  - GSTN/Udyam number not found → Manual verification flow with officer
  - NAPS API down → Graceful failure: "अभी NAPS portal unavailable है — हम कल try करेंगे। आपको notify करेंगे।"

#### Feature 3.3.2 — MSME Cluster Aggregator
- **What it does:** Groups multiple MSMEs in the same industrial estate/area with similar vacancies and submits a batched apprenticeship demand to SIDH/NAPS.
- **Screen required:** This is primarily a back-end AI feature. The UI component is a "Cluster dashboard" view in the employer micro-portal showing: your cluster (2km radius), total apprenticeship demand from the cluster, total candidates matched to the cluster, and a shared "accept candidates" interface.
- **AI behaviour:** AI identifies employer clusters by geolocation + trade overlap. Sends invitation to MSME owners in the same cluster: "आपके पड़ोस के 4 और workshops भी electrician apprentices ढूंढ रहे हैं — मिलकर एक batch बनाएं?" Batches apprenticeship compliance submissions.

---

## SURFACE 4 — Saathi District Console (DSSDO-Facing)

> **Design intent:** Data-dense, authoritative, and action-oriented for a policy context. This is the first dashboard a district officer has ever had. It should feel like a control room — clear, comprehensive, and decisively useful.

---

### 4.1 DISTRICT OVERVIEW

#### Feature 4.1.1 — District Placement Health Dashboard
- **What it does:** The home screen of the district console. A macro view of placement health across all training centres in the district.
- **Screen required:** Dashboard with:
  - District-level KPIs: total enrolled (current period), total placed, placement rate %, time-to-placement average
  - Centre performance leaderboard: ranked list of training centres by placement rate
  - Trade heatmap: which trades are placing fastest vs. slowest
  - A "district health score" (0–100, AI-computed) with a trend arrow (up/down from last month)

#### Feature 4.1.2 — MSME Demand Signal Map
- **What it does:** A map showing active MSME vacancies in the district, overlaid with learner supply. Surfaces gaps: where employer demand exists but there are no learners in that trade or location.
- **Screen required:** An interactive map (Google Maps API or Leaflet.js) with two layers:
  - Blue pins: MSME vacancy clusters (size of pin = number of vacancies)
  - Green pins: training centres with active learners in matching trades
  - Red zones: areas with MSME demand but no matched learner supply
- **AI behaviour:** AI runs a supply-demand gap analysis weekly. Flags persistent gaps (>4 weeks of unmet MSME demand for a specific trade in a specific area) as "Structural mismatches" for the DSSDO to investigate.

#### Feature 4.1.3 — Dropout Risk Early Warning
- **What it does:** The AI monitors early indicators of cohort-level dropout risk — not individual learners (that's the officer's job) but systemic patterns across multiple centres.
- **Screen required:** An "Early warning" panel on the district dashboard — flags patterns like: "3 training centres in Varanasi North show <20% profile completion at week 4 — investigate onboarding friction" or "Welder trade placements have dropped 40% this month — labour demand shift possible."
- **AI behaviour:** AI trains on historical cohort data to identify leading indicators of poor placement outcomes. Anomaly detection triggers alerts when current cohort data deviates significantly from expected patterns.

---

### 4.2 ANALYTICS AND REPORTING

#### Feature 4.2.1 — AI-Generated Policy Brief
- **What it does:** Every month, the AI generates a 1-page executive brief for the DSSDO summarising: what happened this month in district skilling, what the data says about emerging trends, and 3 specific recommended actions.
- **Screen required:** A "Monthly Brief" section — a clean, printable 1-page document with: headline metric changes, AI-written narrative summary (2 paragraphs, plain language), and a "3 actions for next month" section.
- **AI behaviour:** AI writes the brief in plain Hindi and English. The narrative is generated from structured data — it does not just list numbers but interprets them: "इस महीने welding placements में कमी आई — local steel plant की hiring freeze इसकी वजह हो सकती है। अगले महीने construction sector में redirect करना फायदेमंद होगा।"

#### Feature 4.2.2 — Centre Performance Deep-Dive
- **What it does:** Clicking any training centre in the leaderboard opens a detailed performance view.
- **Screen required:** Centre profile page with: placement funnel chart, time-to-placement distribution, employer relationship map (which employers has this centre placed with), cohort comparison (this period vs last 3 periods), officer workload indicator.

#### Feature 4.2.3 — Passive Feedback Aggregation
- **What it does:** Replaces the <1% feedback submission problem. Instead of asking for explicit feedback, SaathiAI passively infers feedback from learner behaviour: did they respond to job matches? Did they complete the interview? Did they leave the job within 90 days? This is aggregated into a "Learner Voice" insight panel.
- **Screen required:** "Learner Voice" panel on the district dashboard — AI-synthesised themes: "67% of unplaced learners cite long commute as reason for rejecting matches — consider reviewing Varanasi training centre placement radius policy." with supporting data points.

---

## SURFACE 5 — Cross-Cutting AI Features

> These features span multiple surfaces and represent the core AI intelligence layer that makes SaathiAI genuinely novel.

---

### 5.1 CORE AI ENGINE

#### Feature 5.1.1 — Contextual Memory and Continuity
- **What it does:** SaathiAI remembers every interaction with every learner across the entire placement journey. When a learner returns after days of silence, the AI picks up exactly where they left off with full context.
- **Technical implementation:** Learner state object persisted in database: `{current_stage, last_interaction_timestamp, open_threads, pending_actions, match_history, expressed_preferences}`. Injected into LLM context on every conversation turn.
- **Screen impact:** Conversation continuity — no "who are you?" re-onboarding after gaps. The AI greets returning learners by name and references their last interaction: "Ramu ji, last time aapne Ganesh Electricals mein interest dikhaya tha — kya update hai?"

#### Feature 5.1.2 — Emotional Tone Detection and Response Calibration
- **What it does:** The AI detects emotional signals in the learner's voice notes and text (frustration, anxiety, discouragement) and adjusts its communication tone and support level accordingly.
- **AI behaviour:**
  - Frustrated / angry → AI acknowledges emotion first before problem-solving: "Main samajh sakta hoon yeh frustrating hai..." — never jumps straight to solutions
  - Discouraged / sad → AI shifts to emotional support mode before returning to job content
  - Excited / positive → AI matches energy; moves faster, offers more options
  - Distressed (extreme) → AI provides MSDE learner support helpline number and connects to officer
- **Screen impact:** The tone of AI messages visibly changes (more gentle phrasing, fewer task prompts, more affirmations) based on emotional state detection. Officer dashboard shows a "Learner sentiment" indicator on each profile.

#### Feature 5.1.3 — Labour Market Intelligence Feed
- **What it does:** SaathiAI continuously monitors labour market signals (SIDH vacancy trends, NAPS posting volumes, sector hiring freezes, minimum wage changes) and uses this to proactively adjust matching logic and alert relevant stakeholders.
- **AI behaviour:**
  - Rising vacancies in a trade → AI increases matching priority for learners in that trade
  - Sector hiring freeze detected → AI proactively suggests adjacent trades to affected learners and officers
  - Minimum wage increase announced → AI updates all salary floor calculations and notifies placed learners
- **Screen impact:** Officer dashboard "Market Signals" widget — 3 current signals with recommended actions. District console "Demand Forecast" chart.

#### Feature 5.1.4 — Fraud and Exploitation Detection
- **What it does:** AI monitors employer behaviour for patterns consistent with labour exploitation: unusually low wages, job descriptions that don't match posted roles, employers with high learner departure rates, unverified employers.
- **AI behaviour:**
  - New employer match is unverified → Automatic caution flag in learner match card
  - Employer has >40% 30-day dropout rate from learners → Flagged to officer; removed from active matching until reviewed
  - Salary offered < state minimum wage for trade → Blocked from matching; employer notified
- **Screen impact:** Employer verification status badge on all Skill Cards and match cards. Officer dashboard "Employer risk flags" list.

---

### 5.2 NOTIFICATIONS AND NUDGE ARCHITECTURE

#### Feature 5.2.1 — Nudge Engine — Complete Trigger Library
- **What it does:** A rule-based + AI-driven nudge engine that sends the right message to the right person at the right moment. Every nudge is designed with a specific behavioural trigger and goal.

| Nudge Name | Trigger | Recipient | Message Goal | Channel |
|---|---|---|---|---|
| Graduation Activation | Cohort graduation event | Learner | Initiate onboarding | WhatsApp |
| Onboarding Resume | No response 48h after activation | Learner | Re-engage | WhatsApp → SMS |
| Verification Reminder | Profile unverified after 5 days | Learner | Complete DigiLocker link | WhatsApp |
| Match Delivery | New matches computed | Learner | Express interest | WhatsApp |
| Interest Nudge | Match received but no response in 48h | Learner | Prompt action | WhatsApp |
| Interview Prep Push | Interview confirmed | Learner | Use mock interview | WhatsApp |
| Day-Before Reminder | Interview T-24h | Learner | Logistics reminder | WhatsApp |
| Day-Of Reminder | Interview T-2h | Learner | Confidence boost | WhatsApp |
| First-Day Check-In | First day of work | Learner | Retention support | WhatsApp |
| 30-Day Check-In | 30 days post-placement | Learner | Retention signal | WhatsApp |
| 90-Day Upskill | 90 days post-placement | Learner | Next NSQF level | WhatsApp |
| Certificate Expiry | 60 days before expiry | Learner | Renewal prompt | WhatsApp |
| At-Risk Alert | Risk score > 70 | Officer | Intervene now | Dashboard + Push |
| MIS Report Ready | Monthly report generation | Officer | Review and submit | Dashboard + Push |
| New NAPS Stipend Due | Monthly stipend cycle | Employer | Claim reminder | WhatsApp |
| Demand Gap Alert | Structural mismatch > 4 weeks | DSSDO | Policy action | Dashboard |

#### Feature 5.2.2 — Nudge Fatigue Prevention
- **What it does:** Prevents the system from overwhelming learners (especially at-risk ones) with too many messages.
- **Rules:**
  - Max 2 messages per day to any learner
  - If learner explicitly says "mujhe message mat karo" → pause all nudges for 7 days, flag to officer
  - If learner has not responded to 3 consecutive nudges → switch to lower-frequency mode; escalate to officer
  - Never send nudges between 10pm and 7am

---

### 5.3 DATA, PRIVACY, AND TRUST

#### Feature 5.3.1 — Consent and Data Transparency
- **What it does:** During onboarding, the learner is told clearly (in Hindi, in voice) exactly what data SaathiAI collects, who it is shared with, and how to delete their data.
- **Screen required:** WhatsApp consent message — a plain-Hindi voice note + text summary. Key points: "Aapka data sirf job dhundhne ke liye use hoga. Hum aapka data kisi employer ko bina aapki permission ke nahi denge. Aap kabhi bhi 'data delete karo' likh sakte hain."
- **AI behaviour:** On "data delete karo" command from learner → Immediately initiates data deletion flow, notifies officer, removes profile from matching engine within 24 hours.

#### Feature 5.3.2 — Learner Data Portability
- **What it does:** Learners can request their full data profile as a PDF — their verified credentials, skill badge, match history — to use independently.
- **Screen required:** "Mera profile download karo" WhatsApp command → AI generates a PDF containing: name, trade, NSQF certificate details, capability badge, DigiLocker verification reference. Sent as a WhatsApp document attachment.
- **AI behaviour:** PDF generation is automated. Contains a QR code linking to DigiLocker verification (so employers can verify independently).

---

## MICRO-INTERACTIONS AND STATE LIBRARY

> Every interactive element in the product needs these states designed.

### Error States
- API failure (SIDH / NAPS / DigiLocker down) → Graceful message in Hindi, specific next step, no technical jargon
- Video upload failure → Retry prompt with reason ("Internet weak lag raha hai — dobara try karein")
- Matching engine returns 0 results → Empathetic no-results state with constructive next action (not just "no results found")
- WhatsApp delivery failure → Auto-switch to SMS, flag to officer

### Loading States
- Match computation in progress → "Aapke liye best matches dhundh rahe hain… 🔍" (30 sec max)
- Video being scored → "Aapka video dekh rahe hain… ek minute" (with progress indicator)
- DigiLocker verification → "Certificate verify ho raha hai…" (15 sec)
- Report generating → "Report taiyar ho rahi hai…" (for officer dashboard)

### Success States
- Profile verified → Green confirmation with certificate summary
- Match expressed interest → Immediate acknowledgement + what happens next
- Placement confirmed → Celebration state (learner WhatsApp + officer dashboard confetti)
- Video badge earned → Badge reveal moment (designed as a "unlock" moment)

### Empty States
- No matches yet → "Abhi koi match nahi mila — par hum dhundhte reh rahe hain. Aap apni preferences badal sakte hain."
- No employers in directory → "Is area mein abhi employers nahi hain — hum expand kar rahe hain."
- No cohort yet (officer) → "Apna pehla cohort activate karein" with onboarding prompt

---

## SCREEN INVENTORY — COMPLETE LIST

### Surface 1: SaathiAI Companion (WhatsApp + PWA)
1. WhatsApp Activation Message (design as component)
2. Voice Onboarding Conversation Thread
3. DigiLocker Verification Card (in WhatsApp)
4. Profile Summary / Strength Card
5. Match Delivery Card (3 matches)
6. Match Detail Expansion Card
7. Video Task Assignment Card
8. Video Scoring Result Card
9. Skill Badge Reveal
10. Pre-Interview Briefing Card
11. Mock Interview Conversation Thread
12. Day-Before Interview Reminder Card
13. Day-Of Interview Reminder Card
14. First-Day Check-In Card
15. 30-Day Retention Check-In Card
16. 90-Day Upskill Prompt Card
17. Language Selection Card
18. Consent and Privacy Card
19. Weekly Match Refresh Card
20. Proactive Alert Card (job fair / expiry / new match)
21. Wage Navigation Info Card
22. Data Download Confirmation

### Surface 2: Saathi Officer Dashboard (PWA)
23. Home / Cohort Health Overview
24. Priority Action Inbox
25. Cohort Timeline View
26. Individual Learner Profile Page
27. AI Learner Summary Card (within profile)
28. Employer Directory
29. Create Manual Match Flow
30. Employer Outreach CRM
31. Reports List View
32. MIS Report Preview / Edit
33. Placement Confirmation Modal
34. Cohort End Report View
35. New Cohort Activation Flow
36. Market Signals Widget
37. Employer Risk Flags List

### Surface 3: Saathi Employer Portal
38. WhatsApp Vacancy Posting Flow
39. Learner Skill Card (web page — most critical design)
40. Employer Interest Confirmation Page
41. Candidate Pipeline View
42. NAPS Compliance WhatsApp Flow
43. MSME Cluster Dashboard
44. Employer Profile Setup (WhatsApp flow)

### Surface 4: Saathi District Console
45. District Placement Health Dashboard
46. MSME Demand Signal Map
47. Dropout Risk Early Warning Panel
48. Monthly AI Policy Brief
49. Centre Performance Deep-Dive
50. Learner Voice Insight Panel
51. Trade Heatmap View
52. Supply-Demand Gap Analysis View

---

## DESIGN SYSTEM NOTES FOR UI DESIGNER

### Typography direction
Two registers: an **authoritative display font** for dashboard headers and KPI numbers (something with weight and confidence), and a **highly legible body font** for Hindi text rendering — critical because Devanagari script at small sizes requires specific letterspacing and line-height. Test all body text in both Hindi and English.

### Colour language
- 🟢 Green: placement, success, verified, placed learner
- 🔴 Red: at-risk, unverified employer, urgent action required
- 🟡 Amber: in-progress, follow-up needed, pending
- 🔵 Blue: information, data, government DPI integration
- Neutral warm background (off-white / cream) — not pure white, not grey — referencing the warmth of the solution's human context

### Interaction principles
- **WhatsApp surfaces:** All must look and feel native to WhatsApp. No visual elements that break the chat metaphor. AI messages use a distinct colour bubble (not the standard grey) to signal "this is SaathiAI, not a human."
- **Officer dashboard:** High information density acceptable. Officers are power users. Reduce click depth — every critical action should be reachable in ≤ 2 taps from the home screen.
- **Skill Card (web):** Must load in <2 seconds on 3G. Video must be the visual hero. Design for one-handed mobile use.
- **District console:** Designed for a 13" laptop or larger. Data visualisations must be readable at a glance — no 10-colour legends.

### Accessibility
- All Hindi text must pass WCAG AA contrast ratio
- All interactive elements must have touch targets ≥ 44x44px
- Voice note player must have a visible progress bar (for hearing-impaired users or noisy environments)
- All icons must have text labels — never icon-only navigation

---

*End of SaathiAI Feature Blueprint v1.0*
*Total screens: 52 | Total AI features: 26 | Total user-facing surfaces: 4*