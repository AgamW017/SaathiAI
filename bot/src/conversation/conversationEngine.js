import { EventTypes, PlacementStatus, StepNames, Steps } from '../constants/steps.js';
import { isDocumentUploadEnabled } from '../constants/config.js';
import { t, withOptions, LANGUAGE_MENU } from '../templates/messages.js';
import { chooseScript } from '../utils/scriptDetector.js';
import { isAffirmative, isNegative, normalizeText, parseNumberChoice } from '../utils/text.js';
import { detectKeywordIntent, isDistressMessage } from './keywordRouter.js';
import { verificationLabel } from '../services/jobService.js';

const LANGUAGE_OPTIONS = [
  { value: 'english', script: 'english', label: 'English' },
  { value: 'hindi', script: 'devanagari', label: 'हिंदी' },
  { value: 'hinglish', script: 'roman', label: 'Hinglish' },
  { value: 'marathi', script: 'devanagari', label: 'मराठी' },
  { value: 'gujarati', script: 'roman', label: 'ગુજરાતી' },
  { value: 'bengali', script: 'roman', label: 'বাংলা' },
];

export class ConversationEngine {
  constructor({ store, eventLog, extractionService, skillCardService, jobService, interviewService, transcriptionService, placementTrackerService, employerPingService, documentStorageService, sandboxKycService, logger }) {
    this.store = store;
    this.eventLog = eventLog;
    this.extractionService = extractionService;
    this.skillCardService = skillCardService;
    this.jobService = jobService;
    this.interviewService = interviewService;
    this.transcriptionService = transcriptionService;
    this.placementTrackerService = placementTrackerService;
    this.employerPingService = employerPingService;
    this.documentStorageService = documentStorageService;
    this.sandboxKycService = sandboxKycService ?? null;
    this.logger = logger;
    this.aiClient = extractionService.aiClient;
  }

  async processIncoming(incoming) {
    const session = await this.loadOrCreateSession(incoming.phone);
    const stepBefore = session.step;

    if (this.isDuplicate(session, incoming.messageId)) {
      this.logger.debug({ phone: incoming.phone, messageId: incoming.messageId }, 'Duplicate message ignored');
      return { replies: [], session, duplicate: true };
    }

    this.markMessageProcessed(session, incoming.messageId);

    const learner = await this.store.getLearnerByPhone(incoming.phone);
    await this.eventLog.record({
      learnerId: learner?.id,
      phone: incoming.phone,
      eventType: incoming.isVoice ? EventTypes.VOICE_RECEIVED : EventTypes.MESSAGE_RECEIVED,
      stepBefore,
      stepAfter: stepBefore,
      metadata: { messageId: incoming.messageId, fromGroup: Boolean(incoming.fromGroup) }
    });

    const text = await this.textFromIncoming(incoming, session);
    if (text === null) {
      // null means voice transcription failed — not applicable to image/document messages
      const reason = session.context.lastVoiceTranscriptionError ?? 'unknown voice transcription error';
      this.logger.warn({ phone: incoming.phone, reason }, 'Voice message could not be transcribed');
      const fallbackReplies = [this.message(t(session.script).voiceUnavailable, { debugReason: reason, intent: 'voice_transcription_failed' })];
      const draftedReplies = await this.draftReplies(session, fallbackReplies, '');
      await this.store.saveSession(session);
      return { replies: draftedReplies, session };
    }

    // Only auto-detect script if the user hasn't locked their language preference
    if (!session.language) {
      session.script = chooseScript(session, text);
    }
    session.lastInteractionAt = new Date().toISOString();
    session.context.lastQuotedBody = incoming.quotedBody ?? null;

    // Check if the incoming message is an employer ping command
    if (this.employerPingService) {
      const parsed = this.employerPingService.parseEmployerCommand(text);
      if (parsed) {
        const response = await this.employerPingService.handleEmployerPing(text, incoming.phone);
        if (response !== null) {
          const pingReplies = [this.message(response)];
          const draftedPingReplies = await this.draftReplies(session, pingReplies, text);
          await this.store.saveSession(session);
          return { replies: draftedPingReplies, session };
        }
        // response === null means sender is not an employer, ignore silently
        return { replies: [], session };
      }
    }

    const replies = await this.routeText(session, text, incoming);
    const finalReplies = await this.draftReplies(session, replies, text);

    // Store chat history in session (last 10 exchanges for context)
    if (!session.context.chatHistory) session.context.chatHistory = [];
    session.context.chatHistory.push({ role: 'user', text, at: new Date().toISOString() });
    for (const reply of finalReplies) {
      session.context.chatHistory.push({ role: 'bot', text: reply.text, at: new Date().toISOString() });
    }
    // Keep only last 10 messages to avoid bloating session
    session.context.chatHistory = session.context.chatHistory.slice(-10);

    await this.persistSessionAndLearner(session);

    if (session.step !== stepBefore) {
      await this.eventLog.record({
        learnerId: session.learnerId,
        phone: session.phone,
        eventType: EventTypes.STEP_ADVANCED,
        stepBefore,
        stepAfter: session.step,
        metadata: { from: StepNames[stepBefore], to: StepNames[session.step] }
      });
    }

    return { replies: finalReplies, session };
  }

  async loadOrCreateSession(phone) {
    const existingSession = await this.store.getSession(phone);
    if (existingSession) {
      return {
        ...existingSession,
        context: existingSession.context ?? {},
        collected: existingSession.collected ?? {},
        lastProcessedMessageIds: existingSession.lastProcessedMessageIds ?? []
      };
    }

    const learner = await this.store.getLearnerByPhone(phone);
    const session = {
      phone,
      learnerId: learner?.id ?? null,
      step: learner?.step ?? Steps.NEW,
      script: learner?.script ?? null,
      language: learner?.language ?? null,
      placementStatus: learner?.placementStatus ?? PlacementStatus.ONBOARDING,
      collected: {
        name: learner?.name ?? null,
        trade: learner?.trade ?? null,
        district: learner?.district ?? null,
        state: learner?.state ?? null,
        certificateType: learner?.certificateType ?? null,
        skills: learner?.skills ?? []
      },
      cardUrl: learner?.cardUrl ?? null,
      context: {},
      lastProcessedMessageIds: [],
      createdAt: new Date().toISOString(),
      lastInteractionAt: new Date().toISOString()
    };

    await this.store.saveSession(session);
    await this.eventLog.record({
      learnerId: learner?.id,
      phone,
      eventType: learner ? EventTypes.SESSION_RESUMED : EventTypes.SESSION_CREATED,
      stepBefore: Steps.NEW,
      stepAfter: session.step,
      metadata: {}
    });

    return session;
  }

  async textFromIncoming(incoming, session) {
    if (!incoming.isVoice) return incoming.body ?? '';

    if (!this.transcriptionService.isConfigured()) {
      session.context.lastVoiceTranscriptionError = this.transcriptionService.getStatus().reason;
      return null;
    }

    const transcript = await this.transcriptionService.transcribe(incoming.media);
    if (transcript) {
      session.context.lastVoiceTranscriptionError = null;
      session.script = chooseScript(session, transcript);
      return transcript;
    }

    session.context.lastVoiceTranscriptionError =
      this.transcriptionService.getLastError() ?? 'Sarvam returned no transcript before timeout';
    return null;
  }

