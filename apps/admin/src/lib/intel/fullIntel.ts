import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { runStrategist } from '@toney/coaching';
import type { Profile, BehavioralIntel, CoachMemory, Win, RewireCard, CoachingBriefing } from '@toney/types';
import type { StrategistOutput } from '@toney/coaching';
import {
  getAllUserMessages,
  saveProdBriefing,
  applyProdIntelUpdates,
  applyProdFocusCardPrescription,
  updateProdJourneyNarrative,
} from '@/lib/queries/intel';

// ────────────────────────────────────────────
// Daily summary prompt
// ────────────────────────────────────────────

const DAILY_SUMMARY_SYSTEM_PROMPT = `You are a coaching supervisor reviewing a day's worth of conversation between a money coaching AI and a user. Extract coaching-relevant observations.

Output a structured summary covering:
- THEMES: What money topics came up today
- EMOTIONAL MOMENTS: When did the user show genuine emotion, vulnerability, or energy?
- RESISTANCE: Where did the user deflect, minimize, change subject, or push back?
- BREAKTHROUGHS: Any "aha" moments, new self-awareness, or shifts?
- COACHING APPROACHES: What the coach tried — what landed, what didn't
- LIFE DETAILS: Specific facts revealed (people, amounts, situations, events)
- LANGUAGE: Notable phrases, vocabulary, emotional words the user used

Be specific and use direct quotes where meaningful. Keep each section to 2-4 bullet points.
If a section has nothing notable, write "None observed."
Aim for 200-400 words total.`;

// ────────────────────────────────────────────
// Step 1: Summarize messages by day
// ────────────────────────────────────────────

interface DaySummary {
  date: string;
  messageCount: number;
  summary: string;
}

export async function summarizeMessagesByDay(
  userId: string,
  onProgress: (msg: string) => void,
): Promise<DaySummary[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  onProgress('Loading conversation history...');
  const messages = await getAllUserMessages(userId);

  if (messages.length === 0) {
    throw new Error('No messages found for this user');
  }

  // Group messages by calendar day
  const messagesByDay = new Map<string, typeof messages>();
  for (const msg of messages) {
    const day = msg.created_at.split('T')[0];
    if (!messagesByDay.has(day)) messagesByDay.set(day, []);
    messagesByDay.get(day)!.push(msg);
  }

  const days = Array.from(messagesByDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  onProgress(`Found ${messages.length} messages across ${days.length} days`);

  const summaries: DaySummary[] = [];

  for (let i = 0; i < days.length; i++) {
    const [date, dayMessages] = days[i];
    onProgress(`Summarizing day ${i + 1} of ${days.length} (${date})...`);

    // Format messages for the prompt
    const transcript = dayMessages
      .map(m => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
      .join('\n\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 600,
      temperature: 0.3,
      system: DAILY_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Date: ${date}\n\n${transcript}` }],
    });

    const summary = response.content[0].type === 'text' ? response.content[0].text : '';
    summaries.push({ date, messageCount: dayMessages.length, summary });
  }

  return summaries;
}

// ────────────────────────────────────────────
// Step 2: Run full intel pipeline
// ────────────────────────────────────────────

export async function runFullIntel(
  userId: string,
  onProgress: (msg: string) => void,
): Promise<StrategistOutput> {
  // Step 1: Summarize by day
  const dailySummaries = await summarizeMessagesByDay(userId, onProgress);

  // Format summaries as a single document
  const summaryDocument = dailySummaries
    .map(s => `=== ${s.date} (${s.messageCount} messages) ===\n${s.summary}`)
    .join('\n\n---\n\n');

  onProgress('Loading profile and existing data...');
  const supabase = createAdminClient();

  // Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) throw new Error('Profile not found');

  // Load existing data (likely empty for imported users)
  let behavioralIntel: BehavioralIntel | null = null;
  try {
    const { data } = await supabase
      .from('behavioral_intel')
      .select('*')
      .eq('user_id', userId)
      .single();
    behavioralIntel = data as BehavioralIntel | null;
  } catch { /* none yet */ }

  let coachMemories: CoachMemory[] = [];
  try {
    const { data } = await supabase
      .from('coach_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('importance', { ascending: true })
      .limit(30);
    coachMemories = (data || []) as CoachMemory[];
  } catch { /* none */ }

  let wins: Win[] = [];
  try {
    const { data } = await supabase
      .from('wins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    wins = (data || []).map((w: Record<string, unknown>) => ({
      id: w.id as string,
      text: w.text as string,
      tension_type: w.tension_type as string | null,
      date: w.created_at ? new Date(w.created_at as string) : undefined,
    })) as Win[];
  } catch { /* none */ }

  let rewireCards: RewireCard[] = [];
  try {
    const { data } = await supabase
      .from('rewire_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    rewireCards = (data || []) as RewireCard[];
  } catch { /* none */ }

  let previousBriefing: CoachingBriefing | null = null;
  try {
    const { data } = await supabase
      .from('coaching_briefings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    previousBriefing = data as CoachingBriefing | null;
  } catch { /* none */ }

  // Step 2: Run Strategist with daily summaries as transcript
  onProgress('Running Strategist analysis...');
  const result = await runStrategist({
    profile: profile as Profile,
    behavioralIntel,
    coachMemories,
    wins,
    rewireCards,
    previousBriefing,
    observerSignals: [],
    sessionTranscript: [{ role: 'user', content: summaryDocument }],
    isFirstBriefing: !previousBriefing,
  });

  // Step 3: Save everything to production tables
  onProgress('Saving intel...');
  await saveProdBriefing(userId, null, result);
  await applyProdIntelUpdates(userId, result);
  await applyProdFocusCardPrescription(userId, result);
  await updateProdJourneyNarrative(userId, result);

  onProgress('Complete!');
  return result;
}
