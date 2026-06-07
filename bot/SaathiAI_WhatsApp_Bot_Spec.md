# SaathiAI WhatsApp Bot — Complete Functional Specification

---

## Who the bot talks to

The bot has one primary user: a vocational graduate (PMKVY, ITI, JSS) who has just completed or recently completed their course. Call him Ramu. He is 18–25, uses a low-end Android phone, has intermittent connectivity, speaks Hindi or a regional variant of it, and has never written a formal resume. He checks WhatsApp every day. He does not open apps he installed once and forgot. The bot must come to him, in his language, at the right moment.

The bot does not directly serve the placement officer or employer — they have a dashboard and a skill card URL respectively. But every action the bot takes with Ramu must generate data that feeds the officer's dashboard automatically.

---

## How a conversation starts

There are three entry points. The bot must handle all three.

**Entry 1 — Training centre broadcast.**
The training centre (or placement officer) sends a WhatsApp broadcast to all graduates in a batch. The message is:

> नमस्ते! आपका course complete हो गया। 🎉 SaathiAI आपकी पहली job ढूंढने में मदद करेगा। शुरू करने के लिए **START** लिखें।

When Ramu replies with anything — "START", "haan", "ok", "हाँ", even a thumbs up — the bot begins onboarding. Any first reply counts as intent to start. Do not require the exact word START.

**Entry 2 — Direct message.**
Ramu finds the WhatsApp number (from a poster at the training centre, from a friend) and messages it directly. The bot has no context about him. It starts from the same onboarding flow but skips the "your course is complete" framing and instead opens with:

> नमस्ते! मैं SaathiAI हूँ — आपका career साथी। क्या आपने कोई vocational course किया है? जैसे Electrician, Fitter, COPA, या कोई और trade?

**Entry 3 — Placement officer sends a link.**
The officer shares the bot's number with a specific learner. Same as Entry 2 — bot has no context, starts fresh.

In all cases: on the very first message from a new number, check Redis. If no session exists for that phone number, this is a new user. Create a blank session, set step to 0, and begin onboarding.

---

## Language and script detection

Do this on every incoming message before doing anything else.

Count Devanagari Unicode characters (range \u0900–\u097F) vs total alphabetic characters. If more than 40% of the alphabetic characters are Devanagari, the user is writing in Hindi script. If 0% are Devanagari but the message contains recognisable Hindi words (hoon, mera, aapka, kya, nahi, etc.), they are writing Hinglish. If neither, treat as English.

Store the detected script in the session on the first message: `session["script"]`. Use this throughout the entire conversation to decide how to respond. Never switch the response language unless the user switches first.

For voice notes: Sarvam STT returns text in the script that matches the speaker's primary language. A Hindi speaker gets Devanagari output. A Hinglish speaker gets Roman output with Hindi words in Roman. Set the session script from the STT output on the first voice note.

Respond in whichever script the session says. If the session script is "devanagari", send all messages in Devanagari Hindi. If "roman", send in Hinglish. If "english", send in English but keep it simple and avoid formal vocabulary.

Pre-write all template messages (every fixed message in every flow) in all three scripts. Use templates for structured messages. Use the LLM to generate freeform responses (interview feedback, tips, explanations) in the right language.

---

## Flow 1 — Onboarding

**Purpose:** Collect the learner's name, trade, district, and certificate type. Take 3–4 messages maximum. Do not ask for everything at once — that looks like a form, not a conversation.

**Step 0 → Step 1**

Bot sends welcome message (adapt based on entry point as described above). Then immediately asks:

> आपका नाम क्या है?

Wait for reply. Whatever they send, treat it as their name. Do not validate. Store as `session["collected"]["name"]`. Even if they say "Ramu bhai" — store that as their name and use it.

After receiving name:

> [Name] ji, आपने कौन सा trade किया है और आप किस जिले में रहते हैं? बस बोल दीजिए — voice note या type कर सकते हैं।

This is a double question intentionally. Most users will answer both in one message: "main Varanasi mein rehta hoon aur electrician ka course kiya hai." The LLM extracts both trade and district from a single response. If they only answer one part, ask for the other.

**Step 1 → Step 2**

After trade and district are collected, ask about their certificate:

> आपने यह course कहाँ से किया? PMKVY, ITI, या कोई और जगह से?

If they don't know what PMKVY or ITI is, they might say "government course" or "skill centre se". Accept any answer. Map it loosely: "government" → PMKVY, "polytechnic" or "sarkari college" → ITI. If completely unclear, store as "unknown" and move on — do not block progress on this.