  async routeText(session, text, incoming = {}) {
    const messages = t(session.script);
    const keyword = detectKeywordIntent(text);

    if (keyword) {
      return this.handleKeyword(session, keyword);
    }

    if (isDistressMessage(text)) {
      return [this.message(withOptions(messages.empathetic, [messages.labels.showJobs, messages.labels.wait]))];
    }

    switch (session.step) {
      case Steps.NEW:
        return this.startOnboarding(session);
      case Steps.LANGUAGE_SELECT:
        return this.handleLanguageSelect(session, text);
      case Steps.ONBOARDING_NAME:
        return this.handleName(session, text);
      case Steps.ONBOARDING_TRADE:
        return this.handleTradeDistrict(session, text);
      case Steps.ONBOARDING_CERTIFICATE:
        return this.handleCertificateAndConfirmation(session, text);
      case Steps.ONBOARDING_DOCUMENTS:
        // If toggle was disabled mid-flow, skip directly to SKILL_EXTRACTION
        if (!isDocumentUploadEnabled()) {
          session.step = Steps.SKILL_EXTRACTION;
          return this.handleSkillExtraction(session, text);
        }
        return this.handleDocumentUpload(session, text, incoming.media);
      case Steps.AADHAAR_OTP_SENT:
        return this.handleAadhaarOtp(session, text);
      case Steps.SKILL_EXTRACTION:
        return this.handleSkillExtraction(session, text);
      case Steps.SKILL_CARD_SHOWN:
        return this.handleJobsReady(session, text);
      case Steps.JOBS_SHOWN:
        return this.handleJobSelection(session, text);
      case Steps.JOB_APPLIED:
        return this.handlePostApply(session, text);
      case Steps.INTERVIEW_Q1:
      case Steps.INTERVIEW_Q2:
      case Steps.INTERVIEW_Q3:
        return this.handleInterviewAnswer(session, text);
      case Steps.SALARY_CAPTURE:
      case Steps.SALARY_RETRY:
        return this.placementTrackerService.handleSalaryResponse(session, text);
      case Steps.RETENTION_CHECK:
      case Steps.RETENTION_RETRY:
        return this.placementTrackerService.handleRetentionResponse(session, text);
      case Steps.EMPLOYER_PING_REPLY:
        return this.handleEmployerPingReply(session, text);
      case Steps.PLACEMENT_DETAILS:
        return this.handlePlacementDetails(session, text);
      case Steps.PLACED:
      case Steps.STOPPED:
      case Steps.TRACKING:
      default:
        return this.handleFreeformWithAI(session, text);
    }
  }

  /**
   * AI-driven freeform response for when the user says something outside
   * the rigid step flow. The AI generates a contextual reply while being
   * aware of what the bot can do (JOBS, CARD, PRACTICE, etc.)
   */
  async handleFreeformWithAI(session, text) {
    // Check for placement signal even in freeform states
    if (detectKeywordIntent(text) === 'placed') {
      return this.enterPlacementDetailsFlow(session);
    }

    const stepName = StepNames[session.step] ?? 'idle';
    const capabilities = 'JOBS (find matching jobs), CARD (view skill card), PRACTICE (interview practice), STATUS (check status), HELP (see options)';

    const prompt = `The learner said: "${text}"

Current state: ${stepName} | Trade: ${session.collected?.trade ?? 'unknown'} | District: ${session.collected?.district ?? 'unknown'}
Available commands: ${capabilities}

Respond naturally to what they said. If they're asking about something you can help with, guide them.
If they're just chatting, be friendly but gently remind them of what you can help with.
If they seem to want jobs, suggest they type JOBS. If they want practice, suggest PRACTICE.
If they're placed and happy, congratulate them. If they're frustrated, be empathetic and offer concrete next steps.
Don't just say "I can only help with jobs" — be conversational and human.`;

    try {
      const aiResponse = await this.aiClient.draftReply({
        script: session.script ?? 'roman',
        intent: 'freeform_conversation',
        brief: prompt,
        facts: { incomingText: text, step: stepName },
        session
      });

      if (aiResponse?.text) {
        return [this.message(aiResponse.text, { intent: 'freeform', facts: { aiGenerated: true } })];
      }
    } catch (error) {
      this.logger.error({ error, phone: session.phone }, 'Freeform AI response failed');
    }

    // Fallback if AI fails
    const messages = t(session.script);
    return [this.message(messages.help)];
  }

  async handleKeyword(session, keyword) {
    const messages = t(session.script);

    if (keyword === 'stop') {
      session.step = Steps.STOPPED;
      session.placementStatus = PlacementStatus.STOPPED;
      return [this.message(messages.stopped)];
    }

    if (keyword === 'help') return [this.message(messages.help)];
    if (keyword === 'status') return [this.message(this.statusText(session))];

    if (keyword === 'card') {
      const card = await this.store.getLatestSkillCardByPhone(session.phone);
      if (!card) return [this.message(messages.noCardYet)];
      session.cardUrl = card.url;
      return [this.message(messages.cardReady(card.url))];
    }

    if (keyword === 'practice') {
      return this.startInterview(session);
    }

    if (keyword === 'jobs') {
      return this.showJobs(session);
    }

    if (keyword === 'placed') {
      return this.enterPlacementDetailsFlow(session);
    }

    if (keyword === 'start' && session.step === Steps.STOPPED) {
      session.step = session.collected?.name ? Steps.SKILL_CARD_SHOWN : Steps.NEW;
      return this.routeText(session, 'hello');
    }

    if (keyword === 'start' && session.step === Steps.NEW) {
      return this.startOnboarding(session);
    }

    return [this.message(messages.help)];
  }

  startOnboarding(session) {
    // If language already set (returning user), skip straight to name
    if (session.language) {
      const messages = t(session.script);
      session.step = Steps.ONBOARDING_NAME;
      session.placementStatus = PlacementStatus.ONBOARDING;
      return [this.message(`${messages.welcomeNew}\n\n${messages.askName}`)];
    }
    session.step = Steps.LANGUAGE_SELECT;
    session.placementStatus = PlacementStatus.ONBOARDING;
    return [this.message(LANGUAGE_MENU, { intent: 'language_menu', facts: { aiGenerated: true } })];
  }

  handleLanguageSelect(session, text) {
    const choice = parseNumberChoice(text, LANGUAGE_OPTIONS.length);
    const lang = choice ? LANGUAGE_OPTIONS[choice - 1] : null;

    if (!lang) {
      return [this.message(LANGUAGE_MENU, { intent: 'language_reprompt', facts: { aiGenerated: true } })];
    }

    session.language = lang.value;
    session.script = lang.script;

    const messages = t(session.script);
    session.step = Steps.ONBOARDING_NAME;
    return [
      this.message(messages.languageSet, { intent: 'language_set', facts: { aiGenerated: true } }),
      this.message(`${messages.welcomeNew}\n\n${messages.askName}`, { intent: 'welcome' })
    ];
  }

  async handleName(session, text) {
    const messages = t(session.script);

    // If user types yes/no/number, they're probably responding to a previous question
    // Don't interpret these as names
    if (isAffirmative(text) || isNegative(text)) {
      // If they already have a name stored, treat "yes" as confirming it
      if (session.collected.name && isAffirmative(text)) {
        session.step = Steps.ONBOARDING_TRADE;
        return [this.message(messages.askTradeDistrict(session.collected.name), { intent: 'ask_trade_district' })];
      }
      // Otherwise re-ask for name
      return [this.message(messages.askName, { intent: 'clarify_name', facts: { reason: 'got_yes_no_instead_of_name' } })];
    }

    try {
      const extraction = await this.extractionService.extractName(text, { script: session.script });
      this.addAiFlags(session, extraction.flags, 'name');

      if (!extraction.name) {
        return [this.message(messages.askName, { intent: 'clarify_name', facts: { reason: 'name_not_clear' } })];
      }

      session.collected.name = extraction.name;
      session.step = Steps.ONBOARDING_TRADE;
      return [this.message(messages.askTradeDistrict(session.collected.name), { intent: 'ask_trade_district' })];
    } catch (error) {
      this.logger.error({ error, phone: session.phone }, 'Name extraction failed unexpectedly');
      this.addAiFlags(session, [{ code: 'ai_error', severity: 'warning', reason: error.message, field: 'name' }], 'name');
      // Ask again — don't advance state, don't guess
      return [this.message(messages.askName, { intent: 'clarify_name', facts: { reason: 'extraction_error' } })];
    }
  }

