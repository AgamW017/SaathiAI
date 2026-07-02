import { EventTypes, PlacementStatus, StepNames, Steps } from '../constants/steps.js';
import { isDocumentUploadEnabled } from '../constants/config.js';
import { t, withOptions, LANGUAGE_MENU } from '../templates/messages.js';
import { chooseScript, detectScript } from '../utils/scriptDetector.js';
import { isAffirmative, isNegative, normalizeText, parseNumberChoice } from '../utils/text.js';
import { detectKeywordIntent } from './keywordRouter.js';

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
    // Persist immediately to prevent concurrent webhook retries from duplicating processing
    await this.store.saveSession(session);

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

    // Seamless language auto-switching: always detect what the user is typing
    // and silently adapt if they switch languages mid-conversation
    if (session.language) {
      const detected = detectScript(text);
      if (detected.detectedLanguage && detected.confidence >= 0.6 && detected.detectedLanguage !== session.language) {
        const match = LANGUAGE_OPTIONS.find(o => o.value === detected.detectedLanguage);
        if (match) {
          this.logger.info(
            { phone: session.phone, from: session.language, to: match.value, confidence: detected.confidence },
            'Seamless language switch detected'
          );
          session.language = match.value;
          session.script = match.script;
        }
      }
    } else {
      // No language set yet — use basic script detection
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
    // Keep last 30 messages for rich conversational context
    session.context.chatHistory = session.context.chatHistory.slice(-30);

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
    const learner = await this.store.getLearnerByPhone(phone); // Always fetch the true database record

    if (existingSession) {
      // Sync critical properties from the database so dashboard updates are reflected instantly
      // and we never lose language preference across cache restarts
      return {
        ...existingSession,
        learnerId: existingSession.learnerId ?? learner?.id ?? null,
        language: existingSession.language ?? learner?.language ?? null,
        script: existingSession.script ?? learner?.script ?? null,
        placementStatus: learner?.placementStatus ?? existingSession.placementStatus,
        context: existingSession.context ?? {},
        collected: {
          ...existingSession.collected,
          name: existingSession.collected?.name ?? learner?.name ?? null,
          trade: existingSession.collected?.trade ?? learner?.trade ?? null,
          district: existingSession.collected?.district ?? learner?.district ?? null,
          state: existingSession.collected?.state ?? learner?.state ?? null,
        },
        lastProcessedMessageIds: existingSession.lastProcessedMessageIds ?? []
      };
    }

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

    // voiceMedia is the dedicated audio field; fall back to media for backward compat
    const audioMedia = incoming.voiceMedia ?? incoming.media;
    const transcript = await this.transcriptionService.transcribe(audioMedia);
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
    const { intent, isDistress } = await this.extractionService.extractIntent(text, StepNames[session.step]);

    if (intent && intent !== 'none') {
      if (intent === 'refuse_aadhaar') {
        if (session.step === Steps.ONBOARDING_DOCUMENTS || session.step === Steps.AADHAAR_OTP_SENT) {
          session.context.aadhaarRefusals = (session.context.aadhaarRefusals ?? 0) + 1;
          if (session.context.aadhaarRefusals >= 2) {
            session.step = Steps.STOPPED;
            session.placementStatus = PlacementStatus.STOPPED;
            return [this.message(messages.aadhaarMandatoryStop, { intent: 'aadhaar_mandatory_stop' })];
          }
        }
        // Let it fall through so handleDocumentUpload/LLM can explain the privacy benefits for the first refusal
      } else {
        const isOnboarding = session.step < Steps.JOBS_SHOWN && session.step !== Steps.NEW;
        const globalKeywords = ['stop', 'start', 'help', 'placed', 'distress'];
        
        // Prevent random feature jumps during onboarding
        if (isOnboarding && !globalKeywords.includes(intent)) {
          this.logger.debug({ phone: session.phone, intent, step: session.step }, 'Ignored feature intent during onboarding');
        } else {
          if (intent === 'distress' || isDistress) {
            return [this.message(withOptions(messages.empathetic, [messages.labels.showJobs, messages.labels.wait]))];
          }
          return this.handleKeyword(session, intent);
        }
      }
    }

    // Language must be set before any other detail collection
    if (!session.language && session.step !== Steps.NEW && session.step !== Steps.LANGUAGE_SELECT) {
      session.step = Steps.LANGUAGE_SELECT;
      return [this.message(LANGUAGE_MENU, { intent: 'language_menu', facts: { aiGenerated: true } })];
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
        facts: { incomingText: text, step: stepName, chatHistory: session.context.chatHistory ?? [] },
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
    let lang = choice ? LANGUAGE_OPTIONS[choice - 1] : null;

    // Intent-based fallback if number isn't provided
    if (!lang && text) {
      const n = text.toLowerCase();
      if (n.includes('hinglish')) lang = LANGUAGE_OPTIONS.find(o => o.value === 'hinglish');
      else if (n.includes('hindi') || n.includes('hin') || n.includes('हिंदी')) lang = LANGUAGE_OPTIONS.find(o => o.value === 'hindi');
      else if (n.includes('english') || n.includes('eng')) lang = LANGUAGE_OPTIONS.find(o => o.value === 'english');
      else if (n.includes('marathi') || n.includes('मराठी')) lang = LANGUAGE_OPTIONS.find(o => o.value === 'marathi');
      else if (n.includes('gujarati') || n.includes('guj') || n.includes('ગુજરાતી')) lang = LANGUAGE_OPTIONS.find(o => o.value === 'gujarati');
      else if (n.includes('bengali') || n.includes('bangla') || n.includes('beng') || n.includes('bang') || n.includes('বাংলা')) lang = LANGUAGE_OPTIONS.find(o => o.value === 'bengali');
    }

    if (!lang) {
      return [this.message(LANGUAGE_MENU, { intent: 'language_reprompt', facts: { aiGenerated: true } })];
    }

    session.language = lang.value;
    session.script = lang.script;

    const messages = t(session.script);
    session.step = Steps.ONBOARDING_NAME;
    return [
      this.message(messages.languageSet, { intent: 'language_set', facts: { selectedLanguage: lang.value } }),
      this.message(`${messages.welcomeNew}\n\n${messages.askName}`, { intent: 'welcome' })
    ];
  }

  /**
   * Opportunistically extract ALL onboarding fields (name, trade, district, state)
   * from any message, regardless of which step we're on. This ensures the bot never
   * forgets information the user has already volunteered.
   */
  async collectAllOnboardingInfo(session, text) {
    const collected = { name: false, trade: false, district: false };

    // Build a contextual text that includes recent conversation history.
    // This allows the LLM to see what the user mentioned in earlier messages,
    // preventing re-asking for information the user has already provided
    // (even if the extraction failed at that moment due to low confidence).
    const recentHistory = (session.context.chatHistory ?? []).slice(-6);
    const contextualText = buildContextualExtractionText(text, recentHistory);

    // Extract name (only if not already known)
    if (!session.collected.name) {
      try {
        const nameResult = await this.extractionService.extractName(contextualText, { script: session.script });
        this.addAiFlags(session, nameResult.flags, 'name');
        if (nameResult.name) {
          session.collected.name = nameResult.name;
          collected.name = true;
          this.logger.info({ phone: session.phone, name: nameResult.name }, 'Collected name');
        }
      } catch (error) {
        this.logger.error({ error, phone: session.phone }, 'Name extraction failed');
      }
    }

    // Extract trade/district/state (merge with existing, don't overwrite what we have)
    try {
      const profileResult = await this.extractionService.extractProfile(contextualText, session.collected);
      this.addAiFlags(session, profileResult.flags, 'profile');
      if (profileResult.trade && !session.collected.trade) {
        session.collected.trade = profileResult.trade;
        collected.trade = true;
        this.logger.info({ phone: session.phone, trade: profileResult.trade }, 'Collected trade');
      }
      if (profileResult.district && !session.collected.district) {
        session.collected.district = profileResult.district;
        session.collected.state = profileResult.state ?? session.collected.state ?? null;
        collected.district = true;
        this.logger.info({ phone: session.phone, district: profileResult.district }, 'Collected district');
      }
      if (profileResult.state && !session.collected.state) {
        session.collected.state = profileResult.state;
      }
    } catch (error) {
      this.logger.error({ error, phone: session.phone }, 'Profile extraction failed');
    }

    // Opportunistically extract certificate if missing
    if (!session.collected.certificateType) {
      try {
        const certResult = await this.extractionService.extractCertificate(contextualText);
        // FIX: Check normalizedType to prevent hallucinated certificateTypes from skipping the step
        if (certResult.certificateType && certResult.normalizedType !== 'Unknown') {
          session.collected.certificateType = certResult.certificateType;
          session.collected.certificateNormalizedType = certResult.normalizedType;
          collected.certificate = true;
          this.logger.info({ phone: session.phone, cert: certResult.certificateType }, 'Collected certificate opportunistically');
        }
      } catch (error) {
        this.logger.error({ error, phone: session.phone }, 'Certificate extraction failed');
      }
    }

    // Opportunistically extract skills if missing
    if (!session.collected.skills || session.collected.skills.length === 0) {
      try {
        const skillResult = await this.extractionService.extractSkills(contextualText, []);
        if (skillResult.skills && skillResult.skills.length > 0) {
          session.collected.skills = skillResult.skills;
          collected.skills = true;
          this.logger.info({ phone: session.phone, count: skillResult.skills.length }, 'Collected skills opportunistically');
        }
      } catch (error) {
        this.logger.error({ error, phone: session.phone }, 'Skills extraction failed');
      }
    }

    return collected;
  }

  /**
   * Determine what onboarding info is still missing and return the appropriate
   * prompt for the NEXT missing field. If everything is collected, advance to
   * the certificate step.
   */
  advanceToNextMissing(session) {
    const messages = t(session.script);

    if (!session.collected.name) {
      session.step = Steps.ONBOARDING_NAME;
      return [this.message(messages.askName, { intent: 'ask_name' })];
    }

    if (!session.collected.trade || !session.collected.district) {
      session.step = Steps.ONBOARDING_TRADE;

      if (!session.collected.trade && !session.collected.district) {
        return [this.message(messages.askTradeDistrict(session.collected.name), { intent: 'ask_trade_district' })];
      }
      if (!session.collected.trade) {
        session.context.awaitingProfileField = 'trade';
        return [this.message(messages.askMissingTrade, { intent: 'clarify_trade' })];
      }
      // district missing
      session.context.awaitingProfileField = 'district';
      return [this.message(messages.askMissingDistrict, { intent: 'clarify_district' })];
    }

    if (!session.collected.certificateType) {
      // All basics collected — move to certificate
      session.step = Steps.ONBOARDING_CERTIFICATE;
      session.context.awaitingProfileField = null;
      return [this.message(messages.profileBasicsCaptured(session.collected), { intent: 'ask_certificate', facts: session.collected })];
    }

    // Basics and certificate both collected (opportunistically). Jump to confirmation.
    session.step = Steps.ONBOARDING_CERTIFICATE;
    session.context.awaitingProfileField = null;
    session.context.profileConfirmation = true;
    return [this.message(this.profileConfirmationText(session), { intent: 'confirm_profile', facts: session.collected })];
  }

  async handleName(session, text) {
    const messages = t(session.script);

    // If user types yes/no, they're probably responding to a previous question
    if (isAffirmative(text) || isNegative(text)) {
      if (session.collected.name && isAffirmative(text)) {
        return this.advanceToNextMissing(session);
      }
      return [this.message(messages.askName, { intent: 'clarify_name', facts: { reason: 'got_yes_no_instead_of_name' } })];
    }

    // Extract ALL fields from this message (name, trade, district)
    await this.collectAllOnboardingInfo(session, text);

    if (!session.collected.name) {
      return [this.message(messages.askName, { intent: 'clarify_name', facts: { reason: 'name_not_clear' } })];
    }

    return this.advanceToNextMissing(session);
  }

  async handleTradeDistrict(session, text) {
    const messages = t(session.script);

    // Extract ALL fields — user might give their name here too
    // e.g. "I'm Raj, electrician from Pune"
    await this.collectAllOnboardingInfo(session, text);

    // If name was given during this step but wasn't known before, great — it's captured
    return this.advanceToNextMissing(session);
  }

  async handleCertificateAndConfirmation(session, text) {
    const messages = t(session.script);

    if (session.context.profileCorrection) {
      // Handle the merge/replace choice if we're waiting for it
      if (session.context.awaitingTradeChoice) {
        const newTrade = session.context.pendingNewTrade;
        const oldTrade = session.context.pendingOldTrade;

        let decision = 'replace';
        if (isAffirmative(text) || text.trim() === '1') {
          decision = 'merge';
        } else if (isNegative(text) || text.trim() === '2') {
          decision = 'replace';
        } else {
          const aiDecision = await this.extractionService.extractDecision(text, 'choose_trade_action', ['merge_both_trades', 'replace_old_with_new']);
          decision = aiDecision === 'merge_both_trades' ? 'merge' : 'replace';
        }

        if (decision === 'merge') {
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
      if (extracted.trade && session.collected.trade && normalizeText(extracted.trade) !== normalizeText(session.collected.trade)) {
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

      // Implicit confirmation/correction: Check if they provided new info directly in this message
      try {
        const profileHint = await this.extractionService.extractProfile(text, {});
        const nameHint = await this.extractionService.extractName(text, { script: session.script });
        
        const hasNewInfo = profileHint.trade || profileHint.district || profileHint.state || nameHint.name;
        
        if (hasNewInfo) {
          this.logger.info({ phone: session.phone }, 'Implicit profile correction detected during confirmation');
          session.context.profileConfirmation = false;
          session.context.profileCorrection = true;
          // Recursively process this exact message through the correction block at the top of this function
          return this.handleCertificateAndConfirmation(session, text);
        }
      } catch (error) {
        this.logger.error({ error, phone: session.phone }, 'Implicit correction extraction failed');
      }

      // If no new info, use AI to classify the ambiguous response
      const aiDecision = await this.extractionService.extractDecision(text, 'profile_confirmation', ['confirm', 'reject', 'none']);
      
      if (aiDecision === 'confirm') {
        session.context.profileConfirmation = false;
        if (isDocumentUploadEnabled()) {
          session.step = Steps.ONBOARDING_DOCUMENTS;
          session.context.aadhaarPhase = 'number';
          return [this.message(messages.askAadhaarUpload ?? 'Please upload your Aadhaar card (photo or PDF)', { intent: 'ask_document_upload' })];
        }
        session.step = Steps.SKILL_EXTRACTION;
        if (session.collected.skills && session.collected.skills.length > 0) {
          session.context.skillAddition = false;
          session.context.skillConfirmation = true;
          return [
            this.message(withOptions(messages.skillsSummary(session.collected.skills), [messages.labels.noMoreSkills, messages.labels.addSkills]), {
              intent: 'confirm_skills',
              facts: { skills: session.collected.skills }
            })
          ];
        }
        return [this.message(messages.askSkills, { intent: 'ask_skills' })];
      }
      
      if (aiDecision === 'reject') {
        session.context.profileCorrection = true;
        return [this.message(messages.askCorrection, { intent: 'ask_profile_correction', facts: { userChoice: 'wants_to_correct_profile' } })];
      }
      
      // Still completely ambiguous — gracefully ask again
      return [this.message(messages.confirmProfile(session.collected), { intent: 'confirm_profile', facts: { reason: 'ambiguous_response' } })];
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
    const allItems = Array.isArray(media) ? media : (media ? [media] : []);

    // Filter out audio files — voice notes are transcribed to `text` already;
    // attempting Docling on an audio buffer would always fail.
    const AUDIO_MIME_RE = /^audio\//i;
    const mediaItems = allItems.filter(item => !AUDIO_MIME_RE.test(item.mimetype || item.mimeType || ''));

    // ── Caption check: typed/spoken aadhaar number even when an image is present ──
    // We run this before the image extraction so a valid 12-digit caption wins immediately.
    const captionCleaned = (text ?? '').trim().replace(/[\s\-]/g, '');
    const captionIsAadhaar = /^\d{12}$/.test(captionCleaned);

    // ── User sent a photo/PDF: try to extract Aadhaar number via Docling ──
    if (mediaItems.length > 0) {
      // If the caption itself contains a valid Aadhaar number, use it directly.
      if (captionIsAadhaar) {
        return this._triggerAadhaarOtp(session, captionCleaned);
      }

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

      // Extraction from image failed. The user might have also typed the number as a caption —
      // check the text one more time (in case it didn't have exactly 12 cleaned digits above
      // due to partial formatting like "1234-5678-9012" with other text around it).
      if (text && text.trim()) {
        const anyDigits = text.replace(/[\s\-]/g, '');
        const match12 = anyDigits.match(/\d{12}/);
        if (match12) {
          return this._triggerAadhaarOtp(session, match12[0]);
        }
      }

      const brief = `The user sent an image/document at the Aadhaar collection step. The system tried to extract an Aadhaar number from it but failed (it might not be an Aadhaar card, or the photo might be too blurry).
Acknowledge the image they sent politely, but explain that you couldn't read the 12-digit Aadhaar number from it.
Ask them to either send a clearer photo of their Aadhaar card, or simply type the 12-digit number.
Keep it encouraging, human, and very short (1-2 sentences).`;

      try {
        const aiResponse = await this.aiClient.draftReply({
          script: session.script ?? 'roman',
          intent: 'aadhaar_extraction_failed',
          brief,
          facts: { step: 'aadhaar_number', chatHistory: session.context.chatHistory ?? [] },
          session
        });

        if (aiResponse?.text) {
          return [this.message(aiResponse.text, { intent: 'aadhaar_extraction_failed', facts: { aiGenerated: true } })];
        }
      } catch (err) {
        this.logger.error({ err, phone: session.phone }, 'AI Aadhaar image fallback failed');
      }

      // Fallback if AI fails
      return [this.message(messages.aadhaarPhotoUnclear, { intent: 'aadhaar_photo_unclear' })];
    }

    // ── User typed/spoke something: check for a valid Aadhaar number ─────────
    // This handles:
    //   • Typed number: "1234 5678 9012" or "123456789012"
    //   • Voice transcribed: "my aadhaar is 1234 5678 9012"
    if (text && text.trim()) {
      // First: exact 12-digit match after stripping spaces/hyphens
      if (captionIsAadhaar) {
        return this._triggerAadhaarOtp(session, captionCleaned);
      }
      // Second: 12 contiguous digits anywhere in the message (handles "mera aadhaar 123456789012 hai")
      const embeddedMatch = text.replace(/[\s\-]/g, '').match(/\d{12}/);
      if (embeddedMatch) {
        return this._triggerAadhaarOtp(session, embeddedMatch[0]);
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
      // User typed something that isn't a valid OTP — use AI to address their concern
      if (text && text.trim() && !/^\d+$/.test(otp)) {
        session.context.otpPromptCount = (session.context.otpPromptCount ?? 0) + 1;
        const attempt = session.context.otpPromptCount;

        const brief = `The learner said "${text}" when asked for their Aadhaar OTP (attempt #${attempt}).
Address what they said naturally. If they are confused, explain that a 6-digit OTP was sent to the mobile number linked to their Aadhaar card.
If they say they didn't get it, ask them to wait a minute or check their network, and let them know they can enter an incorrect code 3 times to automatically trigger a resend.
Keep it to 2-3 sentences. Be warm and encouraging.`;

        try {
          const aiResponse = await this.aiClient.draftReply({
            script: session.script ?? 'roman',
            intent: 'aadhaar_otp_clarification',
            brief,
            facts: { incomingText: text, step: 'aadhaar_otp', attempt, chatHistory: session.context.chatHistory ?? [] },
            session
          });

          if (aiResponse?.text) {
            return [this.message(aiResponse.text, { intent: 'aadhaar_otp_clarification', facts: { aiGenerated: true } })];
          }
        } catch (error) {
          this.logger.error({ error, phone: session.phone }, 'OTP clarification AI response failed');
        }
      }

      // Fallback to template if AI fails or if they typed a non-OTP digit string
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

    // Filter audio files — voice notes are transcribed to `text` already.
    const AUDIO_MIME_RE = /^audio\//i;
    const allItems = Array.isArray(media) ? media : (media ? [media] : []);
    const mediaItems = allItems.filter(item => !AUDIO_MIME_RE.test(item.mimetype || item.mimeType || ''));

    if (mediaItems.length === 0) {
      // ── Check if user explicitly says they have no certificate ──────────
      // This handles: "no cert", "nahi hai", "N/A", "no training", spoken transcripts, etc.
      if (text && text.trim() && isNoCertificateText(text)) {
        // Mark certificate as N/A and advance to skills
        session.collected.certificateType = session.collected.certificateType ?? 'N/A';
        session.collected.certificateNormalizedType = 'None';
        session.context.aadhaarPhase = 'done';
        session.step = Steps.SKILL_EXTRACTION;

        const naCertMsg = session.script === 'devanagari'
          ? '✅ कोई बात नहीं! Certificate के बिना भी आपका skill card बन जाएगा। अब आपकी skills बताइए।'
          : session.script === 'english'
            ? '✅ No problem! Your skill card can still be created without a certificate. Now tell me about your skills.'
            : '✅ Koi baat nahi! Certificate ke bina bhi aapka skill card ban jayega. Ab aapki skills batao.';

        return [
          this.message(naCertMsg, { intent: 'cert_na', facts: { aiGenerated: true } }),
          this.message(messages.askSkills, { intent: 'ask_skills' })
        ];
      }

      // User typed a message instead of sending a file — use AI to address it
      if (text && text.trim()) {
        session.context.certPromptCount = (session.context.certPromptCount ?? 0) + 1;
        const attempt = session.context.certPromptCount;

        const brief = `The learner said "${text}" when asked to upload their skill/training certificate (attempt #${attempt}).
Address what they said naturally. Explain that uploading their certificate helps employers verify their skills, which gets them better job matches.
If they say they don't have a certificate at all, let them know they can skip it and their profile will still be created.
If they don't have it right now but might have it, suggest they find it and take a clear photo (PNG, JPEG, or PDF).
Keep it short (2-3 sentences) and encouraging.`;

        try {
          const aiResponse = await this.aiClient.draftReply({
            script: session.script ?? 'roman',
            intent: 'certificate_clarification',
            brief,
            facts: { incomingText: text, step: 'certificate_upload', attempt, chatHistory: session.context.chatHistory ?? [] },
            session
          });

          if (aiResponse?.text) {
            return [this.message(aiResponse.text, { intent: 'certificate_clarification', facts: { aiGenerated: true } })];
          }
        } catch (error) {
          this.logger.error({ error, phone: session.phone }, 'Certificate clarification AI response failed');
        }
      }

      // Fallback to template if AI fails or empty message
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

    return [
      this.message(messages.certificateSaved, { intent: 'certificate_saved', facts: { url: uploadResult.url } }),
      this.message(messages.askSkills, { intent: 'ask_skills' })
    ];
  }

  async handleSkillExtraction(session, text) {
    const messages = t(session.script);

    if (session.context.skillConfirmation) {
      let decision = 'none';
      if (isAffirmative(text) || isNegative(text) || text.trim() === '1') decision = 'confirm';
      else if (text.trim() === '2') decision = 'add_skills';
      else {
        const aiDecision = await this.extractionService.extractDecision(text, 'skill_confirmation', ['confirm', 'add_skills']);
        decision = aiDecision;
      }

      if (decision === 'add_skills') {
        session.context.skillConfirmation = false;
        session.context.skillAddition = true;
        return [this.message(messages.askSkills, { intent: 'ask_more_skills' })];
      } else if (decision === 'confirm') {
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

    let decision = 'none';
    if (isAffirmative(text)) decision = 'show_jobs';
    else if (isNegative(text)) decision = 'later';
    else {
      const aiDecision = await this.extractionService.extractDecision(text, 'jobs_ready', ['show_jobs', 'later']);
      decision = aiDecision;
    }

    if (decision === 'later') {
      session.context.jobsReady = false;
      return [this.message(messages.jobsLater)];
    }

    if (decision === 'show_jobs') {
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


    let choice = parseNumberChoice(text, jobs.length + 1);

    if (!choice && text.trim()) {
      const aiDecision = await this.extractionService.extractDecision(
        text, 
        'job_selection', 
        [...jobs.map((j, i) => `job_${i + 1}`), 'none']
      );
      if (aiDecision.startsWith('job_')) {
        choice = parseInt(aiDecision.split('_')[1], 10);
      } else if (aiDecision === 'none') {
        if (normalizedText.includes('koi nahi') || normalizedText.includes('none') || normalizedText.includes('nahi')) {
          session.context.jobDeclineReason = true;
          return [this.message(messages.jobDeclineReason)];
        }
      }
    }

    if (!choice && (normalizedText.includes('koi nahi') || normalizedText.includes('none') || normalizedText.includes('nahi'))) {
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

    let decision = 'none';
    if (isAffirmative(text)) decision = 'practice';
    else if (isNegative(text)) decision = 'wait';
    else {
      const aiDecision = await this.extractionService.extractDecision(text, 'post_apply', ['practice', 'wait']);
      decision = aiDecision;
    }

    if (decision === 'practice') {
      return this.startInterview(session);
    }

    if (decision === 'wait') {
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
            chatHistory: session.context.chatHistory ?? []
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

/**
 * Returns true if the user's text clearly indicates they have NO certificate.
 * Handles Hindi, Hinglish, English variants.
 */
function isNoCertificateText(text) {
  const t = text.toLowerCase().trim();
  // Standalone "N/A", "NA", "no", "none"
  if (/^\s*n[\s\/]?a\s*$/i.test(t)) return true;
  if (/^\s*(no|none|nahi|nai|nhi|nahin)\s*$/i.test(t)) return true;
  // Phrases indicating absence of certificate/training
  const noCertPatterns = [
    /\b(no|koi nahi|kuch nahi|nahi hai|nahin hai|nai hai|nahi mila|nahi mili|nhi hai)\b/,
    /\b(no certificate|no cert|no training|no course|no qualification)\b/,
    /\b(certificate nahi|cert nahi|nahi mila certificate|training nahi ki)\b/,
    /\b(nhi li|nahi li|nahin li|nahi kiya|nai kiya)\b/,
    /\b(mere paas nahi|mere pass nahi|hamare paas nahi)\b/,
    /\b(i don'?t have|i have no|don'?t have any|didn'?t do any)\b/,
  ];
  return noCertPatterns.some(p => p.test(t));
}

/**
 * Build contextual text for LLM extraction tasks.
 * Prepends recent chat history so the model can see what the user has already said,
 * enabling context-aware extraction even when current message is brief.
 */
function buildContextualExtractionText(currentText, recentHistory) {
  if (!recentHistory || recentHistory.length === 0) return currentText;
  const lines = recentHistory
    .map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.text}`)
    .join('\n');
  return `[Recent conversation]\n${lines}\n\n[Current message]\n${currentText}`;
}
