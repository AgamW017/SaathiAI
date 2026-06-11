import { LocaleCode } from './i18n';

type BreakpointCardContent = {
  stat: string;
  title: string;
  body: string;
};

type SolutionFeatureContent = {
  badge: string;
  headline: string;
  body: string;
  bullets: string[];
  cta?: string;
};

type TechIntegrationContent = {
  icon: string;
  name: string;
  role: string;
  color: string;
};

type FlowNodeContent = {
  label: string;
  icon: string;
};

type HomeContent = {
  showcase: {
    eyebrow: string;
    heading: string;
    body: string;
    activeLabel: string;
    activeUsersLabel: string;
    switchLabel: string;
    footerNote: string;
  };
  breakpoints: {
    eyebrow: string;
    heading: string;
    subheading: string;
    cards: BreakpointCardContent[];
  };
  solution: {
    eyebrow: string;
    headingLines: [string, string, string];
    features: SolutionFeatureContent[];
    miniPhoneMatches: string;
    district: {
      badge: string;
      headline: string;
      body: string;
      title: string;
      subtitle: string;
      bars: { label: string; pct: number; color: string }[];
      note: string;
    };
  };
  funnel: {
    eyebrow: string;
    heading: string;
    brokenBadge: string;
    saathiBadge: string;
    sourceNote: string;
    callout: string;
    brokenPipeline: { label: string; percent: number }[];
    saathiPathway: { label: string; percent: number }[];
  };
  tech: {
    eyebrow: string;
    heading: string;
    integrations: TechIntegrationContent[];
    flowNodes: FlowNodeContent[];
  };
  quote: {
    text: string;
    source: string;
    sourceDetail: string;
    closing: string;
  };
  finalCta: {
    personas: string[];
  };
  impactFineprint: string;
  footer: {
    body: string;
    sourcesLabel: string;
    sources: string;
    copyright: string;
  };
};

const COLORS = {
  teal: 'var(--color-saathi-teal)',
  flame: 'var(--color-action-flame)',
  amber: '#d97706',
  info: 'var(--color-info)',
  risk: 'var(--color-risk)',
};