  async handleTradeDistrict(session, text) {
    const messages = t(session.script);
    let extracted;
    try {
      extracted = await this.extractionService.extractProfile(text, session.collected);
      this.addAiFlags(session, extracted.flags, 'profile');
    } catch (error) {
      this.logger.error({ error, phone: session.phone }, 'Profile extraction failed unexpectedly');
      this.addAiFlags(session, [{ code: 'ai_error', severity: 'warning', reason: error.message, field: 'profile' }], 'profile');
      // Use a minimal result so the flow still works — ask again for what's missing
      extracted = { trade: null, district: null, state: null, flags: [] };
    }
    const profilePatch = withoutEmptyValues({
      trade: extracted.trade,
      district: extracted.district,
      state: extracted.state
    });

    if (session.context.awaitingProfileField === 'trade') {
      session.collected.trade = extracted.trade ?? null;
      session.context.awaitingProfileField = null;
    } else if (session.context.awaitingProfileField === 'district') {
      session.collected.district = extracted.district ?? null;
      session.collected.state = extracted.state ?? session.collected.state ?? null;
      session.context.awaitingProfileField = null;
    }

    session.collected = { ...session.collected, ...profilePatch };

    if (!session.collected.trade) {
      session.context.awaitingProfileField = 'trade';
      return [this.message(messages.askMissingTrade, { intent: 'clarify_trade', facts: { extraction: extracted } })];
    }

    if (!session.collected.district) {
      session.context.awaitingProfileField = 'district';
      return [this.message(messages.askMissingDistrict, { intent: 'clarify_district', facts: { extraction: extracted } })];
    }

    session.step = Steps.ONBOARDING_CERTIFICATE;
    return [this.message(messages.profileBasicsCaptured(session.collected), { intent: 'ask_certificate', facts: session.collected })];
  }

  async handleCertificateAndConfirmation(session, text) {
    const messages = t(session.script);

    if (session.context.profileCorrection) {
      // Handle the merge/replace choice if we're waiting for it
      if (session.context.awaitingTradeChoice) {
        const newTrade = session.context.pendingNewTrade;
        const oldTrade = session.context.pendingOldTrade;

        if (isAffirmative(text) || normalizeText(text).includes('add') || normalizeText(text).includes('jod') || normalizeText(text).includes('dono') || text.trim() === '1') {
          // Merge — combine both trades
          session.collected.trade = `${oldTrade}, ${newTrade}`;
        } else {
          // Replace — only keep new trade
          session.collected.trade = newTrade;
        }

        session.context.awaitingTradeChoice = false;
        session.context.pendingNewTrade = null;
        session.context.pendingOldTrade = null;
        session.context.profileCorrection = false;
        session.context.profileConfirmation = true;
        return [this.message(this.profileConfirmationText(session), { intent: 'confirm_profile', facts: session.collected })];
      }

      let extracted;
      try {
        // Pass empty existing so AI doesn't merge with old values — this is a CORRECTION
        extracted = await this.extractionService.extractProfile(text, {});
        this.addAiFlags(session, extracted.flags, 'profile_correction');
      } catch (error) {
        this.logger.error({ error, phone: session.phone }, 'Profile correction extraction failed');
        extracted = { trade: null, district: null, state: null, flags: [] };
      }

      // If trade changed and old trade exists, ask whether to add or replace
      if (extracted.trade && session.collected.trade && normalize(extracted.trade) !== normalize(session.collected.trade)) {
        session.context.awaitingTradeChoice = true;
        session.context.pendingNewTrade = extracted.trade;
        session.context.pendingOldTrade = session.collected.trade;
        // Update district/state if provided
        if (extracted.district) session.collected.district = extracted.district;
        if (extracted.state) session.collected.state = extracted.state;

        const oldTrade = session.collected.trade;
        const newTrade = extracted.trade;
        let askMsg;
        if (session.script === 'devanagari') {
          askMsg = `आपने पहले "${oldTrade}" बताया था। अब "${newTrade}" बता रहे हैं।\n\n1. दोनों रखें (${oldTrade}, ${newTrade})\n2. सिर्फ ${newTrade} रखें`;
        } else if (session.script === 'english') {
          askMsg = `You previously said "${oldTrade}". Now you're saying "${newTrade}".\n\n1. Keep both (${oldTrade}, ${newTrade})\n2. Replace with just ${newTrade}`;
        } else {
          askMsg = `Aapne pehle "${oldTrade}" bataya tha. Ab "${newTrade}" bol rahe hain.\n\n1. Dono rakhein (${oldTrade}, ${newTrade})\n2. Sirf ${newTrade} rakhein`;
        }
        return [this.message(askMsg, { intent: 'ask_trade_merge_or_replace', facts: { oldTrade, newTrade, aiGenerated: true } })];
      }

      // No conflict — just replace directly
      if (extracted.trade) session.collected.trade = extracted.trade;
      if (extracted.district) session.collected.district = extracted.district;
      if (extracted.state) session.collected.state = extracted.state;
      if (/pmkvy|iti|jss|government|skill|course|college/i.test(text)) {
        try {
          const certificate = await this.extractionService.extractCertificate(text);
          this.addAiFlags(session, certificate.flags, 'certificate_correction');
          session.collected.certificateType = certificate.certificateType;
          session.collected.certificateNormalizedType = certificate.normalizedType;
        } catch (error) {
          this.logger.error({ error, phone: session.phone }, 'Certificate correction extraction failed');
        }
      }
      session.context.profileCorrection = false;
      session.context.profileConfirmation = true;
      return [this.message(this.profileConfirmationText(session), { intent: 'confirm_profile', facts: session.collected })];
    }

    if (session.context.profileConfirmation) {
      if (isAffirmative(text)) {
        session.context.profileConfirmation = false;
        if (isDocumentUploadEnabled()) {
          session.step = Steps.ONBOARDING_DOCUMENTS;
          return [this.message(messages.askAadhaarUpload ?? 'Please upload your Aadhaar card (photo or PDF)', { intent: 'ask_document_upload' })];
        }
        session.step = Steps.SKILL_EXTRACTION;
        return [this.message(messages.askSkills, { intent: 'ask_skills' })];
      }

      if (isNegative(text)) {
        session.context.profileCorrection = true;
        return [this.message(messages.askCorrection, { intent: 'ask_profile_correction', facts: { userChoice: 'wants_to_correct_profile', currentProfile: session.collected } })];
      }

      return [this.message(this.profileConfirmationText(session), { intent: 'confirm_profile', facts: session.collected })];
    }

    let certificate;
    try {
      certificate = await this.extractionService.extractCertificate(text);
      this.addAiFlags(session, certificate.flags, 'certificate');
    } catch (error) {
      this.logger.error({ error, phone: session.phone }, 'Certificate extraction failed');
      certificate = { certificateType: 'Unknown', normalizedType: 'Unknown', flags: [] };
    }
    session.collected.certificateType = certificate.certificateType;
    session.collected.certificateNormalizedType = certificate.normalizedType;
    session.context.profileConfirmation = true;
    return [this.message(this.profileConfirmationText(session), { intent: 'confirm_profile', facts: session.collected })];
  }

