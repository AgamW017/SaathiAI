# Implementation Status vs features.md

## SURFACE 1 — SaathiAI Companion (Learner-Facing)
### 1.1 ONBOARDING FLOW
- [x] Feature 1.1.1 — WhatsApp Activation Trigger
- [x] Feature 1.1.2 — Voice Onboarding Intake (Sarvam ASR integrated)
- [ ] Feature 1.1.3 — Credential Verification Gateway (DigiLocker OAuth missing, simulated via text extraction)
- [x] Feature 1.1.4 — Profile Completion Indicator

### 1.2 JOB MATCHING ENGINE
- [x] Feature 1.2.1 — Constraint-Based Match Generation
- [x] Feature 1.2.2 — Match Detail Expansion
- [ ] Feature 1.2.3 — Weekly Match Refresh (cron jobs pending)
- [ ] Feature 1.2.4 — Proactive Opportunity Alerts

### 1.3 SKILL VERIFICATION — VIDEO TASK ASSESSMENT
- [ ] Feature 1.3.1 — Task Video Request
- [ ] Feature 1.3.2 — AI Video Scoring Engine (document_processing_pipeline is pending)
- [ ] Feature 1.3.3 — Skill Badge Improvement Loop

### 1.4 INTERVIEW PREPARATION
- [ ] Feature 1.4.1 — Pre-Interview Briefing
- [x] Feature 1.4.2 — Voice-Based Mock Interview (Implemented in interviewService.js)
- [ ] Feature 1.4.3 — Day-Of Interview Reminder

### 1.5 POST-PLACEMENT SUPPORT
- [x] Feature 1.5.1 — First-Day Check-In (placementTrackerService)
- [x] Feature 1.5.2 — 30-Day Retention Check-In
- [ ] Feature 1.5.3 — 90-Day Retention and Upskill Prompt
- [ ] Feature 1.5.4 — Wage Navigation Support

### 1.6 LANGUAGE AND ACCESSIBILITY
- [x] Feature 1.6.1 — Language Selection and Persistence (chooseScript implemented)
- [ ] Feature 1.6.2 — SMS Fallback Mode
- [x] Feature 1.6.3 — Voice-Only Mode (Supported via Sarvam ASR)
- [ ] Feature 1.6.4 — Female Safety Preferences

## SURFACE 2 — Saathi Officer Dashboard (Placement Officer)
### 2.1 MAIN DASHBOARD VIEW
- [x] Feature 2.1.1 — Cohort Health Overview
- [x] Feature 2.1.2 — Priority Action Inbox
- [x] Feature 2.1.3 — Cohort Timeline View

### 2.2 LEARNER PROFILE DEEP-DIVE
- [x] Feature 2.2.1 — Individual Learner Profile Card
- [x] Feature 2.2.2 — AI-Generated Learner Summary
- [ ] Feature 2.2.3 — Suggested Officer Action

### 2.3 EMPLOYER AND MATCH MANAGEMENT
- [x] Feature 2.3.1 — Employer Directory
- [ ] Feature 2.3.2 — Manual Match Override
- [ ] Feature 2.3.3 — Employer Outreach CRM

### 2.4 REPORTING AND COMPLIANCE
- [x] Feature 2.4.1 — Auto-Generated MIS Report (reports router)
- [x] Feature 2.4.2 — Placement Confirmation Logging
- [x] Feature 2.4.3 — Cohort End Report

### 2.5 BATCH MANAGEMENT
- [x] Feature 2.5.1 — New Cohort Activation (cohorts router)

## SURFACE 3 — Saathi Employer Portal (MSME-Facing)
### 3.1 SKILL CARD
- [x] Feature 3.1.1 — Learner Skill Card (WhatsApp Link / skillCardService)
- [x] Feature 3.1.2 — Employer Interest Response (employerPingService)
- [ ] Feature 3.1.3 — Employer Verification Badge

### 3.2 EMPLOYER VACANCY MANAGEMENT
- [x] Feature 3.2.1 — Vacancy Posting via WhatsApp (employerPingService)
- [x] Feature 3.2.2 — Employer Candidate Pipeline View (Frontend employer portal)

### 3.3 NAPS APPRENTICESHIP ABSTRACTION
- [ ] Feature 3.3.1 — NAPS Compliance AI Agent
- [ ] Feature 3.3.2 — MSME Cluster Aggregator

## SURFACE 4 — Saathi District Console (DSSDO-Facing)
### 4.1 DISTRICT OVERVIEW
- [x] Feature 4.1.1 — District Placement Health Dashboard
- [ ] Feature 4.1.2 — MSME Demand Signal Map
- [ ] Feature 4.1.3 — Dropout Risk Early Warning

### 4.2 ANALYTICS AND REPORTING
- [x] Feature 4.2.1 — AI-Generated Policy Brief (reports router)
- [x] Feature 4.2.2 — Centre Performance Deep-Dive
- [ ] Feature 4.2.3 — Passive Feedback Aggregation

## SURFACE 5 — Cross-Cutting AI Features
### 5.1 CORE AI ENGINE
- [x] Feature 5.1.1 — Contextual Memory and Continuity (session.context tracking)
- [x] Feature 5.1.2 — Emotional Tone Detection and Response Calibration (distress flags & LLM routing)
- [ ] Feature 5.1.3 — Labour Market Intelligence Feed
