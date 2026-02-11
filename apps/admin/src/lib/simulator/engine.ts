import Anthropic from '@anthropic-ai/sdk';
import type { Profile, UserKnowledge, CoachMemory } from '@toney/types';
import { BASE_USER_PROMPT } from './presets';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-5-20250929';

// ============================================================
// User Agent — generates persona messages
// ============================================================
// This is a "4th agent" — an LLM that pretends to be a real person
// texting a money coaching app. The coaching logic itself runs
// through the admin chat route (same pipeline as mobile /api/chat).

export async function generateUserMessage(
  userPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const turnNumber = Math.floor(history.length / 2);

  let instruction: string;

  if (history.length === 0) {
    // First message — short, casual opener
    instruction = `Start the conversation. Write a SHORT first message (1 sentence max) like someone opening a chat app for the first time. Examples of tone: "hey", "so I signed up for this thing and idk", "hi... not really sure what to say lol". Be casual, imperfect, human.`;
  } else if (turnNumber <= 2) {
    // Early turns — still guarded, short replies
    instruction = `Continue the conversation. You're still warming up — keep it SHORT (1-2 sentences max). You might:
- Give a brief answer but not elaborate much ("yeah that's pretty much it", "I guess so")
- Deflect slightly ("haha idk it's not that deep", "I mean kind of?")
- Show mild engagement but not full vulnerability yet
Don't pour your heart out yet. Real people don't open up on turn ${turnNumber + 1}.`;
  } else if (turnNumber <= 5) {
    // Mid conversation — starting to open up
    instruction = `Continue the conversation. You're starting to feel more comfortable. You might:
- Give a longer answer (2-4 sentences) if the coach touched on something real
- Share a specific detail from your life (a specific purchase, a fight with someone, something that happened this week)
- Still deflect sometimes ("ok yeah but like that's just how it is right?")
- Occasionally just say "yeah" or "exactly" if the coach nailed it
Mix short and medium responses. Don't be consistently deep.`;
  } else {
    // Later turns — more open, but still human
    instruction = `Continue the conversation naturally. By now you might:
- Share something vulnerable if it feels earned (a specific memory, a fear, something you haven't told anyone)
- Push back on something the coach said that doesn't land ("idk that doesn't really feel like me", "I mean sure but that's not really what I meant")
- Negotiate coach suggestions ("hmm what about something more like...", "that's not quite it. maybe more like...")
- Still sometimes give short responses ("yes", "omg that", "exactly that")
- Reference something specific from earlier in the conversation
Vary your length. Not every message needs to be deep. Sometimes just "yeah" is the right response.`;
  }

  const messages: { role: 'user' | 'assistant'; content: string }[] = history.length === 0
    ? [{ role: 'user', content: instruction }]
    : [...history, { role: 'user', content: instruction }];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200, // Shorter max to discourage long AI-sounding messages
    temperature: 1.0, // Higher temp for more natural variance
    system: userPrompt,
    messages,
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

// ============================================================
// Helpers
// ============================================================

// ============================================================
// Character Synthesis — builds a rich persona from real user data
// ============================================================

export async function synthesizeCharacterProfile(
  profile: Partial<Profile>,
  userMessages: string[],
  userKnowledge: UserKnowledge[],
  coachMemories: CoachMemory[],
): Promise<string> {
  const messagesBlock = userMessages.length > 0
    ? `Here are their actual messages from the app (user messages only, chronological):\n\n${userMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}`
    : 'No messages available — use the profile data to infer character.';

  const intelBlock = userKnowledge.length > 0
    ? `Knowledge extracted from their sessions:\n${userKnowledge.map(k => `- [${k.category}] ${k.content}`).join('\n')}`
    : '';

  const memoriesBlock = coachMemories.length > 0
    ? `Things the coach remembers about them:\n${coachMemories.map(m => `- ${m.content}`).join('\n')}`
    : '';

  const profileBlock = `Profile data:
- Tension type: ${profile.tension_type || 'unknown'}
- Emotional why: "${profile.emotional_why || ''}"
- Tone preference: ${profile.tone || 5}/10
- Depth: ${profile.depth || 'balanced'}
- Life stage: ${profile.life_stage || 'unknown'}
- Income type: ${profile.income_type || 'unknown'}
- Relationship status: ${profile.relationship_status || 'unknown'}
- Learning styles: ${(profile.learning_styles || []).join(', ') || 'unknown'}`;

  const synthesisPrompt = `You are analyzing a real user's messages and profile from a money coaching app. Your job is to create a detailed character description that captures who this person REALLY is — how they text, what they care about, their specific life details, their personality quirks.

${profileBlock}

${messagesBlock}

${intelBlock}

${memoriesBlock}

Based on ALL of this, write a character description. Follow this exact format:

YOUR SPECIFIC CHARACTER — [their name or a fitting pseudonym], [inferred age], [inferred job/situation]:
- [Financial specifics: income, debt, savings, spending patterns — infer from their messages and profile]
- [Key relationships they've mentioned: partner, family, friends — use actual names if they used them]
- [Their texting style: message length, tone, vocabulary, filler words they actually use, punctuation habits]
- [Specific recent events or situations they've described]
- [Emotional patterns: what makes them open up, what makes them shut down, how they deflect]
- [Contradictions: things they say vs what they actually do]
- [What they're defensive about, what they're curious about]
- Specific recent thing: [the most recent concrete situation from their messages]

IMPORTANT RULES:
- Use details DIRECTLY from their messages. Don't invent life details they never mentioned.
- Match their ACTUAL texting style — if they use "lol" and "idk", note that. If they write in full sentences, note that.
- If they mentioned specific people by name, use those names.
- If they mentioned specific amounts ($), use those amounts.
- Keep it to 8-12 bullet points. Be specific, not generic.
- Do NOT include the base texting instructions (those are prepended separately).`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    temperature: 0.7,
    messages: [{ role: 'user', content: synthesisPrompt }],
  });

  const characterBlock = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  return `${BASE_USER_PROMPT}\n\n${characterBlock}`;
}

