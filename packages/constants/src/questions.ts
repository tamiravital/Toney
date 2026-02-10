export interface QuestionOption {
  value: string;
  label: string;
  emoji: string;
}

export interface OnboardingQuestion {
  id: string;
  question: string;
  options: QuestionOption[];
}

/**
 * Converts raw onboarding answers {questionId: answerValue} into
 * human-readable "Q → A" lines for the Strategist.
 */
export function formatAnswersReadable(answers: Record<string, string>): string {
  const lines: string[] = [];
  for (const q of questions) {
    const answerValue = answers[q.id];
    if (!answerValue) continue;
    const option = q.options.find(o => o.value === answerValue);
    if (option) {
      lines.push(`${q.question} → "${option.label}"`);
    }
  }
  return lines.join('\n');
}

export const questions: OnboardingQuestion[] = [
  {
    id: 'money_check',
    question: 'How do you feel about checking your bank balance?',
    options: [
      { value: 'avoid_it', label: "I'd rather not know", emoji: '\u{1F648}' },
      { value: 'obsess', label: "I check all the time but it doesn't help", emoji: '\u{1F630}' },
      { value: 'track_tight', label: 'I need to know exactly where every dollar is', emoji: '\u{1F4CA}' },
      { value: 'normal', label: 'I know roughly where I stand', emoji: '\u2705' },
      { value: 'dont_think', label: "Honestly, I don't think about it much", emoji: '\u{1F937}' },
      { value: 'depends_mood', label: 'Depends on how I feel that day', emoji: '\u{1F3B2}' },
    ],
  },
  {
    id: 'unexpected_500',
    question: 'You get an unexpected $500. What\u2019s your gut reaction?',
    options: [
      { value: 'save_all', label: "Don't touch it \u2014 save for when things go wrong", emoji: '\u{1F3E6}' },
      { value: 'treat_self', label: 'Finally, something nice for me', emoji: '\u{1F381}' },
      { value: 'invest_fast', label: 'Where can I put this to make more?', emoji: '\u{1F4C8}' },
      { value: 'help_others', label: 'I know someone who needs this more', emoji: '\u{1F49D}' },
      { value: 'dont_think', label: "It'll be gone before I even notice", emoji: '\u{1F32B}\u{FE0F}' },
    ],
  },
  {
    id: 'stress_trigger',
    question: 'Which of these keeps you up at night?',
    options: [
      { value: 'falling_behind', label: 'Everyone else seems to have it figured out', emoji: '\u{1F3C3}' },
      { value: 'not_enough', label: 'No matter what I do, it never feels like enough', emoji: '\u{1F61F}' },
      { value: 'cant_say_no', label: "I keep putting others' needs before mine", emoji: '\u{1F494}' },
      { value: 'losing_control', label: "I spend in ways I know I shouldn't", emoji: '\u{1F300}' },
      { value: 'cant_enjoy', label: "I have money but I'm afraid to use it", emoji: '\u{1F512}' },
    ],
  },
  {
    id: 'social_money',
    question: 'A friend suggests a dinner you can\u2019t really afford. You\u2026',
    options: [
      { value: 'go_anyway', label: "Go anyway \u2014 I'll deal with it later", emoji: '\u{1F62C}' },
      { value: 'cover_others', label: 'Go and probably end up paying for others too', emoji: '\u{1F932}' },
      { value: 'stress_whole_time', label: 'Go but stress about the bill the whole time', emoji: '\u{1F9EE}' },
      { value: 'avoid_plans', label: 'Make up an excuse not to go', emoji: '\u{1F6AA}' },
      { value: 'suggest_cheaper', label: 'Suggest somewhere cheaper', emoji: '\u{1F4AC}' },
    ],
  },
  {
    id: 'money_decisions',
    question: 'A big purchase is coming up. How do you handle it?',
    options: [
      { value: 'postpone', label: 'Avoid thinking about it until I have to', emoji: '\u23F0' },
      { value: 'overthink', label: 'Research for weeks and still feel unsure', emoji: '\u{1F92F}' },
      { value: 'act_fast', label: 'Just do it before I overthink it', emoji: '\u26A1' },
      { value: 'ask_others', label: 'Ask everyone I know what they think', emoji: '\u{1F5E3}\u{FE0F}' },
      { value: 'emotion_driven', label: 'Depends entirely on my mood that day', emoji: '\u{1F4AB}' },
    ],
  },
  {
    id: 'money_identity',
    question: 'Be honest, people who know you would say\u2026',
    options: [
      { value: 'too_careful', label: '"You need to live a little"', emoji: '\u{1F510}' },
      { value: 'too_generous', label: '"You\u2019re too generous for your own good"', emoji: '\u{1F4B8}' },
      { value: 'head_in_sand', label: '"You pretend money doesn\u2019t exist"', emoji: '\u{1F3D6}\u{FE0F}' },
      { value: 'always_stressed', label: '"You worry about money way too much"', emoji: '\u{1F630}' },
      { value: 'big_spender', label: '"You spend like there\u2019s no tomorrow"', emoji: '\u2728' },
    ],
  },
  {
    id: 'purchase_pattern',
    question: 'Look at your last few purchases. What do you see?',
    options: [
      { value: 'unopened', label: "Stuff I haven't even used yet", emoji: '\u{1F4E6}' },
      { value: 'impressive', label: 'Things I bought to feel a certain way', emoji: '\u{1F4F1}' },
      { value: 'opportunities', label: 'Courses, investments, side projects', emoji: '\u{1F680}' },
      { value: 'for_others', label: 'Mostly things for other people', emoji: '\u{1F381}' },
      { value: 'mostly_essentials', label: "Just the basics \u2014 I don't let myself get extras", emoji: '\u{1F6D2}' },
    ],
  },
];
