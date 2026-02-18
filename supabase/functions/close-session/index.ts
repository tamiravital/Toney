// ────────────────────────────────────────────
// Supabase Edge Function: close-session
// ────────────────────────────────────────────
// Runs the full close pipeline (Haiku notes + Sonnet evolution + save).
// Called via fire-and-forget from Vercel routes after session ends.
// Supabase Edge Functions have 150s timeout (vs Vercel Hobby 10s).
//
// Auth: shared secret as Bearer token.
// Runtime: Deno — uses npm: specifiers for Node packages.

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.39";

// ── ENV ──
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const CLOSE_PIPELINE_SECRET = Deno.env.get("CLOSE_PIPELINE_SECRET")!;

// ── Models ──
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-5-20250929";

// ── Supabase client (service role — bypasses RLS) ──
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ────────────────────────────────────────────
// Prompts (copied from packages/coaching/)
// Deno Edge Functions can't resolve workspace deps.
// ────────────────────────────────────────────

const GROWTH_LENSES_DESCRIPTION = `Growth lenses (use as a thinking framework, not rigid categories):
- Self-receiving — Can they spend on themselves without guilt? Can they accept gifts, compliments about money, rest?
- Earning mindset — Do they believe they can generate income? Can they ask for what they're worth?
- Money identity — Do they see themselves as someone who can have, make, or manage money?
- Money relationships — Can they have healthy money conversations with partners, family, friends?
- Financial awareness — Do they know their numbers? Are they engaged with their finances or avoiding them?
- Decision confidence — Can they make money decisions without spiraling, overanalyzing, or freezing?
- Future orientation — Can they plan without anxiety or avoidance? Do they trust that the future will be okay?`;

const SESSION_NOTES_PROMPT = `You are writing session notes for Toney, an AI money coaching app. The user just finished a coaching session and will read these as their personal recap.

These notes are FOR THE USER. Write warmly, in second person. Make them feel heard and help them remember what happened. This is not a clinical report — it's a thoughtful summary from someone who was really listening.

## Output format (JSON):

\`\`\`json
{
  "headline": "One specific sentence capturing the core of what happened. Not generic ('We talked about spending') but reflective ('You connected your reluctance to spend on yourself to how your mom treated money as scarce').",
  "narrative": "2-3 short paragraphs. Second person, warm. The arc of the conversation — where it started, where it went, what shifted. Like a thoughtful friend summarizing what happened. Use their actual words and situations, not therapy-speak.",
  "keyMoments": ["Specific things the user said or realized that mattered — the 'oh wow' moments. Close to their actual words. 2-3 items. OMIT this field entirely if nothing stood out."],
  "milestone": "Optional. 5-15 word statement of the core shift or realization — the ONE thing that changed. Not a description of what happened, but a statement of what changed. Examples: 'Money as a canvas for my dreams', 'I am also safe in my being when I am wealthy', 'Named 6000 shekels from the wealthy woman inside'. Only include if there was a genuine shift or breakthrough. OMIT if the session was exploratory or a continuation without a distinct new realization."
}
\`\`\`

## Rules:
- The headline should be specific enough that reading it tomorrow, they remember what happened
- The narrative should feel like someone was really listening — not a summary, a reflection
- keyMoments: only include if there were genuine moments worth highlighting. If the session was casual or exploratory, omit this field. Don't manufacture moments.
- Do NOT include any "cardsCreated" field — saved cards are handled separately
- Don't invent insights that didn't happen
- Keep it concise — quality over length
- If you have context about who this person is (below), connect this session to their larger journey — reference known patterns, note progress. Keep it natural, not clinical.
- If you know the previous session headline, show movement or contrast — don't repeat it.
- If the session made progress on any of their focus areas, weave that into the narrative naturally. Name the focus area. Help them see their intentions becoming real.
- If wins were earned this session, they're the highlights — weave them into the narrative. These are moments where they interrupted their pattern. Don't just list them; help the user feel what they accomplished.`;

