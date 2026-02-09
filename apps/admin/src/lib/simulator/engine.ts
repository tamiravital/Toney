import Anthropic from '@anthropic-ai/sdk';
import type { Profile } from '@toney/types';

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
- Never sound like an AI roleplaying a person`;
}
