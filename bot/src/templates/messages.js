const labels = {
  devanagari: {
    yes: 'हाँ, सही है',
    noChange: 'नहीं, बदलो',
    noMoreSkills: 'नहीं, ठीक है',
    addSkills: 'हाँ, और बताऊंगा',
    showJobs: 'हाँ, Jobs दिखाओ',
    later: 'बाद में',
    practice: 'हाँ, Practice करें',
    wait: 'ठीक है, इंतज़ार करूंगा',
    none: 'कोई नहीं'
  },
  roman: {
    yes: 'Haan, sahi hai',
    noChange: 'Nahi, badlo',
    noMoreSkills: 'Nahi, theek hai',
    addSkills: 'Haan, aur bataunga',
    showJobs: 'Haan, Jobs dikhao',
    later: 'Baad mein',
    practice: 'Haan, Practice karein',
    wait: 'Theek hai, wait karunga',
    none: 'Koi nahi'
  },
  english: {
    yes: 'Yes, correct',
    noChange: 'No, change it',
    noMoreSkills: 'No, this is fine',
    addSkills: 'Yes, add more',
    showJobs: 'Yes, show jobs',
    later: 'Later',
    practice: 'Yes, practice',
    wait: 'Okay, I will wait',
    none: 'None'
  }
};