**Step 2 → Step 3**

Confirm what was collected:

> ठीक है! मैंने समझा:
> 👤 [Name]
> 🔧 [Trade] — [District], [State]
> 🎓 [Certificate Type]
>
> क्या यह सही है?

Send two buttons: "हाँ, सही है ✅" and "नहीं, बदलो ✏️"

If they tap yes → move to skill extraction.
If they tap no → ask "क्या बदलना है?" Accept freeform reply, re-extract, show confirmation again.

---

## Flow 2 — Skill Extraction

**Purpose:** Understand what Ramu can actually do — not just what trade he studied, but what specific tasks he performed. This becomes the content of his skill card.

**Step 3 → Step 4**

Bot sends:

> अब मुझे बताइए — आपने अपनी training में क्या-क्या किया? कोई भी काम जो आपने सीखा या किया हो। Voice note में बोल सकते हैं।

Wait for their reply. Accept voice note or text. This is the most important input in the entire flow — give them room to describe freely. Do not give options or checkboxes. You want unstructured natural speech because that reveals more than a checklist ever would.

If they send a voice note:
1. Download from Meta media API
2. Convert ogg → wav
3. Send to Sarvam STT with language_code hi-IN
4. Get transcript
5. Pass transcript to LLM skill extractor

If they send text: pass directly to LLM skill extractor.

The LLM extracts a JSON with these fields:
- `skills_mentioned`: array of specific tasks (e.g. "3-phase panel board installation", "wiring", "IS 732 safety protocols")
- `ojt_hours`: number if they mentioned hours, else null
- `specific_projects`: any specific jobs or projects they mentioned
- `additional_trades`: any secondary skills mentioned

After extraction, show a summary:

> मैंने आपकी skills note कर लीं:
> ✅ [skill 1]
> ✅ [skill 2]
> ✅ [skill 3]
>
> कुछ और जोड़ना है?

Send two buttons: "नहीं, ठीक है" and "हाँ, और बताऊंगा"

If they want to add more, collect one more free-form message, re-run extraction, merge with existing skills, show updated list.

If they're happy → move to skill card generation.

**Handling insufficient detail:**

If the extraction returns fewer than 2 skills (the user was very brief, e.g. "wiring ka kaam kiya"), prompt once more:

> थोड़ा और बताइए — जैसे कि आपने OJT में कहाँ काम किया, या कौन सी specific चीज़ें install/repair की?

Do not ask this twice. If they're still brief after the second chance, work with what you have.

---

## Flow 3 — Skill Card Generation

**Purpose:** Generate a verified skill card, give Ramu a shareable URL, and explain what it is.

**Step 4 → Step 5**

Bot sends a "processing" message first (because generation takes 1–2 seconds):

> आपका Skill Card बन रहा है... ⚙️

Then generate the skill card record in the database (id, all collected fields, timestamp) and construct the URL: `https://yourdomain.com/card/{card_id}`

Then send:

> ✅ आपका Skill Card तैयार है!
>
> 🔗 [card URL]
>
> यह link employers को भेज सकते हैं। इसमें आपकी verified skills, NSQF level, और certificate details हैं।

Immediately follow with:

> अब आपके लिए jobs ढूंढते हैं। तैयार हैं?

Send two buttons: "हाँ, Jobs दिखाओ 🎯" and "बाद में"

If they tap "बाद में": acknowledge, save state as step 5 (skill card generated, jobs not yet shown), send:
> ठीक है! जब चाहें "JOBS" लिखें — मैं तुरंत match करूंगा।
Stop there. Proactive nudge scheduler picks them up in 48 hours.

---

## Flow 4 — Job Matching

**Purpose:** Show Ramu 3 real job openings near him that match his trade. Let him express interest in one tap.

**Step 5 → Step 6**

Query the job database: filter by trade, filter by distance ≤ 25km from their district centroid, sort by distance ascending, return top 3. If fewer than 3 exist within 25km, expand to 50km. If still fewer than 3, show what exists and note the distance.

Send each job as a separate message (not a list) so each one is readable and distinct:

> **Job 1 of 3** ⚡
> Gupta Electricals Pvt. Ltd.
> 📍 12 km — Varanasi City
> 💰 ₹14,000 – ₹18,000 / month
> 🕐 2 openings • Posted 2 days ago

> **Job 2 of 3** 🏭
> Varanasi Industrial Zone (NAPS Registered)
> 📍 18 km — Ramnagar
> 💰 ₹8,000 stipend / month
> 🟢 Government registered apprenticeship