  /**
   * Handle the document upload step (ONBOARDING_DOCUMENTS).
   * Aadhaar KYC + certificate collection sub-flow.
   *
   * Phase tracking is done via session.context.aadhaarPhase:
   *   'number'      — awaiting Aadhaar card photo or typed number
   *   'otp'         — OTP sent, waiting for user to type it
   *   'certificate' — Aadhaar done, waiting for certificate upload
   *   'done'        — both complete, advance to skill extraction
   *
   * @param {object} session - Current user session
   * @param {string} text - Message text (may be empty for media-only messages)
   * @param {Array|object|null} media - Media attachment(s)
   * @returns {Promise<Array>} Reply messages
   */
  async handleDocumentUpload(session, text, media) {
    const messages = t(session.script);

    // ─── Entry point: initialise phase on first visit ─────────────────────────
    if (!session.context.aadhaarPhase) {
      session.context.aadhaarPhase = 'number';
      session.context.aadhaarNumber = null;
      session.context.aadhaarReferenceId = null;
      session.context.aadhaarAttempts = 0;
      session.context.aadhaarRegenCount = 0;
      session.context.aadhaarName = null;
      session.context.certificateUrl = null;
      return [this.message(messages.askAadhaarInput, { intent: 'ask_aadhaar_input' })];
    }

    const phase = session.context.aadhaarPhase;

    // ─── Phase: number ────────────────────────────────────────────────────────
    if (phase === 'number') {
      return this._handleAadhaarNumberPhase(session, text, media);
    }

    // ─── Phase: otp (handled by routeText → handleAadhaarOtp, but guard here) ─
    if (phase === 'otp') {
      return this.handleAadhaarOtp(session, text);
    }

    // ─── Phase: certificate ───────────────────────────────────────────────────
    if (phase === 'certificate') {
      return this._handleCertificatePhase(session, text, media);
    }

    // ─── Phase: done (shouldn't reach here normally) ──────────────────────────
    session.step = Steps.SKILL_EXTRACTION;
    return this.handleSkillExtraction(session, text);
  }

  /**
   * Sub-handler: collect Aadhaar number (photo or typed).
   */
  async _handleAadhaarNumberPhase(session, text, media) {
    const messages = t(session.script);
    const mediaItems = Array.isArray(media) ? media : (media ? [media] : []);

    // ── User sent a photo/PDF: try to extract Aadhaar number via Docling ──
    if (mediaItems.length > 0) {
      const item = mediaItems[0];
      const mimeType = item.mimetype || item.mimeType || '';
      const filename = item.filename || 'aadhaar_card';

      if (!this.sandboxKycService) {
        // Fallback: if KYC service not configured, ask user to type the number
        return [this.message(messages.aadhaarPhotoUnclear, { intent: 'aadhaar_kyc_unavailable' })];
      }

      try {
        const buffer = Buffer.from(item.data, 'base64');
        const aadhaarNumber = await this.sandboxKycService.extractAadhaarNumber(buffer, mimeType, filename);

        if (aadhaarNumber && /^\d{12}$/.test(aadhaarNumber)) {
          return this._triggerAadhaarOtp(session, aadhaarNumber);
        }
      } catch (err) {
        this.logger.warn({ err, phone: session.phone }, 'Aadhaar number extraction failed');
      }

      return [this.message(messages.aadhaarPhotoUnclear, { intent: 'aadhaar_photo_unclear' })];
    }

    // ── User typed a number: validate ──────────────────────────────────────
    if (text && text.trim()) {
      const cleaned = text.trim().replace(/[\s\-]/g, '');
      if (/^\d{12}$/.test(cleaned)) {
        return this._triggerAadhaarOtp(session, cleaned);
      }

      // Not 12 digits — re-prompt
      return [this.message(messages.askAadhaarInput, { intent: 'aadhaar_number_invalid', facts: { input: text } })];
    }

    // No media, no text
    return [this.message(messages.askAadhaarInput, { intent: 'aadhaar_reprompt' })];
  }

  /**
   * Call Sandbox to generate OTP and advance session to AADHAAR_OTP_SENT.
   */
  async _triggerAadhaarOtp(session, aadhaarNumber) {
    const messages = t(session.script);

    if (!this.sandboxKycService) {
      // KYC disabled — skip Aadhaar verification and go straight to certificate
      session.context.aadhaarPhase = 'certificate';
      session.context.aadhaarNumber = aadhaarNumber;
      return [this.message(messages.askCertificate, { intent: 'kyc_skipped_ask_certificate' })];
    }

    try {
      const { referenceId } = await this.sandboxKycService.generateAadhaarOtp(aadhaarNumber);
      session.context.aadhaarNumber = aadhaarNumber;
      session.context.aadhaarReferenceId = referenceId;
      session.context.aadhaarAttempts = 0;
      session.context.aadhaarPhase = 'otp';
      session.step = Steps.AADHAAR_OTP_SENT;
      return [this.message(messages.aadhaarOtpSent, { intent: 'aadhaar_otp_sent', facts: { aadhaarNumber } })];
    } catch (err) {
      this.logger.error({ err, phone: session.phone }, 'Sandbox generate OTP failed');
      return [this.message(
        'There was a problem sending the OTP. Please check your Aadhaar number and try again.',
        { intent: 'aadhaar_otp_generate_error' }
      )];
    }
  }