// ============================================================
// Helpers
// ============================================================

export function buildDefaultUserPrompt(profile: Partial<Profile>): string {
  return `You are a real person texting with a money coaching app on your phone. Your primary money tension is "${profile.tension_type || 'unknown'}".
${profile.emotional_why ? `When you signed up, you said: "${profile.emotional_why}"` : ''}

HOW REAL PEOPLE TEXT:
- Most messages are SHORT. 1-5 words is normal ("yeah", "I guess", "omg yes", "that's true")
- You type fast and imperfectly — occasional typos, no perfect punctuation, trailing off with "..."
- You use filler words: "like", "honestly", "I mean", "idk", "lol", "haha"
- You DON'T sound like a therapy client. You sound like someone texting a friend.
- When something lands, you might just say "yes" or "exactly" — you don't write a paragraph about it
- When something doesn't land, you deflect: "haha idk", "I mean maybe", "sure but like..."

EMOTIONAL PACING:
- You don't pour your heart out immediately. You warm up over many messages.
- Early on you're casual and guarded. You might even be a little skeptical.
- You open up gradually — IF the coach earns it. Not automatically.
- Sometimes you share something real and then pull back ("wait that came out wrong", "anyway it's whatever")

WHAT MAKES YOU REAL:
- You mention SPECIFIC things from your life: your rent, your coworker, what you bought last week, your mom
- You contradict yourself sometimes (say you're fine, then admit you're not)
- You change the subject when things get uncomfortable
- You sometimes respond to the coach's question with a different question
- You negotiate: "that doesn't feel right. maybe more like..."

NEVER:
- Never use clinical/therapy language ("I notice a pattern in my behavior")
- Never be perfectly self-aware about your issues
- Never write more than 3 sentences unless you're really sharing something big
- Never sound like an AI roleplaying a person
- NEVER use action narration like *laughs nervously*, *shifts uncomfortably*, *sighs*, *pauses*. Real people don't narrate their body language in texts. Just write the words they'd actually type.`;
}