const copy = {
  devanagari: {
    welcomeNew:
      'नमस्ते! मैं SaathiAI हूँ - आपका career साथी। क्या आपने कोई vocational course किया है? जैसे Electrician, Fitter, COPA, या कोई और trade?',
    askName: 'आपका नाम क्या है?',
    askTradeDistrict: (name) =>
      `${name} ji, आपने कौन सा trade किया है और आप किस जिले में रहते हैं? बस बोल दीजिए - voice note या type कर सकते हैं।`,
    askMissingTrade: 'Trade भी बता दीजिए - जैसे Electrician, Fitter, COPA, Welder, Plumber.',
    askMissingDistrict: 'आप किस जिले में रहते हैं? जिला बता दीजिए.',
    askCertificate: 'आपने यह course कहाँ से किया? PMKVY, ITI, या कोई और जगह से?',
    profileBasicsCaptured: ({ trade, district }) =>
      `ठीक है, note कर लिया: ${trade} - ${district}.\n\nअब बताइए, आपने यह course कहाँ से किया? PMKVY, ITI, या कोई और जगह से?`,
    confirmProfile: ({ name, trade, district, state, certificateType }) =>
      `ठीक है! मैंने समझा:\n\n👤 ${name}\n🔧 ${trade} - ${district}${state ? `, ${state}` : ''}\n🎓 ${certificateType}\n\nक्या यह सही है?`,
    askCorrection: 'क्या बदलना है? एक message में सही details भेज दीजिए.',
    askSkills:
      'अब मुझे बताइए - आपने अपनी training में क्या-क्या किया? कोई भी काम जो आपने सीखा या किया हो। Voice note में बोल सकते हैं.',
    askMoreSkillDetail:
      'थोड़ा और बताइए - जैसे OJT में कहाँ काम किया, या कौन सी specific चीज़ें install/repair की?',
    skillsSummary: (skills) =>
      `मैंने आपकी skills note कर लीं:\n${skills.map((skill) => `✅ ${skill}`).join('\n')}\n\nकुछ और जोड़ना है?`,
    cardProcessing: 'आपका Skill Card बन रहा है...',
    cardReady: (url) =>
      `✅ आपका Skill Card तैयार है!\n\n🔗 ${url}\n\nयह link employers को भेज सकते हैं. इसमें आपकी collected skills और certificate details हैं.`,
    askJobsReady: 'अब आपके लिए jobs ढूंढते हैं. तैयार हैं?',
    jobsLater: 'ठीक है! जब चाहें "JOBS" लिखें - मैं तुरंत match करूंगा.',
    noCardYet: 'आपका Skill Card अभी तैयार नहीं है. पहले onboarding पूरी करते हैं.',
    noJobsFound:
      'अभी आपके trade और district में matching jobs नहीं मिलीं. मैं आपकी preference save कर रहा हूँ और नई jobs आते ही बताऊंगा.',
    jobInterestPrompt: 'किस job में interest है?',
    jobDeclineReason: 'कोई बात नहीं. क्या कारण है? ज्यादा दूर हैं, salary कम है, या कुछ और?',
    jobDeclineSaved: 'समझ गया. जैसे ही नई jobs आएंगी, मैं बताऊंगा.',
    applied: (employer) =>
      `✅ हमने ${employer} को आपका Skill Card भेज दिया है.\n\nवे जल्द contact करेंगे. कभी-कभी 2-3 दिन लगते हैं - घबराएं नहीं.\n\nतब तक interview की तैयारी करें?`,
    practiceIntro:
      'Interview practice शुरू करते हैं! मैं interviewer की तरह सवाल पूछूंगा. आप voice note या text में जवाब दें. मैं feedback दूंगा.\n\nतैयार? पहला सवाल:',
    practiceDone:
      'बहुत अच्छा! आपकी practice हो गई.\n\nएक tip याद रखें: interview में हमेशा एक specific example दें - सिर्फ "haan mujhe aata hai" नहीं.\n\nAll the best! जब भी और practice करनी हो, "PRACTICE" लिखें.',
    practiceSkipped: 'ठीक है! जब भी practice करनी हो, बस "PRACTICE" लिखें.',
    help:
      'SaathiAI क्या कर सकता है:\n\n🔧 JOBS - नई jobs देखें\n📝 CARD - Skill Card देखें/share करें\n🎯 PRACTICE - Interview practice करें\n📊 STATUS - अपना status देखें\n🚫 STOP - Messages बंद करें',
    stopped: 'ठीक है, proactive messages बंद कर दिए गए हैं. फिर शुरू करना हो तो START लिखें.',
    status: ({ name, stepName, placementStatus, cardUrl }) =>
      `Status summary:\n👤 ${name ?? 'नाम pending'}\n📍 Step: ${stepName}\n📊 Placement: ${placementStatus}\n${cardUrl ? `🔗 Card: ${cardUrl}` : ''}`,
    offTopic:
      'माफ करें, मैं सिर्फ jobs और career में help करता हूँ. क्या job ढूंढने में help करूँ?',
    empathetic:
      'समझ सकता हूँ - यह time मुश्किल होता है. आप अकेले नहीं हैं.\n\nचलिए मिलकर एक नई कोशिश करते हैं - अभी आपके लिए fresh jobs देखते हैं?',
    voiceUnavailable: 'Voice note मिला, लेकिन मैं साफ सुन नहीं पाया. कृपया वही जवाब text में भेज दीजिए.',
    placed: (name) =>
      `🎊 बधाई हो ${name} ji! यह बहुत बड़ी बात है.\n\nपहले दिन के लिए कुछ tips चाहिए?`,
    firstDayTips:
      '💼 पहले दिन के लिए:\n✅ 15 मिनट पहले पहुँचें\n✅ जरूरी tools/PPE साथ रखें\n✅ Supervisor का नाम पूछें\n✅ पहले दिन ज्यादा observe करें\n✅ अपनी सीखने वाली बातें note करें\n\nAll the best! आप कर सकते हैं.'
  },
  roman: {
    welcomeNew:
      'Namaste! Main SaathiAI hoon - aapka career saathi. Kya aapne koi vocational course kiya hai? Jaise Electrician, Fitter, COPA, ya koi aur trade?',
    askName: 'Aapka naam kya hai?',
    askTradeDistrict: (name) =>
      `${name} ji, aapne kaun sa trade kiya hai aur aap kis district mein rehte hain? Bas bol dijiye - voice note ya type kar sakte hain.`,
    askMissingTrade: 'Trade bhi bata dijiye - jaise Electrician, Fitter, COPA, Welder, Plumber.',
    askMissingDistrict: 'Aap kis district mein rehte hain? District bata dijiye.',
    askCertificate: 'Aapne yeh course kahan se kiya? PMKVY, ITI, ya koi aur jagah se?',
    profileBasicsCaptured: ({ trade, district }) =>
      `Theek hai, note kar liya: ${trade} - ${district}.\n\nAb bataiye, aapne yeh course kahan se kiya? PMKVY, ITI, ya koi aur jagah se?`,
    confirmProfile: ({ name, trade, district, state, certificateType }) =>
      `Theek hai! Maine samjha:\n\n👤 ${name}\n🔧 ${trade} - ${district}${state ? `, ${state}` : ''}\n🎓 ${certificateType}\n\nKya yeh sahi hai?`,
    askCorrection: 'Kya badalna hai? Ek message mein correct details bhej dijiye.',
    askSkills:
      'Ab mujhe bataiye - aapne training mein kya-kya kiya? Koi bhi kaam jo aapne seekha ya kiya ho. Voice note mein bol sakte hain.',
    askMoreSkillDetail:
      'Thoda aur bataiye - jaise OJT mein kahan kaam kiya, ya kaun si specific cheezein install/repair ki?',
    skillsSummary: (skills) =>
      `Maine aapki skills note kar li:\n${skills.map((skill) => `✅ ${skill}`).join('\n')}\n\nKuch aur jodna hai?`,
    cardProcessing: 'Aapka Skill Card ban raha hai...',
    cardReady: (url) =>
      `✅ Aapka Skill Card tayyar hai!\n\n🔗 ${url}\n\nYeh link employers ko bhej sakte hain. Isme aapki collected skills aur certificate details hain.`,
    askJobsReady: 'Ab aapke liye jobs dhoondte hain. Tayyar hain?',
    jobsLater: 'Theek hai! Jab chahein "JOBS" likhein - main turant match karunga.',
    noCardYet: 'Aapka Skill Card abhi tayyar nahi hai. Pehle onboarding complete karte hain.',
    noJobsFound:
      'Abhi aapke trade aur district mein matching jobs nahi mili. Main preference save kar raha hoon aur new jobs aate hi bataunga.',
    jobInterestPrompt: 'Kis job mein interest hai?',
    jobDeclineReason: 'Koi baat nahi. Kya reason hai? Zyada door hain, salary kam hai, ya kuch aur?',
    jobDeclineSaved: 'Samajh gaya. Jaise hi new jobs aayengi, main bataunga.',
    applied: (employer) =>
      `✅ Humne ${employer} ko aapka Skill Card bhej diya hai.\n\nWoh jald contact karenge. Kabhi-kabhi 2-3 din lagte hain - ghabraiye nahi.\n\nTab tak interview ki taiyari karein?`,
    practiceIntro:
      'Interview practice shuru karte hain! Main interviewer ki tarah sawaal poochunga. Aap voice note ya text mein jawab dein. Main feedback dunga.\n\nTayyar? Pehla sawaal:',
    practiceDone:
      'Bahut accha! Aapki practice ho gayi.\n\nEk tip yaad rakhein: interview mein hamesha ek specific example dein - sirf "haan mujhe aata hai" nahi.\n\nAll the best! Jab bhi aur practice karni ho, "PRACTICE" likhein.',
    practiceSkipped: 'Theek hai! Jab bhi practice karni ho, bas "PRACTICE" likhein.',
    help:
      'SaathiAI kya kar sakta hai:\n\n🔧 JOBS - new jobs dekhein\n📝 CARD - Skill Card dekhein/share karein\n🎯 PRACTICE - Interview practice karein\n📊 STATUS - apna status dekhein\n🚫 STOP - messages band karein',
    stopped: 'Theek hai, proactive messages band kar diye gaye hain. Phir shuru karna ho to START likhein.',
    status: ({ name, stepName, placementStatus, cardUrl }) =>
      `Status summary:\n👤 ${name ?? 'naam pending'}\n📍 Step: ${stepName}\n📊 Placement: ${placementStatus}\n${cardUrl ? `🔗 Card: ${cardUrl}` : ''}`,
    offTopic: 'Maaf karein, main sirf jobs aur career mein help karta hoon. Kya job dhoondhne mein help karoon?',
    empathetic:
      'Samajh sakta hoon - yeh time mushkil hota hai. Aap akele nahi hain.\n\nChaliye milkar ek nayi koshish karte hain - abhi fresh jobs dekhein?',
    voiceUnavailable: 'Voice note mila, lekin main saaf sun nahi paaya. Please wahi jawab text mein bhej dijiye.',
    placed: (name) => `🎊 Badhai ho ${name} ji! Yeh bahut badi baat hai.\n\nPehle din ke liye kuch tips chahiye?`,
    firstDayTips:
      '💼 Pehle din ke liye:\n✅ 15 minutes pehle pahunchein\n✅ zaroori tools/PPE saath rakhein\n✅ Supervisor ka naam poochhein\n✅ pehle din zyada observe karein\n✅ learning notes banaate rahein\n\nAll the best! Aap kar sakte hain.'
  },
  english: {
    welcomeNew:
      'Namaste! I am SaathiAI, your career companion. Have you completed a vocational course such as Electrician, Fitter, COPA, or another trade?',
    askName: 'What is your name?',
    askTradeDistrict: (name) =>
      `${name} ji, which trade did you study and which district do you live in? You can type or send a voice note.`,
    askMissingTrade: 'Please also tell me your trade, such as Electrician, Fitter, COPA, Welder, or Plumber.',
    askMissingDistrict: 'Which district do you live in?',
    askCertificate: 'Where did you complete this course: PMKVY, ITI, or somewhere else?',
    profileBasicsCaptured: ({ trade, district }) =>
      `Got it: ${trade} - ${district}.\n\nNow tell me where you completed this course: PMKVY, ITI, or somewhere else?`,
    confirmProfile: ({ name, trade, district, state, certificateType }) =>
      `Okay, I understood:\n\n👤 ${name}\n🔧 ${trade} - ${district}${state ? `, ${state}` : ''}\n🎓 ${certificateType}\n\nIs this correct?`,
    askCorrection: 'What should I change? Send the correct details in one message.',
    askSkills:
      'Now tell me what tasks you did during training. Anything you learned or practiced is useful. You can also send a voice note.',
    askMoreSkillDetail:
      'Please share a little more detail, such as where you worked during OJT or what you installed or repaired.',
    skillsSummary: (skills) =>
      `I noted these skills:\n${skills.map((skill) => `✅ ${skill}`).join('\n')}\n\nDo you want to add anything else?`,
    cardProcessing: 'Your Skill Card is being created...',
    cardReady: (url) =>
      `✅ Your Skill Card is ready!\n\n🔗 ${url}\n\nYou can share this link with employers. It includes the skills and certificate details collected from you.`,
    askJobsReady: 'Now shall I find jobs for you?',
    jobsLater: 'Okay. Whenever you want, type "JOBS" and I will match jobs for you.',
    noCardYet: 'Your Skill Card is not ready yet. Let us complete onboarding first.',
    noJobsFound: 'I could not find matching jobs for your trade and district right now. I saved your preference.',
    jobInterestPrompt: 'Which job are you interested in?',
    jobDeclineReason: 'No problem. What is the reason: too far, low salary, or something else?',
    jobDeclineSaved: 'Understood. I will tell you when new jobs come in.',
    applied: (employer) =>
      `✅ We sent your Skill Card to ${employer}.\n\nThey should contact you soon. Sometimes it takes 2-3 days.\n\nWould you like to practice for the interview?`,
    practiceIntro:
      'Let us start interview practice. I will ask questions like an interviewer. You can answer by voice note or text, and I will give feedback.\n\nReady? First question:',
    practiceDone:
      'Good work! Your practice is complete.\n\nOne tip: always give a specific example in the interview, not just "yes, I know it."\n\nAll the best. Type "PRACTICE" whenever you want to practice again.',
    practiceSkipped: 'Okay. Whenever you want to practice, type "PRACTICE".',
    help:
      'What SaathiAI can do:\n\n🔧 JOBS - see new jobs\n📝 CARD - view/share Skill Card\n🎯 PRACTICE - interview practice\n📊 STATUS - see your status\n🚫 STOP - stop messages',
    stopped: 'Okay, proactive messages are stopped. Type START if you want to begin again.',
    status: ({ name, stepName, placementStatus, cardUrl }) =>
      `Status summary:\n👤 ${name ?? 'name pending'}\n📍 Step: ${stepName}\n📊 Placement: ${placementStatus}\n${cardUrl ? `🔗 Card: ${cardUrl}` : ''}`,
    offTopic: 'Sorry, I can only help with jobs and career. Shall I help you find a job?',
    empathetic:
      'I understand. This phase can be difficult, and you are not alone.\n\nLet us try one practical next step together. Shall I look for fresh jobs?',
    voiceUnavailable: 'I received your voice note, but I could not hear it clearly. Please send the same answer as text.',
    placed: (name) => `🎊 Congratulations ${name} ji! That is a big step.\n\nWould you like first-day tips?`,
    firstDayTips:
      '💼 For your first day:\n✅ arrive 15 minutes early\n✅ carry required tools/PPE\n✅ ask for your supervisor name\n✅ observe carefully on day one\n✅ note what you learn\n\nAll the best. You can do this.'
  }
};

export function t(script = 'roman') {
  return {
    ...copy[script],
    labels: labels[script]
  };
}

export function withOptions(message, options = []) {
  if (options.length === 0) return message;
  return `${message}\n\n${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}`;
}