const HOME_CONTENT: Record<LocaleCode, HomeContent> = {
  en: {
    showcase: {
      eyebrow: '9 Languages · One Saathi',
      heading: 'Your language is our language',
      body: 'SaathiAI speaks to every graduate in the language they grew up with, not the language a form demands. Tap a tile to switch instantly.',
      activeLabel: 'Active',
      activeUsersLabel: 'active users',
      switchLabel: 'Switch to this language',
      footerNote: 'More languages are coming soon, including Odia, Punjabi, Assamese, and Bhojpuri.',
    },
    breakpoints: {
      eyebrow: 'The Five Real Breakpoints',
      heading: "Where Ramu's journey breaks. Every time.",
      subheading: "Our research mapped the exact points where India's education-to-employment pipeline collapses for ITIs and PMKVY centres.",
      cards: [
        {
          stat: '8–23%',
          title: 'PMKVY Placement Rate',
          body: 'No placement cell. No guidance. A learner gets a certificate and walks straight into a vacuum.',
        },
        {
          stat: '71%',
          title: "MSMEs Say Skilling Didn't Help",
          body: 'Too many disconnected records and too little trust. Employers doubt certificates because bad hires have burned them before.',
        },
        {
          stat: '↓ Declining',
          title: 'NCS Portal Registrations FY26',
          body: 'Desktop-first, text-heavy, and hard to use on mobile. The platform misses the learner at the moment support is needed.',
        },
        {
          stat: '22%',
          title: 'New Hires Quit Within 90 Days',
          body: 'Employers rely on referrals and expensive screening. Formal credentials still do not reduce hiring risk enough.',
        },
        {
          stat: '<1%',
          title: 'Trainee Feedback Ever Submitted',
          body: 'Placement officers still rely on WhatsApp groups and logbooks. District teams cannot see what is failing in real time.',
        },
      ],
    },
    solution: {
      eyebrow: 'The Solution',
      headingLines: ['One WhatsApp message.', 'Four surfaces.', 'One unified system.'],
      features: [
        {
          badge: '01 · Learner Companion',
          headline: 'Ramu meets his career guide on WhatsApp.',
          body: 'One activation message at graduation is enough. SaathiAI speaks in the learner’s language, accepts voice notes, and works even on weak data networks.',
          bullets: [
            'Voice onboarding with no typing required',
            'DigiLocker credential verification',
            'Top 3 job matches within 24 hours',
            'Mock interview preparation in the learner’s language',
          ],
          cta: 'See the conversation flow →',
        },
        {
          badge: '02 · Placement Officer Dashboard',
          headline: '200 students. One officer. AI handles the triage.',
          body: 'SaathiAI surfaces the few learners who need human intervention today and automates follow-up for everyone else.',
          bullets: [
            'AI risk scoring across the full cohort',
            'Auto-generated MIS compliance reports',
            'Built-in employer outreach CRM',
            'Real-time placement confirmation',
          ],
        },
        {
          badge: '03 · MSME Employer Portal',
          headline: 'The certificate MSMEs will actually trust.',
          body: 'SaathiAI turns a generic NSQF certificate into a plain-language skill card that employers can verify and respond to over WhatsApp.',
          bullets: [
            'Embedded video practical assessment',
            'DigiLocker and NSQF verification shown clearly',
            'Trainer endorsement visible on the card',
            'One-tap employer interest over WhatsApp',
          ],
        },
        {
          badge: '04 · District Console',
          headline: 'For the first time, district leaders can see the truth.',
          body: 'Trades, centres, drop-offs, and unmet employer demand appear in one weekly district view instead of scattered manual reports.',
          bullets: [],
        },
      ],
      miniPhoneMatches: '3 matches found in 24 hrs',
      district: {
        badge: '04 · District Console',
        headline: 'For the first time, DSSDs can see the truth.',
        body: 'Which trades are placing fastest? Which centres stay above 60% placement? Where is MSME demand still unmet? The district console answers that every week, automatically.',
        title: 'Varanasi District · June 2026',
        subtitle: 'Placement rates by trade',
        bars: [
          { label: 'Electrician', pct: 73, color: COLORS.teal },
          { label: 'Fitter', pct: 61, color: COLORS.teal },
          { label: 'Dressmaking ⚠', pct: 22, color: 'var(--color-caution)' },
        ],
        note: 'AI policy brief auto-generated every Monday',
      },
    },
    funnel: {
      eyebrow: 'The Dropout Funnel · Before and After SaathiAI',
      heading: 'From 19% real yield to a system that actually works.',
      brokenBadge: 'The Broken Pipeline',
      saathiBadge: 'The SaathiAI Pathway',
      sourceNote: 'PMKVY data · STRIVE tracer study · HR retention surveys',
      callout: "From 19% to 65%: that's 3.4× more lives changed per training cohort.",
      brokenPipeline: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Completed course', percent: 82 },
        { label: 'Got certified', percent: 58 },
        { label: 'Found a job', percent: 43 },
        { label: 'Still employed at 90 days', percent: 19 },
      ],
      saathiPathway: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Completed with nudges', percent: 95 },
        { label: 'Certified with support', percent: 88 },
        { label: 'Placed in 24 hours', percent: 75 },
        { label: 'Retained at 90 days', percent: 65 },
      ],
    },
    tech: {
      eyebrow: "Built on India's DPI",
      heading: 'Every useful API, finally connected.',
      integrations: [
        { icon: '🗣️', name: 'Sarvam AI', role: 'Voice input and output across Indian languages, even on low bandwidth.', color: '#6366f1' },
        { icon: '🏛️', name: 'DigiLocker', role: 'OAuth-based NSQF certificate verification with tamper-resistant credentials.', color: '#0ea5e9' },
        { icon: '🎓', name: 'SIDH', role: 'Scheme, enrolment, assessment, and certification records in one training backbone.', color: COLORS.teal },
        { icon: '🏗️', name: 'NAPS Portal', role: 'Apprenticeship matching for thousands of registered employers.', color: '#f59e0b' },
        { icon: '💼', name: 'NCS API', role: 'Real-time vacancy data with district-aware filtering.', color: '#10b981' },
        { icon: '💬', name: 'WhatsApp Business API', role: 'Zero-install delivery where learners already communicate.', color: '#25d366' },
      ],
      flowNodes: [
        { label: 'Learner WhatsApp', icon: '💬' },
        { label: 'SaathiAI Core', icon: '🤝' },
        { label: 'SIDH + DigiLocker + NCS', icon: '🏛️' },
        { label: 'Employer Skill Card', icon: '📋' },
        { label: 'Officer Dashboard', icon: '📊' },
        { label: 'District Console', icon: '🗺️' },
      ],
    },
    quote: {
      text: "India's vocational system is generating certified, capable human potential that the market still cannot discover, verify, trust, or absorb.",
      source: "Structural Bottlenecks in India's Education-to-Employment Pathways, 2026",
      sourceDetail: 'Synthesized from World Bank, STRIVE tracer study, CAG audit, and India Skills Report 2026.',
      closing: 'SaathiAI becomes the missing discovery, verification, and trust layer.',
    },
    finalCta: {
      personas: ['Learners', 'Placement Officers', 'MSMEs', 'District Teams'],
    },
    impactFineprint: 'Modelled using published placement, retention, and wage benchmarks across vocational training cohorts.',
    footer: {
      body: "Built for Shiksha Hackathon 2026 · Problem Statement 3.5. An AI career companion for India's vocational graduates.",
      sourcesLabel: 'Data sources',
      sources: 'India Skills Report 2026 · CAG PMKVY Audit · STRIVE Tracer Study · World Bank · KPMG MSME Report · NSDC data · NCS portal analytics',
      copyright: '© 2026 SaathiAI · Built for Bharat',
    },
  },
  hi: {
    showcase: {
      eyebrow: '9 भाषाएं · एक साथी',
      heading: 'आपकी भाषा ही हमारी भाषा है',
      body: 'SaathiAI हर graduate से उसी भाषा में बात करता है जिसमें वह बड़ा हुआ है, किसी सरकारी फॉर्म की भाषा में नहीं। टाइल दबाते ही भाषा बदल जाती है।',
      activeLabel: 'चालू',
      activeUsersLabel: 'सक्रिय उपयोगकर्ता',
      switchLabel: 'इस भाषा में बदलें',
      footerNote: 'जल्द ही ओड़िया, पंजाबी, असमिया और भोजपुरी भी जुड़ेंगी।',
    },
    breakpoints: {
      eyebrow: 'पाँच असली टूटन-बिंदु',
      heading: 'रमू की यात्रा कहाँ टूटती है। हर बार।',
      subheading: 'हमारी research ने दिखाया कि ITI और PMKVY centres में शिक्षा से नौकरी तक की pipeline किन सटीक जगहों पर टूट जाती है।',
      cards: [
        {
          stat: '8–23%',
          title: 'PMKVY प्लेसमेंट दर',
          body: 'न placement cell, न guidance. Learner certificate लेकर सीधे खालीपन में पहुंच जाता है।',
        },
        {
          stat: '71%',
          title: 'MSME कहते हैं skilling से hiring नहीं सुधरी',
          body: 'रिकॉर्ड बिखरे हुए हैं और भरोसा कम है। बुरी hires के बाद employer certificate पर यकीन नहीं करते।',
        },
        {
          stat: '↓ गिरावट',
          title: 'NCS Portal registrations FY26',
          body: 'Platform desktop-first और text-heavy है। जिस समय मदद चाहिए, उसी समय learner छूट जाता है।',
        },
        {
          stat: '22%',
          title: '90 दिन में नई hires छोड़ देती हैं',
          body: 'Employer referrals और costly screening पर निर्भर रहते हैं। Formal credentials risk कम नहीं कर पाते।',
        },
        {
          stat: '<1%',
          title: 'कभी जमा हुआ trainee feedback',
          body: 'Placement officers अभी भी WhatsApp groups और logbooks पर चलते हैं। District को real-time में कुछ दिखता ही नहीं।',
        },
      ],
    },
    solution: {
      eyebrow: 'समाधान',
      headingLines: ['एक WhatsApp message.', 'चार surfaces.', 'एक unified system.'],
      features: [
        {
          badge: '01 · Learner Companion',
          headline: 'रमू को उसका career guide WhatsApp पर मिलता है।',
          body: 'Graduation पर एक activation message काफी है। SaathiAI उसकी भाषा में बोलता है, voice notes लेता है और कमजोर network पर भी काम करता है।',
          bullets: [
            'बिना typing के voice onboarding',
            'DigiLocker credential verification',
            '24 घंटे में top 3 job matches',
            'अपनी भाषा में mock interview तैयारी',
          ],
          cta: 'Conversation flow देखें →',
        },
        {
          badge: '02 · Placement Officer Dashboard',
          headline: '200 students. एक officer. Triage AI संभालेगा।',
          body: 'SaathiAI उन learners को ऊपर लाता है जिन्हें आज human intervention चाहिए, और बाकी follow-up अपने आप संभालता है।',
          bullets: [
            'पूरे cohort पर AI risk scoring',
            'Auto-generated MIS compliance reports',
            'Built-in employer outreach CRM',
            'Real-time placement confirmation',
          ],
        },
        {
          badge: '03 · MSME Employer Portal',
          headline: 'वही certificate जिस पर MSME सच में भरोसा करेगा।',
          body: 'SaathiAI generic NSQF certificate को plain-language skill card में बदल देता है जिसे employer WhatsApp link से verify और respond कर सके।',
          bullets: [
            'Embedded video practical assessment',
            'DigiLocker और NSQF verification साफ दिखाई देता है',
            'Trainer endorsement card पर दिखता है',
            'WhatsApp पर one-tap employer interest',
          ],
        },
        {
          badge: '04 · District Console',
          headline: 'पहली बार district leaders सच देख पाएंगे।',
          body: 'Trades, centres, drop-offs और unmet employer demand एक weekly district view में दिखती है।',
          bullets: [],
        },
      ],
      miniPhoneMatches: '24 घंटे में 3 matches मिले',
      district: {
        badge: '04 · District Console',
        headline: 'पहली बार DSSD सच देख सकता है।',
        body: 'कौन से trades सबसे तेज place हो रहे हैं? कौन से centres 60% से ऊपर हैं? MSME demand कहाँ अभी भी unmet है? District console हर हफ्ते इसका जवाब देता है।',
        title: 'वाराणसी जिला · जून 2026',
        subtitle: 'Trade के हिसाब से placement दर',
        bars: [
          { label: 'Electrician', pct: 73, color: COLORS.teal },
          { label: 'Fitter', pct: 61, color: COLORS.teal },
          { label: 'Dressmaking ⚠', pct: 22, color: 'var(--color-caution)' },
        ],
        note: 'हर सोमवार AI policy brief अपने आप बनता है',
      },
    },
    funnel: {
      eyebrow: 'ड्रॉपआउट funnel · SaathiAI से पहले और बाद',
      heading: '19% real yield से उस system तक जो सच में काम करे।',
      brokenBadge: 'टूटी हुई pipeline',
      saathiBadge: 'SaathiAI pathway',
      sourceNote: 'PMKVY data · STRIVE tracer study · HR retention surveys',
      callout: '19% से 65% तक: हर training cohort में 3.4× ज़्यादा ज़िंदगियाँ बदलती हैं।',
      brokenPipeline: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Course पूरा', percent: 82 },
        { label: 'Certified', percent: 58 },
        { label: 'Job मिली', percent: 43 },
        { label: '90 दिन बाद भी नौकरी में', percent: 19 },
      ],
      saathiPathway: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Nudges के साथ पूरा', percent: 95 },
        { label: 'Support के साथ certified', percent: 88 },
        { label: '24 घंटे में placed', percent: 75 },
        { label: '90 दिन retention', percent: 65 },
      ],
    },
    tech: {
      eyebrow: 'भारत की DPI पर बना',
      heading: 'जो APIs काम की हैं, वे अब पहली बार जुड़ी हैं।',
      integrations: [
        { icon: '🗣️', name: 'Sarvam AI', role: 'भारतीय भाषाओं में voice input और output, low bandwidth पर भी।', color: '#6366f1' },
        { icon: '🏛️', name: 'DigiLocker', role: 'OAuth आधारित NSQF certificate verification और tamper-resistant credentials।', color: '#0ea5e9' },
        { icon: '🎓', name: 'SIDH', role: 'Scheme, enrolment, assessment और certification records के लिए training backbone।', color: COLORS.teal },
        { icon: '🏗️', name: 'NAPS Portal', role: 'हज़ारों registered employers के लिए apprenticeship matching।', color: '#f59e0b' },
        { icon: '💼', name: 'NCS API', role: 'District-aware filtering के साथ real-time vacancy data।', color: '#10b981' },
        { icon: '💬', name: 'WhatsApp Business API', role: 'Zero-install delivery वहीं जहाँ learners पहले से बात करते हैं।', color: '#25d366' },
      ],
      flowNodes: [
        { label: 'Learner WhatsApp', icon: '💬' },
        { label: 'SaathiAI Core', icon: '🤝' },
        { label: 'SIDH + DigiLocker + NCS', icon: '🏛️' },
        { label: 'Employer Skill Card', icon: '📋' },
        { label: 'Officer Dashboard', icon: '📊' },
        { label: 'District Console', icon: '🗺️' },
      ],
    },
    quote: {
      text: 'भारत की vocational system certified और capable youth बना रही है, लेकिन market अब भी उन्हें ढूंढ, verify, trust या absorb नहीं कर पा रहा है।',
      source: "India's Education-to-Employment Pathways में Structural Bottlenecks, 2026",
      sourceDetail: 'World Bank, STRIVE tracer study, CAG audit और India Skills Report 2026 से synthesize किया गया।',
      closing: 'SaathiAI वही missing discovery, verification और trust layer बनता है।',
    },
    finalCta: {
      personas: ['Learners', 'Placement Officers', 'MSMEs', 'District Teams'],
    },
    impactFineprint: 'यह model vocational cohorts के published placement, retention और wage benchmarks पर आधारित है।',
    footer: {
      body: 'Shiksha Hackathon 2026 · Problem Statement 3.5 के लिए बनाया गया। भारत के vocational graduates के लिए AI career companion।',
      sourcesLabel: 'Data sources',
      sources: 'India Skills Report 2026 · CAG PMKVY Audit · STRIVE Tracer Study · World Bank · KPMG MSME Report · NSDC data · NCS portal analytics',
      copyright: '© 2026 SaathiAI · भारत के लिए बनाया गया',
    },
  },
  'hi-HG': {
    showcase: {
      eyebrow: '9 languages · ek Saathi',
      heading: 'Tumhari language hi hamari language hai',
      body: 'SaathiAI har graduate se usi zubaan mein baat karta hai jismein woh bada hua hai, kisi sarkari form wali language mein nahi. Tile dabao aur switch ho jao.',
      activeLabel: 'Active',
      activeUsersLabel: 'active users',
      switchLabel: 'Is language mein switch karo',
      footerNote: 'Jaldi hi Odia, Punjabi, Assamese aur Bhojpuri bhi aayengi.',
    },
    breakpoints: {
      eyebrow: 'Paanch asli breakpoints',
      heading: 'Ramu ki journey kahan toot jaati hai. Har baar.',
      subheading: 'Hamari research ne dikhaya ki ITI aur PMKVY pipeline exact kin jagahon par collapse karti hai.',
      cards: [
        { stat: '8–23%', title: 'PMKVY placement rate', body: 'Na placement cell, na guidance. Learner certificate lekar seedha khaali space mein gir jaata hai.' },
        { stat: '71%', title: 'MSME bolte hain skilling se hiring nahi sudhri', body: 'Records tootey hue hain aur trust low hai. Pehle ke bad hires ke baad employers certificates pe bharosa nahi karte.' },
        { stat: '↓ Gir raha hai', title: 'NCS Portal registrations FY26', body: 'Platform desktop-first aur text-heavy hai. Jis time support chahiye, learner wahi miss ho jaata hai.' },
        { stat: '22%', title: '90 din mein nayi hires quit kar deti hain', body: 'Employers referrals aur costly screening pe chal rahe hain. Formal credentials risk kaafi kam nahi kar paate.' },
        { stat: '<1%', title: 'Kabhi submit hua trainee feedback', body: 'Placement officers abhi bhi WhatsApp groups aur logbooks pe atke hue hain. District ko live picture milti hi nahi.' },
      ],
    },
    solution: {
      eyebrow: 'Solution',
      headingLines: ['Ek WhatsApp message.', 'Chaar surfaces.', 'Ek unified system.'],
      features: [
        {
          badge: '01 · Learner Companion',
          headline: 'Ramu ko uska career guide WhatsApp par milta hai.',
          body: 'Graduation ke baad bas ek activation message chahiye. SaathiAI uski language mein bolta hai, voice notes leta hai, aur weak network pe bhi kaam karta hai.',
          bullets: [
            'Voice onboarding, typing ki zaroorat nahi',
            'DigiLocker credential verification',
            '24 ghante ke andar top 3 job matches',
            'Apni language mein mock interview prep',
          ],
          cta: 'Conversation flow dekho →',
        },
        {
          badge: '02 · Placement Officer Dashboard',
          headline: '200 students. Ek officer. Triage AI sambhalega.',
          body: 'SaathiAI un learners ko highlight karta hai jinko aaj human intervention chahiye, aur baaki follow-up auto chala deta hai.',
          bullets: [
            'Pure cohort par AI risk scoring',
            'Auto-generated MIS reports',
            'Built-in employer outreach CRM',
            'Real-time placement confirmation',
          ],
        },
        {
          badge: '03 · MSME Employer Portal',
          headline: 'Wahi certificate jismein MSME ko trust aaye.',
          body: 'SaathiAI generic NSQF certificate ko plain-language skill card mein badal deta hai jise employer WhatsApp link se verify aur respond kar sake.',
          bullets: [
            'Embedded video practical assessment',
            'DigiLocker + NSQF verification clearly shown',
            'Trainer endorsement visible',
            'WhatsApp par one-tap interest',
          ],
        },
        {
          badge: '04 · District Console',
          headline: 'Pehli baar district leaders sach dekh payenge.',
          body: 'Trades, centres, drop-offs aur unmet employer demand ek hi weekly district view mein dikhegi.',
          bullets: [],
        },
      ],
      miniPhoneMatches: '24 hrs mein 3 matches mile',
      district: {
        badge: '04 · District Console',
        headline: 'Pehli baar DSSD ko sach dikhega.',
        body: 'Kaun se trades sabse fast place ho rahe hain? Kaun se centres 60% se upar hain? MSME demand kahan unmet hai? District console har hafte jawab deta hai.',
        title: 'Varanasi District · June 2026',
        subtitle: 'Placement rate by trade',
        bars: [
          { label: 'Electrician', pct: 73, color: COLORS.teal },
          { label: 'Fitter', pct: 61, color: COLORS.teal },
          { label: 'Dressmaking ⚠', pct: 22, color: 'var(--color-caution)' },
        ],
        note: 'Har Monday AI policy brief auto-generate hota hai',
      },
    },
    funnel: {
      eyebrow: 'Dropout funnel · SaathiAI se pehle aur baad',
      heading: '19% real yield se ek aise system tak jo actual mein kaam kare.',
      brokenBadge: 'Tooti hui pipeline',
      saathiBadge: 'SaathiAI pathway',
      sourceNote: 'PMKVY data · STRIVE tracer study · HR retention surveys',
      callout: '19% se 65% tak: har training cohort mein 3.4× zyada lives change hoti hain.',
      brokenPipeline: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Course complete', percent: 82 },
        { label: 'Certified', percent: 58 },
        { label: 'Job mili', percent: 43 },
        { label: '90 din baad bhi job mein', percent: 19 },
      ],
      saathiPathway: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Nudges ke saath complete', percent: 95 },
        { label: 'Support ke saath certified', percent: 88 },
        { label: '24 hrs mein placed', percent: 75 },
        { label: '90-day retention', percent: 65 },
      ],
    },
    tech: {
      eyebrow: "India ki DPI par built",
      heading: 'Jo APIs useful hain, ab finally connected hain.',
      integrations: [
        { icon: '🗣️', name: 'Sarvam AI', role: 'Indian languages mein voice input-output, low bandwidth par bhi.', color: '#6366f1' },
        { icon: '🏛️', name: 'DigiLocker', role: 'OAuth-based NSQF certificate verification aur tamper-resistant credentials.', color: '#0ea5e9' },
        { icon: '🎓', name: 'SIDH', role: 'Scheme, enrolment, assessment aur certification records ka training backbone.', color: COLORS.teal },
        { icon: '🏗️', name: 'NAPS Portal', role: 'Hazaron registered employers ke liye apprenticeship matching.', color: '#f59e0b' },
        { icon: '💼', name: 'NCS API', role: 'District-aware filtering ke saath real-time vacancy data.', color: '#10b981' },
        { icon: '💬', name: 'WhatsApp Business API', role: 'Zero-install delivery jahan learner already chat karta hai.', color: '#25d366' },
      ],
      flowNodes: [
        { label: 'Learner WhatsApp', icon: '💬' },
        { label: 'SaathiAI Core', icon: '🤝' },
        { label: 'SIDH + DigiLocker + NCS', icon: '🏛️' },
        { label: 'Employer Skill Card', icon: '📋' },
        { label: 'Officer Dashboard', icon: '📊' },
        { label: 'District Console', icon: '🗺️' },
      ],
    },
    quote: {
      text: 'India ka vocational system certified aur capable talent bana raha hai, par market abhi bhi unhe discover, verify, trust ya absorb nahi kar paa raha.',
      source: "India's Education-to-Employment Pathways mein Structural Bottlenecks, 2026",
      sourceDetail: 'World Bank, STRIVE tracer study, CAG audit aur India Skills Report 2026 se synthesize kiya gaya.',
      closing: 'SaathiAI wahi missing discovery, verification aur trust layer hai.',
    },
    finalCta: {
      personas: ['Learners', 'Placement Officers', 'MSMEs', 'District Teams'],
    },
    impactFineprint: 'Yeh model published placement, retention aur wage benchmarks par based hai.',
    footer: {
      body: 'Shiksha Hackathon 2026 · Problem Statement 3.5 ke liye bana. India ke vocational graduates ke liye AI career companion.',
      sourcesLabel: 'Data sources',
      sources: 'India Skills Report 2026 · CAG PMKVY Audit · STRIVE Tracer Study · World Bank · KPMG MSME Report · NSDC data · NCS portal analytics',
      copyright: '© 2026 SaathiAI · Bharat ke liye built',
    },
  },
  bn: {
    showcase: {
      eyebrow: '৯টি ভাষা · এক সাথী',
      heading: 'আপনার ভাষাই আমাদের ভাষা',
      body: 'SaathiAI প্রত্যেক graduate-এর সঙ্গে সেই ভাষায় কথা বলে, যেটায় সে বড় হয়েছে। কোনো সরকারি ফর্মের ভাষা চাপিয়ে দেয় না।',
      activeLabel: 'চলছে',
      activeUsersLabel: 'সক্রিয় ব্যবহারকারী',
      switchLabel: 'এই ভাষায় বদলান',
      footerNote: 'শীঘ্রই ওড়িয়া, পাঞ্জাবি, অসমীয়া এবং ভোজপুরিও আসছে।',
    },
    breakpoints: {
      eyebrow: 'পাঁচটি আসল ভাঙন',
      heading: 'রামুর যাত্রা কোথায় ভেঙে যায়। বারবার।',
      subheading: 'আমাদের research দেখিয়েছে ITI ও PMKVY pipeline ঠিক কোন জায়গাগুলোতে ভেঙে পড়ে।',
      cards: [
        { stat: '8–23%', title: 'PMKVY placement rate', body: 'Placement cell নেই, guidance নেই। Learner certificate পেয়ে সরাসরি শূন্যতায় পড়ে যায়।' },
        { stat: '71%', title: 'MSME বলে skilling hiring-এ সাহায্য করেনি', body: 'রেকর্ড ছড়ানো, trust কম। খারাপ hire-এর পরে employer certificate-এ ভরসা করে না।' },
        { stat: '↓ কমছে', title: 'NCS Portal registrations FY26', body: 'Platform desktop-first আর text-heavy। যেই সময়ে support দরকার, learner তখনই বাদ পড়ে যায়।' },
        { stat: '22%', title: '90 দিনের মধ্যে নতুন hire চাকরি ছাড়ে', body: 'Employer referral আর costly screening-এর উপর নির্ভর করে। Formal credential risk যথেষ্ট কমাতে পারে না।' },
        { stat: '<1%', title: 'কখনও জমা হওয়া trainee feedback', body: 'Placement officer এখনও WhatsApp group আর logbook নিয়ে কাজ করেন। District live picture পায় না।' },
      ],
    },
    solution: {
      eyebrow: 'সমাধান',
      headingLines: ['একটি WhatsApp message.', 'চারটি surface.', 'একটি unified system.'],
      features: [
        {
          badge: '01 · Learner Companion',
          headline: 'রামু তার career guide-কে WhatsApp-এ পায়।',
          body: 'Graduation-এর পরে একটি activation message-ই যথেষ্ট। SaathiAI learner-এর ভাষায় কথা বলে, voice note নেয়, আর দুর্বল network-এও কাজ করে।',
          bullets: [
            'Typing ছাড়াই voice onboarding',
            'DigiLocker credential verification',
            '24 ঘণ্টায় top 3 job matches',
            'নিজের ভাষায় mock interview প্রস্তুতি',
          ],
          cta: 'Conversation flow দেখুন →',
        },
        {
          badge: '02 · Placement Officer Dashboard',
          headline: '200 students. একজন officer. Triage AI সামলাবে।',
          body: 'SaathiAI আজ যাদের human intervention দরকার তাদের সামনে আনে, আর বাকিদের follow-up automate করে।',
          bullets: [
            'পুরো cohort-এ AI risk scoring',
            'Auto-generated MIS reports',
            'Built-in employer outreach CRM',
            'Real-time placement confirmation',
          ],
        },
        {
          badge: '03 · MSME Employer Portal',
          headline: 'যে certificate-এ MSME সত্যি trust করবে।',
          body: 'SaathiAI generic NSQF certificate-কে plain-language skill card-এ বদলে দেয়, যেটা employer WhatsApp link দিয়ে verify করতে পারে।',
          bullets: [
            'Embedded video practical assessment',
            'DigiLocker + NSQF verification স্পষ্টভাবে দেখা যায়',
            'Trainer endorsement visible',
            'WhatsApp-এ one-tap interest',
          ],
        },
        {
          badge: '04 · District Console',
          headline: 'প্রথমবার district leader সত্যিটা দেখতে পারবে।',
          body: 'Trades, centres, drop-offs আর unmet employer demand এক weekly district view-তে দেখা যাবে।',
          bullets: [],
        },
      ],
      miniPhoneMatches: '24 ঘণ্টায় 3টি match পাওয়া গেছে',
      district: {
        badge: '04 · District Console',
        headline: 'প্রথমবার DSSD সত্যিটা দেখতে পারবে।',
        body: 'কোন trade সবচেয়ে দ্রুত place হচ্ছে? কোন centre 60%-এর উপরে? MSME demand কোথায় unmet? District console প্রতি সপ্তাহে উত্তর দেয়।',
        title: 'বারাণসী জেলা · জুন 2026',
        subtitle: 'Trade অনুযায়ী placement rate',
        bars: [
          { label: 'Electrician', pct: 73, color: COLORS.teal },
          { label: 'Fitter', pct: 61, color: COLORS.teal },
          { label: 'Dressmaking ⚠', pct: 22, color: 'var(--color-caution)' },
        ],
        note: 'প্রতি সোমবার AI policy brief নিজে থেকেই তৈরি হয়',
      },
    },
    funnel: {
      eyebrow: 'Dropout funnel · SaathiAI-এর আগে ও পরে',
      heading: '19% real yield থেকে এমন system-এ যা সত্যিই কাজ করে।',
      brokenBadge: 'ভাঙা pipeline',
      saathiBadge: 'SaathiAI pathway',
      sourceNote: 'PMKVY data · STRIVE tracer study · HR retention surveys',
      callout: '19% থেকে 65%: প্রতি training cohort-এ 3.4× বেশি জীবন বদলায়।',
      brokenPipeline: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Course complete', percent: 82 },
        { label: 'Certified', percent: 58 },
        { label: 'Job পেয়েছে', percent: 43 },
        { label: '90 দিন পরও চাকরিতে', percent: 19 },
      ],
      saathiPathway: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Nudge সহ complete', percent: 95 },
        { label: 'Support সহ certified', percent: 88 },
        { label: '24 ঘণ্টায় placed', percent: 75 },
        { label: '90 দিন retention', percent: 65 },
      ],
    },
    tech: {
      eyebrow: 'ভারতের DPI-র উপর তৈরি',
      heading: 'যে APIs দরকার, সেগুলো এবার সত্যি যুক্ত হয়েছে।',
      integrations: [
        { icon: '🗣️', name: 'Sarvam AI', role: 'ভারতীয় ভাষায় voice input-output, low bandwidth-এও।', color: '#6366f1' },
        { icon: '🏛️', name: 'DigiLocker', role: 'OAuth-based NSQF certificate verification এবং tamper-resistant credentials।', color: '#0ea5e9' },
        { icon: '🎓', name: 'SIDH', role: 'Scheme, enrolment, assessment এবং certification records-এর training backbone।', color: COLORS.teal },
        { icon: '🏗️', name: 'NAPS Portal', role: 'হাজারো registered employer-এর জন্য apprenticeship matching।', color: '#f59e0b' },
        { icon: '💼', name: 'NCS API', role: 'District-aware filtering সহ real-time vacancy data।', color: '#10b981' },
        { icon: '💬', name: 'WhatsApp Business API', role: 'Zero-install delivery যেখানে learner আগেই কথা বলে।', color: '#25d366' },
      ],
      flowNodes: [
        { label: 'Learner WhatsApp', icon: '💬' },
        { label: 'SaathiAI Core', icon: '🤝' },
        { label: 'SIDH + DigiLocker + NCS', icon: '🏛️' },
        { label: 'Employer Skill Card', icon: '📋' },
        { label: 'Officer Dashboard', icon: '📊' },
        { label: 'District Console', icon: '🗺️' },
      ],
    },
    quote: {
      text: 'ভারতের vocational system certified এবং capable talent তৈরি করছে, কিন্তু market এখনও তাদের discover, verify, trust বা absorb করতে পারছে না।',
      source: "India's Education-to-Employment Pathways-এ Structural Bottlenecks, 2026",
      sourceDetail: 'World Bank, STRIVE tracer study, CAG audit এবং India Skills Report 2026 থেকে সংকলিত।',
      closing: 'SaathiAI-ই সেই missing discovery, verification এবং trust layer।',
    },
    finalCta: {
      personas: ['Learners', 'Placement Officers', 'MSMEs', 'District Teams'],
    },
    impactFineprint: 'এই model vocational cohorts-এর published placement, retention এবং wage benchmarks-এর উপর ভিত্তি করে।',
    footer: {
      body: 'Shiksha Hackathon 2026 · Problem Statement 3.5-এর জন্য তৈরি। ভারতের vocational graduates-দের জন্য AI career companion।',
      sourcesLabel: 'Data sources',
      sources: 'India Skills Report 2026 · CAG PMKVY Audit · STRIVE Tracer Study · World Bank · KPMG MSME Report · NSDC data · NCS portal analytics',
      copyright: '© 2026 SaathiAI · ভারতের জন্য তৈরি',
    },
  },
  mr: {
    showcase: {
      eyebrow: '9 भाषा · एक साथी',
      heading: 'तुमची भाषा हीच आमची भाषा',
      body: 'SaathiAI प्रत्येक graduate शी त्याने वाढलेल्या भाषेत बोलतो, कोणत्याही फॉर्मच्या भाषेत नाही.',
      activeLabel: 'चालू',
      activeUsersLabel: 'सक्रिय वापरकर्ते',
      switchLabel: 'या भाषेत बदला',
      footerNote: 'लवकरच ओडिया, पंजाबी, आसामी आणि भोजपुरीही येतील.',
    },
    breakpoints: {
      eyebrow: 'पाच खरे तुटणारे बिंदू',
      heading: 'रामूचा प्रवास कुठे तुटतो. प्रत्येक वेळी.',
      subheading: 'आमच्या research ने ITI आणि PMKVY pipeline नेमक्या कुठे कोसळते ते दाखवले.',
      cards: [
        { stat: '8–23%', title: 'PMKVY placement rate', body: 'Placement cell नाही, guidance नाही. Learner certificate घेऊन थेट रिकाम्या जागेत जातो.' },
        { stat: '71%', title: 'MSME म्हणतात skilling ने hiring सुधारली नाही', body: 'Records तुटक आहेत आणि trust कमी आहे. वाईट hire नंतर employer certificate वर विश्वास ठेवत नाही.' },
        { stat: '↓ घट', title: 'NCS Portal registrations FY26', body: 'Platform desktop-first आणि text-heavy आहे. ज्यावेळी मदत हवी, तेव्हाच learner हातातून निसटतो.' },
        { stat: '22%', title: '90 दिवसांत नवीन hires नोकरी सोडतात', body: 'Employers referrals आणि महाग screening वर अवलंबून आहेत. Formal credentials risk पुरेसा कमी करत नाहीत.' },
        { stat: '<1%', title: 'कधी submit झालेले trainee feedback', body: 'Placement officers अजूनही WhatsApp groups आणि logbooks वर आहेत. District ला live picture दिसत नाही.' },
      ],
    },
    solution: {
      eyebrow: 'उपाय',
      headingLines: ['एक WhatsApp message.', 'चार surfaces.', 'एक unified system.'],
      features: [
        {
          badge: '01 · Learner Companion',
          headline: 'रामूला त्याचा career guide WhatsApp वर भेटतो.',
          body: 'Graduation नंतर एक activation message पुरेसा आहे. SaathiAI त्याच्या भाषेत बोलतो, voice notes घेतो आणि कमजोर network वरही चालतो.',
          bullets: [
            'Typing शिवाय voice onboarding',
            'DigiLocker credential verification',
            '24 तासांत top 3 job matches',
            'स्वतःच्या भाषेत mock interview तयारी',
          ],
          cta: 'Conversation flow पहा →',
        },
        {
          badge: '02 · Placement Officer Dashboard',
          headline: '200 students. एक officer. Triage AI करेल.',
          body: 'SaathiAI आज human intervention लागणाऱ्या learners ला पुढे आणतो आणि बाकी follow-up automate करतो.',
          bullets: [
            'पूर्ण cohort वर AI risk scoring',
            'Auto-generated MIS reports',
            'Built-in employer outreach CRM',
            'Real-time placement confirmation',
          ],
        },
        {
          badge: '03 · MSME Employer Portal',
          headline: 'ज्या certificate वर MSME खरोखर trust करेल.',
          body: 'SaathiAI generic NSQF certificate ला plain-language skill card मध्ये बदलतो, ज्यावर employer WhatsApp link ने verify करू शकतो.',
          bullets: [
            'Embedded video practical assessment',
            'DigiLocker + NSQF verification स्पष्टपणे दिसते',
            'Trainer endorsement visible',
            'WhatsApp वर one-tap interest',
          ],
        },
        {
          badge: '04 · District Console',
          headline: 'पहिल्यांदाच district leaders ला खरं चित्र दिसेल.',
          body: 'Trades, centres, drop-offs आणि unmet employer demand एका weekly district view मध्ये दिसेल.',
          bullets: [],
        },
      ],
      miniPhoneMatches: '24 तासांत 3 matches मिळाले',
      district: {
        badge: '04 · District Console',
        headline: 'पहिल्यांदाच DSSD ला सत्य दिसेल.',
        body: 'कोणते trades पटकन place होतात? कोणते centres 60% पेक्षा वर आहेत? MSME demand कुठे unmet आहे? District console आठवड्याला उत्तर देतो.',
        title: 'वाराणसी जिल्हा · जून 2026',
        subtitle: 'Trade नुसार placement rate',
        bars: [
          { label: 'Electrician', pct: 73, color: COLORS.teal },
          { label: 'Fitter', pct: 61, color: COLORS.teal },
          { label: 'Dressmaking ⚠', pct: 22, color: 'var(--color-caution)' },
        ],
        note: 'दर सोमवारी AI policy brief आपोआप तयार होतो',
      },
    },
    funnel: {
      eyebrow: 'Dropout funnel · SaathiAI आधी आणि नंतर',
      heading: '19% real yield पासून अशा system पर्यंत जो खरंच काम करतो.',
      brokenBadge: 'तुटलेली pipeline',
      saathiBadge: 'SaathiAI pathway',
      sourceNote: 'PMKVY data · STRIVE tracer study · HR retention surveys',
      callout: '19% वरून 65% पर्यंत: प्रत्येक training cohort मध्ये 3.4× जास्त आयुष्ये बदलतात.',
      brokenPipeline: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Course complete', percent: 82 },
        { label: 'Certified', percent: 58 },
        { label: 'Job मिळाली', percent: 43 },
        { label: '90 दिवसांनीही नोकरीत', percent: 19 },
      ],
      saathiPathway: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Nudges सह complete', percent: 95 },
        { label: 'Support सह certified', percent: 88 },
        { label: '24 तासांत placed', percent: 75 },
        { label: '90 दिवस retention', percent: 65 },
      ],
    },
    tech: {
      eyebrow: 'भारताच्या DPI वर बांधलेले',
      heading: 'उपयोगी APIs आता पहिल्यांदाच जोडल्या गेल्या आहेत.',
      integrations: [
        { icon: '🗣️', name: 'Sarvam AI', role: 'भारतीय भाषांमध्ये voice input-output, low bandwidth वरही.', color: '#6366f1' },
        { icon: '🏛️', name: 'DigiLocker', role: 'OAuth-based NSQF certificate verification आणि tamper-resistant credentials.', color: '#0ea5e9' },
        { icon: '🎓', name: 'SIDH', role: 'Scheme, enrolment, assessment आणि certification records साठी training backbone.', color: COLORS.teal },
        { icon: '🏗️', name: 'NAPS Portal', role: 'हजारो registered employers साठी apprenticeship matching.', color: '#f59e0b' },
        { icon: '💼', name: 'NCS API', role: 'District-aware filtering सह real-time vacancy data.', color: '#10b981' },
        { icon: '💬', name: 'WhatsApp Business API', role: 'Zero-install delivery जिथे learner आधीपासून बोलतो.', color: '#25d366' },
      ],
      flowNodes: [
        { label: 'Learner WhatsApp', icon: '💬' },
        { label: 'SaathiAI Core', icon: '🤝' },
        { label: 'SIDH + DigiLocker + NCS', icon: '🏛️' },
        { label: 'Employer Skill Card', icon: '📋' },
        { label: 'Officer Dashboard', icon: '📊' },
        { label: 'District Console', icon: '🗺️' },
      ],
    },
    quote: {
      text: 'भारताची vocational system certified आणि capable talent तयार करते, पण market अजूनही त्यांना discover, verify, trust किंवा absorb करू शकत नाही.',
      source: "India's Education-to-Employment Pathways मधील Structural Bottlenecks, 2026",
      sourceDetail: 'World Bank, STRIVE tracer study, CAG audit आणि India Skills Report 2026 वर आधारित संकलन.',
      closing: 'SaathiAI हीच missing discovery, verification आणि trust layer आहे.',
    },
    finalCta: {
      personas: ['Learners', 'Placement Officers', 'MSMEs', 'District Teams'],
    },
    impactFineprint: 'हा model vocational cohorts साठी published placement, retention आणि wage benchmarks वर आधारित आहे.',
    footer: {
      body: 'Shiksha Hackathon 2026 · Problem Statement 3.5 साठी तयार केलेले. भारतातील vocational graduates साठी AI career companion.',
      sourcesLabel: 'Data sources',
      sources: 'India Skills Report 2026 · CAG PMKVY Audit · STRIVE Tracer Study · World Bank · KPMG MSME Report · NSDC data · NCS portal analytics',
      copyright: '© 2026 SaathiAI · भारतासाठी तयार',
    },
  },
  te: {
    showcase: {
      eyebrow: '9 భాషలు · ఒక సాథీ',
      heading: 'మీ భాషే మా భాష',
      body: 'SaathiAI ప్రతి graduate‌తో అతను పెరిగిన భాషలోనే మాట్లాడుతుంది. ఎలాంటి ఫారం భాషను బలవంతం చేయదు.',
      activeLabel: 'ప్రస్తుతం',
      activeUsersLabel: 'క్రియాశీల వినియోగదారులు',
      switchLabel: 'ఈ భాషకు మారండి',
      footerNote: 'త్వరలో ఒడియా, పంజాబీ, అస్సామీ, భోజ్‌పురి కూడా వస్తాయి.',
    },
    breakpoints: {
      eyebrow: 'ఐదు నిజమైన విరామ బిందువులు',
      heading: 'రాము ప్రయాణం ఎక్కడ విరుగుతుంది. ప్రతి సారి.',
      subheading: 'మా research ITI మరియు PMKVY pipeline కచ్చితంగా ఎక్కడ కూలిపోతుందో చూపించింది.',
      cards: [
        { stat: '8–23%', title: 'PMKVY placement rate', body: 'Placement cell లేదు, guidance లేదు. Learner certificate తీసుకుని ఖాళీలోకి వెళ్లిపోతాడు.' },
        { stat: '71%', title: 'MSMEలు skilling hiring కి సహాయం చేయలేదని చెబుతున్నాయి', body: 'Records చెల్లాచెదురుగా ఉన్నాయి, trust తక్కువ. చెడు hires తర్వాత employer certificate ని నమ్మడం లేదు.' },
        { stat: '↓ తగ్గుతోంది', title: 'NCS Portal registrations FY26', body: 'Platform desktop-first, text-heavy. అవసరమైన సమయంలో learner తప్పిపోతాడు.' },
        { stat: '22%', title: '90 రోజుల్లో కొత్త hires ఉద్యోగం విడిచేస్తారు', body: 'Employer referrals మరియు costly screening పై ఆధారపడుతున్నారు. Formal credentials risk ను తగినంతగా తగ్గించవు.' },
        { stat: '<1%', title: 'ఎప్పుడైనా submit అయిన trainee feedback', body: 'Placement officers ఇంకా WhatsApp groups, logbooks పై ఆధారపడుతున్నారు. District కి live picture కనిపించదు.' },
      ],
    },
    solution: {
      eyebrow: 'పరిష్కారం',
      headingLines: ['ఒక WhatsApp message.', 'నాలుగు surfaces.', 'ఒక unified system.'],
      features: [
        {
          badge: '01 · Learner Companion',
          headline: 'రాముకు అతని career guide WhatsApp లోనే దొరుకుతుంది.',
          body: 'Graduation తర్వాత ఒక activation message చాలు. SaathiAI learner భాషలోనే మాట్లాడుతుంది, voice notes తీసుకుంటుంది, బలహీనమైన network పై కూడా పనిచేస్తుంది.',
          bullets: [
            'Typing అవసరం లేని voice onboarding',
            'DigiLocker credential verification',
            '24 గంటల్లో top 3 job matches',
            'తన భాషలో mock interview సిద్ధం',
          ],
          cta: 'Conversation flow చూడండి →',
        },
        {
          badge: '02 · Placement Officer Dashboard',
          headline: '200 students. ఒక officer. Triageని AI చూసుకుంటుంది.',
          body: 'ఈ రోజు human intervention అవసరమైన learners ను SaathiAI ముందుకు తీసుకొస్తుంది, మిగిలిన follow-up ను automate చేస్తుంది.',
          bullets: [
            'మొత్తం cohort పై AI risk scoring',
            'Auto-generated MIS reports',
            'Built-in employer outreach CRM',
            'Real-time placement confirmation',
          ],
        },
        {
          badge: '03 · MSME Employer Portal',
          headline: 'MSME నిజంగా నమ్మే certificate ఇదే.',
          body: 'SaathiAI generic NSQF certificate ను plain-language skill card గా మార్చుతుంది. Employer WhatsApp link ద్వారా verify చేసి స్పందించగలడు.',
          bullets: [
            'Embedded video practical assessment',
            'DigiLocker + NSQF verification స్పష్టంగా కనిపిస్తుంది',
            'Trainer endorsement visible',
            'WhatsApp లో one-tap interest',
          ],
        },
        {
          badge: '04 · District Console',
          headline: 'మొదటిసారి district leaders నిజాన్ని చూడగలరు.',
          body: 'Trades, centres, drop-offs, unmet employer demand అన్నీ ఒక weekly district view లో కనిపిస్తాయి.',
          bullets: [],
        },
      ],
      miniPhoneMatches: '24 గంటల్లో 3 matches దొరికాయి',
      district: {
        badge: '04 · District Console',
        headline: 'మొదటిసారి DSSD నిజాన్ని చూడగలదు.',
        body: 'ఏ trades వేగంగా place అవుతున్నాయి? ఏ centres 60% కి పైగా ఉన్నాయి? MSME demand ఎక్కడ unmet గా ఉంది? District console ప్రతి వారం జవాబు ఇస్తుంది.',
        title: 'వారణాసి జిల్లా · జూన్ 2026',
        subtitle: 'Trade వారీ placement rate',
        bars: [
          { label: 'Electrician', pct: 73, color: COLORS.teal },
          { label: 'Fitter', pct: 61, color: COLORS.teal },
          { label: 'Dressmaking ⚠', pct: 22, color: 'var(--color-caution)' },
        ],
        note: 'ప్రతి సోమవారం AI policy brief ఆటోగా తయారవుతుంది',
      },
    },
    funnel: {
      eyebrow: 'Dropout funnel · SaathiAI ముందు మరియు తర్వాత',
      heading: '19% real yield నుంచి నిజంగా పని చేసే system వరకు.',
      brokenBadge: 'విరిగిన pipeline',
      saathiBadge: 'SaathiAI pathway',
      sourceNote: 'PMKVY data · STRIVE tracer study · HR retention surveys',
      callout: '19% నుంచి 65% వరకు: ప్రతి training cohort లో 3.4× ఎక్కువ జీవితాలు మారుతాయి.',
      brokenPipeline: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Course complete', percent: 82 },
        { label: 'Certified', percent: 58 },
        { label: 'Job పొందింది', percent: 43 },
        { label: '90 రోజులకు కూడా ఉద్యోగంలో', percent: 19 },
      ],
      saathiPathway: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Nudges తో complete', percent: 95 },
        { label: 'Support తో certified', percent: 88 },
        { label: '24 గంటల్లో placed', percent: 75 },
        { label: '90-day retention', percent: 65 },
      ],
    },
    tech: {
      eyebrow: 'భారత DPI పై నిర్మించబడింది',
      heading: 'ఉపయోగకరమైన APIs ఇప్పుడు నిజంగా కలిశాయి.',
      integrations: [
        { icon: '🗣️', name: 'Sarvam AI', role: 'భారతీయ భాషల్లో voice input-output, low bandwidth పై కూడా.', color: '#6366f1' },
        { icon: '🏛️', name: 'DigiLocker', role: 'OAuth-based NSQF certificate verification మరియు tamper-resistant credentials.', color: '#0ea5e9' },
        { icon: '🎓', name: 'SIDH', role: 'Scheme, enrolment, assessment, certification records కు training backbone.', color: COLORS.teal },
        { icon: '🏗️', name: 'NAPS Portal', role: 'వేలాది registered employers కోసం apprenticeship matching.', color: '#f59e0b' },
        { icon: '💼', name: 'NCS API', role: 'District-aware filtering తో real-time vacancy data.', color: '#10b981' },
        { icon: '💬', name: 'WhatsApp Business API', role: 'Learner ఇప్పటికే మాట్లాడే చోట zero-install delivery.', color: '#25d366' },
      ],
      flowNodes: [
        { label: 'Learner WhatsApp', icon: '💬' },
        { label: 'SaathiAI Core', icon: '🤝' },
        { label: 'SIDH + DigiLocker + NCS', icon: '🏛️' },
        { label: 'Employer Skill Card', icon: '📋' },
        { label: 'Officer Dashboard', icon: '📊' },
        { label: 'District Console', icon: '🗺️' },
      ],
    },
    quote: {
      text: 'భారత vocational system certified మరియు capable talent ను తయారు చేస్తోంది, కానీ market ఇంకా వారిని discover, verify, trust లేదా absorb చేయలేకపోతోంది.',
      source: "India's Education-to-Employment Pathways లో Structural Bottlenecks, 2026",
      sourceDetail: 'World Bank, STRIVE tracer study, CAG audit మరియు India Skills Report 2026 నుండి సంకలనం.',
      closing: 'SaathiAI ఆ missing discovery, verification, trust layer అవుతుంది.',
    },
    finalCta: {
      personas: ['Learners', 'Placement Officers', 'MSMEs', 'District Teams'],
    },
    impactFineprint: 'ఈ model vocational cohorts పై ఉన్న published placement, retention, wage benchmarks ఆధారంగా రూపొందించబడింది.',
    footer: {
      body: 'Shiksha Hackathon 2026 · Problem Statement 3.5 కోసం నిర్మించబడింది. భారత vocational graduates కోసం AI career companion.',
      sourcesLabel: 'Data sources',
      sources: 'India Skills Report 2026 · CAG PMKVY Audit · STRIVE Tracer Study · World Bank · KPMG MSME Report · NSDC data · NCS portal analytics',
      copyright: '© 2026 SaathiAI · భారత్ కోసం నిర్మించబడింది',
    },
  },
  ta: {
    showcase: {
      eyebrow: '9 மொழிகள் · ஒரு சாத்தி',
      heading: 'உங்கள் மொழியே எங்கள் மொழி',
      body: 'SaathiAI ஒவ்வொரு graduate-உடனும் அவர் வளர்ந்த மொழியில்தான் பேசுகிறது. எந்த form மொழியையும் திணிக்காது.',
      activeLabel: 'செயலில்',
      activeUsersLabel: 'செயலில் உள்ள பயனர்கள்',
      switchLabel: 'இந்த மொழிக்கு மாற்று',
      footerNote: 'விரைவில் ஒடியா, பஞ்சாபி, அஸ்ஸாமிஸ், போஜ்புரியும் வரும்.',
    },
    breakpoints: {
      eyebrow: 'ஐந்து உண்மையான உடைப்பு புள்ளிகள்',
      heading: 'ராமுவின் பயணம் எங்கே உடைகிறது. ஒவ்வொரு முறையும்.',
      subheading: 'எங்கள் research ITI மற்றும் PMKVY pipeline சரியாக எங்கே சரிகிறது என்பதை காட்டியது.',
      cards: [
        { stat: '8–23%', title: 'PMKVY placement rate', body: 'Placement cell இல்லை, guidance இல்லை. Learner certificate எடுத்தவுடன் வெற்றிடத்துக்குள் செல்கிறார்.' },
        { stat: '71%', title: 'MSMEகள் skilling hiring-க்கு உதவவில்லை என்கிறார்கள்', body: 'Records சிதறியுள்ளன, trust குறைவு. மோசமான hireகளுக்குப் பிறகு employer certificate-ஐ நம்பவில்லை.' },
        { stat: '↓ குறைகிறது', title: 'NCS Portal registrations FY26', body: 'Platform desktop-first மற்றும் text-heavy. உதவி தேவைப்படும் நேரத்திலேயே learner தவறி விடுகிறார்.' },
        { stat: '22%', title: '90 நாட்களில் புதிய hires விட்டு செல்கின்றனர்', body: 'Employer referrals மற்றும் costly screening மீது சார்ந்துள்ளனர். Formal credentials risk-ஐ போதுமான அளவு குறைக்கவில்லை.' },
        { stat: '<1%', title: 'எப்போதாவது submit செய்யப்பட்ட trainee feedback', body: 'Placement officers இன்னும் WhatsApp groups மற்றும் logbooks-ஐ பயன்படுத்துகின்றனர். District-க்கு live picture கிடைக்கவில்லை.' },
      ],
    },
    solution: {
      eyebrow: 'தீர்வு',
      headingLines: ['ஒரு WhatsApp message.', 'நான்கு surfaces.', 'ஒரு unified system.'],
      features: [
        {
          badge: '01 · Learner Companion',
          headline: 'ராமுவுக்கு அவரது career guide WhatsApp-லேயே கிடைக்கிறது.',
          body: 'Graduationக்குப் பிறகு ஒரு activation message போதும். SaathiAI learner-ன் மொழியில் பேசுகிறது, voice note ஏற்கிறது, பலவீனமான network-ல்கூட வேலை செய்கிறது.',
          bullets: [
            'Typing தேவையில்லாத voice onboarding',
            'DigiLocker credential verification',
            '24 மணி நேரத்தில் top 3 job matches',
            'தன் மொழியில் mock interview தயார்',
          ],
          cta: 'Conversation flow பாருங்கள் →',
        },
        {
          badge: '02 · Placement Officer Dashboard',
          headline: '200 students. ஒரு officer. Triageஐ AI செய்கிறது.',
          body: 'இன்று human intervention தேவைப்படும் learners-ஐ SaathiAI முன்னிலைப்படுத்தி, மற்ற follow-up அனைத்தையும் automate செய்கிறது.',
          bullets: [
            'முழு cohort-இல் AI risk scoring',
            'Auto-generated MIS reports',
            'Built-in employer outreach CRM',
            'Real-time placement confirmation',
          ],
        },
        {
          badge: '03 · MSME Employer Portal',
          headline: 'MSME உண்மையாக நம்பும் certificate.',
          body: 'SaathiAI generic NSQF certificate-ஐ plain-language skill card ஆக மாற்றுகிறது. Employer WhatsApp link வழியாக verify செய்து பதிலளிக்கலாம்.',
          bullets: [
            'Embedded video practical assessment',
            'DigiLocker + NSQF verification தெளிவாக தெரியும்',
            'Trainer endorsement visible',
            'WhatsApp-ல் one-tap interest',
          ],
        },
        {
          badge: '04 · District Console',
          headline: 'முதல் முறையாக district leaders உண்மையைப் பார்க்க முடியும்.',
          body: 'Trades, centres, drop-offs, unmet employer demand எல்லாம் ஒரு weekly district view-ல் தெரியும்.',
          bullets: [],
        },
      ],
      miniPhoneMatches: '24 மணி நேரத்தில் 3 matches கிடைத்தன',
      district: {
        badge: '04 · District Console',
        headline: 'முதல் முறையாக DSSD உண்மையைப் பார்க்க முடியும்.',
        body: 'எந்த trades வேகமாக place ஆகின்றன? எந்த centres 60% க்கு மேல் உள்ளன? MSME demand எங்கு unmet ஆகிறது? District console வாரம் தோறும் பதில் தருகிறது.',
        title: 'வாரணாசி மாவட்டம் · ஜூன் 2026',
        subtitle: 'Trade வாரியான placement rate',
        bars: [
          { label: 'Electrician', pct: 73, color: COLORS.teal },
          { label: 'Fitter', pct: 61, color: COLORS.teal },
          { label: 'Dressmaking ⚠', pct: 22, color: 'var(--color-caution)' },
        ],
        note: 'ஒவ்வொரு திங்களும் AI policy brief தானாக உருவாகிறது',
      },
    },
    funnel: {
      eyebrow: 'Dropout funnel · SaathiAIக்கு முன் மற்றும் பின்',
      heading: '19% real yield இலிருந்து உண்மையில் வேலை செய்யும் system வரை.',
      brokenBadge: 'உடைந்த pipeline',
      saathiBadge: 'SaathiAI pathway',
      sourceNote: 'PMKVY data · STRIVE tracer study · HR retention surveys',
      callout: '19% இலிருந்து 65% வரை: ஒவ்வொரு training cohort-இலும் 3.4× அதிக வாழ்க்கைகள் மாறுகின்றன.',
      brokenPipeline: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Course complete', percent: 82 },
        { label: 'Certified', percent: 58 },
        { label: 'Job கிடைத்தது', percent: 43 },
        { label: '90 நாட்களுக்கும் பின் வேலைவில்', percent: 19 },
      ],
      saathiPathway: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Nudges உடன் complete', percent: 95 },
        { label: 'Support உடன் certified', percent: 88 },
        { label: '24 மணி நேரத்தில் placed', percent: 75 },
        { label: '90 நாள் retention', percent: 65 },
      ],
    },
    tech: {
      eyebrow: 'இந்தியாவின் DPI மீது கட்டப்பட்டது',
      heading: 'பயனுள்ள APIs இப்போது உண்மையாக இணைக்கப்பட்டுள்ளன.',
      integrations: [
        { icon: '🗣️', name: 'Sarvam AI', role: 'இந்திய மொழிகளில் voice input-output, low bandwidth-ல்கூட.', color: '#6366f1' },
        { icon: '🏛️', name: 'DigiLocker', role: 'OAuth-based NSQF certificate verification மற்றும் tamper-resistant credentials.', color: '#0ea5e9' },
        { icon: '🎓', name: 'SIDH', role: 'Scheme, enrolment, assessment, certification records க்கு training backbone.', color: COLORS.teal },
        { icon: '🏗️', name: 'NAPS Portal', role: 'ஆயிரக்கணக்கான registered employers க்கு apprenticeship matching.', color: '#f59e0b' },
        { icon: '💼', name: 'NCS API', role: 'District-aware filtering உடன் real-time vacancy data.', color: '#10b981' },
        { icon: '💬', name: 'WhatsApp Business API', role: 'Learner ஏற்கனவே இருக்கும் இடத்தில் zero-install delivery.', color: '#25d366' },
      ],
      flowNodes: [
        { label: 'Learner WhatsApp', icon: '💬' },
        { label: 'SaathiAI Core', icon: '🤝' },
        { label: 'SIDH + DigiLocker + NCS', icon: '🏛️' },
        { label: 'Employer Skill Card', icon: '📋' },
        { label: 'Officer Dashboard', icon: '📊' },
        { label: 'District Console', icon: '🗺️' },
      ],
    },
    quote: {
      text: 'இந்தியாவின் vocational system certified மற்றும் capable talent உருவாக்குகிறது, ஆனால் market இன்னும் அவர்களை discover, verify, trust அல்லது absorb செய்ய முடியவில்லை.',
      source: "India's Education-to-Employment Pathways இல் Structural Bottlenecks, 2026",
      sourceDetail: 'World Bank, STRIVE tracer study, CAG audit மற்றும் India Skills Report 2026 ஆகியவற்றின் ஒருங்கிணைவு.',
      closing: 'SaathiAI தான் அந்த missing discovery, verification மற்றும் trust layer.',
    },
    finalCta: {
      personas: ['Learners', 'Placement Officers', 'MSMEs', 'District Teams'],
    },
    impactFineprint: 'இந்த model vocational cohorts க்கான published placement, retention, wage benchmarks மீது அமைந்தது.',
    footer: {
      body: 'Shiksha Hackathon 2026 · Problem Statement 3.5 க்காக உருவாக்கப்பட்டது. இந்திய vocational graduates க்கான AI career companion.',
      sourcesLabel: 'Data sources',
      sources: 'India Skills Report 2026 · CAG PMKVY Audit · STRIVE Tracer Study · World Bank · KPMG MSME Report · NSDC data · NCS portal analytics',
      copyright: '© 2026 SaathiAI · இந்தியாவுக்காக உருவாக்கப்பட்டது',
    },
  },
  kn: {
    showcase: {
      eyebrow: '9 ಭಾಷೆಗಳು · ಒಂದು ಸಾಥಿ',
      heading: 'ನಿಮ್ಮ ಭಾಷೆಯೇ ನಮ್ಮ ಭಾಷೆ',
      body: 'SaathiAI ಪ್ರತಿಯೊಬ್ಬ graduate ಜೊತೆಗೆ ಅವರು ಬೆಳೆದ ಭಾಷೆಯಲ್ಲೇ ಮಾತನಾಡುತ್ತದೆ. ಯಾವುದೇ form ಭಾಷೆಯನ್ನು ಬಲವಂತಪಡಿಸುವುದಿಲ್ಲ.',
      activeLabel: 'ಸಕ್ರಿಯ',
      activeUsersLabel: 'ಸಕ್ರಿಯ ಬಳಕೆದಾರರು',
      switchLabel: 'ಈ ಭಾಷೆಗೆ ಬದಲಿಸಿ',
      footerNote: 'ಶೀಘ್ರದಲ್ಲೇ ಒಡಿಯಾ, ಪಂಜಾಬಿ, ಅಸ್ಸಾಮಿ ಮತ್ತು ಭೋಜ್ಪುರಿಯೂ ಬರುತ್ತವೆ.',
    },
    breakpoints: {
      eyebrow: 'ಐದು ನಿಜವಾದ ಮುರಿತ ಬಿಂದುಗಳು',
      heading: 'ರಾಮುವಿನ ಪ್ರಯಾಣ ಎಲ್ಲಿ ಮುರಿಯುತ್ತದೆ. ಪ್ರತೀ ಬಾರಿ.',
      subheading: 'ನಮ್ಮ research ITI ಮತ್ತು PMKVY pipeline ಯಾವ ಸ್ಥಳಗಳಲ್ಲಿ ಕುಸಿಯುತ್ತದೆ ಎಂಬುದನ್ನು ತೋರಿಸಿದೆ.',
      cards: [
        { stat: '8–23%', title: 'PMKVY placement rate', body: 'Placement cell ಇಲ್ಲ, guidance ಇಲ್ಲ. Learner certificate ಪಡೆದು ನೇರವಾಗಿ ಶೂನ್ಯಕ್ಕೆ ಬೀಳುತ್ತಾನೆ.' },
        { stat: '71%', title: 'MSMEಗಳು skilling hiringಗೆ ಸಹಾಯ ಮಾಡಲಿಲ್ಲ ಎಂದು ಹೇಳುತ್ತವೆ', body: 'Records ಚದುರಿವೆ, trust ಕಡಿಮೆ. ಕೆಟ್ಟ hires ನಂತರ employer certificate ನಂಬುವುದಿಲ್ಲ.' },
        { stat: '↓ ಇಳಿಕೆ', title: 'NCS Portal registrations FY26', body: 'Platform desktop-first ಮತ್ತು text-heavy. ಸಹಾಯ ಬೇಕಾದ ಕ್ಷಣದಲ್ಲಿ learner ತಪ್ಪಿಹೋಗುತ್ತಾನೆ.' },
        { stat: '22%', title: '90 ದಿನಗಳಲ್ಲಿ ಹೊಸ hires ಕೆಲಸ ಬಿಡುತ್ತಾರೆ', body: 'Employer referrals ಮತ್ತು costly screening ಮೇಲೆ ಅವಲಂಬಿತ. Formal credentials risk ಅನ್ನು ಸಾಕಷ್ಟು ಕಡಿಮೆ ಮಾಡುವುದಿಲ್ಲ.' },
        { stat: '<1%', title: 'ಎಂದಾದರೂ submit ಆದ trainee feedback', body: 'Placement officers ಇನ್ನೂ WhatsApp groups ಮತ್ತು logbooks ಮೇಲೆ ಇದ್ದಾರೆ. Districtಗೆ live picture ಕಾಣುವುದಿಲ್ಲ.' },
      ],
    },
    solution: {
      eyebrow: 'ಪರಿಹಾರ',
      headingLines: ['ಒಂದು WhatsApp message.', 'ನಾಲ್ಕು surfaces.', 'ಒಂದು unified system.'],
      features: [
        {
          badge: '01 · Learner Companion',
          headline: 'ರಾಮುವಿಗೆ career guide WhatsAppಲ್ಲೇ ಸಿಗುತ್ತದೆ.',
          body: 'Graduation ನಂತರ ಒಂದು activation message ಸಾಕು. SaathiAI learner ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡುತ್ತದೆ, voice notes ಸ್ವೀಕರಿಸುತ್ತದೆ, ಕಡಿಮೆ network ಮೇಲೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ.',
          bullets: [
            'Typing ಬೇಡವಾದ voice onboarding',
            'DigiLocker credential verification',
            '24 ಗಂಟೆಗಳಲ್ಲಿ top 3 job matches',
            'ತಮ್ಮ ಭಾಷೆಯಲ್ಲಿ mock interview ತಯಾರಿ',
          ],
          cta: 'Conversation flow ನೋಡಿ →',
        },
        {
          badge: '02 · Placement Officer Dashboard',
          headline: '200 students. ಒಬ್ಬ officer. Triage ಅನ್ನು AI ನೋಡಿಕೊಳ್ಳುತ್ತದೆ.',
          body: 'ಇಂದು human intervention ಬೇಕಿರುವ learners ಅನ್ನು SaathiAI ಮುಂದಕ್ಕೆ ತರುತ್ತದೆ, ಉಳಿದ follow-up ಅನ್ನು automate ಮಾಡುತ್ತದೆ.',
          bullets: [
            'ಪೂರ್ಣ cohort ಮೇಲೆ AI risk scoring',
            'Auto-generated MIS reports',
            'Built-in employer outreach CRM',
            'Real-time placement confirmation',
          ],
        },
        {
          badge: '03 · MSME Employer Portal',
          headline: 'MSME ನಿಜವಾಗಿ ನಂಬುವ certificate.',
          body: 'SaathiAI generic NSQF certificate ಅನ್ನು plain-language skill card ಆಗಿ ಬದಲಿಸುತ್ತದೆ. Employer WhatsApp link ಮೂಲಕ verify ಮಾಡಿ ಪ್ರತಿಕ್ರಿಯಿಸಬಹುದು.',
          bullets: [
            'Embedded video practical assessment',
            'DigiLocker + NSQF verification ಸ್ಪಷ್ಟವಾಗಿ ಕಾಣಿಸುತ್ತದೆ',
            'Trainer endorsement visible',
            'WhatsAppನಲ್ಲಿ one-tap interest',
          ],
        },
        {
          badge: '04 · District Console',
          headline: 'ಮೊದಲ ಬಾರಿಗೆ district leaders ಸತ್ಯವನ್ನು ನೋಡಬಹುದು.',
          body: 'Trades, centres, drop-offs, unmet employer demand ಎಲ್ಲವೂ ಒಂದು weekly district viewನಲ್ಲಿ ಕಾಣುತ್ತವೆ.',
          bullets: [],
        },
      ],
      miniPhoneMatches: '24 ಗಂಟೆಗಳಲ್ಲಿ 3 matches ಸಿಕ್ಕಿವೆ',
      district: {
        badge: '04 · District Console',
        headline: 'ಮೊದಲ ಬಾರಿಗೆ DSSD ಸತ್ಯವನ್ನು ನೋಡಬಹುದು.',
        body: 'ಯಾವ trades ಬೇಗ place ಆಗುತ್ತವೆ? ಯಾವ centres 60% ಕ್ಕಿಂತ ಮೇಲಿವೆ? MSME demand ಎಲ್ಲಿ unmet ಆಗಿದೆ? District console ವಾರಕ್ಕೊಮ್ಮೆ ಉತ್ತರ ನೀಡುತ್ತದೆ.',
        title: 'ವಾರಾಣಸಿ ಜಿಲ್ಲೆ · ಜೂನ್ 2026',
        subtitle: 'Trade ಪ್ರಕಾರ placement rate',
        bars: [
          { label: 'Electrician', pct: 73, color: COLORS.teal },
          { label: 'Fitter', pct: 61, color: COLORS.teal },
          { label: 'Dressmaking ⚠', pct: 22, color: 'var(--color-caution)' },
        ],
        note: 'ಪ್ರತಿ ಸೋಮವಾರ AI policy brief ಸ್ವಯಂ ನಿರ್ಮಾಣವಾಗುತ್ತದೆ',
      },
    },
    funnel: {
      eyebrow: 'Dropout funnel · SaathiAI ಮೊದಲು ಮತ್ತು ನಂತರ',
      heading: '19% real yield ಇಂದ ನಿಜವಾಗಿಯೂ ಕೆಲಸ ಮಾಡುವ system ವರೆಗೆ.',
      brokenBadge: 'ಮುರಿದ pipeline',
      saathiBadge: 'SaathiAI pathway',
      sourceNote: 'PMKVY data · STRIVE tracer study · HR retention surveys',
      callout: '19% ರಿಂದ 65% ವರೆಗೆ: ಪ್ರತಿ training cohort ನಲ್ಲಿ 3.4× ಹೆಚ್ಚು ಬದುಕುಗಳು ಬದಲಾಗುತ್ತವೆ.',
      brokenPipeline: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Course complete', percent: 82 },
        { label: 'Certified', percent: 58 },
        { label: 'Job ಸಿಕ್ಕಿತು', percent: 43 },
        { label: '90 ದಿನಗಳ ಬಳಿಕವೂ ಕೆಲಸದಲ್ಲಿ', percent: 19 },
      ],
      saathiPathway: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Nudges ಜೊತೆ complete', percent: 95 },
        { label: 'Support ಜೊತೆ certified', percent: 88 },
        { label: '24 ಗಂಟೆಗಳಲ್ಲಿ placed', percent: 75 },
        { label: '90-day retention', percent: 65 },
      ],
    },
    tech: {
      eyebrow: 'ಭಾರತದ DPI ಮೇಲೆ ನಿರ್ಮಿತ',
      heading: 'ಬಳಕೆಯ APIs ಈಗ ನಿಜವಾಗಿಯೂ ಸಂಪರ್ಕಗೊಂಡಿವೆ.',
      integrations: [
        { icon: '🗣️', name: 'Sarvam AI', role: 'ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ voice input-output, low bandwidth ಮೇಲೂ.', color: '#6366f1' },
        { icon: '🏛️', name: 'DigiLocker', role: 'OAuth-based NSQF certificate verification ಮತ್ತು tamper-resistant credentials.', color: '#0ea5e9' },
        { icon: '🎓', name: 'SIDH', role: 'Scheme, enrolment, assessment, certification records ಗಾಗಿ training backbone.', color: COLORS.teal },
        { icon: '🏗️', name: 'NAPS Portal', role: 'ಸಾವಿರಾರು registered employers ಗಾಗಿ apprenticeship matching.', color: '#f59e0b' },
        { icon: '💼', name: 'NCS API', role: 'District-aware filtering ಜೊತೆಗೆ real-time vacancy data.', color: '#10b981' },
        { icon: '💬', name: 'WhatsApp Business API', role: 'Learner ಈಗಾಗಲೇ ಇರುವ ಜಾಗದಲ್ಲಿ zero-install delivery.', color: '#25d366' },
      ],
      flowNodes: [
        { label: 'Learner WhatsApp', icon: '💬' },
        { label: 'SaathiAI Core', icon: '🤝' },
        { label: 'SIDH + DigiLocker + NCS', icon: '🏛️' },
        { label: 'Employer Skill Card', icon: '📋' },
        { label: 'Officer Dashboard', icon: '📊' },
        { label: 'District Console', icon: '🗺️' },
      ],
    },
    quote: {
      text: 'ಭಾರತದ vocational system certified ಮತ್ತು capable talent ಅನ್ನು ಸೃಷ್ಟಿಸುತ್ತಿದೆ, ಆದರೆ market ಇನ್ನೂ ಅವರನ್ನು discover, verify, trust ಅಥವಾ absorb ಮಾಡಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ.',
      source: "India's Education-to-Employment Pathways ನಲ್ಲಿ Structural Bottlenecks, 2026",
      sourceDetail: 'World Bank, STRIVE tracer study, CAG audit ಮತ್ತು India Skills Report 2026 ಆಧಾರಿತ ಸಂಗ್ರಹ.',
      closing: 'SaathiAI ಆ missing discovery, verification, trust layer ಆಗುತ್ತದೆ.',
    },
    finalCta: {
      personas: ['Learners', 'Placement Officers', 'MSMEs', 'District Teams'],
    },
    impactFineprint: 'ಈ model vocational cohorts ಕುರಿತ published placement, retention, wage benchmarks ಆಧಾರಿತವಾಗಿದೆ.',
    footer: {
      body: 'Shiksha Hackathon 2026 · Problem Statement 3.5 ಗಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ. ಭಾರತದ vocational graduates ಗಾಗಿ AI career companion.',
      sourcesLabel: 'Data sources',
      sources: 'India Skills Report 2026 · CAG PMKVY Audit · STRIVE Tracer Study · World Bank · KPMG MSME Report · NSDC data · NCS portal analytics',
      copyright: '© 2026 SaathiAI · ಭಾರತದಿಗಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ',
    },
  },
  gu: {
    showcase: {
      eyebrow: '9 ભાષાઓ · એક સાથી',
      heading: 'તમારી ભાષા જ અમારી ભાષા છે',
      body: 'SaathiAI દરેક graduate સાથે એ જ ભાષામાં વાત કરે છે જેમાં તે મોટો થયો છે. કોઈ form ની ભાષા લાદાતી નથી.',
      activeLabel: 'સક્રિય',
      activeUsersLabel: 'સક્રિય વપરાશકર્તાઓ',
      switchLabel: 'આ ભાષામાં બદલો',
      footerNote: 'જલ્દી જ ઓડિયા, પંજાબી, આસામી અને ભોજપુરી પણ આવશે.',
    },
    breakpoints: {
      eyebrow: 'પાંચ ખરેખરા તૂટવાના બિંદુઓ',
      heading: 'રામુની સફર ક્યાં તૂટે છે. દરેક વખત.',
      subheading: 'અમારી research એ બતાવ્યું કે ITI અને PMKVY pipeline ચોક્કસ કયા સ્થળે તૂટી પડે છે.',
      cards: [
        { stat: '8–23%', title: 'PMKVY placement rate', body: 'Placement cell નથી, guidance નથી. Learner certificate લઈને સીધો ખાલીપામાં પહોંચે છે.' },
        { stat: '71%', title: 'MSME કહે છે skilling hiringમાં મદદ કરતી નથી', body: 'Records બિખરાયેલા છે અને trust ઓછો છે. ખરાબ hires પછી employer certificate પર વિશ્વાસ કરતો નથી.' },
        { stat: '↓ ઘટાડો', title: 'NCS Portal registrations FY26', body: 'Platform desktop-first અને text-heavy છે. મદદની સૌથી જરૂર હોય ત્યારે learner છૂટી જાય છે.' },
        { stat: '22%', title: '90 દિવસમાં નવા hires નોકરી છોડી દે છે', body: 'Employers referrals અને costly screening પર આધાર રાખે છે. Formal credentials risk પૂરતું ઓછું કરતા નથી.' },
        { stat: '<1%', title: 'ક્યારેય submit થયેલો trainee feedback', body: 'Placement officers હજુ પણ WhatsApp groups અને logbooks પર છે. District ને live picture દેખાતી નથી.' },
      ],
    },
    solution: {
      eyebrow: 'ઉકેલ',
      headingLines: ['એક WhatsApp message.', 'ચાર surfaces.', 'એક unified system.'],
      features: [
        {
          badge: '01 · Learner Companion',
          headline: 'રામુને તેનો career guide WhatsApp પર જ મળે છે.',
          body: 'Graduation પછી એક activation message પૂરતો છે. SaathiAI learner ની ભાષામાં બોલે છે, voice notes લે છે અને નબળા network પર પણ કામ કરે છે.',
          bullets: [
            'Typing વગરનું voice onboarding',
            'DigiLocker credential verification',
            '24 કલાકમાં top 3 job matches',
            'પોતાની ભાષામાં mock interview તૈયારી',
          ],
          cta: 'Conversation flow જુઓ →',
        },
        {
          badge: '02 · Placement Officer Dashboard',
          headline: '200 students. એક officer. Triage AI સંભાળશે.',
          body: 'SaathiAI આજ human intervention જોઈએ એવા learners ને આગળ લાવે છે અને બાકીના follow-up ને automate કરે છે.',
          bullets: [
            'સમગ્ર cohort પર AI risk scoring',
            'Auto-generated MIS reports',
            'Built-in employer outreach CRM',
            'Real-time placement confirmation',
          ],
        },
        {
          badge: '03 · MSME Employer Portal',
          headline: 'જે certificate પર MSME ખરેખર trust કરશે.',
          body: 'SaathiAI generic NSQF certificate ને plain-language skill card માં ફેરવે છે. Employer WhatsApp link થી verify કરીને જવાબ આપી શકે છે.',
          bullets: [
            'Embedded video practical assessment',
            'DigiLocker + NSQF verification સ્પષ્ટ રીતે દેખાય છે',
            'Trainer endorsement visible',
            'WhatsApp પર one-tap interest',
          ],
        },
        {
          badge: '04 · District Console',
          headline: 'પહેલી વાર district leaders સાચું જોઈ શકશે.',
          body: 'Trades, centres, drop-offs અને unmet employer demand એક weekly district view માં દેખાશે.',
          bullets: [],
        },
      ],
      miniPhoneMatches: '24 કલાકમાં 3 matches મળ્યા',
      district: {
        badge: '04 · District Console',
        headline: 'પહેલી વાર DSSD સાચું જોઈ શકશે.',
        body: 'કયા trades ઝડપથી place થાય છે? કયા centres 60% થી ઉપર છે? MSME demand ક્યાં unmet છે? District console દર અઠવાડિયે જવાબ આપે છે.',
        title: 'વારાણસી જિલ્લો · જૂન 2026',
        subtitle: 'Trade મુજબ placement rate',
        bars: [
          { label: 'Electrician', pct: 73, color: COLORS.teal },
          { label: 'Fitter', pct: 61, color: COLORS.teal },
          { label: 'Dressmaking ⚠', pct: 22, color: 'var(--color-caution)' },
        ],
        note: 'દર સોમવારે AI policy brief આપમેળે બને છે',
      },
    },
    funnel: {
      eyebrow: 'Dropout funnel · SaathiAI પહેલાં અને પછી',
      heading: '19% real yield થી એ system સુધી જે ખરેખર કામ કરે છે.',
      brokenBadge: 'તૂટેલી pipeline',
      saathiBadge: 'SaathiAI pathway',
      sourceNote: 'PMKVY data · STRIVE tracer study · HR retention surveys',
      callout: '19% થી 65% સુધી: દરેક training cohort માં 3.4× વધુ જીવનો બદલાય છે.',
      brokenPipeline: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Course complete', percent: 82 },
        { label: 'Certified', percent: 58 },
        { label: 'Job મળી', percent: 43 },
        { label: '90 દિવસ પછી પણ નોકરીમાં', percent: 19 },
      ],
      saathiPathway: [
        { label: 'Enrolled', percent: 100 },
        { label: 'Nudges સાથે complete', percent: 95 },
        { label: 'Support સાથે certified', percent: 88 },
        { label: '24 કલાકમાં placed', percent: 75 },
        { label: '90-day retention', percent: 65 },
      ],
    },
    tech: {
      eyebrow: 'ભારતની DPI પર બનાવેલું',
      heading: 'જરૂરી APIs હવે સાચે જોડાઈ ગઈ છે.',
      integrations: [
        { icon: '🗣️', name: 'Sarvam AI', role: 'ભારતીય ભાષાઓમાં voice input-output, low bandwidth પર પણ.', color: '#6366f1' },
        { icon: '🏛️', name: 'DigiLocker', role: 'OAuth-based NSQF certificate verification અને tamper-resistant credentials.', color: '#0ea5e9' },
        { icon: '🎓', name: 'SIDH', role: 'Scheme, enrolment, assessment અને certification records માટે training backbone.', color: COLORS.teal },
        { icon: '🏗️', name: 'NAPS Portal', role: 'હજારો registered employers માટે apprenticeship matching.', color: '#f59e0b' },
        { icon: '💼', name: 'NCS API', role: 'District-aware filtering સાથે real-time vacancy data.', color: '#10b981' },
        { icon: '💬', name: 'WhatsApp Business API', role: 'જ્યાં learner પહેલેથી છે ત્યાં zero-install delivery.', color: '#25d366' },
      ],
      flowNodes: [
        { label: 'Learner WhatsApp', icon: '💬' },
        { label: 'SaathiAI Core', icon: '🤝' },
        { label: 'SIDH + DigiLocker + NCS', icon: '🏛️' },
        { label: 'Employer Skill Card', icon: '📋' },
        { label: 'Officer Dashboard', icon: '📊' },
        { label: 'District Console', icon: '🗺️' },
      ],
    },
    quote: {
      text: 'ભારતની vocational system certified અને capable talent બનાવે છે, પણ market હજુ પણ તેમને discover, verify, trust અથવા absorb કરી શકતું નથી.',
      source: "India's Education-to-Employment Pathways માં Structural Bottlenecks, 2026",
      sourceDetail: 'World Bank, STRIVE tracer study, CAG audit અને India Skills Report 2026 પરથી સંકલિત.',
      closing: 'SaathiAI એ જ missing discovery, verification અને trust layer છે.',
    },
    finalCta: {
      personas: ['Learners', 'Placement Officers', 'MSMEs', 'District Teams'],
    },
    impactFineprint: 'આ model vocational cohorts માટેના published placement, retention અને wage benchmarks પર આધારિત છે.',
    footer: {
      body: 'Shiksha Hackathon 2026 · Problem Statement 3.5 માટે બનાવેલું. ભારતના vocational graduates માટે AI career companion.',
      sourcesLabel: 'Data sources',
      sources: 'India Skills Report 2026 · CAG PMKVY Audit · STRIVE Tracer Study · World Bank · KPMG MSME Report · NSDC data · NCS portal analytics',
      copyright: '© 2026 SaathiAI · ભારત માટે બનાવેલું',
    },
  },
};

export function getHomeContent(locale: LocaleCode): HomeContent {
  return HOME_CONTENT[locale] ?? HOME_CONTENT.en;
}
