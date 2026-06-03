# SaathiAI (SahAI for Shiksha Hackathon 2026)

> **The Intelligent, WhatsApp-Native Orchestration Layer for India's Skilling DPI**

SaathiAI acts as the vital, missing conversational middleware that bridges the deep information gap between rural vocational graduates, overworked placement cells, and skeptical MSME employers. Instead of building another redundant application or entry portal, SaathiAI unifies existing Digital Public Infrastructures (DPI) like the **Skill India Digital Hub (SIDH)**, **DigiLocker**, and **NAPS** directly inside India's highest-retention messaging interface: WhatsApp.

---

## 🚨 The Core Problem Statement

India injects roughly 12 million young people into the active workforce every single year. Despite robust policies and heavy government funding for skilling (such as PMKVY 4.0 and Jan Shikshan Sansthans), the system experiences massive drop-offs at the transition phase from classroom to employment.

Comprehensive audits reveal that **PMKVY 3.0 successfully placed only 10.1% of its certified trainees**, displaying a sharp downward trend from previous iterations.

The systemic breakdown manifests as five critical handoff points:

1. **Graduation to Guidance Desert:** Overburdened Industrial Training Institute (ITI) placement cells relegate student tracking to manual paper logs or temporary, highly fragmented WhatsApp groups that rapidly decay post-graduation.
2. **The Credential Trust Deficit:** 71% of manufacturing MSMEs explicitly state that government skill-training credentials do not actively help them hire. Static PDF/paper certificates are prone to forgery, forcing employers to default to hyper-local social referral networks.
3. **Desktop-First Portal Friction:** Standard public job-matching platforms (such as the National Career Service portal) enforce complex, multi-page text forms and desktop-first resume inputs that cause immediate platform abandonment among semi-literate populations.
4. **The 90-Day Retention Cliff:** Due to spatial mismatches, unverified candidate profiling, and intense migration shock, up to **22% of newly onboarded vocational workers quit or abscond within the first 90 days** of employment.
5. **Data Silos and Broken Feedback Loops:** State Skill Development Missions (SSDMs) and local District Skill Committees (DSCs) frequently lack structural data interoperability with central entities, creating an administrative blind spot where policy iterations are designed in a complete data vacuum.

---

## 🎯 Target Users & Context

SaathiAI unifies the user experience for three tightly constrained human personas:

* **The Learner (e.g., "Ramu"):** A 19-year-old ITI Fitter/Electrician graduate near Varanasi, UP. He utilizes a low-end Android smartphone (Redmi 9), relies on spotty 2G/3G connectivity, and operates almost entirely via voice notes in regional Hindi/Bhojpuri.
* **The Placement Cell Officer:** An administrative manager managing 200+ students across multiple shifting batches, suffocated by formatting Excel sheets for district compliance reporting.
* **The MSME Shop-Floor Manager:** A small manufacturer who needs immediate practical proof of operational capabilities over theoretical certificates and finds traditional NAPS onboarding processes highly cumbersome.

---

## ⚡ Why AI is Structurally Mandatory

Traditional, rule-based software development relies on a rigid schema of drop-down filters and strict, structured keyboard inputs. This structure fails when interfacing with a demographic that expresses capabilities through conversational oral dialect.

**AI acts as an essential, fluid translation layer.** It alone possesses the capacity to ingest unformatted, messy conversational audio (e.g., a Hinglish voice note), filter out background noise, map phonetic slang into standard NSQF competencies, and instantly output a verified JSON payload that existing state registries can programmatically digest.

---

## 🛠️ The Architecture & DPI Integration

SaathiAI does not seek to rebuild or compete with India's sophisticated underlying Digital Public Infrastructure. It unifies it.

```
       +-----------------------+
       |   WhatsApp Frontend   | <--- Voice / Dialect Notes (Learner)
       +-----------------------+
                   |
                   v (Webhook Streaming)
       +-----------------------+
       |    SaathiAI Engine    | <--- Audio Cached -> Whisper ASR -> LLM Semantic Parser
       +-----------------------+
                   |
                   +-----------------------+------------------------+
                   |                       |                        |
                   v (API Setu)            v (DigiLocker API)       v (NAPS / JobX APIs)
       +-----------------------+ +--------------------+ +-------------------------+
       | Skill India Digital   | | Verifiable LERs    | | Hyper-local Matchmaking |
       | Hub (e-KYC & Profile) | | (Cryptographic ID) | | (MSME Onboarding)       |
       +-----------------------+ +--------------------+ +-------------------------+

```

### Key Technical Integrations (via API Setu):

* **DigiLocker (Push/Pull Schema):** Converts static, vulnerable PDFs into cryptographically signed Learning and Employment Records (LERs) that employers can instantly verify via standard OAuth 2.0 flows.
* **Skill India Digital Hub (SIDH):** Feeds structured JSON data extracted from conversations straight into centralized profiles, bypassing web registration constraints entirely.
* **NAPS-2 Direct Benefit Transfer (DBT) Framework:** Intelligently triggers adaptive check-in nudges to ensure the user’s Aadhaar-seeded bank configurations are correctly linked, directly minimizing systemic subsidy delays.