const EVOLVE_AND_SUGGEST_PROMPT = `You are the clinical intelligence behind Toney, an AI money coaching app. You maintain an evolving understanding of each person AND generate personalized session suggestions for their home screen.

You just observed a coaching session. You have TWO jobs:
1. EVOLVE the understanding narrative
2. GENERATE session suggestions based on the evolved understanding

---

## PART 1: EVOLVING THE UNDERSTANDING

Your job is to EVOLVE the understanding — not rewrite it from scratch.

### How to evolve:

1. **Keep what's still true.** Don't drop observations just because this session didn't mention them. A trigger identified 3 sessions ago is still a trigger unless new evidence contradicts it.

2. **Add what's new.** New triggers, breakthroughs, resistance patterns, vocabulary, life details, coaching observations — weave them in naturally.

3. **Deepen what you understand better.** If something you noted before got more nuanced this session, update the language to reflect your deeper understanding.

4. **Update what changed.** If something shifted — a resistance softened, a new pattern emerged that contradicts an old one, a life circumstance changed — revise accordingly. Note the shift when it's significant ("Previously avoided checking accounts entirely; now checks weekly without spiraling").

5. **Integrate, don't append.** The narrative should read as one coherent clinical picture, not session-by-session notes. No timestamps, no "in session 3 they said..." — just the current understanding.

### What to capture:

- **Their money tension** — how it manifests specifically for THEM, not just the label. What it looks like in their daily life.
- **Triggers** — specific situations that provoke emotional reactions around money (e.g., "partner bringing up vacation budget," not "money conversations")
- **Breakthroughs** — aha moments that stuck vs ones that were fleeting. What they connected.
- **Resistance patterns** — where coaching bounces off, how they deflect. What topics they intellectualize, avoid, or redirect from.
- **Emotional vocabulary** — words they actually use for money feelings, words they avoid, deflection phrases ("it's not a big deal," "I know I should")
- **Life context that matters** — relationships (use names when known), work situation, financial specifics they've shared, family history that's relevant
- **What coaching approaches work** — do they respond to direct naming? Somatic prompts? Humor? Reframing? What makes them shut down? What makes them light up? Note these as observations, NOT overrides of their stated preferences.
- **Where growth is available** — which dimensions are active, stabilizing, or not yet ready. Weave these assessments into the narrative naturally:
${GROWTH_LENSES_DESCRIPTION}
- **Stage of change** — where they are in the change process. This should be evident from the narrative itself.

---

## PART 2: SESSION SUGGESTIONS

Generate personalized session suggestions across four length categories. Each suggestion is a session the user would actually WANT to have — deeply specific to their story.

### Length categories:
- **quick** (2-5 min): A single focused moment. One question, one check-in, one follow-up on something specific.
- **medium** (5-10 min): An exploration. Connect two dots, apply a breakthrough to a new area, practice something.
- **deep** (10-15 min): Go to the root. Core wounds, family patterns, belief systems.
- **standing** (always available): Recurring entry points that are always relevant — personalized to their patterns.

### Suggestion rules:
1. MINIMUM 1 suggestion per length category, 6-10 total
2. Each must feel like something ONLY Toney could say to THIS person
3. Titles: 3-7 words, conversational, intriguing — NOT clinical or generic
4. Teasers: 1-2 sentences that make the person think "oh, I want to do that"
5. Don't suggest what was JUST covered in this session
6. Standing suggestions should reference their specific tension pattern
7. Write all user-facing text (title, teaser) in second person — "you," not "they"
8. At least one suggestion should BUILD ON a recent win — deepen or extend what's already working. If they won by checking their balance, suggest exploring what changed. Wins are proof of momentum — suggest sessions that ride it.
9. At least 1-2 suggestions should target a specific focus area — advancing the work on that named pain, not just referencing it. Include \`focus_area_text\` with the EXACT text of the focus area.
10. When a focus area is ready for reflection (2+ reflections, or dormant/not touched recently, or showing signs of shift/stuckness), generate 1+ standing "check-in" suggestions. These are about the pain itself: "You named this. Let's look at where you are with it." Standing = always available. Check-in titles should feel curious, not clinical: "Is 'feel in control' still the shape of it?" Check-in openingDirection should: name the focus area, reference its trajectory, ask how the pain feels now — has it shifted? Is it still the same shape? Include \`focus_area_text\`.
11. For EACH suggestion, write an \`opening_message\` — the actual 3-4 sentence opening the Coach would say to start this session. Second person, warm, specific to this person's story. This IS the Coach speaking directly to the user. Don't reference time-specific events or say "last time" — it should work whenever they pick it.

---

## PART 3: FOCUS AREA REFLECTIONS

For each active focus area that this session touched on (directly or indirectly), write a 1-3 sentence observation. These accumulate over time and show the person their own evolution.

Rules:
- Only include areas relevant to this session. Skip areas that weren't touched.
- Second person ("You..." not "She...") — these are shown directly to the user.
- Be specific — use what they actually said or did.
- Note movement when visible: "You used to [X] — now you're [Y]."
- Noting stuckness is okay: "You're still navigating [X], even as the desire to change grows."
- Don't force it — omit areas with nothing to say.

---

## PART 4: FOCUS AREA ACTIONS (only after check-in sessions)

If this session was clearly about checking in on a focus area AND the conversation resulted in a clear resolution, you may signal an action:

- **archive**: The user said this area is done, resolved, or no longer relevant. Only use when there's explicit signal from the user — not when YOU think it's done.
- **update_text**: The user wants to reframe this area — they articulated a better version. Include the new text exactly as they want it.

Rules:
- These are RARE. Most sessions, even check-ins, don't result in an action.
- Never archive a focus area just because the user is doing well at it — "maintenance" is not "done."
- Only act on explicit user signal, not your inference.
- Omit \`focus_area_actions\` entirely if no actions are warranted.

---

## Output format (JSON only, no other text):

\`\`\`json
{
  "understanding": "The full evolved narrative. 3-8 paragraphs. Clinical but warm. Third person. 300-800 words.",
  "stage_of_change": "Only if shifted THIS session. One of: precontemplation, contemplation, preparation, action, maintenance. Omit if unchanged.",
  "snippet": "One sentence (15-30 words) capturing the most salient observation RIGHT NOW. Third person.",
  "suggestions": [
    {
      "title": "string (3-7 words)",
      "teaser": "string (1-2 sentences)",
      "length": "quick|medium|deep|standing",
      "hypothesis": "string (coaching insight driving this suggestion)",
      "leveragePoint": "string (strength + goal + obstacle)",
      "curiosities": "string (what to explore)",
      "openingDirection": "string (how the Coach should open)",
      "opening_message": "string (3-4 sentences — the Coach's actual opening greeting)",
      "focus_area_text": "exact text of the focus area this targets, or omit if not focus-area-specific"
    }
  ],
  "focus_area_reflections": [
    {
      "focus_area_text": "exact text of the focus area",
      "reflection": "1-3 sentences, second person, specific"
    }
  ],
  "focus_area_actions": [
    {
      "focus_area_text": "exact text of the focus area",
      "action": "archive|update_text",
      "new_text": "only for update_text — the reframed text"
    }
  ]
}
\`\`\`

## Rules:
- Understanding: 300-800 words, third person, specific, no session timestamps.
- Suggestions: 6-10 total, at least 1 per length category.
- Be specific — their actual words, actual situations, actual reactions. Not categories or labels.
- If the session was short or casual, minimal evolution is fine. Don't manufacture depth.
- Never drop facts (names, amounts, life details) that haven't been contradicted.`;

