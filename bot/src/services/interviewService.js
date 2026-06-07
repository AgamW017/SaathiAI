const QUESTION_BANK = {
  electrician: [
    'Aapne kis tarah ka electrical work kiya hai? Ek real example dijiye.',
    'Agar kisi circuit mein fault aaye to aap kaise pehchanenge aur theek karenge?',
    '3-phase aur single-phase connection mein kya fark hota hai?',
    'Safety ke liye aap kya precautions lete hain?'
  ],
  fitter: [
    'Aapne kaun se machines par kaam kiya hai?',
    'Blueprint ya drawing padhna aata hai? Kaise use karte hain?',
    'Lathe machine par turning operation kaise karte hain?',
    'Measuring instruments mein kaunse use kiye hain aapne?'
  ],
  copa: [
    'Aap kaun se software use kar sakte hain?',
    'Data entry mein aapki speed kitni hai?',
    'Koi computer problem aai thi kabhi? Kaise solve ki?'
  ],
  default: [
    'Aapne training mein kaun sa practical kaam sabse accha seekha?',
    'Agar supervisor aapko naya task de, to aap kaise shuru karenge?',
    'Safety aur discipline ke liye aap kya dhyan rakhte hain?'
  ]
};

export class InterviewService {
  pickQuestions(trade) {
    const questions = QUESTION_BANK[normalize(trade)] ?? QUESTION_BANK.default;
    return questions.slice(0, 3);
  }

  currentQuestion(session) {
    const questions = session.interview?.questions ?? this.pickQuestions(session.collected?.trade);
    const index = session.interview?.currentIndex ?? 0;
    return questions[index] ?? null;
  }
}

function normalize(value = '') {
  return value.toString().trim().toLowerCase();
}