  /**
   * Handle OTP entry (step AADHAAR_OTP_SENT).
   *
   * Max 3 OTP entry attempts; then 1 re-generate allowed.
   */
  async handleAadhaarOtp(session, text) {
    const messages = t(session.script);
    const MAX_OTP_ATTEMPTS = 3;
    const MAX_REGEN = 1;

    const otp = (text ?? '').trim().replace(/\s/g, '');

    if (!otp || !/^\d{4,8}$/.test(otp)) {
      return [this.message(messages.aadhaarOtpInvalid, { intent: 'aadhaar_otp_format_invalid' })];
    }

    const referenceId = session.context.aadhaarReferenceId;
    if (!referenceId) {
      // Lost reference ID — restart Aadhaar phase
      session.context.aadhaarPhase = 'number';
      session.step = Steps.ONBOARDING_DOCUMENTS;
      return [this.message(messages.askAadhaarInput, { intent: 'aadhaar_session_lost' })];
    }

    try {
      const kycData = await this.sandboxKycService.verifyAadhaarOtp(referenceId, otp);

      // ── Success: upload photo, persist KYC data, advance to certificate ──
      let aadhaarPhotoUrl = null;
      if (kycData.photo && this.documentStorageService) {
        try {
          aadhaarPhotoUrl = await this.documentStorageService.uploadBase64Photo(session.phone, kycData.photo);
        } catch (photoErr) {
          this.logger.warn({ photoErr, phone: session.phone }, 'Aadhaar photo upload failed — continuing without it');
        }
      }

      await this.store.saveKycData(session.phone, {
        aadhaarNumber: kycData.aadhaarNumber || session.context.aadhaarNumber,
        dob: kycData.dob,
        gender: kycData.gender,
        address: kycData.address,
        aadhaarPhotoUrl,
        aadhaarName: kycData.name,
        currentName: session.collected?.name ?? null
      });

      // Update local session state
      session.context.aadhaarPhase = 'certificate';
      session.context.aadhaarName = kycData.name;
      session.context.certificatePromptSent = true; // We're already asking for certificate in the response below
      session.step = Steps.ONBOARDING_DOCUMENTS;

      const displayName = kycData.name || session.collected?.name || '';
      return [this.message(
        typeof messages.aadhaarVerified === 'function'
          ? messages.aadhaarVerified(displayName)
          : messages.aadhaarVerified,
        { intent: 'aadhaar_verified', facts: { name: displayName } }
      )];

    } catch (err) {
      if (err.otpInvalid) {
        session.context.aadhaarAttempts = (session.context.aadhaarAttempts ?? 0) + 1;

        if (session.context.aadhaarAttempts >= MAX_OTP_ATTEMPTS) {
          // Allow one re-generate
          const regenCount = session.context.aadhaarRegenCount ?? 0;
          if (regenCount < MAX_REGEN) {
            session.context.aadhaarRegenCount = regenCount + 1;
            session.context.aadhaarAttempts = 0;
            // Regenerate OTP
            try {
              const { referenceId: newRef } = await this.sandboxKycService.generateAadhaarOtp(
                session.context.aadhaarNumber
              );
              session.context.aadhaarReferenceId = newRef;
              return [this.message(
                `Too many incorrect attempts. A new OTP has been sent to your Aadhaar-registered mobile. Please try again.`,
                { intent: 'aadhaar_otp_regenerated' }
              )];
            } catch (regenErr) {
              this.logger.error({ regenErr, phone: session.phone }, 'OTP re-generate failed');
            }
          }

          // Exhausted retries — restart Aadhaar number phase
          session.context.aadhaarPhase = 'number';
          session.context.aadhaarReferenceId = null;
          session.context.aadhaarAttempts = 0;
          session.context.aadhaarRegenCount = 0;
          session.step = Steps.ONBOARDING_DOCUMENTS;
          return [this.message(
            'OTP verification failed too many times. Please start again by sending your Aadhaar card.',
            { intent: 'aadhaar_otp_exhausted' }
          )];
        }

        return [this.message(messages.aadhaarOtpInvalid, {
          intent: 'aadhaar_otp_invalid',
          facts: { attempt: session.context.aadhaarAttempts, max: MAX_OTP_ATTEMPTS }
        })];
      }

      this.logger.error({ err, phone: session.phone }, 'Sandbox verify OTP unexpected error');
      return [this.message(
        'Something went wrong verifying your OTP. Please try again.',
        { intent: 'aadhaar_otp_error' }
      )];
    }
  }

  /**
   * Sub-handler: collect the skill/training certificate.
   */
  async _handleCertificatePhase(session, text, media) {
    const messages = t(session.script);

    // Entry: send the certificate prompt if we haven't yet
    if (!session.context.certificatePromptSent) {
      session.context.certificatePromptSent = true;
      return [this.message(messages.askCertificate, { intent: 'ask_certificate' })];
    }

    const mediaItems = Array.isArray(media) ? media : (media ? [media] : []);
    if (mediaItems.length === 0) {
      return [this.message(messages.askCertificate, { intent: 'certificate_reprompt' })];
    }

    const item = mediaItems[0];
    const mimeType = item.mimetype || item.mimeType || '';
    const sizeBytes = item.filesize || item.sizeBytes || (item.data ? Buffer.from(item.data, 'base64').length : 0);
    const filename = item.filename || 'certificate';

    if (!this.documentStorageService) {
      this.logger.error({ phone: session.phone }, 'DocumentStorageService not configured');
      return [this.message(
        'Document upload is temporarily unavailable. Please try again later.',
        { intent: 'document_service_unavailable' }
      )];
    }

    const validation = this.documentStorageService.validateFile(mimeType, sizeBytes);
    if (!validation.valid) {
      if (sizeBytes > 10 * 1024 * 1024) {
        return [this.message(
          'This file is too large. Please send a file smaller than 10 MB.',
          { intent: 'document_size_error', facts: { sizeBytes } }
        )];
      }
      return [this.message(
        'This file format is not accepted. Please send your certificate as PNG, JPEG, or PDF only.',
        { intent: 'document_format_error', facts: { mimeType } }
      )];
    }

    let uploadResult;
    try {
      const buffer = Buffer.from(item.data, 'base64');
      uploadResult = await this.documentStorageService.uploadDocument({
        phone: session.phone,
        filename,
        buffer,
        mimeType
      });
    } catch (uploadError) {
      this.logger.error({ error: uploadError, phone: session.phone }, 'Certificate upload failed');
      return [this.message(
        'Sorry, there was a problem uploading your certificate. Please try sending it again.',
        { intent: 'certificate_upload_failed' }
      )];
    }

    // Persist certificate URL to DB
    try {
      await this.store.saveCertificateUrl(session.phone, uploadResult.url);
    } catch (dbErr) {
      this.logger.warn({ dbErr, phone: session.phone }, 'Failed to save certificate URL to DB');
    }

    session.context.aadhaarPhase = 'done';
    session.context.certificateUrl = uploadResult.url;
    session.step = Steps.SKILL_EXTRACTION;

    return [this.message(messages.certificateSaved, { intent: 'certificate_saved', facts: { url: uploadResult.url } })];
  }

  async handleSkillExtraction(session, text) {
    const messages = t(session.script);

    if (session.context.skillConfirmation) {
      if (wantsToAddSkill(text)) {
        session.context.skillConfirmation = false;
        session.context.skillAddition = true;
        return [this.message(messages.askSkills, { intent: 'ask_more_skills' })];
      }

      if (isNegative(text) || isAffirmative(text)) {
        session.context.skillConfirmation = false;
        return this.createSkillCard(session);
      }
    }

    let extraction;
    try {
      extraction = await this.extractionService.extractSkills(text, session.collected.skills ?? []);
      this.addAiFlags(session, extraction.flags, 'skills');
    } catch (error) {
      this.logger.error({ error, phone: session.phone }, 'Skill extraction failed unexpectedly');
      this.addAiFlags(session, [{ code: 'ai_error', severity: 'warning', reason: error.message, field: 'skills' }], 'skills');
      extraction = { skills: session.collected.skills ?? [], ojtHours: null, specificProjects: [], additionalTrades: [], flags: [] };
    }
    session.collected.skills = extraction.skills;
    session.collected.ojtHours = extraction.ojtHours;
    session.collected.specificProjects = extraction.specificProjects;
    session.collected.additionalTrades = extraction.additionalTrades;

    if (session.collected.skills.length < 2 && !session.context.skillDetailPrompted) {
      session.context.skillDetailPrompted = true;
      return [this.message(messages.askMoreSkillDetail, { intent: 'clarify_skills', facts: { extraction } })];
    }

    session.context.skillAddition = false;
    session.context.skillConfirmation = true;
    return [
      this.message(withOptions(messages.skillsSummary(session.collected.skills), [messages.labels.noMoreSkills, messages.labels.addSkills]), {
        intent: 'confirm_skills',
        facts: { skills: session.collected.skills }
      })
    ];
  }