// ────────────────────────────────────────────
// Formatting helpers (copied from packages/coaching/src/strategist/formatters.ts)
// ────────────────────────────────────────────

interface RewireCard {
  id?: string;
  title: string;
  category: string;
  times_completed?: number;
}

interface Win {
  id?: string;
  text: string;
  tension_type?: string | null;
  session_id?: string | null;
  focus_area_id?: string | null;
  created_at?: string | null;
  date?: string | null;
}

interface FocusArea {
  id: string;
  text: string;
  user_id?: string;
  source?: string;
  session_id?: string | null;
  archived_at?: string | null;
  created_at?: string | null;
  reflections?: { date: string; sessionId: string; text: string }[] | null;
}

interface SessionSuggestion {
  title: string;
  teaser: string;
  length: string;
  hypothesis: string;
  leveragePoint: string;
  curiosities: string;
  openingDirection: string;
  openingMessage?: string;
  focusAreaText?: string;
  focusAreaId?: string;
}

function formatToolkit(cards: RewireCard[]): string {
  if (!cards || cards.length === 0) return "No cards in toolkit yet.";
  return cards
    .map((c) => {
      let line = `- [${c.category}] "${c.title}"`;
      if (c.times_completed) line += ` — used ${c.times_completed}x`;
      return line;
    })
    .join("\n");
}