> **Job 3 of 3** ⚡
> BHU Infrastructure Projects
> 📍 8 km — Lanka, Varanasi
> 💰 ₹12,000 – ₹15,000 / month
> 🕐 1 opening • Posted today

After all three, send a single interactive message:

> किस job में interest है?

With buttons: "Job 1 — Gupta Electricals", "Job 2 — NAPS Apprentice", "Job 3 — BHU Projects", "कोई नहीं"

When they select a job:

1. Mark that job as "applied" in the database, linked to their learner record
2. Mark the match as "interested" in the session
3. Send the employer their skill card URL (or flag for placement officer to contact employer manually if no automated employer integration yet)
4. Tell Ramu:

> ✅ हमने Gupta Electricals को आपका Skill Card भेज दिया है।
>
> वे जल्द contact करेंगे। कभी-कभी 2–3 दिन लगते हैं — घबराएं नहीं।
>
> तब तक interview की तैयारी करें? 🎯

Send two buttons: "हाँ, Practice करें" and "ठीक है, इंतज़ार करूंगा"

If they select "कोई नहीं": ask why in one message:
> कोई बात नहीं। क्या कारण है? ज़्यादा दूर हैं, salary कम है, या कुछ और?

Accept freeform reply, store the feedback, then say:
> समझ गया। जैसे ही नई jobs आएंगी, मैं बताऊंगा। 👍
Move to step 6 (waiting state). Proactive nudge will fire in 7 days.

---

## Flow 5 — Interview Preparation

**Purpose:** Run Ramu through 2–3 mock interview questions specific to his trade. Give him concrete, actionable feedback after each answer.

**Step 6 → Step 7**

Bot explains the format first:

> Interview practice शुरू करते हैं! मैं interviewer की तरह सवाल पूछूंगा। आप voice note या text में जवाब दें। मैं feedback दूंगा।
>
> तैयार? पहला सवाल:

**Question bank — Electrician (NSQF Level 3):**
- "आपने किस तरह का electrical work किया है? एक real example दीजिए।"
- "अगर किसी circuit में fault आए तो आप कैसे पहचानेंगे और ठीक करेंगे?"
- "3-phase aur single-phase connection mein kya fark hota hai?"
- "Safety के लिए आप क्या precautions लेते हैं?"

**Question bank — Fitter (NSQF Level 3):**
- "आपने कौन से machines पर काम किया है?"
- "Blueprint या drawing पढ़ना आता है? कैसे use करते हैं?"
- "Lathe machine par turning operation kaise karte hain?"
- "Measuring instruments mein kaunse use kiye hain aapne?"

**Question bank — COPA (NSQF Level 4):**
- "आप कौन से software use कर सकते हैं?"
- "Data entry mein aapki speed kitni hai?"
- "Koi computer problem aai thi kabhi? Kaise solve ki?"

Pick 3 questions for the learner's specific trade. Send them one at a time. Wait for their answer before sending the next.

**Evaluating answers:**

Pass the question + their answer to the LLM with this instruction:

```
The user is a vocational graduate practicing for a job interview.
Question asked: [question]
Their answer: [answer]

Evaluate their answer on two dimensions:
1. Content: Did they mention relevant skills or specific examples? (yes/partially/no)
2. Clarity: Was the answer coherent and confident? (yes/partially/no)

Give ONE specific improvement tip in [language]. Keep it to 2 sentences maximum.
Start with brief positive reinforcement. Never be harsh.
```

Send the feedback, then either send the next question or close the practice session.

After all 3 questions, send a summary:

> बहुत अच्छा! आपकी practice हो गई। 💪
>
> एक tip याद रखें: interview में हमेशा एक specific example दें — सिर्फ "haan mujhe aata hai" नहीं।
>
> All the best! जब भी और practice करनी हो, "PRACTICE" लिखें।

Set step to 7 (interview prep done, tracking placement).

**If they skip interview prep:** Respect it. Do not push twice. Just say:

> ठीक है! जब भी practice करनी हो, बस "PRACTICE" लिखें। 👍

---

## Flow 6 — Placement Tracking

**Purpose:** Know whether Ramu got the job, and if not, keep helping him. This phase runs for weeks or months through proactive messages rather than one-time flows.

After interview prep is done (or skipped), the bot enters a passive tracking state. It does not send daily messages. It follows a specific nudge schedule described below.

When the employer contacts Ramu and schedules an interview, we may not know about it unless Ramu tells us. So the bot asks at specific intervals.

