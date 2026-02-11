# Toney — Decision Log

Architectural, product, and technical decisions. Newest first.

---

### Unified prepareSession() replaces two Strategist paths (2026-02-11)
The old system had `generateInitialBriefing()` for first sessions and `planSession()` for returning sessions — two completely different LLM prompts, different output shapes, different code paths. This meant changes to coaching strategy had to be applied in two places, and the first session experience was architecturally different from every subsequent session. The new `prepareSession()` handles all sessions with one LLM call. First session is detected by `!previousBriefing && (!userKnowledge || userKnowledge.length === 0)`. Inputs simply grow richer over time — first session gets quiz answers + goals, returning sessions also get knowledge entries, previous briefing, wins, and session notes. Same prompt, same output shape, same code path.

### user_knowledge replaces behavioral_intel + coach_memories (2026-02-11)
`behavioral_intel` stored coaching intelligence as unbounded arrays (triggers[], breakthroughs[], resistance_patterns[]) in a single row per user. Problems: no provenance (which session produced which trigger?), no deduplication (naive string comparison), no importance ranking, no expiration, arrays grow forever. `coach_memories` was a separate table with similar goals but different shape. Replaced both with `user_knowledge`: one row per knowledge entry, tagged with category, source, importance, session_id, and active flag. Dedup is code-level (skip if identical content+category already exists). Old tables kept during transition — chat route's legacy fallback still reads `behavioral_intel` for users without a briefing.