function formatWins(wins: Win[], focusAreas?: FocusArea[]): string {
  if (!wins || wins.length === 0) return "No wins logged yet.";

  const now = Date.now();
  const lines: string[] = [];

  lines.push(`Total: ${wins.length} wins`);
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = wins.filter((w) => {
    const d = w.created_at
      ? new Date(w.created_at).getTime()
      : w.date
        ? new Date(w.date).getTime()
        : 0;
    return d >= weekAgo;
  }).length;
  if (thisWeek > 0) lines.push(`This week: ${thisWeek}`);

  function formatSingleWin(w: Win): string {
    const d = w.created_at
      ? new Date(w.created_at)
      : w.date
        ? new Date(w.date)
        : null;
    let ago = "";
    if (d) {
      const days = Math.floor(
        (now - d.getTime()) / (1000 * 60 * 60 * 24),
      );
      ago =
        days === 0
          ? " (today)"
          : days === 1
            ? " (yesterday)"
            : ` (${days}d ago)`;
    }
    return `- "${w.text}"${ago}`;
  }

  const linked = wins.filter((w) => w.focus_area_id);
  const unlinked = wins.filter((w) => !w.focus_area_id);

  if (linked.length > 0 && focusAreas && focusAreas.length > 0) {
    const faMap = new Map(focusAreas.map((fa) => [fa.id, fa.text]));
    const groups = new Map<string, Win[]>();

    for (const w of linked) {
      const faId = w.focus_area_id!;
      if (!groups.has(faId)) groups.set(faId, []);
      groups.get(faId)!.push(w);
    }

    lines.push("");
    for (const [faId, groupWins] of groups) {
      const faText = faMap.get(faId) || "Unknown focus area";
      lines.push(`Focus area: "${faText}"`);
      for (const w of groupWins) {
        lines.push(`  ${formatSingleWin(w)}`);
      }
    }

    if (unlinked.length > 0) {
      lines.push("Unlinked:");
      for (const w of unlinked) {
        lines.push(formatSingleWin(w));
      }
    }
  } else {
    lines.push("");
    for (const w of wins) {
      lines.push(formatSingleWin(w));
    }
  }

  return lines.join("\n");
}

