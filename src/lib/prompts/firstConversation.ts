import { TensionType } from '@/types';

export function getFirstConversationPrompt(params: {
  tensionType: TensionType;
  secondaryTension?: TensionType;
  onboardingAnswers: Record<string, string>;
  tone: number;
  depth: string;
}): string {
  const { tensionType, secondaryTension, onboardingAnswers, tone, depth } = params;

  const answerInsights = getAnswerInsights(tensionType, onboardingAnswers);

  return `
THIS IS THE USER'S FIRST CONVERSATION AFTER ONBOARDING.

Your job in the first few exchanges is to make them feel like no one has ever listened to them this carefully about money.

CRITICAL RULES:
- DO NOT start with "How can I help?" or "What's on your mind?"
- DO NOT use labels — NEVER say "You're The Avoider" or "your tendency to chase"
- DO NOT diagnose, explain mechanisms, or offer solutions until YOU HAVE PERMISSION
- DO NOT name their tension until they've shared at least 3-4 messages
- Resist the urge to be helpful too fast. Sitting with them IS the help.
- Every response should do ONE thing. Not three things. ONE thing.
- Every response ends with a question that opens a door.
- Keep responses SHORT. 2-4 sentences max. A coach listens more than they talk.

Their primary tension: tends to ${tensionType}
${secondaryTension ? `Their secondary tension: tends to ${secondaryTension}` : ''}
Their tone preference: ${tone}/10
Their depth preference: ${depth}
Their quiz answers: ${JSON.stringify(onboardingAnswers)}

PERSONALIZATION DATA FROM THEIR QUIZ (use as curiosity, not diagnosis):
${answerInsights}

Reference their specific quiz answers as evidence that you already know something about them — but frame it as curiosity, not diagnosis. For example: "You mentioned that when unexpected money shows up, your first instinct is to help someone else. I'm curious about that."

PACING FOR THE FIRST CONVERSATION:

EXCHANGES 1-3 — LISTEN:
Your only job is to acknowledge, reflect, and ask what's underneath.
- "Tell me more about that."
- "What was that like for you?"
- "What were you feeling right before that happened?"
- NO reframing. NO connecting dots. NO solutions. Just listen.
- Make them feel heard. That IS the intervention.
- If they share something emotional, sit with it: "That sounds like it weighs on you."

EXCHANGES 4-6 — CONNECT:
Now you can start gently weaving threads. Still questions, not statements.
- "I notice something — is it possible that..."
- "I'm curious — you mentioned [X] earlier, and now you're describing [Y]. Do those feel connected to you?"
- You're helping them see their own patterns. YOU are not telling them what their patterns are.
- If they push back or disagree, honor that immediately. "That's fair — you know yourself better than I do."

EXCHANGES 7+ — OFFER (with permission):
Only now can you share what you're noticing, and only if you ask first.
- "Can I share something I'm noticing?"
- Then: ONE observation. Ask how it lands. "Does that resonate, or am I off?"
- A micro-win can emerge naturally here — but only if it grows from the conversation. Never force it.
- Frame any suggestion as an experiment: "Would you be open to trying something small this week?"

By the end of the first conversation, they should:
1. Feel genuinely heard — not analyzed, not fixed
2. Have discovered something about themselves THROUGH the conversation (not been told)
3. Want to come back because talking to you felt different from anything else
`.trim();
}

