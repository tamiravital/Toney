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

export const questions: OnboardingQuestion[] = [
  {
    id: 'money_check',
    question: 'How do you relate to checking your bank balance?',
    options: [
      { value: 'avoid_it', label: "I'd rather not look", emoji: '\u{1F648}' },
      { value: 'obsess', label: 'I check constantly but it never helps', emoji: '\u{1F630}' },
      { value: 'track_tight', label: 'I track every dollar carefully', emoji: '\u{1F4CA}' },
      { value: 'only_when_needed', label: 'Only when I need to buy something', emoji: '\u{1F937}' },
      { value: 'check_normally', label: 'I check regularly and it feels fine', emoji: '\u2705' },
    ],
  },
  {
    id: 'unexpected_500',
    question: 'You get an unexpected $500. What\u2019s your first instinct?',
    options: [
      { value: 'save_all', label: 'Save every cent \u2014 you never know', emoji: '\u{1F3E6}' },
      { value: 'treat_self', label: 'Treat myself \u2014 I deserve it', emoji: '\u{1F381}' },
      { value: 'invest_fast', label: 'Put it to work \u2014 find an opportunity', emoji: '\u{1F4C8}' },
      { value: 'help_others', label: 'Help someone who needs it more', emoji: '\u{1F49D}' },
      { value: 'dont_think', label: "It'll disappear and I won't know where", emoji: '\u{1F32B}\u{FE0F}' },
    ],
  },
  {
    id: 'stress_trigger',
    question: 'What triggers your money stress most?',
    options: [
      { value: 'falling_behind', label: 'Feeling like others are ahead of me', emoji: '\u{1F3C3}' },
      { value: 'not_enough', label: 'Never having enough, no matter what', emoji: '\u{1F61F}' },
      { value: 'cant_say_no', label: 'Saying no to people I care about', emoji: '\u{1F494}' },
      { value: 'losing_control', label: 'Feeling out of control with spending', emoji: '\u{1F300}' },
      { value: 'cant_enjoy', label: 'Having money but not being able to enjoy it', emoji: '\u{1F512}' },
    ],
  },
  {
    id: 'social_money',
    question: 'When friends suggest something expensive, you\u2026',
    options: [
      { value: 'say_yes_regret', label: 'Say yes, figure it out later', emoji: '\u{1F62C}' },
      { value: 'cover_others', label: 'Offer to cover others, even if tight', emoji: '\u{1F932}' },
      { value: 'calculate', label: 'Internally calculate if I can afford it', emoji: '\u{1F9EE}' },
      { value: 'avoid_plans', label: 'Make an excuse to avoid the situation', emoji: '\u{1F6AA}' },
      { value: 'go_big', label: 'Go big \u2014 I want people to have a good time', emoji: '\u{1F389}' },
    ],
  },
  {
    id: 'money_decisions',
    question: 'When you need to make a money decision, you tend to\u2026',
    options: [
      { value: 'postpone', label: 'Put it off as long as possible', emoji: '\u23F0' },
      { value: 'overthink', label: 'Research endlessly, never feel ready', emoji: '\u{1F92F}' },
      { value: 'act_fast', label: "Act quickly \u2014 opportunities don't wait", emoji: '\u26A1' },
      { value: 'ask_others', label: 'Ask what others think I should do', emoji: '\u{1F5E3}\u{FE0F}' },
      { value: 'emotion_driven', label: 'Go with how I feel in the moment', emoji: '\u{1F4AB}' },
    ],
  },
  {
    id: 'money_identity',
    question: 'If someone close to you described your money behavior, they\u2019d say\u2026',
    options: [
      { value: 'too_careful', label: "You're too careful, you need to live a little", emoji: '\u{1F510}' },
      { value: 'too_generous', label: 'You give too much to everyone else', emoji: '\u{1F4B8}' },
      { value: 'head_in_sand', label: 'You stick your head in the sand', emoji: '\u{1F3D6}\u{FE0F}' },
      { value: 'always_stressed', label: "You're always stressed about money", emoji: '\u{1F630}' },
      { value: 'big_spender', label: 'You live large, maybe too large', emoji: '\u2728' },
    ],
  },
  {
    id: 'purchase_pattern',
    question: 'When you look at your recent purchases, what pattern do you notice?',
    options: [
      { value: 'unopened', label: "A lot of things I haven't opened or used", emoji: '\u{1F4E6}' },
      { value: 'impressive', label: 'Things that look great on social media', emoji: '\u{1F4F1}' },
      { value: 'opportunities', label: 'Investments, side projects, or "opportunities"', emoji: '\u{1F680}' },
      { value: 'for_others', label: 'Gifts and things for other people', emoji: '\u{1F381}' },
      { value: 'mostly_essentials', label: 'Mostly essentials \u2014 I rarely splurge', emoji: '\u{1F6D2}' },
    ],
  },
];