// ────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // ── Auth ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${CLOSE_PIPELINE_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Parse body ──
  let body: {
    sessionId: string;
    userId: string;
    isSimMode?: boolean;
    sessionNotes?: { headline?: string; keyMoments?: string[] };
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { sessionId, userId, isSimMode } = body;
  if (!sessionId || !userId) {
    return new Response(
      JSON.stringify({ error: "Missing sessionId or userId" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Table resolver (sim mode support) ──
  const t = (name: string) => (isSimMode ? `sim_${name}` : name);

  console.log(
    `[close-session] Starting pipeline for session ${sessionId.slice(0, 8)} (sim: ${!!isSimMode})`,
  );

  try {
    // ── Load all data in parallel ──
    const [
      messagesResult,
      profileResult,
      sessionCardsResult,
      allCardsResult,
      sessionResult,
      prevNotesResult,
      focusAreasResult,
      winsResult,
      prevSuggestionsResult,
    ] = await Promise.all([
      supabase
        .from(t("messages"))
        .select("role, content")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      supabase
        .from(t("profiles"))
        .select(
          "tension_type, stage_of_change, understanding",
        )
        .eq("id", userId)
        .single(),
      supabase
        .from(t("rewire_cards"))
        .select("title, category")
        .eq("session_id", sessionId),
      supabase
        .from(t("rewire_cards"))
        .select("id, title, category, times_completed")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from(t("sessions"))
        .select("hypothesis")
        .eq("id", sessionId)
        .maybeSingle(),
      supabase
        .from(t("sessions"))
        .select("session_notes")
        .eq("user_id", userId)
        .eq("session_status", "completed")
        .not("session_notes", "is", null)
        .neq("id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from(t("focus_areas"))
        .select("*")
        .eq("user_id", userId)
        .is("archived_at", null),
      supabase
        .from(t("wins"))
        .select("id, text, tension_type, session_id, focus_area_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from(t("session_suggestions"))
        .select("suggestions")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const messages = (messagesResult.data || []).map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }),
    );

    // ── Tiered close ──
    const userMessageCount = messages.filter(
      (m: { role: string }) => m.role === "user",
    ).length;

    if (userMessageCount === 0) {
      // Tier 0: delete empty session
      await supabase.from(t("sessions")).delete().eq("id", sessionId);
      console.log(`[close-session] Deleted empty session`);
      return new Response(JSON.stringify({ ok: true, tier: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (userMessageCount <= 2) {
      // Tier 1-2: light close
      await supabase
        .from(t("sessions"))
        .update({
          session_status: "completed",
          evolution_status: "completed",
          title: "Brief session",
        })
        .eq("id", sessionId);
      console.log(`[close-session] Light close (${userMessageCount} user msgs)`);
      return new Response(JSON.stringify({ ok: true, tier: userMessageCount }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Tier 3+: Full pipeline ──
    const tensionType = profileResult.data?.tension_type || null;
    const hypothesis = sessionResult.data?.hypothesis || null;
    const currentStageOfChange = profileResult.data?.stage_of_change || null;
    const currentUnderstanding = profileResult.data?.understanding || null;

    const savedCards = (sessionCardsResult.data || []).map(
      (c: { title: string; category: string }) => ({
        title: c.title,
        category: c.category,
      }),
    );

    const allCards = (allCardsResult.data || []) as RewireCard[];
    const recentWins = (winsResult.data || []) as Win[];
    const activeFocusAreas = (focusAreasResult.data || []) as FocusArea[];

    let previousHeadline: string | null = null;
    if (prevNotesResult.data?.session_notes) {
      try {
        const parsed = JSON.parse(prevNotesResult.data.session_notes);
        previousHeadline = parsed.headline || null;
      } catch {
        /* ignore */
      }
    }

    let previousSuggestionTitles: string[] = [];
    if (prevSuggestionsResult.data?.suggestions) {
      try {
        const prevSuggestions =
          typeof prevSuggestionsResult.data.suggestions === "string"
            ? JSON.parse(prevSuggestionsResult.data.suggestions)
            : prevSuggestionsResult.data.suggestions;
        if (Array.isArray(prevSuggestions)) {
          previousSuggestionTitles = prevSuggestions
            .map((s: { title?: string }) => s.title || "")
            .filter(Boolean);
        }
      } catch {
        /* ignore */
      }
    }

    const sessionWins = recentWins
      .filter((w) => w.session_id === sessionId)
      .map((w) => ({ text: w.text }));

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // ── Step 1: Session notes (Haiku) — only if not passed in body ──
    let sessionNotes: {
      headline: string;
      narrative: string;
      keyMoments?: string[];
      milestone?: string;
    };

    if (body.sessionNotes?.headline) {
      // Notes were already generated by Vercel route — reuse
      sessionNotes = {
        headline: body.sessionNotes.headline,
        narrative: "",
        keyMoments: body.sessionNotes.keyMoments,
      };
      console.log(`[close-session] Reusing session notes from caller`);
    } else {
      // Generate notes (Haiku)
      const transcript = messages
        .map(
          (m: { role: string; content: string }) =>
            `${m.role === "user" ? "USER" : "COACH"}: ${m.content}`,
        )
        .join("\n\n");

      const contextLines: string[] = [];
      if (tensionType) contextLines.push(`User's money tension: ${tensionType}`);
      if (hypothesis) contextLines.push(`Current coaching hypothesis: ${hypothesis}`);
      if (currentStageOfChange) contextLines.push(`Stage of change: ${currentStageOfChange}`);
      if (previousHeadline) contextLines.push(`Previous session headline: "${previousHeadline}"`);
      if (activeFocusAreas.length > 0) {
        contextLines.push(
          `Focus areas they're working on: ${activeFocusAreas.map((a) => `"${a.text}"`).join(", ")}`,
        );
      }
      if (sessionWins.length > 0) {
        contextLines.push(
          `Wins earned this session: ${sessionWins.map((w) => `"${w.text}"`).join(", ")}`,
        );
      }

      const contextSection =
        contextLines.length > 0
          ? `\n\nContext:\n${contextLines.join("\n")}\n\n`
          : "\n\n";

      const understandingSection = currentUnderstanding
        ? `## Who This Person Is\n${currentUnderstanding}\n\n`
        : "";

      const notesUserMessage = `Write session notes for this coaching session.${contextSection}${understandingSection}## Session Transcript\n\n${transcript}`;

      try {
        const notesResponse = await anthropic.messages.create({
          model: HAIKU_MODEL,
          max_tokens: 1000,
          temperature: 0.3,
          system: SESSION_NOTES_PROMPT,
          messages: [{ role: "user", content: notesUserMessage }],
        });

        const notesText =
          notesResponse.content[0].type === "text"
            ? notesResponse.content[0].text
            : "";
        const jsonMatch = notesText.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : notesText;

        const parsed = JSON.parse(jsonStr);
        sessionNotes = {
          headline: parsed.headline || "Session complete",
          narrative: parsed.narrative || "",
        };
        if (Array.isArray(parsed.keyMoments) && parsed.keyMoments.length > 0) {
          sessionNotes.keyMoments = parsed.keyMoments;
        }
        if (typeof parsed.milestone === "string" && parsed.milestone.trim()) {
          sessionNotes.milestone = parsed.milestone.trim();
        }

        // Save LLM usage
        try {
          await supabase.from(t("llm_usage")).insert({
            user_id: userId,
            session_id: sessionId,
            call_site: "session_close_notes",
            model: HAIKU_MODEL,
            input_tokens: notesResponse.usage.input_tokens,
            output_tokens: notesResponse.usage.output_tokens,
            cache_creation_input_tokens: (notesResponse.usage as Record<string, number>).cache_creation_input_tokens || 0,
            cache_read_input_tokens: (notesResponse.usage as Record<string, number>).cache_read_input_tokens || 0,
          });
        } catch { /* non-critical */ }
      } catch (err) {
        console.error("[close-session] Session notes generation failed:", err);
        sessionNotes = {
          headline: "Session complete",
          narrative: "Notes could not be generated for this session.",
        };
      }

      // Save notes to session
      await supabase
        .from(t("sessions"))
        .update({
          session_notes: JSON.stringify({
            headline: sessionNotes.headline,
            narrative: sessionNotes.narrative,
            ...(sessionNotes.keyMoments && { keyMoments: sessionNotes.keyMoments }),
            ...(savedCards.length > 0 && { cardsCreated: savedCards }),
            ...(sessionNotes.milestone && { milestone: sessionNotes.milestone }),
          }),
          session_status: "completed",
          evolution_status: "pending",
          title: sessionNotes.headline || "Session complete",
          narrative_snapshot: currentUnderstanding,
          ...(sessionNotes.milestone && { milestone: sessionNotes.milestone }),
        })
        .eq("id", sessionId);

      console.log(`[close-session] Session notes generated`);
    }

    // ── Step 2: Evolve understanding + generate suggestions (Sonnet) ──
    const transcript = messages
      .map(
        (m: { role: string; content: string }) =>
          `${m.role === "user" ? "USER" : "COACH"}: ${m.content}`,
      )
      .join("\n\n");

    const sections: string[] = [];

    if (currentUnderstanding) {
      sections.push(`## Current Understanding\n${currentUnderstanding}`);
    } else {
      sections.push(
        "## Current Understanding\nNo prior understanding — this is the first post-session evolution. Build a comprehensive picture from what the session revealed.",
      );
    }

    const ctxLines: string[] = [];
    if (tensionType) ctxLines.push(`Money tension: ${tensionType}`);
    if (hypothesis) ctxLines.push(`Hypothesis going into this session: ${hypothesis}`);
    if (currentStageOfChange) ctxLines.push(`Current stage of change: ${currentStageOfChange}`);
    if (ctxLines.length > 0) {
      sections.push(`## Context\n${ctxLines.join("\n")}`);
    }

    if (activeFocusAreas.length > 0) {
      const focusAreaLines = activeFocusAreas.map((a) => {
        let line = `- "${a.text}"`;
        if (a.reflections && a.reflections.length > 0) {
          line += ` (${a.reflections.length} reflections)`;
          const recent = a.reflections.slice(-2);
          for (const r of recent) {
            line += `\n  - ${r.text}`;
          }
        }
        if (a.created_at) {
          const daysOld = Math.floor(
            (Date.now() - new Date(a.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          line += `\n  Active for ${daysOld} days`;
        }
        return line;
      });
      sections.push(`## Active Focus Areas\n${focusAreaLines.join("\n")}`);
    }

    sections.push(`## Session Transcript\n\n${transcript}`);

    if (allCards.length > 0) {
      sections.push(
        `## Their Toolkit (for suggestion context)\n${formatToolkit(allCards)}`,
      );
    }
    if (recentWins.length > 0) {
      sections.push(
        `## Wins — Evidence of Real Change\nThese wins represent moments where this person INTERRUPTED their tension pattern. They are the strongest evidence of change.\n\nWhen evolving the understanding:\n- Reference specific wins as proof of growth ("Previously avoided checking accounts; now checks regularly without spiraling")\n- If a win contradicts a resistance pattern in the narrative, UPDATE the narrative\n- Note if wins are accelerating or diversifying\n\n${formatWins(recentWins, activeFocusAreas)}`,
      );
    }
    if (sessionNotes.headline && sessionNotes.headline !== "Session complete") {
      sections.push(
        `## This Session's Headline: "${sessionNotes.headline}"\n(Do NOT suggest sessions covering the same ground — suggest what comes NEXT.)`,
      );
      if (sessionNotes.keyMoments && sessionNotes.keyMoments.length > 0) {
        sections.push(
          `Key moments from this session:\n${sessionNotes.keyMoments.map((m) => `- "${m}"`).join("\n")}`,
        );
      }
    }
    if (previousSuggestionTitles.length > 0) {
      sections.push(
        `## Previous Suggestion Titles (avoid repeating these exactly)\n${previousSuggestionTitles.map((t) => `- "${t}"`).join("\n")}`,
      );
    }

    const evolveUserMessage = `Evolve the understanding based on this session, then generate session suggestions.\n\n${sections.join("\n\n")}`;

    let evolvedUnderstanding = currentUnderstanding || "";
    let evolvedSnippet: string | null = null;
    let evolvedStageOfChange: string | null = null;
    let suggestions: SessionSuggestion[] = [];
    let focusAreaReflections: {
      focusAreaText: string;
      reflection: string;
    }[] = [];
    let focusAreaActions: {
      focusAreaText: string;
      action: string;
      newText?: string;
    }[] = [];

    try {
      const evolveResponse = await anthropic.messages.create({
        model: SONNET_MODEL,
        max_tokens: 5000,
        temperature: 0.3,
        system: EVOLVE_AND_SUGGEST_PROMPT,
        messages: [{ role: "user", content: evolveUserMessage }],
      });

      const evolveText =
        evolveResponse.content[0].type === "text"
          ? evolveResponse.content[0].text
          : "";
      const jsonMatch = evolveText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : evolveText;

      const parsed = JSON.parse(jsonStr);

      evolvedUnderstanding = parsed.understanding || currentUnderstanding || "";

      if (parsed.stage_of_change && typeof parsed.stage_of_change === "string") {
        evolvedStageOfChange = parsed.stage_of_change;
      }

      if (parsed.snippet && typeof parsed.snippet === "string") {
        evolvedSnippet = parsed.snippet;
      }

      if (Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions.map(
          (s: Record<string, unknown>) => ({
            title: String(s.title || ""),
            teaser: String(s.teaser || ""),
            length: ["quick", "medium", "deep", "standing"].includes(
              String(s.length),
            )
              ? String(s.length)
              : "medium",
            hypothesis: String(s.hypothesis || ""),
            leveragePoint: String(
              s.leveragePoint || s.leverage_point || "",
            ),
            curiosities: String(s.curiosities || ""),
            openingDirection: String(
              s.openingDirection || s.opening_direction || "",
            ),
            openingMessage: s.opening_message ? String(s.opening_message) : undefined,
            focusAreaText: s.focus_area_text
              ? String(s.focus_area_text)
              : undefined,
          }),
        );
      }

      if (Array.isArray(parsed.focus_area_reflections)) {
        focusAreaReflections = parsed.focus_area_reflections
          .filter(
            (r: Record<string, unknown>) => r.focus_area_text && r.reflection,
          )
          .map((r: Record<string, unknown>) => ({
            focusAreaText: String(r.focus_area_text),
            reflection: String(r.reflection),
          }));
      }

      if (Array.isArray(parsed.focus_area_actions)) {
        focusAreaActions = parsed.focus_area_actions
          .filter(
            (a: Record<string, unknown>) => a.focus_area_text && a.action,
          )
          .map((a: Record<string, unknown>) => ({
            focusAreaText: String(a.focus_area_text),
            action: ["archive", "update_text"].includes(String(a.action))
              ? String(a.action)
              : "archive",
            newText: a.new_text ? String(a.new_text) : undefined,
          }));
      }

      // Save LLM usage
      try {
        await supabase.from(t("llm_usage")).insert({
          user_id: userId,
          session_id: sessionId,
          call_site: "session_close_evolve",
          model: SONNET_MODEL,
          input_tokens: evolveResponse.usage.input_tokens,
          output_tokens: evolveResponse.usage.output_tokens,
          cache_creation_input_tokens: (evolveResponse.usage as Record<string, number>).cache_creation_input_tokens || 0,
          cache_read_input_tokens: (evolveResponse.usage as Record<string, number>).cache_read_input_tokens || 0,
        });
      } catch { /* non-critical */ }

      console.log(
        `[close-session] Evolution complete: ${suggestions.length} suggestions`,
      );
    } catch (err) {
      console.error("[close-session] evolveAndSuggest failed:", err);
    }

    // ── Save results ──

    // Save evolved understanding to profile
    const profileUpdate: Record<string, unknown> = {
      understanding: evolvedUnderstanding,
      understanding_snippet: evolvedSnippet,
    };
    if (evolvedStageOfChange) {
      profileUpdate.stage_of_change = evolvedStageOfChange;
    }

    const { error: profileErr } = await supabase
      .from(t("profiles"))
      .update(profileUpdate)
      .eq("id", userId);
    if (profileErr) {
      console.error("[close-session] Profile update failed:", profileErr);
    }

    // Resolve focusAreaText → focusAreaId on suggestions
    if (suggestions.length > 0 && activeFocusAreas.length > 0) {
      for (const sug of suggestions) {
        if (sug.focusAreaText) {
          const match = activeFocusAreas.find(
            (a) => a.text === sug.focusAreaText,
          );
          if (match) sug.focusAreaId = match.id;
        }
      }
    }

    // Save suggestions (idempotency: check generated_after_session_id)
    if (suggestions.length > 0) {
      const { data: existingSugs } = await supabase
        .from(t("session_suggestions"))
        .select("id")
        .eq("generated_after_session_id", sessionId)
        .limit(1);

      if (!existingSugs || existingSugs.length === 0) {
        const { error: sugErr } = await supabase
          .from(t("session_suggestions"))
          .insert({
            user_id: userId,
            suggestions: suggestions,
            generated_after_session_id: sessionId,
          });
        if (sugErr) {
          console.error("[close-session] Suggestions save failed:", sugErr);
        }
      } else {
        console.log(`[close-session] Suggestions already exist — skipping`);
      }
    }

    // Save focus area reflections (idempotency: check sessionId in JSONB)
    if (focusAreaReflections.length > 0) {
      for (const ref of focusAreaReflections) {
        const match = activeFocusAreas.find(
          (a) => a.text === ref.focusAreaText,
        );
        if (!match) {
          console.warn(
            `[close-session] Focus area text mismatch: "${ref.focusAreaText}"`,
          );
          continue;
        }
        const existing = match.reflections || [];
        // Idempotency: skip if this session already has a reflection
        if (existing.some((r) => r.sessionId === sessionId)) continue;

        const { error: refErr } = await supabase
          .from(t("focus_areas"))
          .update({
            reflections: [
              ...existing,
              {
                date: new Date().toISOString(),
                sessionId,
                text: ref.reflection,
              },
            ],
          })
          .eq("id", match.id);
        if (refErr) {
          console.error(
            "[close-session] Focus area reflection save failed:",
            refErr,
          );
        }
      }
    }

    // Apply focus area actions
    if (focusAreaActions.length > 0) {
      for (const action of focusAreaActions) {
        const match = activeFocusAreas.find(
          (a) => a.text === action.focusAreaText,
        );
        if (!match) {
          console.warn(
            `[close-session] Focus area action text mismatch: "${action.focusAreaText}"`,
          );
          continue;
        }

        if (action.action === "archive") {
          await supabase
            .from(t("focus_areas"))
            .update({ archived_at: new Date().toISOString() })
            .eq("id", match.id);
        } else if (action.action === "update_text" && action.newText) {
          // Archive old, create new with reframed text + carry over reflections
          await supabase
            .from(t("focus_areas"))
            .update({ archived_at: new Date().toISOString() })
            .eq("id", match.id);
          await supabase.from(t("focus_areas")).insert({
            user_id: userId,
            text: action.newText,
            source: "coach",
            session_id: sessionId,
            reflections: match.reflections || [],
          });
        }
      }
    }

    // Mark evolution as completed
    await supabase
      .from(t("sessions"))
      .update({ evolution_status: "completed" })
      .eq("id", sessionId);

    console.log(
      `[close-session] Pipeline complete for ${sessionId.slice(0, 8)}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        tier: 3,
        suggestionsCount: suggestions.length,
        reflectionsCount: focusAreaReflections.length,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[close-session] Fatal error:", err);

    // Mark evolution as failed
    try {
      await supabase
        .from(t("sessions"))
        .update({ evolution_status: "failed" })
        .eq("id", sessionId);
    } catch {
      /* last resort */
    }

    return new Response(
      JSON.stringify({ error: "Pipeline failed", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
