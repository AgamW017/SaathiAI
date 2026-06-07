import { EventTypes, PlacementStatus, StepNames, Steps } from '../constants/steps.js';
import { t, withOptions } from '../templates/messages.js';
import { chooseScript } from '../utils/scriptDetector.js';
import { isAffirmative, isNegative, normalizeText, parseNumberChoice } from '../utils/text.js';
import { detectKeywordIntent, isDistressMessage } from './keywordRouter.js';

export class ConversationEngine {
  constructor({ store, eventLog, extractionService, skillCardService, jobService, interviewService, transcriptionService, logger }) {
    this.store = store;
    this.eventLog = eventLog;
    this.extractionService = extractionService;
    this.skillCardService = skillCardService;
    this.jobService = jobService;
    this.interviewService = interviewService;
    this.transcriptionService = transcriptionService;
    this.logger = logger;
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
    if (!text) {
      await this.store.saveSession(session);
      return { replies: [this.message(t(session.script).voiceUnavailable)], session };
    }

    session.script = chooseScript(session, text);
    session.lastInteractionAt = new Date().toISOString();

    const replies = await this.routeText(session, text);
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

    return { replies, session };
  }

  async loadOrCreateSession(phone) {
    const existingSession = await this.store.getSession(phone);
    if (existingSession) return existingSession;

    const learner = await this.store.getLearnerByPhone(phone);
    const session = {
      phone,
      learnerId: learner?.id ?? null,
      step: learner?.step ?? Steps.NEW,
      script: learner?.script ?? null,
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
    const transcript = await this.transcriptionService.transcribe(incoming.media);
    if (transcript) {
      session.script = chooseScript(session, transcript);
      return transcript;
    }
    return null;
  }

  async routeText(session, text) {
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
      case Steps.ONBOARDING_NAME:
        return this.handleName(session, text);
      case Steps.ONBOARDING_TRADE:
        return this.handleTradeDistrict(session, text);
      case Steps.ONBOARDING_CERTIFICATE:
        return this.handleCertificateAndConfirmation(session, text);
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
      case Steps.PLACED:
        return [this.message(messages.firstDayTips)];
      case Steps.STOPPED:
        return [this.message(messages.stopped)];
      default:
        return [this.message(messages.offTopic)];
    }
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
    const messages = t(session.script);
    session.step = Steps.ONBOARDING_NAME;
    session.placementStatus = PlacementStatus.ONBOARDING;
    return [this.message(`${messages.welcomeNew}\n\n${messages.askName}`)];
  }

  async handleName(session, text) {
    const messages = t(session.script);
    session.collected.name = text.trim();
    session.step = Steps.ONBOARDING_TRADE;
    return [this.message(messages.askTradeDistrict(session.collected.name))];
  }

  async handleTradeDistrict(session, text) {
    const messages = t(session.script);
    const extracted = await this.extractionService.extractProfile(text, session.collected);
    const profilePatch = withoutEmptyValues(extracted);

    if (session.context.awaitingProfileField === 'trade') {
      session.collected.trade = extracted.trade ?? text.trim();
      session.context.awaitingProfileField = null;
    } else if (session.context.awaitingProfileField === 'district') {
      session.collected.district = extracted.district ?? text.trim();
      session.collected.state = extracted.state ?? session.collected.state ?? 'Uttar Pradesh';
      session.context.awaitingProfileField = null;
    }

    session.collected = { ...session.collected, ...profilePatch };

    if (!session.collected.trade) {
      session.context.awaitingProfileField = 'trade';
      return [this.message(messages.askMissingTrade)];
    }

    if (!session.collected.district) {
      session.context.awaitingProfileField = 'district';
      return [this.message(messages.askMissingDistrict)];
    }

    session.step = Steps.ONBOARDING_CERTIFICATE;
    return [this.message(messages.profileBasicsCaptured(session.collected))];
  }

  async handleCertificateAndConfirmation(session, text) {
    const messages = t(session.script);

    if (session.context.profileCorrection) {
      const extracted = await this.extractionService.extractProfile(text, session.collected);
      session.collected = { ...session.collected, ...extracted };
      if (/pmkvy|iti|jss|government|skill|course|college/i.test(text)) {
        session.collected.certificateType = await this.extractionService.extractCertificate(text);
      }
      session.context.profileCorrection = false;
      session.context.profileConfirmation = true;
      return [this.message(this.profileConfirmationText(session))];
    }

    if (session.context.profileConfirmation) {
      if (isAffirmative(text)) {
        session.context.profileConfirmation = false;
        session.step = Steps.SKILL_EXTRACTION;
        return [this.message(messages.askSkills)];
      }

      if (isNegative(text)) {
        session.context.profileCorrection = true;
        return [this.message(messages.askCorrection)];
      }

      return [this.message(this.profileConfirmationText(session))];
    }

    session.collected.certificateType = await this.extractionService.extractCertificate(text);
    session.context.profileConfirmation = true;
    return [this.message(this.profileConfirmationText(session))];
  }

