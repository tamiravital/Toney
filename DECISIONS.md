# Toney — Decision Log

Architectural, product, and technical decisions. Newest first.

---

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