**Nudge at Day 3 (3 days after applying to a job):**

> Ramu ji, Gupta Electricals ka koi message aaya? Ya unka call aaya?

Buttons: "हाँ, interview fix हुई 📅" | "नहीं, कोई reply नहीं" | "हाँ, selected हो गया! 🎉"

If "selected":
> 🎊 बधाई हो Ramu ji! यह बहुत बड़ी बात है।
>
> पहले दिन के लिए कुछ tips चाहिए?
Set status to PLACED in database. Record placement date and employer.

If "interview fix hui":
> शानदार! Interview से पहले practice करें? "PRACTICE" लिखें।

If "no reply":
> ठीक है। कभी-कभी 5–7 दिन लगते हैं। हम 3 दिन और wait करते हैं।
> तब तक 2 और jobs देखें?
Buttons: "हाँ, और jobs दिखाओ" | "नहीं, इंतज़ार करूंगा"

**Nudge at Day 7:**
Same format. If still no reply from employer, offer fresh job matches. If they've gone completely silent (no reply to the nudge either), mark as AT_RISK in the database — placement officer gets an alert on their dashboard.

**Nudge at Day 14:**
> 2 हफ्ते हो गए Ramu ji। क्या job मिली?
Buttons: "हाँ, job मिल गई! 🎉" | "नहीं, अभी ढूंढ रहा हूँ"

If still searching: restart job matching flow with fresh listings.

**Nudge at Day 30 (if not placed):**
> Ramu ji, abhi bhi job dhundh rahe hain? Koi problem aa rahi hai?
Accept freeform. Route based on what they say — if it's about distance, show more jobs. If salary, note it. If they gave up, record and alert placement officer.

**90-day retention check (if placed):**
> Ramu ji, 3 महीने हो गए Gupta Electricals में। काम कैसा चल रहा है?
Buttons: "अच्छा चल रहा है 👍" | "छोड़ दिया" | "बदलाव चाहिए"
Record the 90-day retention status. If they left, ask why and re-enter job matching.

---

## Keyword triggers — always active

At any point in any conversation, if the user sends one of these keywords, the bot acts on them immediately regardless of which step they're on. These override the state machine.

| Keyword | Bot does |
|---|---|
| "JOBS" or "job chahiye" or "kaam chahiye" | Re-runs job matching with latest listings |
| "PRACTICE" or "interview practice" | Starts interview prep from question 1 |
| "CARD" or "skill card" or "mera card" | Resends their skill card URL |
| "HELP" or "madad" or "help chahiye" | Sends a menu of what SaathiAI can do |
| "STOP" or "mat bhejo" or "unsubscribe" | Stops all proactive nudges, sends confirmation |
| "START" | Restarts from the beginning if they have no active profile |
| "STATUS" | Shows their current placement status summary |

The HELP menu:

> SaathiAI क्या कर सकता है:
> 
> 🔧 **JOBS** — नई jobs देखें
> 📝 **CARD** — Skill Card देखें/share करें
> 🎯 **PRACTICE** — Interview practice करें
> 📊 **STATUS** — अपना status देखें
> 🚫 **STOP** — Messages बंद करें

---

## Handling unexpected input

The bot will receive messages it does not expect. These fall into three categories.

**Category 1 — Off-topic questions.**
User asks something unrelated: "weather kaisa hai", "Modi ji kya bol rahe hain", "mujhe loan chahiye."

Bot does not try to answer. Responds:

> माफ करें, मैं सिर्फ jobs और career में help करता हूँ। 😊 क्या job ढूंढने में help करूं?

**Category 2 — Follow-up questions about the job or employer.**
User asks: "Gupta Electricals mein kya kaam hoga?" or "salary pakki hai?"

Bot has limited employer data. If the job record has additional details, share them. If not:
> मेरे पास इतनी detail नहीं है। Interview में directly poochh sakte hain — यह actually अच्छा impression देता है।

**Category 3 — Emotional or distress messages.**
User says: "koi kaam nahi mila", "thak gaya hoon", "family pressure hai", "paisa nahi hai."

Do not ignore these. Respond with empathy first, then practical help:
> समझ सकता हूँ — यह time मुश्किल होता है। आप अकेले नहीं हैं।
>
> चलिए मिलकर एक नई कोशिश करते हैं — अभी आपके लिए fresh jobs देखते हैं?

Do not give mental health advice or suggest counseling services. That is outside the bot's scope. Acknowledge and redirect to what you can actually do.

---

## Handling message delivery failures