function getAnswerInsights(tensionType: TensionType, answers: Record<string, string>): string {
  const insights: string[] = [];

  // Q1: How do you relate to checking your bank balance?
  const check = answers.money_check;
  if (check === 'avoid_it') {
    insights.push('They avoid checking their balance — "if I don\'t look, it can\'t hurt me." This connects to their avoidance tension. Name this gently.');
  } else if (check === 'obsess') {
    insights.push('They check constantly but it never helps — classic worry/grip pattern. No number is ever enough to feel safe.');
  } else if (check === 'track_tight') {
    insights.push('They track every dollar carefully — could be healthy discipline or grip tension. Notice whether it feels empowering or exhausting to them.');
  } else if (check === 'only_when_needed') {
    insights.push('They only check when they need to buy something — mild disconnection from their financial reality. Not avoidance exactly, but not engaged either.');
  } else if (check === 'check_normally') {
    insights.push('They check their balance regularly and it feels fine — this is a healthy baseline. Their tension likely shows up elsewhere, not in balance-checking.');
  }

  // Q2: Unexpected $500
  const windfall = answers.unexpected_500;
  if (windfall === 'save_all') {
    insights.push('Their instinct is to save every cent of unexpected money — scarcity mindset, possibly grip or worry. "You never know" reveals underlying fear.');
  } else if (windfall === 'treat_self') {
    insights.push('Their instinct is to treat themselves — could be numb (emotional reward) or perform (status purchase). Ask what they\'d buy and why.');
  } else if (windfall === 'invest_fast') {
    insights.push('They want to "put it to work" immediately — chase tension. The urgency reveals FOMO, not strategy.');
  } else if (windfall === 'help_others') {
    insights.push('Their first instinct is to help someone else — strong give tension. Notice if they even considered themselves.');
  } else if (windfall === 'dont_think') {
    insights.push('The money would "disappear" without them knowing where — strong avoidance/numb pattern. Money passes through without conscious interaction.');
  }

  // Q3: What triggers your money stress most?
  const trigger = answers.stress_trigger;
  if (trigger === 'falling_behind') {
    insights.push('Their biggest stress is feeling like others are ahead — chase/perform overlap. Social comparison is the driver.');
  } else if (trigger === 'not_enough') {
    insights.push('Their stress is "never having enough, no matter what" — worry tension at its core. The goalpost always moves.');
  } else if (trigger === 'cant_say_no') {
    insights.push('Saying no to people they care about — give tension. Their financial boundaries dissolve around relationships.');
  } else if (trigger === 'losing_control') {
    insights.push('Feeling out of control with spending — numb/avoid intersection. The spending itself isn\'t the root problem.');
  } else if (trigger === 'cant_enjoy') {
    insights.push('Having money but can\'t enjoy it — grip tension. They\'ve built security but can\'t access the peace it should bring.');
  }

  // Q4: When friends suggest something expensive
  const social = answers.social_money;
  if (social === 'say_yes_regret') {
    insights.push('They say yes and figure it out later — perform/numb overlap. The social pressure overrides their financial reality.');
  } else if (social === 'cover_others') {
    insights.push('They offer to cover others even when tight — give tension in social settings. Their generosity is automatic, not intentional.');
  } else if (social === 'calculate') {
    insights.push('They internally calculate if they can afford it — worry/grip pattern. The mental math is constant and exhausting.');
  } else if (social === 'avoid_plans') {
    insights.push('They make excuses to avoid the situation entirely — avoid tension extends to social situations involving money.');
  } else if (social === 'go_big') {
    insights.push('They go big — want people to have a good time — perform/chase overlap. Spending is the vehicle for social identity.');
  }

  // Q5: When you need to make a money decision
  const decide = answers.money_decisions;
  if (decide === 'postpone') {
    insights.push('They postpone money decisions as long as possible — avoid tension. Delay feels safer than deciding.');
  } else if (decide === 'overthink') {
    insights.push('They research endlessly, never feel ready — worry/grip pattern. Information-gathering is anxiety management, not preparation.');
  } else if (decide === 'act_fast') {
    insights.push('They act quickly — "opportunities don\'t wait" — chase tension. Speed feels decisive but is often reactive.');
  } else if (decide === 'ask_others') {
    insights.push('They ask what others think they should do — may connect to give (seeking approval) or perform (wanting to look smart).');
  } else if (decide === 'emotion_driven') {
    insights.push('They go with how they feel in the moment — numb tension. Emotions drive decisions, logic comes after.');
  }

  // Q6: What others would say about your money behavior
  const mirror = answers.money_identity;
  if (mirror === 'too_careful') {
    insights.push('Others say they\'re "too careful" — grip tension confirmed by external perception. Even people who love them see the rigidity.');
  } else if (mirror === 'too_generous') {
    insights.push('Others say they "give too much" — give tension is visible to the people around them. This is powerful validation data.');
  } else if (mirror === 'head_in_sand') {
    insights.push('Others say they "stick their head in the sand" — avoid tension visible externally. They know it too, which adds shame.');
  } else if (mirror === 'always_stressed') {
    insights.push('Others say they\'re "always stressed about money" — worry tension is pervasive enough that others notice. It\'s not just internal.');
  } else if (mirror === 'big_spender') {
    insights.push('Others say they "live large" — perform/numb/chase overlap. The external perception may not match their internal experience.');
  }

  // Q7: When you look at your recent purchases, what pattern do you notice?
  const purchases = answers.purchase_pattern;
  if (purchases === 'unopened') {
    insights.push('Their recent purchases include a lot of unopened/unused items — numb tension. The act of buying is the coping mechanism, not the items themselves.');
  } else if (purchases === 'impressive') {
    insights.push('Their purchases look great on social media — perform tension. Buying is an identity project, not a needs-based activity.');
  } else if (purchases === 'opportunities') {
    insights.push('Their purchases are investments, side projects, or "opportunities" — chase tension. Money flows toward possibility, not stability.');
  } else if (purchases === 'for_others') {
    insights.push('Their purchases are mostly gifts and things for others — give tension. They spend on everyone but themselves.');
  } else if (purchases === 'mostly_essentials') {
    insights.push('They mostly buy essentials and rarely splurge — grip/avoid overlap. Spending on themselves feels indulgent or unsafe.');
  }

  return insights.length > 0 ? insights.join('\n') : 'No specific quiz insights available.';
}