  async createSkillCard(session) {
    const messages = t(session.script);
    const learner = await this.store.upsertLearner(session.phone, {
      script: session.script,
      language: session.language ?? null,
      step: session.step,
      placementStatus: session.placementStatus,
      ...session.collected
    });
    session.learnerId = learner.id;
    const card = await this.skillCardService.create({ phone: session.phone, learner, collected: session.collected });
    session.cardUrl = card.url;
    session.step = Steps.SKILL_CARD_SHOWN;
    session.placementStatus = PlacementStatus.CARD_READY;
    session.context.jobsReady = true;

    return [
      this.message(messages.cardProcessing, { intent: 'card_processing' }),
      this.message(messages.cardReady(card.url), { intent: 'card_ready', facts: { cardUrl: card.url } }),
      this.message(withOptions(messages.askJobsReady, [messages.labels.showJobs, messages.labels.later]), { intent: 'ask_jobs_ready' })
    ];
  }

  async handleJobsReady(session, text) {
    const messages = t(session.script);
    if (isNegative(text) || normalizeText(text).includes('later') || normalizeText(text).includes('baad')) {
      session.context.jobsReady = false;
      return [this.message(messages.jobsLater)];
    }

    if (isAffirmative(text) || normalizeText(text).includes('job')) {
      return this.showJobs(session);
    }

    return [this.message(withOptions(messages.askJobsReady, [messages.labels.showJobs, messages.labels.later]))];
  }

  async showJobs(session) {
    const messages = t(session.script);
    if (!session.collected.trade || !session.collected.district) {
      session.step = Steps.ONBOARDING_TRADE;
      return [this.message(messages.askTradeDistrict(session.collected.name ?? 'Dost'))];
    }

    const stepBefore = session.step;
    const jobs = await this.jobService.matchJobs(session.collected);
    session.latestJobs = jobs;
    session.step = Steps.JOBS_SHOWN;
    session.placementStatus = PlacementStatus.MATCHING;

    if (jobs.length === 0) return [this.message(messages.noJobsFound)];

    await this.eventLog.record({
      learnerId: session.learnerId,
      phone: session.phone,
      eventType: EventTypes.JOB_MATCHED,
      stepBefore,
      stepAfter: Steps.JOBS_SHOWN,
      metadata: { jobIds: jobs.map((job) => job.id), count: jobs.length }
    });

    // Build a single consolidated message with count + top 3 descriptions
    const topJobs = jobs.slice(0, 3);
    const remaining = jobs.length - topJobs.length;

    let jobSummary = '';
    if (session.script === 'devanagari') {
      jobSummary = `🔍 आपके profile से *${jobs.length} jobs* match करती हैं!\n\n`;
    } else if (session.script === 'english') {
      jobSummary = `🔍 *${jobs.length} jobs* match your profile!\n\n`;
    } else {
      jobSummary = `🔍 Aapke profile se *${jobs.length} jobs* match karti hain!\n\n`;
    }

    topJobs.forEach((job, index) => {
      const salary = formatJobSalary(job);
      const location = job.location || job.district || '';
      jobSummary += `*${index + 1}. ${job.role}*\n`;
      jobSummary += `   🏢 ${job.employerName}\n`;
      jobSummary += `   📍 ${location}  💰 ${salary}\n`;
      if (job.openings > 1) jobSummary += `   👥 ${job.openings} openings\n`;
      jobSummary += `   ${verificationLabel(job.verificationStatus)}\n`;
      jobSummary += `   📌 Source: ${job.source ?? 'SaathiAI'}\n`;
      jobSummary += '\n';
    });

    if (remaining > 0) {
      if (session.script === 'devanagari') {
        jobSummary += `📋 और ${remaining} jobs हैं। "MORE" लिखें सब देखने के लिए।\n\n`;
      } else if (session.script === 'english') {
        jobSummary += `📋 ${remaining} more jobs available. Type "MORE" to see all.\n\n`;
      } else {
        jobSummary += `📋 ${remaining} aur jobs hain. "MORE" likhein sab dekhne ke liye.\n\n`;
      }
    }

    // Add selection prompt
    const labels = topJobs.map((job, index) => `${index + 1}. ${job.role}`);
    if (remaining > 0) labels.push('MORE');
    labels.push(messages.labels.none);

    if (session.script === 'devanagari') {
      jobSummary += 'किस job में interest है? Number लिखें:';
    } else if (session.script === 'english') {
      jobSummary += 'Which job interests you? Type the number:';
    } else {
      jobSummary += 'Kis job mein interest hai? Number likhein:';
    }

    return [this.message(jobSummary, { intent: 'jobs_shown', facts: { count: jobs.length, shown: topJobs.length, aiGenerated: true } })];
  }

  async handleJobSelection(session, text) {
    const messages = t(session.script);

    if (session.context.jobDeclineReason) {
      session.context.jobDeclineReason = false;
      session.jobFeedback = { reason: text.trim(), at: new Date().toISOString() };
      session.step = Steps.TRACKING;
      return [this.message(messages.jobDeclineSaved)];
    }

    const jobs = session.latestJobs ?? [];
    const normalizedText = normalizeText(text);

    // Handle "MORE" — show remaining jobs
    if (normalizedText.includes('more') || normalizedText.includes('aur') || normalizedText.includes('और')) {
      const alreadyShown = 3;
      const remaining = jobs.slice(alreadyShown);
      if (remaining.length === 0) {
        return [this.message(session.script === 'devanagari' ? 'और कोई jobs नहीं हैं।' : session.script === 'english' ? 'No more jobs available.' : 'Aur koi jobs nahi hain.')];
      }

      let moreMsg = '';
      remaining.forEach((job, index) => {
        const salary = formatJobSalary(job);
        const location = job.location || job.district || '';
        moreMsg += `*${alreadyShown + index + 1}. ${job.role}*\n`;
        moreMsg += `   🏢 ${job.employerName}\n`;
        moreMsg += `   📍 ${location}  💰 ${salary}\n`;
        moreMsg += `   📌 Source: ${job.source ?? 'SaathiAI'}\n`;
        moreMsg += '\n';
      });

      if (session.script === 'devanagari') {
        moreMsg += 'किस job में interest है? Number लिखें:';
      } else if (session.script === 'english') {
        moreMsg += 'Which job interests you? Type the number:';
      } else {
        moreMsg += 'Kis job mein interest hai? Number likhein:';
      }

      return [this.message(moreMsg, { intent: 'more_jobs_shown', facts: { aiGenerated: true } })];
    }

    const choice = parseNumberChoice(text, jobs.length + 1);

    if (normalizedText.includes('koi nahi') || normalizedText.includes('none') || normalizedText.includes('nahi')) {
      session.context.jobDeclineReason = true;
      return [this.message(messages.jobDeclineReason)];
    }

    const selectedJob = choice ? jobs[choice - 1] : null;
    if (!selectedJob) {
      if (session.script === 'devanagari') {
        return [this.message('कृपया job number लिखें जिसमें interest है, या "MORE" लिखें बाकी देखने के लिए।')];
      } else if (session.script === 'english') {
        return [this.message('Please type the job number you\'re interested in, or "MORE" to see the rest.')];
      }
      return [this.message('Please job number likhein jisme interest hai, ya "MORE" likhein baaki dekhne ke liye.')];
    }

    // SIDH jobs: send the apply link instead of recording an internal application
    if (selectedJob.detailUrl) {
      await this.eventLog.record({
        learnerId: session.learnerId,
        phone: session.phone,
        eventType: EventTypes.JOB_APPLIED,
        stepBefore: session.step,
        stepAfter: Steps.JOB_APPLIED,
        metadata: { jobId: selectedJob.id, employerName: selectedJob.employerName, source: selectedJob.source, detailUrl: selectedJob.detailUrl }
      });

      session.selectedJob = selectedJob;
      session.step = Steps.JOB_APPLIED;
      session.placementStatus = PlacementStatus.APPLIED;

      let sidhMsg = '';
      if (session.script === 'devanagari') {
        sidhMsg = `बढ़िया! *${selectedJob.role}* में interest के लिए शुक्रिया! 🎉\n\n`;
        sidhMsg += `यह job *Skill India Digital Hub* पर listed है। नीचे दिए link पर जाकर apply करें:\n\n`;
        sidhMsg += `🔗 ${selectedJob.detailUrl}\n\n`;
        sidhMsg += `Apply करने के बाद हमें बताएं। शुभकामनाएं! 🌟`;
      } else if (session.script === 'english') {
        sidhMsg = `Great choice! You selected *${selectedJob.role}* at ${selectedJob.employerName}. 🎉\n\n`;
        sidhMsg += `This job is listed on *Skill India Digital Hub*. Apply directly here:\n\n`;
        sidhMsg += `🔗 ${selectedJob.detailUrl}\n\n`;
        sidhMsg += `Let us know once you've applied. Best of luck! 🌟`;
      } else {
        sidhMsg = `Bahut badhiya! *${selectedJob.role}* ke liye interest dikhane ka shukriya! 🎉\n\n`;
        sidhMsg += `Yeh job *Skill India Digital Hub* par listed hai. Neeche diye link par jaakar apply karein:\n\n`;
        sidhMsg += `🔗 ${selectedJob.detailUrl}\n\n`;
        sidhMsg += `Apply karne ke baad humein batayein. All the best! 🌟`;
      }

      return [this.message(sidhMsg)];
    }

    await this.jobService.apply({
      phone: session.phone,
      learnerId: session.learnerId,
      job: selectedJob,
      cardUrl: session.cardUrl
    });

    await this.eventLog.record({
      learnerId: session.learnerId,
      phone: session.phone,
      eventType: EventTypes.JOB_APPLIED,
      stepBefore: session.step,
      stepAfter: Steps.JOB_APPLIED,
      metadata: { jobId: selectedJob.id, employerName: selectedJob.employerName, distanceKm: selectedJob.distanceKm }
    });

    session.selectedJob = selectedJob;
    session.step = Steps.JOB_APPLIED;
    session.placementStatus = PlacementStatus.APPLIED;
    session.context.awaitingPracticeAfterApply = true;
    return [this.message(withOptions(messages.applied(selectedJob.employerName), [messages.labels.practice, messages.labels.wait]))];
  }