### Narrative-first briefing fields (2026-02-11)
Replaced `session_strategy` ("what to do this session") and `journey_narrative` ("their story arc") with three new fields: `tension_narrative` (evolving understanding of their pattern — deeper than a label), `leverage_point` (their strength + their goal + what's in the way — the fulcrum for change), and `curiosities` (what the Coach should explore — open questions, not directives). The old fields were prescriptive — telling the Coach what to do. The new fields are generative — giving the Coach material to think with.

### Promise.allSettled in close pipeline (2026-02-11)
Changed `closeSessionPipeline` from `Promise.all` to `Promise.allSettled` for the parallel notes + reflection calls. If session notes fail (Haiku error), the reflection should still save knowledge entries — and vice versa. With `Promise.all`, one failure killed both. The cost is slightly more complex result handling (check `.status === 'fulfilled'`), but session close is the most failure-prone point in the system (two LLM calls + multiple DB writes).

### Delete v1 extraction package (2026-02-11)
`packages/coaching/src/extraction/` (intelExtractor.ts, betaAnalyzer.ts, index.ts) was the v1 intel system: Sonnet-based, ran every 5th message mid-session, extracted behavioral intel via `extractBehavioralIntel()` + `mergeIntel()`. Completely superseded by v2: `reflectOnSession()` (Haiku, post-session) + `updatePersonModel()` (pure code merge). The extraction functions were still exported from `@toney/coaching` but only consumed by the now-deleted `/api/extract-intel` and `/api/migrate-b44` routes. Removed exports and deleted entire directory.

### Remove dead legacy routes and hooks (2026-02-11)
Deleted 3 dead API routes and 1 unused hook:
- `/api/strategist` — superseded by `/api/session/open` which calls `planSessionStep()`. Comment in the file said "will be replaced by planSession" — it was.
- `/api/extract-intel` — the old "every 5th message" Sonnet extraction. Replaced by `reflectOnSession()` + `updatePersonModel()` at session close.
- `/api/migrate-b44` — one-time data migration route, already executed. Was triggered from auth callback on specific email.
- `useBehavioralIntel` hook — exported from hooks/index.ts but never imported by any component. Intel merge is now server-side.
All were identified by tracing call sites from the pipeline architecture — nothing routes to these endpoints.

### Remove dead FocusCardPrescription (2026-02-11)
`FocusCardPrescription` was an interface and field on `StrategistOutput` that was never populated: the LLM prompt didn't ask for it, the XML parser didn't extract it, and `focus_card_prescription` was always `undefined`. Both consumer functions (`applySimFocusCardPrescription` in simulator, `applyProdFocusCardPrescription` in intel) always hit `if (!prescription) return`. Removed the interface, the field, both consumer functions, and all import/call sites. Cards are co-created in chat now, not prescribed by the Strategist.

### Shared constants for growth lenses and tension guidance (2026-02-11)
`GROWTH_LENSES` and `TENSION_GUIDANCE` were copy-pasted in `strategist.ts` and `planSession.ts`, with lens names also hardcoded as a string in `reflect.ts`. Adding a growth lens required updating 3 files. Created `packages/coaching/src/strategist/constants.ts` as single source of truth: `GROWTH_LENS_NAMES` (typed array), `GROWTH_LENSES_DESCRIPTION` (detailed text), `TENSION_GUIDANCE` (per-tension coaching approach). All three files now import from constants. Adding a new lens (e.g., sufficiency_perception) requires changing one file.

### Fix growth edges merge bug (2026-02-11)
`reflectOnSession()` outputs growth edges as a per-lens map (Shape B: `{ self_receiving: "stabilizing", earning_mindset: "active" }`), but `planSession()` and the DB store bucket arrays (Shape A: `{ active: ["earning_mindset"], stabilizing: ["self_receiving"], not_ready: [...] }`). `updatePersonModel()` was doing a shallow merge (`{ ...existingEdges, ...reflectionUpdates }`) which produced a corrupted hybrid with orphan keys. `formatGrowthEdges()` in the prompt builder silently ignored the orphan keys, so reflections never actually updated growth edges. Fixed with `mergeGrowthEdges()` in personModel.ts: iterates per-lens updates, removes the lens from its current bucket, adds to target bucket. Also self-heals any previously corrupted DB data.

### Income-agnostic quiz: Q3 self-receiving replaces social money (2026-02-11)
The old Q3 ("A friend suggests a dinner you can't really afford") assumed financial constraint and was a dealbreaker for wealthy users. Q4 already covered social money dynamics, making Q3 redundant. Replaced with a self-receiving question ("You want something for yourself...") which feeds the self-receiving growth lens — previously invisible until session 2+. Question ID stays `social_money` to avoid breaking existing users' stored onboarding_answers JSONB. Old answer insights kept for backward compat.

### Hypothesis abandonment in Coach prompt (2026-02-11)
Added a CHECK YOUR MODEL block to the Coach's GATHER step. The Coach's initial hypothesis (from Strategist briefing) was treated as gospel — if wrong, users had to explicitly correct it multiple times. Now the Coach watches for misalignment signals: corrections, flat/disengaged answers, "yes but" steering, contradictions between assumptions and described reality. When detected, the Coach names the gap ("I might be looking at the wrong thing") and asks a reset question instead of doubling down. Not a timer ("every 3-4 exchanges") — a sensitivity. The Strategist prompt was also updated to frame hypotheses as testable propositions.

### No new tension type for "scarcity" (2026-02-11)
Considered adding a "scarcity" tension type for people who believe there's never enough even when financially secure. Rejected: scarcity is a belief that cuts across all tensions (worry runs from it, chase runs from it, grip hoards against it). Adding it would contaminate the behavioral taxonomy. Instead, sufficiency perception will be tracked as a growth lens (future work) and the Coach prompt now includes guidance to challenge the "more money" belief when evidence suggests the person is financially stable.

### Session notes: real saved cards, not LLM-extracted (2026-02-10)
The session notes LLM (Haiku) was reading [CARD:category]...[/CARD] markers in the transcript and reporting them as "Added to Rewire" — but the user might not have actually tapped "Save to Rewire". Now the session close API queries the rewire_cards table for the session and passes real saved cards to the notes generator. The LLM prompt no longer includes cardsCreated — it only generates headline, narrative, and keyMoments. Cards are data, not extraction.

### End Session: card saved OR 20+ messages, never first session (2026-02-10)
Replaced the old "show after 4 messages, disabled until card saved" pattern. New rules: End Session appears when the user saves a card OR exchanges 20+ messages — but never on their very first session unless a card is saved. First session is special: we want to ensure meaningful engagement (card creation) before allowing session end, since it sets the foundation. Subsequent sessions can end after enough conversation even without a card. The button is always active when visible — the disabled/grayed state was confusing.

### End Session: visible but disabled until card saved (2026-02-10)
The End Session button appears dimmed after 4+ messages, then highlights (indigo) and becomes clickable only after the user saves a card. This gives the button visibility as a hint without letting users end sessions before meaningful work happens. The Coach prompt also mentions ending after card creation. Tried card-gating (hidden until card saved) but it was confusing — users didn't know the button existed.

### Inline new session with message preservation (2026-02-10)
After ending a session, "New Session" replaces "Back to Home" as the primary CTA. Tapping it opens a new session inline — old messages stay visible with a "Session ended — Feb 10" divider line. This avoids the jarring experience of navigating to Home and back to Chat. Uses a 'divider' role on the Message type (client-side only, never saved to DB). The auto-open effect is suppressed during inline opens via skipMessageLoadRef.

### SSE streaming for all Coach responses (2026-02-10)
Converted both /api/chat and /api/session/open from blocking JSON responses to Server-Sent Events. Opening message streams while DB saves (briefing, intel, tension) run as fire-and-forget in parallel. Split openSessionPipeline into planSessionStep() (blocking Strategist call) + streaming opening message. Same SSE protocol (delta/done/error/session events) used by both endpoints. ~50% perceived latency reduction for first message.

### Absorb goals into quiz as Q7 multi-select (2026-02-10)
The separate "What would feel like progress?" goals page after the quiz was redundant — users had already answered 7 behavioral questions and the goals felt repetitive. Made it Q7 inside the quiz itself as multi-select chips. Benefits: shorter flow (no extra screen), goals stored as comma-separated values in onboarding_answers alongside other answers, `formatAnswersReadable()` handles both single and multi-select. The goals feed `what_brought_you` which the Strategist and Coach both read.

### Kill client-side tension scoring, use Strategist LLM (2026-02-10)
Removed `identifyTension()` point-based scoring from the client. The Strategist now determines `tension_type` and `secondary_tension_type` from human-readable quiz answers at first session open. Why: the point system was brittle (adding/removing options required rebalancing scores), couldn't detect nuance (same answer in different contexts signals different tensions), and we already had an LLM reading the same data. The Strategist sees the full picture — quiz answers + goals + any freeform text — and can reason about which tension pattern fits. Session open API saves the determined tension back to the profiles table.

### Behavioral questions over feeling-based (2026-02-10)
Replaced "What keeps you up at night?" / "Unexpected $500" / "Look at your purchases" with "When money stress hits, what do you actually do?" / "How often does stress show up?" / "What are you good at with money?". Informed by analyzing a real coaching intake form. Behavioral questions produce better coaching signal: what someone DOES under stress is more actionable than what they FEEL. Frequency tells the Coach how urgent to be. Strength-based question gives the Coach something to build on (and "Honestly? I can't think of one" is itself a powerful signal).

### Sessions stay open on tab switch (2026-02-09)
Sessions are not auto-closed when the user navigates away from chat. They close via manual "End Session" button or deferred close when the user returns after 12h. Auto-close on tab switch would cost 2 Haiku calls every time someone checks their toolkit or logs a win. The deferred close captures the same data — just not immediately. Session notes from deferred close appear on the home screen via "Last Session" card.

### Deferred close inside /api/session/open (2026-02-09)
When a user returns after 12h, the old session is closed inside the `/api/session/open` endpoint — one round trip instead of two. The close runs first (notes + reflection + intel merge), then the open reads the freshly-merged intel for planning. This ensures the new session's opening message is informed by what happened in the old one. Alternative was client-side close-then-open (two round trips, slower UX).

### End Session button after 4 messages, not card creation (2026-02-09)
Changed the "End Session" button visibility from requiring a card to be co-created to appearing after 4+ messages. The card requirement meant users with no card had no way to manually end a session. 4 messages (1 opening + 1.5 exchanges) is enough for meaningful session notes.

### Add "what brought you here" to onboarding (2026-02-09)
Added an open-ended textarea ("What's going on with money right now?") as the second onboarding screen, before the tension quiz. This is the highest-leverage change for first-session quality — the Strategist needs a specific current situation to generate a hypothesis that makes the user feel seen. Categorical labels (life_stage=early_career, tension=avoid) tell the Strategist what type of person this is. The `what_brought_you` field tells it what's actually happening in their life right now. Placed before the quiz so the flow says "I want to hear from YOU first" rather than "take a test."

### Eliminate the style quiz from onboarding (2026-02-09)
Removed all 5 style quiz screens (tone, learning styles, depth, life context, emotional why). Users can't meaningfully choose tone/depth/learning_style before experiencing coaching — it's premature self-report. Everyone starts at balanced defaults (tone=5, depth=balanced, learningStyles=[]). The Coach learns preferences organically through conversation, and reflectOnSession captures style observations. Users can still override from Settings. Saves 5 screens and ~30 seconds of friction.

### Onboarding-first approach for intel system (2026-02-09)
Identified several weaknesses in the intel system (unbounded arrays, naive string dedup, reflection blind to existing intel, untyped growth edges). Rather than patching these incrementally, decided to redesign the onboarding flow first and build the intel engine from there. Onboarding shapes what data we collect, which shapes what intel we store, which shapes what the Strategist reads. Working backwards from the Strategist would mean reworking things twice.

### Kill the closing message (2026-02-09)
Removed the separate Sonnet call that generated a "warm closing" when a session ends. Session notes ARE the ending — showing notes is enough. Saves one Sonnet call per session close. The closing felt artificial anyway.

### Session notes are Haiku, not Sonnet (2026-02-09)
User-facing session notes (headline, narrative, key moments, cards) are structured extraction, not deep reasoning. Haiku handles this well at a fraction of the cost. Post-session is now 2 parallel Haiku calls (notes + reflection) + code merge. Zero Sonnet.

### Pipeline orchestration layer (2026-02-09)
Created pure TypeScript pipeline functions (openSessionPipeline, closeSessionPipeline) that orchestrate the full session lifecycle with no DB or framework dependency. API routes become thin shells. Same pipelines reusable by admin simulator and future native backend. Motivated by: (1) need to run simulations with exact production code, (2) likely conversion from mobile web to native.

### Kill the Observer agent (2026-02-09)
Removed the per-turn Haiku Observer that detected deflections/breakthroughs/signals. Its output (observer_signals) was only consumed by the Strategist between sessions — same data can be extracted once at session close via reflectOnSession(). Saves one Haiku call per user message. Observer stubbed (not deleted) for admin compat.

### Decompose the monolithic Strategist (2026-02-09)
Split the Strategist into 3 focused functions: reflectOnSession() (clinical extraction, Haiku), updatePersonModel() (array merge, pure code), planSession() (session strategy, Sonnet). Each runs at the appropriate lifecycle point — reflection at session close, planning at session open. The monolithic Strategist tried to do everything at once at session boundaries.

### Rename conversations → sessions in DB and code (2026-02-08)
Renamed the `conversations` table to `sessions` and `conversation_id` to `session_id` everywhere to match v2's session-based model. Also dropped dead v1 columns (pattern_type, pattern_score, topic_key, engine_version) and the unused beta_analytics table. Migration uses DROP/CREATE for indexes and policies instead of ALTER RENAME — Supabase SQL editor doesn't handle PL/pgSQL DO blocks reliably. Live DB missing `started_at` column on sessions table despite migration 001 defining it — skipped that index.

### Direct function calls instead of HTTP self-calls (2026-02-08)
The tick and message routes were calling /api/simulator/chat via HTTP fetch to themselves. This broke on Vercel (401 auth error). Extracted core chat logic into processSimChat() in lib/simulator/chat.ts — called directly as a function. Faster, no URL config needed, no auth issues.

### sim_profiles replaces simulator_personas (2026-02-08)
Eliminated the simulator_personas indirection layer. sim_profiles IS the persona now — stores profile config, user_prompt, and source_user_id directly. One table instead of two, simpler queries, consistent sim_* naming across all simulator tables.

### Drop v1 simulator code entirely (2026-02-08)
Removed all v1 backward-compat: SimulatorMessage type, getRunMessages(), v1 message fallbacks in UI, engineVersion prop, isV2 conditionals, CardBadge per-message rendering. Everything is v2-only now.

### 3-agent coaching architecture (2025-02-06)
Split coaching into Coach (Sonnet, every message), Observer (Haiku, fire-and-forget), and Strategist (Sonnet, session boundaries). Coach reads a static briefing per session rather than raw data. Observer replaces the old every-5th-message extraction. Data flow is async — Observer signals accumulate, Strategist reads them between sessions.

### Session-based conversations, topics removed (2025-02-06)
Removed topic system entirely. Conversations are now session-based (>12h gap = new session). Simpler routing, simpler state, more natural coaching flow.

### Prompt caching with SystemPromptBlock[] (2025-02-06)
Structured system prompt as cache-optimized blocks. Block 1 (core principles) cached across all users. Block 2 (briefing/context) cached within session. ~80% cost reduction.

### Monorepo with Turborepo + pnpm (2025-01-xx)
Split into apps/mobile + apps/admin with shared packages (types, constants, coaching). Packages are unbundled TS transpiled by Next.js.

### Supabase for auth + database (2025-01-xx)
Google OAuth for mobile users, password auth for admin. PostgreSQL with RLS. Profile auto-created on signup via DB trigger.