WhatsApp delivery can fail silently — the user may have changed numbers, deleted the app, or be unreachable. The Meta webhook will return a delivery failure status for undelivered messages.

When a delivery fails on a proactive nudge:
- Mark the message as failed in the database
- Do not retry more than once within 24 hours
- After 3 consecutive failed deliveries, mark the learner as UNREACHABLE in the database and alert the placement officer

---

## Handling duplicate messages

WhatsApp occasionally delivers the same message twice (webhook fires twice for the same message_id). Always store the last processed `message_id` in Redis per user. Before processing any incoming message, check if that message_id was already handled. If yes, acknowledge the webhook with 200 OK but do not process again.

---

## Session expiry and returning users

Redis sessions expire after 7 days of inactivity. If a user messages after 7 days with no session:

- If they have a learner record in Postgres (phone number exists) → reload their state from Postgres, recreate Redis session, greet them by name:
  > Ramu ji, वापस आए! 😊 क्या काम आया कुछ?

- If no Postgres record exists (completely new) → start fresh onboarding.

Never lose their data. Postgres is the source of truth. Redis is only the active session cache.

---

## First-day tips (post-placement)

When a learner confirms they got placed, the bot offers first-day tips. These are trade-specific.

**Electrician:**
> 💼 पहले दिन के लिए:
> ✅ 15 मिनट पहले पहुँचें
> ✅ Safety shoes और PPE लेकर जाएं
> ✅ Supervisor का नाम और designation पूछें
> ✅ पहले दिन ज़्यादा observe करें, कम बोलें
> ✅ अपने tools की list लिख लें
> ✅ IS 732 safety rules mind में रखें
>
> All the best! आप कर सकते हैं। 💪

**COPA:**
> 💼 पहले दिन के लिए:
> ✅ Software versions पूछें जो company use करती है
> ✅ अपना email account set up करें पहले दिन
> ✅ Data backup policy समझें
> ✅ किसी file को delete करने से पहले confirm करें
>
> All the best! 💪

Similar tip sets for all priority trades (Fitter, Mechanic, Welder, Plumber).

---

## What the bot logs to the database on every interaction

Every message sent and received must be logged. Not the content of every message (privacy) — but the events:

- `learner_id`, `phone`, `timestamp`
- `event_type`: one of [MESSAGE_RECEIVED, MESSAGE_SENT, VOICE_RECEIVED, BUTTON_TAPPED, STEP_ADVANCED, JOB_MATCHED, JOB_APPLIED, INTERVIEW_STARTED, INTERVIEW_COMPLETED, PLACEMENT_CONFIRMED, NUDGE_SENT, NUDGE_DELIVERED, NUDGE_FAILED, SESSION_CREATED, SESSION_RESUMED]
- `step_before`, `step_after`
- `metadata`: JSON with relevant details (e.g. for JOB_APPLIED: job_id, employer_name, distance_km)

This event log is what powers the placement officer dashboard. The dashboard reads from this log — it does not need the bot to push anything to it separately.

---

## What the bot never does

- Never claims to guarantee a job
- Never stores Aadhaar numbers or bank account details
- Never asks for OTP or passwords
- Never sends unsolicited promotional messages (only nudges on the schedule above)
- Never gives medical, legal, or financial advice
- Never impersonates a government official or employer
- Never fabricates job listings — every job shown must exist in the database
- Never generates a skill card with credentials that weren't collected from the user in the conversation

---

## Summary of all bot states

| Step | Name | What the bot is waiting for |
|---|---|---|
| 0 | NEW | First message from user |
| 1 | ONBOARDING_NAME | User's name |
| 2 | ONBOARDING_TRADE | Trade and district |
| 3 | ONBOARDING_CERTIFICATE | Certificate type |
| 4 | SKILL_EXTRACTION | Skill description (voice or text) |
| 5 | SKILL_CARD_SHOWN | User to say yes to jobs or "later" |
| 6 | JOBS_SHOWN | User to select a job or decline |
| 7 | JOB_APPLIED | Waiting for employer response (nudge schedule active) |
| 8 | INTERVIEW_Q1 | Answer to question 1 |
| 9 | INTERVIEW_Q2 | Answer to question 2 |
| 10 | INTERVIEW_Q3 | Answer to question 3 |
| 11 | TRACKING | Passive — nudge schedule active |
| 12 | PLACED | Placed — 90-day retention check pending |
| 13 | UNREACHABLE | Delivery failed 3+ times — officer alerted |
| 99 | STOPPED | User sent STOP — no further proactive messages |