  async handleSkillExtraction(session, text) {
    const messages = t(session.script);

    if (session.context.skillConfirmation) {
      if (wantsToAddSkill(text)) {
        session.context.skillConfirmation = false;
        session.context.skillAddition = true;
        return [this.message(messages.askSkills)];
      }

      if (isNegative(text) || isAffirmative(text)) {
        session.context.skillConfirmation = false;
        return this.createSkillCard(session);
      }
    }

    const extraction = await this.extractionService.extractSkills(text, session.collected.skills ?? []);
    session.collected.skills = extraction.skills;
    session.collected.ojtHours = extraction.ojtHours;
    session.collected.specificProjects = extraction.specificProjects;
    session.collected.additionalTrades = extraction.additionalTrades;

    if (session.collected.skills.length < 2 && !session.context.skillDetailPrompted) {
      session.context.skillDetailPrompted = true;
      return [this.message(messages.askMoreSkillDetail)];
    }

    session.context.skillAddition = false;
    session.context.skillConfirmation = true;
    return [this.message(withOptions(messages.skillsSummary(session.collected.skills), [messages.labels.noMoreSkills, messages.labels.addSkills]))];
  }

  async createSkillCard(session) {
    const messages = t(session.script);
    const learner = await this.store.upsertLearner(session.phone, {
      script: session.script,
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
      this.message(messages.cardProcessing),
      this.message(messages.cardReady(card.url)),
      this.message(withOptions(messages.askJobsReady, [messages.labels.showJobs, messages.labels.later]))
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

    const jobMessages = jobs.map((job, index) => this.message(formatJob(job, index + 1, jobs.length)));
    const labels = jobs.map((job, index) => `Job ${index + 1} - ${job.employerName}`).concat(messages.labels.none);

    return [...jobMessages, this.message(withOptions(messages.jobInterestPrompt, labels))];
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
    const choice = parseNumberChoice(text, jobs.length + 1);

    if (choice === jobs.length + 1 || normalizeText(text).includes('koi nahi') || normalizeText(text).includes('none')) {
      session.context.jobDeclineReason = true;
      return [this.message(messages.jobDeclineReason)];
    }

    const selectedJob = choice ? jobs[choice - 1] : null;
    if (!selectedJob) {
      return [this.message(withOptions(messages.jobInterestPrompt, jobs.map((job, index) => `Job ${index + 1} - ${job.employerName}`)))];
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
      return [this.message(withOptions(messages.placed(session.collected.name ?? 'Dost'), [messages.labels.yes, messages.labels.later]))];
    }

    return [this.message(withOptions(messages.applied(session.selectedJob?.employerName ?? 'employer'), [messages.labels.practice, messages.labels.wait]))];
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
    const feedback = await this.extractionService.interviewFeedback({ question, answer: text, script: session.script });

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

  async persistSessionAndLearner(session) {
    await this.store.saveSession(session);
    await this.store.upsertLearner(session.phone, {
      id: session.learnerId,
      script: session.script,
      step: session.step,
      placementStatus: session.placementStatus,
      cardUrl: session.cardUrl,
      ...session.collected
    });
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
  const salary =
    job.salaryMin === job.salaryMax
      ? `Rs.${job.salaryMin.toLocaleString('en-IN')} / month`
      : `Rs.${job.salaryMin.toLocaleString('en-IN')} - Rs.${job.salaryMax.toLocaleString('en-IN')} / month`;
  const marker = job.type === 'apprenticeship' ? 'Government registered apprenticeship' : `${job.openings} openings`;
  const verification = job.verified ? 'Verified employer' : 'Unverified employer - ask your placement officer before proceeding';

  return `Job ${index} of ${total}\n${job.employerName}\n${job.role}\n📍 ${job.distanceKm} km - ${job.location}\n💰 ${salary}\n🕐 ${marker} - ${job.postedText}\n${verification}`;
}

function withoutEmptyValues(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}