  async handlePostApply(session, text) {
    const messages = t(session.script);

    if (isAffirmative(text) || normalizeText(text).includes('practice')) {
      return this.startInterview(session);
    }

    if (isNegative(text) || normalizeText(text).includes('wait')) {
      session.context.awaitingPracticeAfterApply = false;
      session.step = Steps.TRACKING;
      session.placementStatus = PlacementStatus.TRACKING;
      return [this.message(messages.practiceSkipped)];
    }

    if (normalizeText(text).includes('selected') || normalizeText(text).includes('job mil')) {
      session.step = Steps.PLACED;
      session.placementStatus = PlacementStatus.PLACED;
      await this.eventLog.record({
        learnerId: session.learnerId,
        phone: session.phone,
        eventType: EventTypes.PLACEMENT_CONFIRMED,
        stepBefore: Steps.JOB_APPLIED,
        stepAfter: Steps.PLACED,
        metadata: { employerName: session.selectedJob?.employerName }
      });

      // Schedule post-placement salary capture and retention checks
      if (this.placementTrackerService && session.learnerId) {
        const placementDate = new Date().toISOString();
        await this.placementTrackerService.scheduleSalaryCapture(session.learnerId, placementDate);
        await this.placementTrackerService.scheduleRetentionChecks(session.learnerId, placementDate);
      }

      return [this.message(withOptions(messages.placed(session.collected.name ?? 'Dost'), [messages.labels.yes, messages.labels.later]))];
    }

    return [this.message(withOptions(messages.applied(session.selectedJob?.employerName ?? 'employer'), [messages.labels.practice, messages.labels.wait]))];
  }

  /**
   * Handle a learner's reply when they are in the EMPLOYER_PING_REPLY step.
   * Forwards the reply to the employer and returns the session to PLACED or TRACKING.
   */
  async handleEmployerPingReply(session, text) {
    const messages = t(session.script);

    if (this.employerPingService) {
      const result = await this.employerPingService.handleLearnerReply(session, text);
      // result === null means reply was forwarded successfully (no reply to learner)
      // result === undefined means no recent ping found — handle normally
      if (result === undefined) {
        // No recent employer ping — fall back to placed/tracking behavior
        session.step = session.placementStatus === PlacementStatus.PLACED ? Steps.PLACED : Steps.TRACKING;
        return [this.message(messages.offTopic)];
      }
    }

    // Reply forwarded or service not available — return to previous step
    session.step = session.placementStatus === PlacementStatus.PLACED ? Steps.PLACED : Steps.TRACKING;
    return [];
  }

  enterPlacementDetailsFlow(session) {
    const messages = t(session.script);
    // Don't re-enter if already collecting placement details
    if (session.step === Steps.PLACEMENT_DETAILS) {
      return [this.message(messages.askPlacementDetails, { intent: 'ask_placement_details' })];
    }
    session.step = Steps.PLACEMENT_DETAILS;
    session.placementStatus = PlacementStatus.PLACED;
    return [
      this.message(messages.placed(session.collected?.name ?? 'Dost'), { intent: 'placed_congrats' }),
      this.message(messages.askPlacementDetails, { intent: 'ask_placement_details' })
    ];
  }

  async handlePlacementDetails(session, text) {
    const messages = t(session.script);

    const placementSchema = {
      type: 'object',
      properties: {
        company: { type: 'string' },
        role: { type: 'string' },
        salary: { type: 'string' },
        location: { type: 'string' },
        joiningDate: { type: 'string' }
      },
      required: ['company', 'role', 'salary', 'location', 'joiningDate']
    };

    let details = {};
    try {
      const extracted = await this.aiClient.generateJson({
        prompt: `Extract placement/job details from this message. Return empty strings for missing fields.\nLanguage: ${session.language ?? session.script ?? 'hindi'}\nMessage: ${JSON.stringify(text)}\n\nReturn JSON: { company, role, salary, location, joiningDate }`,
        schema: placementSchema
      });
      if (extracted) details = extracted;
    } catch (err) {
      this.logger.warn({ err, phone: session.phone }, 'Placement detail extraction failed');
    }

    // Save to DB even if extraction is partial
    try {
      await this.store.savePlacementDetails(session.phone, details);
    } catch (dbErr) {
      this.logger.error({ dbErr, phone: session.phone }, 'Failed to save placement details');
    }

    await this.eventLog.record({
      learnerId: session.learnerId,
      phone: session.phone,
      eventType: EventTypes.PLACEMENT_REPORTED,
      stepBefore: Steps.PLACEMENT_DETAILS,
      stepAfter: Steps.PLACED,
      metadata: { ...details }
    });

    // Schedule post-placement salary and retention checks
    if (this.placementTrackerService && session.learnerId) {
      const placementDate = new Date().toISOString();
      try {
        await this.placementTrackerService.scheduleSalaryCapture(session.learnerId, placementDate);
        await this.placementTrackerService.scheduleRetentionChecks(session.learnerId, placementDate);
      } catch (scheduleErr) {
        this.logger.warn({ scheduleErr, phone: session.phone }, 'Could not schedule post-placement checks');
      }
    }

    session.step = Steps.PLACED;
    return [this.message(messages.placementSaved, { intent: 'placement_saved' })];
  }

