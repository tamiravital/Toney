export interface QuestionOption {
  value: string;
  label: string;
  emoji: string;
}

export interface OnboardingQuestion {
  id: string;
  question: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

/**
 * Converts raw onboarding answers {questionId: answerValue} into
 * human-readable "Q → A" lines for the Strategist.
 * Handles both single-select (string) and multi-select (comma-separated) answers.
 */
export function formatAnswersReadable(answers: Record<string, string>): string {
  const lines: string[] = [];
  for (const q of questions) {
    const answerValue = answers[q.id];
    if (!answerValue) continue;

    if (q.multiSelect) {
      // Multi-select: value is comma-separated list of values
      const selectedValues = answerValue.split(',').map(v => v.trim()).filter(Boolean);
      const selectedLabels = selectedValues.map(v => {
        if (v.startsWith('other:')) return v.slice(6);
        const option = q.options.find(o => o.value === v);
        return option ? option.label : v;
      });
      if (selectedLabels.length > 0) {
        lines.push(`${q.question} → ${selectedLabels.map(l => `"${l}"`).join(', ')}`);
      }
    } else {
      const option = q.options.find(o => o.value === answerValue);
      if (option) {
        lines.push(`${q.question} → "${option.label}"`);
      }
    }
  }
  return lines.join('\n');
}

export const questions: OnboardingQuestion[] = [
  // Q1: Balance checking — proven tension signal
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

  // Q2: Stress response — what they DO, not how they feel (from intake form)
  {
    id: 'stress_response',
    question: 'When money stress hits, what do you actually do?',
    options: [
      { value: 'shut_down', label: 'Shut down and avoid it completely', emoji: '\u{1F6CC}' },
      { value: 'spend_more', label: 'Spend more to feel better', emoji: '\u{1F6CD}\u{FE0F}' },
      { value: 'obsess_numbers', label: 'Obsess over the numbers', emoji: '\u{1F4F1}' },
      { value: 'take_it_out', label: 'Take it out on the people around me', emoji: '\u{1F4A2}' },
      { value: 'power_through', label: 'Push harder — hustle, grind, earn', emoji: '\u{1F4AA}' },
      { value: 'give_away', label: 'Focus on helping someone else instead', emoji: '\u{1F49D}' },
    ],
  },

  // Q3: Self-receiving — spending on yourself
  {
    id: 'social_money',
    question: 'You want something for yourself \u2014 not a need, just something you\u2019d enjoy. You\u2026',
    options: [
      { value: 'buy_no_guilt', label: 'Buy it and enjoy it', emoji: '\u{1F60A}' },
      { value: 'buy_then_guilt', label: 'Buy it, then feel guilty about it', emoji: '\u{1F62C}' },
      { value: 'research_forever', label: 'Research it for weeks and probably never buy it', emoji: '\u{1F50D}' },
      { value: 'only_if_earned', label: "Only if I feel like I've earned it", emoji: '\u2696\uFE0F' },
      { value: 'spend_on_others', label: "I'd rather spend that money on someone else", emoji: '\u{1F381}' },
    ],
  },

  // Q4: Mirror question — what others see
  {
    id: 'money_identity',
    question: 'Be honest, people who know you would say\u2026',
    options: [
      { value: 'too_careful', label: '"You need to live a little"', emoji: '\u{1F510}' },
      { value: 'too_generous', label: '"You\u2019re too generous for your own good"', emoji: '\u{1F4B8}' },
      { value: 'head_in_sand', label: '"You don\u2019t deal with the money stuff"', emoji: '\u{1F3D6}\u{FE0F}' },
      { value: 'always_stressed', label: '"You worry about money way too much"', emoji: '\u{1F630}' },
      { value: 'big_spender', label: '"You spend like there\u2019s no tomorrow"', emoji: '\u2728' },
      { value: 'always_pays', label: '"You always have to be the one paying"', emoji: '\u{1F4B3}' },
    ],
  },

  // Q5: Frequency — how often money stress shows up
  {
    id: 'stress_frequency',
    question: 'How often does money stress actually show up in your life?',
    options: [
      { value: 'daily', label: 'Every single day', emoji: '\u{1F525}' },
      { value: 'few_week', label: 'A few times a week', emoji: '\u{1F4C5}' },
      { value: 'specific_triggers', label: 'Only around specific things (bills, payday, social events)', emoji: '\u{1F3AF}' },
      { value: 'rarely', label: "Rarely — but when it hits, it hits hard", emoji: '\u{1F329}\u{FE0F}' },
      { value: 'background', label: "It's a constant low hum I've learned to live with", emoji: '\u{1F50A}' },
    ],
  },

  // Q6: Strength-based — what they're already good at
  {
    id: 'money_strength',
    question: 'What\u2019s one thing you\u2019re actually good at with money?',
    options: [
      { value: 'generous', label: "I'm generous with the people I love", emoji: '\u{1F496}' },
      { value: 'earn_well', label: "I know how to earn it", emoji: '\u{1F4B0}' },
      { value: 'disciplined', label: "I'm disciplined when I set my mind to it", emoji: '\u{1F3CB}\u{FE0F}' },
      { value: 'bounce_back', label: "I always figure it out eventually", emoji: '\u{1F331}' },
      { value: 'nothing', label: "Honestly? I can't think of one", emoji: '\u{1F614}' },
    ],
  },

  // Q7: Goals — multi-select, what they want from coaching
  {
    id: 'goals',
    question: 'What would feel like progress?',
    multiSelect: true,
    options: [
      { value: 'spend_on_self', label: 'Feel okay spending on myself', emoji: '\u{1F381}' },
      { value: 'hard_convos', label: 'Have hard money conversations without fighting', emoji: '\u{1F4AC}' },
      { value: 'ask_worth', label: 'Ask for a raise or charge what I\u2019m worth', emoji: '\u{1F4AA}' },
      { value: 'mood_control', label: 'Stop letting money run my mood', emoji: '\u{1F3AF}' },
      { value: 'feel_in_control', label: 'Feel in control of my finances', emoji: '\u2705' },
      { value: 'feel_enough', label: 'Feel satisfied with what I have', emoji: '\u{1F33F}' },
      { value: 'other', label: 'Something else...', emoji: '\u270F\uFE0F' },
    ],
  },
];