  async startInterview(session) {
    const messages = t(session.script);
    const questions = this.interviewService.pickQuestions(session.collected.trade);
    session.interview = { questions, currentIndex: 0, answers: [] };
    const stepBefore = session.step;
    session.step = Steps.INTERVIEW_Q1;

    await this.eventLog.record({
      learnerId: session.learnerId,
      phone: session.phone,
      eventType: EventTypes.INTERVIEW_STARTED,
      stepBefore,
      stepAfter: Steps.INTERVIEW_Q1,
      metadata: { trade: session.collected.trade, questionCount: questions.length }
    });

    return [this.message(`${messages.practiceIntro}\n\n${questions[0]}`)];
  }

  async handleInterviewAnswer(session, text) {
    const messages = t(session.script);
    const interview = session.interview ?? {
      questions: this.interviewService.pickQuestions(session.collected.trade),
      currentIndex: stepToInterviewIndex(session.step),
      answers: []
    };
    const question = interview.questions[interview.currentIndex];
    let feedback;
    try {
      feedback = await this.extractionService.interviewFeedback({ question, answer: text, script: session.script });
    } catch (error) {
      this.logger.error({ error, phone: session.phone }, 'Interview feedback failed unexpectedly');
      // Use the heuristic fallback directly — never leave user without feedback
      const feedbackMap = {
        devanagari: 'अच्छा प्रयास! एक specific example देने की कोशिश करें।',
        english: 'Good attempt! Try giving a specific example from your work.',
        roman: 'Accha prayaas! Ek specific example dene ki koshish karein.'
      };
      feedback = feedbackMap[session.script] ?? feedbackMap.roman;
    }

    interview.answers.push({ question, answerLength: text.length, feedback });
    interview.currentIndex += 1;
    session.interview = interview;

    if (interview.currentIndex >= interview.questions.length) {
      session.step = Steps.TRACKING;
      session.placementStatus = PlacementStatus.TRACKING;
      await this.eventLog.record({
        learnerId: session.learnerId,
        phone: session.phone,
        eventType: EventTypes.INTERVIEW_COMPLETED,
        stepBefore: Steps.INTERVIEW_Q3,
        stepAfter: Steps.TRACKING,
        metadata: { questionCount: interview.questions.length }
      });
      return [this.message(feedback), this.message(messages.practiceDone)];
    }

    session.step = [Steps.INTERVIEW_Q1, Steps.INTERVIEW_Q2, Steps.INTERVIEW_Q3][interview.currentIndex];
    return [this.message(`${feedback}\n\n${interview.questions[interview.currentIndex]}`)];
  }

  statusText(session) {
    const messages = t(session.script);
    return messages.status({
      name: session.collected?.name,
      stepName: StepNames[session.step],
      placementStatus: session.placementStatus,
      cardUrl: session.cardUrl
    });
  }

  profileConfirmationText(session) {
    const messages = t(session.script);
    return withOptions(messages.confirmProfile(session.collected), [messages.labels.yes, messages.labels.noChange]);
  }

  message(text, metadata = {}) {
    return { type: 'text', text, metadata };
  }

  async draftReplies(session, replies, incomingText) {
    const drafted = [];
    for (const reply of replies) {
      // Skip AI rewriting for messages already generated by AI freeform
      if (reply.metadata?.facts?.aiGenerated) {
        drafted.push(reply);
        continue;
      }

      try {
        const draftedReply = await this.aiClient.draftReply({
          script: session.script ?? 'roman',
          intent: reply.metadata?.intent ?? 'conversation_reply',
          brief: reply.text,
          facts: {
            ...(reply.metadata?.facts ?? {}),
            incomingText,
            replyingTo: session.context.lastQuotedBody ?? null,
            chatHistory: (session.context.chatHistory ?? []).slice(-8)
          },
          session
        });
        this.addAiFlags(session, draftedReply.flags, 'reply');
        drafted.push({ ...reply, text: draftedReply.text });
      } catch (error) {
        // Safety net: if draftReply throws unexpectedly, use the template text as-is.
        this.logger.error({ error, phone: session.phone }, 'draftReply failed unexpectedly — using template text');
        this.addAiFlags(session, [{ code: 'ai_error', severity: 'warning', reason: error.message, field: 'reply' }], 'reply');
        drafted.push({ ...reply });
      }
    }
    return drafted;
  }

  addAiFlags(session, flags = [], source = 'unknown') {
    if (!flags.length) return;
    const enriched = flags.map((flag) => ({ ...flag, source, at: new Date().toISOString() }));
    session.context.aiFlags = [...(session.context.aiFlags ?? []), ...enriched].slice(-50);
  }

  async persistSessionAndLearner(session) {
    const learner = await this.store.upsertLearner(session.phone, {
      id: session.learnerId,
      script: session.script,
      language: session.language ?? null,
      step: session.step,
      placementStatus: session.placementStatus,
      cardUrl: session.cardUrl,
      ...session.collected
    });
    session.learnerId = learner.id;
    await this.store.saveSession(session);
  }

  isDuplicate(session, messageId) {
    return Boolean(messageId && session.lastProcessedMessageIds?.includes(messageId));
  }

  markMessageProcessed(session, messageId) {
    if (!messageId) return;
    session.lastProcessedMessageIds = [...(session.lastProcessedMessageIds ?? []), messageId].slice(-20);
  }
}

function wantsToAddSkill(text) {
  const value = normalizeText(text);
  return value.includes('aur') || value.includes('add') || value.includes('more') || value.includes('और');
}

function stepToInterviewIndex(step) {
  if (step === Steps.INTERVIEW_Q2) return 1;
  if (step === Steps.INTERVIEW_Q3) return 2;
  return 0;
}

function formatJob(job, index, total) {
  const salary = formatJobSalary(job);
  const distance = Number.isFinite(job.distanceKm) ? `${job.distanceKm} km - ` : '';
  const marker =
    job.type === 'apprenticeship'
      ? 'Government registered apprenticeship'
      : job.openings
        ? `${job.openings} openings`
        : 'Open role';
  const verification = verificationLabel(job.verificationStatus);

  return `Job ${index} of ${total}\n${job.employerName}\n${job.role}\n📍 ${distance}${job.location}\n💰 ${salary}\n🕐 ${marker} - ${job.postedText}\n${verification}`;
}

function formatJobSalary(job) {
  if (job.salaryRangeText) return job.salaryRangeText;
  if (Number.isFinite(job.salaryMin) && Number.isFinite(job.salaryMax)) {
    return job.salaryMin === job.salaryMax
      ? `₹${job.salaryMin.toLocaleString('en-IN')}/mo`
      : `₹${job.salaryMin.toLocaleString('en-IN')} - ₹${job.salaryMax.toLocaleString('en-IN')}/mo`;
  }
  return 'TBD';
}

function formatSalary(job) {
  if (job.salaryRangeText) return job.salaryRangeText;
  if (Number.isFinite(job.salaryMin) && Number.isFinite(job.salaryMax)) {
    return job.salaryMin === job.salaryMax
      ? `Rs.${job.salaryMin.toLocaleString('en-IN')} / month`
      : `Rs.${job.salaryMin.toLocaleString('en-IN')} - Rs.${job.salaryMax.toLocaleString('en-IN')} / month`;
  }
  return 'Salary to be confirmed';
}

function withoutEmptyValues(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}
