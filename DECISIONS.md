# Toney — Decision Log

Architectural, product, and technical decisions. Newest first.

---

### Manual Vercel env vars over Marketplace integration (2026-02-19)
Researched the Vercel Marketplace Supabase integration for automatic env var syncing. Decided against it for this project. Reasons: (1) Public Alpha with known bugs — multiple reports of env vars not syncing correctly for preview deployments. (2) Can't link existing Supabase projects — integration is designed for new projects created through Vercel. (3) Transfers billing to Vercel and makes Supabase org management Vercel-only. (4) Integration-managed env vars become read-only in Vercel dashboard, blocking custom vars like `CLOSE_PIPELINE_SECRET`, `SIM_SECRET`, `ANTHROPIC_API_KEY`. (5) Manual env vars take 5 minutes and give full control. The Marketplace integration is better suited for greenfield projects. Supabase Branching (automatic per-PR preview databases) is the more compelling feature but also has rough edges — deferred for revisit in a few months.

---

### LLM usage: raw tokens in DB, cost at query time (2026-02-18)
Store raw token counts (input, output, cache_creation, cache_read) in `llm_usage` table. Calculate dollar costs at display time using a pricing constants file. This avoids needing to update historical rows when Anthropic changes pricing. The pricing file (`apps/admin/src/lib/pricing.ts`) is the single source of truth. Trade-off: cost calculation happens on every admin page load, but the math is trivial (multiply + sum).

### Usage table: RLS disabled, not policy-based (2026-02-18)
`llm_usage` is internal telemetry — users never read or write it directly. API routes insert on behalf of authenticated users using the anon key client. Admin reads via service role. Enabling RLS with INSERT policies caused silent failures that were hard to debug (Supabase returns null error when RLS blocks an insert). Disabled RLS entirely since this table has no user-facing access path.

### Stream usage: finalMessage event, not await (2026-02-18)
For streaming routes (chat, session open), capturing token usage requires the final message from the Anthropic SDK. Two options: (1) `await stream.finalMessage()` inside the `'end'` handler — risky because the stream may already be consumed. (2) `stream.on('finalMessage', ...)` event registered before the ReadableStream constructor — fires synchronously before `'end'`, guaranteed to have the usage data. Chose (2) after (1) failed silently in production. The captured usage is stored in a closure variable and saved in the `'end'` handler.

### Coaching functions return usage, don't save it (2026-02-18)
`packages/coaching` functions are pure — no DB, no framework. Rather than injecting Supabase into them, each function returns `usage: LlmUsage` alongside its existing output. The calling route/Edge Function saves to DB. This preserves the package's purity and keeps the save logic close to the context (table name, user ID, sim mode).

---

### Two Supabase projects for PROD/DEV, not one project with branching (2026-02-17)
Needed environment isolation as real users approach. Options considered: (1) Supabase branching (built-in, but limited to Pro plan and doesn't fully isolate Edge Functions/secrets). (2) Single project with prefixed tables (sim_ pattern already used for simulator, but complex and error-prone for a full second environment). (3) Two completely separate Supabase projects — PROD and DEV. Chose (3): complete isolation, independent Edge Function deployments, independent secrets, independent auth users. Cost: must run migrations on both, must deploy Edge Function to both, prompts must be synced manually (already a constraint from Edge Function architecture). The `edgeFunction.ts` helper already reads `NEXT_PUBLIC_SUPABASE_URL` dynamically, so it auto-routes to the correct project's Edge Function without code changes.

### Vercel preview deployments instead of four projects (2026-02-17)
Could create 4 Vercel projects (mobile-prod, mobile-dev, admin-prod, admin-dev) or use Vercel's built-in preview deployments. Chose preview deployments: push to `main` → Production deployment (PROD env vars), push to any other branch → Preview deployment (Preview env vars). This requires zero extra Vercel projects, uses environment-scoped variables (Production vs Preview), and auto-generates preview URLs. Trade-off: preview URLs are auto-generated (not custom subdomain on Hobby plan), but that's fine for development.

### Email on profiles table for user management (2026-02-17)
Email lives in `auth.users` (Supabase auth schema), but querying it requires service role access and joining across schemas. With real users approaching (100-200 testers), need email accessible for: admin dashboard user list, outreach, user identification. Added `email TEXT` column to `profiles`, backfilled from `auth.users`, and updated the `handle_new_user()` trigger to populate on signup. Not a PII concern — this is a user management feature, not a public-facing field. Migration 034.

### UUID remapping for cross-environment data copy (2026-02-17)
Google OAuth creates different UUIDs per Supabase project (the UUID comes from `auth.users`, which is project-scoped). When copying PROD data to DEV, the same person (same Google email) has different UUIDs. Solution: match users by email (`auth.users` in both projects), build a UUID mapping (PROD→DEV), and remap all user_id FKs during copy. This is a one-time operation for initial data seeding, not an ongoing sync.

---

### Pre-generated opening messages for instant session open (2026-02-17)
Session open was ~8s because Sonnet needs ~6s for the first token. But the opening message only depends on the suggestion's coaching plan (hypothesis, leverage point, curiosities, opening direction) — all of which are already known at suggestion generation time. By writing the `openingMessage` at close time (when `evolveAndSuggest()` already has full context), session open can serve it instantly from the DB without any LLM call. Trade-off: opening messages are less reactive to changes between sessions (new cards saved, new wins) — but the suggestion text itself is already snapshot-at-generation-time, so the opening matching it is consistent. Free chat (no suggestion) and old suggestions without `openingMessage` fall back to live Sonnet streaming. Win milestones also fall through to live streaming so milestone text integrates naturally.

### Vercel Pro replaces Edge Function for evolution pipeline (2026-02-19)
Upgraded to Vercel Pro ($20/mo, 300s timeout). The Supabase Edge Function (1034 lines of Deno with inline prompt copies) was eliminated. Evolution pipeline now runs in `after()` callbacks on the close and open routes, importing `evolveAndSuggest()` directly from `@toney/coaching`. Every prompt lives in one place — no more drift risk. Shared `runClosePipeline()` helper (`apps/mobile/src/lib/closePipeline.ts`) handles the full pipeline for deferred close in the open route. Close route keeps a split pattern (notes inline for client response, evolution in `after()`). `CLOSE_PIPELINE_SECRET` env var no longer needed.

### ~~Supabase Edge Function replaces after() for evolution pipeline (2026-02-17)~~
*(Superseded by Vercel Pro upgrade above.)*

### Home screen reorder: focus areas as spine, not bottom section (2026-02-16)
Focus areas are the growth signal now — they accumulate reflections, link to wins, and carry the user's declared intentions. But they were at the bottom of the home screen, below the last session hero tile, the win strip, and two side-by-side tiles. Promoted to position 2 (right after the greeting + CTA). Last session compressed from a hero tile to a compact side-by-side with the understanding snippet. The old hero treatment gave too much weight to looking backward. Now: CTA ("Continue your coaching") → focus areas → wins → reference tiles. Tapping a focus area opens FocusAreaGrowthView directly from home (was: navigate to Journey tab), keeping the user in context.

### Seed route needs idempotency on focus area creation (2026-02-16)
`POST /api/seed` creates focus areas from Q7 goals but had no check for existing rows. If called twice (e.g., client retry, double-tap, or re-onboarding), identical focus areas were inserted — the `focus_areas` table has no unique constraint on `(user_id, text)`. Added an existing-text check: query active focus areas before insert, filter out any with matching text. Chose code-level dedup over a DB unique constraint because archived areas with the same text should be allowed (a user might archive "Feel okay spending on myself" and later re-declare it).

### Focus areas are where users name the pain, not aspirational goals (2026-02-16)
Reframed how focus areas are understood in the system. They're not "what they think they want" — they're where they name the pain. "Stop letting money run my mood" is them saying "this is what hurts." The Coach's existing instruction is already good: "These are the surface — your hypothesis should bridge them to what's actually underneath." The check-in system reflects this: it asks "Is this still the right shape?" not "Have you achieved this goal?" Outcomes of a check-in can be confirming, reframing, archiving, or discovering something entirely new.

### Q7: keep mood_control, drop stop_stress (2026-02-16)
Options 1 ("Stop stressing about money") and 5 ("Stop letting money run my mood") were near-duplicates. Kept #5 because "money running my mood" names the mechanism — it points at something specific the Coach can work with. "Stop stressing" is just the symptom. Added "Something else..." with freeform text input so users aren't boxed in by presets.

### Focus area check-in as standing suggestion, not timed interval (2026-02-16)
Check-in suggestions could be: (1) periodic (every N sessions), (2) calendar-based (every 2 weeks), or (3) Strategist-decided based on signals. Chose (3): the Strategist sees reflection count, dormancy, stuckness, and shift signals — it knows when a check-in matters. Standing suggestions (always available) rather than one-time, because the user might not be ready for the check-in when it first appears. The Strategist generates 1+ standing check-ins when it determines a focus area is ready. No mechanical timer.

### End Session button always visible, no gating (2026-02-16)
The old rule was: show End Session after a card is saved OR 20+ messages exchanged (never on first session unless card). This made sense when every close ran the full pipeline (~$0.05 in LLM calls + 15-20s). But with tiered close, short sessions are free — no LLM calls, instant completion. And hiding the button created a trap: user taps a suggestion, sees the Coach's opening, realizes they want something different, but can't end the session or get back to the suggestion picker. They're stuck for 12 hours. New rule: button appears as soon as `messages.length > 0` (i.e., the Coach has sent its opening). Removed `sessionHasCard`, `isFirstSession`, and `nonDividerCount >= 20` conditions entirely.

### Tiered session close: delete/skip/full based on user message count (2026-02-16)
Sessions with minimal engagement were running the full close pipeline — Haiku notes + Sonnet evolution + suggestions — wasting LLM calls and polluting the understanding narrative with noise. Three tiers: (1) 0 user messages → delete the session entirely (messages cascade via FK ON DELETE CASCADE). No trace. (2) 1-2 user messages → mark completed, skip pipeline. No session_notes means `useSessionHistory` naturally excludes it (`.not('session_notes', 'is', null)` filter). `evolution_status = 'completed'` prevents retry logic from picking it up. (3) 3+ user messages → full pipeline as before. Applied to both deferred close (12h auto-close in session/open route) and manual close (session/close route). The deferred close was also restructured: messages load first (1 query), then only the 3+ path loads the remaining 4 queries — saving unnecessary DB calls for empty/minimal sessions.

### Move 12h boundary check before suggestions/messages guards (2026-02-16)
The auto-open effect in ToneyContext checked for suggestions and loaded messages BEFORE checking the 12h boundary. This meant any session with suggestions (most of them) or loaded messages (all of them) would block the boundary detection from ever running. Discovered via session f52c016e — active since Feb 13, 1 message, never closed. Fix: reorder the guards so boundary detection runs first. If >12h has passed, always open a new session regardless of other state.

### Track evolution_status on sessions, retry on open (2026-02-16)
The `after()` callback in the close route runs `evolveAndSuggest()` (Sonnet) fire-and-forget. On Vercel Hobby, if this fails there's zero recovery — understanding doesn't evolve, no suggestions generated, no reflections written. Alternatives considered: (1) heuristic detection (check if suggestions exist for that session) — fragile, can't distinguish "no suggestions generated" from "suggestions intentionally empty." (2) Admin dashboard visibility — doesn't fix the problem, just makes it visible. (3) Column-based tracking — explicit `evolution_status` ('pending'/'completed'/'failed') on sessions row. Chose (3): clear, queryable, no false positives. Retry is blocking (~5-10s) on next session open — only fires when a previous close's after() failed (rare). Better to wait than have stale context. Idempotency guards prevent double-writes: check `generated_after_session_id` for suggestions, check `sessionId` in JSONB for reflections, last-writer-wins for profile understanding.

### Straight vertical timeline for Journey, winding line deferred (2026-02-15)
Tried 6 approaches for a Duolingo-style winding path on the 430px Journey tab: (1) Full S-curve snake with nodes at left/center/right — text labels didn't fit beside nodes at edge positions. (2) Labels below nodes — text from edge-positioned nodes overflowed. (3) Speech bubbles beside snake — overlapping, misaligned. (4) Left-rail sine wave — Math.sin(i*π)=0 for all integers (no wave) + z-index stacking issues. (5) Full-width sine wave with ResizeObserver — conditionally rendered container never triggered observer; layout still wrong at 430px. (6) Settled on simple straight vertical line with 48px emoji circles and flat-color bubbles to the right. No SVG, no absolute positioning, no width measurement — just a CSS div for the line and normal flow. Ships now, winding line revisited later.

### Journey tab: sessions behind a button, focus areas as spine (2026-02-15)
User directive: "Sessions in general aren't supposed to be there in the current format. I think the journey tab should offer access to the session notes, through a button (like settings via home)." Sessions are now accessible via a BookOpen icon in the top-right (same pattern as Settings on home), not shown inline. The main content is focus areas + narrative growth — that's what shows your evolution. Chose a hybrid layout: compact summary at top (GrowthNarrative card), scrollable focus area cards below. Before/after contrast uses the earliest focus area reflection vs. the current understanding snippet — implicit change signal without forcing a "Day 1 vs Now" comparison. When focus areas are empty but sessions exist (pre-existing users), recent sessions render inline as fallback — so the page is never empty for anyone with history.

### Intel rebuild uses evolveAndSuggest, not evolveUnderstanding (2026-02-15)
The admin "Full Intel" rebuild was using `evolveUnderstanding()` — an evolve-only function that doesn't generate snippet, suggestions, or focus area reflections. This meant running Full Intel left `understanding_snippet` null, focus areas empty, and no reflections — exactly the data the new Journey tab and home screen need. Switched to `evolveAndSuggest()` which produces all outputs in a single Sonnet call. Also creates focus areas from Q7 goals if none exist (same logic as the onboarding seed route). Trade-off: intel rebuild is slower (~5s per session instead of ~3s) because `evolveAndSuggest` has a larger prompt, but correctness matters more — rebuilding should produce the same data as the live pipeline.

### Wins-first: wins as emotional core, not afterthought (2026-02-15)
Wins were a quiet, secondary feature — a static green card in chat, a bottom tile on home. But wins ARE the product's emotional payload. Implemented in 3 phases: (1) Make the moment matter — animated card expansion, Coach language pattern (reflect → mark → ground), wins in session notes, win-referencing suggestions. (2) Make wins visible — home screen momentum strip, enriched formatWins with dates/velocity/patterns, wins as primary evidence in evolve prompt, milestone acknowledgments at 3/7/15/30. (3) Connect the system — migration 029 linking wins to focus areas via `focus_area_id`, `[WIN:focus=X]` Coach syntax with fuzzy matching, win evidence section in FocusAreaGrowthView. Key design choices: (1) Calm celebration, not confetti — warm glow + gentle trophy rotation says "this matters" without being a dopamine hit. (2) Coach voice stays observational — "Seven moments now where you did something different" not "Congratulations on 7 wins!" (3) Wins grouped by focus area in Coach briefing — Coach sees wins as evidence of progress on specific intentions. (4) Fuzzy matching for focus area linking — exact match first, then substring containment in either direction. Mismatches silently fall back to unlinked (null focus_area_id). (5) Bold-as-checkpoint rule — every bold in Coach response should trigger "does this deserve a [WIN] or [CARD]?" Closes the gap where Coach notices something important but fails to act on it. Zero new LLM calls across all 3 phases — everything piggybacks on existing Coach/Strategist/Haiku calls.

### Flashcard deck replaces vertical card list on Rewire screen (2026-02-15)
The Rewire screen showed all cards in a scrollable vertical list with full content visible — category badge, title, full markdown body, date, edit/delete buttons, and "Revisit with Toney" footer for every card. This was information-dense and overwhelming, especially with 10+ cards. Replaced with a tap-to-flip flashcard deck: front shows only the category icon + title (clean, scannable), back reveals full content + actions. Cards are browsed via a horizontal carousel (swipe to navigate) instead of scrolling a long list. Key design choices: (1) Chose carousel over Tinder-style stacked deck — user explicitly preferred carousel feel over Tinder swiping. (2) Infinite loop — no dead ends when swiping, wraps around via modular arithmetic. (3) Velocity-aware swipe commit — fast flick commits even with small distance (0.3 px/ms threshold), slow drag past 25% of card width also commits. This makes the interaction feel native/iOS-like rather than requiring precise drags. (4) `transitionend` event for animation completion instead of `setTimeout` — more reliable, with timeout fallback for safety. (5) Dynamic transition duration — proportional to remaining distance, so cards near their destination animate faster (150-350ms range). Category filter tabs kept as-is — they were already good.

### Focus area growth reflections — show users who they're becoming (2026-02-14)
Inspired by a product analysis identifying a gap: users couldn't see their own growth anchored to their declared intentions. Focus areas existed as flat labels — no evolution signal. The understanding narrative captured growth, but it was clinical and invisible to users. Solution: per-focus-area reflections generated at session close, in second person ("You noticed that buying coffee didn't trigger guilt — that's new"). Stored as JSONB array on the `focus_areas` row, not a separate table. Key design distinction from wins: wins are moments (what happened), reflections are throughlines (who you're becoming) anchored to declared intentions. Voice: user chose second person over third person because reflections are shown directly to users. Cost: piggybacked on existing `evolveAndSuggest()` Sonnet call — ~50-150 extra output tokens on a call already producing ~2000-4000. Zero new LLM calls. UX: Home = empowering (latest reflection per focus area as cards), Journey = nostalgia (full growth timeline in bottom-sheet overlay). Matching by exact text between LLM output and DB records — mismatches silently skipped (logged to console).

### Coach prompt tuning from real session analysis (2026-02-14)
Read the full transcript of session 838039b7 and identified 6 concrete behavioral issues: (1) "There it is" said 4 times — verbal tic, not genuine recognition, (2) 2-4 bold phrases per message — when everything is emphasized nothing is, (3) Coach said "you have a lot of money" — user never said that, (4) co-created a Substack invitation line but never produced a [CARD] even when user asked to see it again, (5) user said "I believe I can nail it. I already built an online shop before" — clear capability recognition, no [WIN] produced, (6) no guidance for messages 2-8 where the real issue surfaces. Each fix is a targeted text addition to CORE_PRINCIPLES (~130 net words). Chose anti-patterns + concrete rules over abstract principles because Sonnet responds better to "never say X" than "be mindful of Y." Rejected slowing down the coaching pace (issue initially identified but user confirmed pacing was fine).

### Calm home screen — no streaks, no counts, no gamification (2026-02-13)
The home screen had become busy — suggestions, last session, focus areas, streak/wins all competing for attention. The user's principle: "I don't want Toney to be part of the attention economy." Removed streaks and session counts entirely. Growth is shown through an evolving "What Toney Sees" snippet — a single sentence that changes after each session. The language shift IS the growth signal. No numbers, no progress bars, no badges. Five tiles fit on one screen without scrolling: last session, understanding snippet, latest card, focus area pills, last win.

### Suggestions in chat, not on home (2026-02-13)
Session suggestions moved from the home screen to the chat screen. Rationale: (1) suggestions are a call to action — they belong where the action happens (chat), (2) the home screen should be a calm dashboard, not a launcher, (3) simpler mental model — open Chat tab, either see your conversation or choose what to talk about next. The suggestion picker shows when `messages.length === 0` and no active session. Auto-open is suppressed via `userInitiatedSessionRef` so the picker isn't bypassed.

### Understanding snippet as growth signal (2026-02-13)
Needed something for the home screen that shows growth without gamification. Options considered: stage of change badge, journey marker/count, recent shift quote, understanding snippet. Chose snippet: a single sentence (15-30 words) generated alongside the understanding narrative evolution. It captures the most salient observation about the person RIGHT NOW. Growth is visible through how the language changes session to session — not through numbers going up. Generated by the same Sonnet call that evolves the understanding (no extra LLM cost).

### Split seed into two parallel Sonnet calls (2026-02-14)
The single `seedUnderstanding()` call was producing understanding + tension + suggestions in one shot (~15-25s). Suggestions don't depend on the understanding output — both only need quiz answers as input. Split into `seedUnderstanding()` (narrative + tension, 800 max tokens) and `seedSuggestions()` (4 suggestions, 1200 max tokens) running via `Promise.all`. Wall time = max(A,B) instead of A+B. Seed prompts are compressed for speed — the post-session `evolveAndSuggest()` prompt remains comprehensive because it runs in background. Trade-off: 2x the Sonnet API cost per onboarding, but seed only runs once per user lifetime (~$0.02 → $0.04).

### Seed sends suggestions in response, accepts quiz data in body (2026-02-14)
Previously: client calls seed → seed reads quiz data from DB → runs LLM → saves suggestions to DB → returns. Then client calls GET /api/suggestions → reads from DB → displays. Two unnecessary round-trips (DB read + second API call). Now: client sends quiz answers in POST body → seed runs LLM → saves + returns suggestions in response. One call, no extra reads. ~400ms saved.

### Kill coaching_briefings — store coaching plan on sessions row (2026-02-13)
Reversed the 2026-02-11 decision to "keep sessions and coaching_briefings as separate tables." The original reasoning (clean queries, decoupled lifecycle, versioning) was valid at the time, but three things changed: (1) `assembleBriefingDocument()` proved the briefing can be built from pure code using suggestion data + profile + DB context — no LLM needed. (2) `prepareSession()` (Sonnet, 3-5s) was the session-open bottleneck that Noga experienced. (3) The briefing snapshot was always stale — cards/wins/focus areas saved mid-session weren't reflected until the next session. Moving hypothesis/leverage_point/curiosities/opening_direction to the sessions row eliminates a table, removes the `prepareSession()` LLM call, and lets each chat message build a fresh system prompt from the latest data. Trade-off: chat route now runs 5 parallel queries instead of 2, but these are small indexed lookups (~10ms each).

### Merge evolve + suggestions into one Sonnet call (2026-02-13)
Session close was running 2 separate Sonnet calls: `evolveUnderstanding()` (~5-8s) then `generateSessionSuggestions()` (~8-12s). But the suggestion generator needed the same context the evolve call already had — understanding + transcript + tension. Merged into `evolveAndSuggest()`: one Sonnet call, one prompt, one JSON response with both the evolved understanding and 6-10 suggestions. Same merge applied to `seedUnderstanding()` (now returns suggestions alongside understanding + tension). LLM call count: session close 2→1 Sonnet, post-onboarding 2→1 Sonnet, session open 2→1 Sonnet. Total: 6 Sonnet calls across the full lifecycle → 3.

### Don't pass previousSessionId for already-completed sessions (2026-02-13)
When the user opens a new session from the suggestion picker, the client was passing `currentSessionId` as `previousSessionId` to trigger deferred close. But if that session was already completed, the server ran `closeSessionPipeline()` on it anyway — 15-20s of wasted Sonnet calls that often timed out. Fix: client skips `previousSessionId` when `sessionStatus === 'completed'`. Server also guards with a `session_status` check before attempting deferred close. Both defenses needed — client for speed, server for correctness.

### Simulator as mobile app in a new window, not rebuilt in admin (2026-02-13)
The simulator could be: (1) mobile components rebuilt inside the admin app, (2) mobile app in an iframe inside admin layout, or (3) mobile app in a popup window. Chose popup window because: zero component duplication — every mobile screen (onboarding, home, chat, rewire, journey) works as-is. The mobile app gains a "sim mode" (`?sim=profileId`) that bypasses auth and swaps to sim_ tables. The simulator is always in sync with mobile automatically — no drift. Trade-off: the mobile API routes need a sim branch (~10 lines each), but that's far less work than rebuilding every screen. Admin simulator page becomes a simple profile grid with open/create/clone/delete.

### Return session notes immediately, background the rest (2026-02-13)
The close pipeline ran 3 sequential LLM calls (evolve → notes → suggestions, ~15-20s) and the client waited for all of them. But notes are the only thing the user sees — evolving understanding and generating suggestions are invisible background work. Restructured: generate notes first (Haiku, ~3-5s) using pre-evolution understanding (it's about what happened in the transcript, not clinical narrative updates), save to DB, return to client. Everything else runs in `after()`. The `closeSessionPipeline` pure function still exists for the simulator, but the production route now inlines the steps to control the response boundary.

### Vercel maxDuration on all LLM routes (2026-02-13)
Vercel Hobby plan defaults to 10s function timeout. Without `maxDuration`, the gateway returns 504 to the client while the function continues running — a split-brain where the server succeeds but the client fails. Every route that calls Claude must export `maxDuration = 60`. Learned this the hard way: Noga's session closes were silently succeeding in the DB while appearing stuck in the UI.

### Depth as 1-5 number, not string union (2026-02-13)
Changed `depth` from `DepthLevel = 'surface' | 'balanced' | 'deep'` to a 1-5 numeric scale matching tone. The string union was leftover from the original style quiz (eliminated in v3). A numeric scale gives finer granularity and consistent UI treatment (both are sliders now). `DepthLevel` type removed entirely.

### Vertical suggestion list with featured card, not horizontal scroll (2026-02-12)
First iteration used horizontal scrollable cards (260px wide). Problems: (1) only 1.5 cards visible at a time — users couldn't see what was available, (2) the home screen felt empty with just a thin strip of cards + streak, (3) horizontal scroll is easy to miss on mobile. Switched to vertical layout: first suggestion gets a full-width gradient card (hero treatment), remaining suggestions are compact rows with title + teaser + time label. Fills the viewport, all options visible, and the featured card gives a clear primary CTA.

### Remove "What Toney Sees" and "Your Rewire Cards" from home screen (2026-02-12)
"What Toney Sees" showed the user's tension label from onboarding — static information they already knew. It didn't evolve between sessions and took up prime real estate. "Your Rewire Cards" duplicated the Rewire tab with only 3 cards. Both replaced by session suggestions, which are dynamic, personalized, and actionable. Home screen now has a clear hierarchy: suggestions (primary CTA) → last session → focus areas → streak.

### Session suggestions generated at close time, not open time (2026-02-12)
Suggestions could run at session open (just-in-time) or session close (pre-computed). Chose close: (1) close is not latency-sensitive — the user already tapped "End Session" — while open is the bottleneck users feel, (2) close has the richest context (just-evolved understanding + session headline + key moments), (3) pre-computing lets the home screen display suggestions without any LLM call at render time. Cost is neutral (~$0.31/session) — the Sonnet `prepareSession()` call at open is swapped for a Sonnet `generateSessionSuggestions()` call at close.

### Close pipeline sequential, not parallel (2026-02-12)
Changed from parallel (evolve + notes via Promise.allSettled) to fully sequential (evolve → notes → suggestions). Each step feeds the next: notes need the evolved understanding for richer context, suggestions need the session headline and key moments from notes. Session close is not latency-sensitive, so the extra seconds don't matter. The pipeline is now ~15-20s instead of ~8-10s, but produces much richer output.

### Pure-code briefing assembly replaces LLM on fast path (2026-02-12)
`assembleBriefingDocument()` is plain TypeScript (no LLM) that produces the same briefing format as `prepareSession()`. Since each suggestion already contains hypothesis, leverage point, and curiosities (computed by Sonnet at close time), the open-time briefing is just formatting: understanding narrative + suggestion fields + fresh cards/wins/focus areas from DB. This eliminates the Sonnet call at session open for returning users with suggestions. First session and edge cases still fall back to full `prepareSession()`.

### Suggestion lengths as coaching concept (2026-02-12)
Four length categories: quick (2-5min), medium (5-10min), deep (10-15min), standing (always available). Informed by user insight that Toney sessions should be "Duolingo-length engagements, not 45-minute coaching sessions." Standing suggestions are recurring entry points personalized to the user's patterns ("before a money decision," "something shifted"). Minimum 1 per category, 4-10 total. This gives users agency over session depth without making them design the session.

### Focus areas are ongoing intentions, not completable goals (2026-02-12)
Rejected binary goal completion. Most onboarding goals ("feel okay spending on myself", "stop fighting about money") are aspirational directions that never truly finish — forcing completion creates pressure and feelings of failure. Focus areas have only two states: active (archived_at IS NULL) and archived (timestamp set). No status column, no completed_at, no percentage. The Coach never marks them "done." Users archive when they feel ready. Naming was deliberate: "goals" creates performance pressure; "focus areas" frames them as directions of attention.

### Focus areas bridge surface goals to deeper coaching work (2026-02-12)
The Strategist prompt includes an explicit instruction: "Bridge their focus areas to the real work." When a user says "start a business," the Strategist's hypothesis should identify the real blocker (e.g., fear of failure, self-worth tied to income). Focus areas are what the user declares; the hypothesis is what the coach actually works on. This prevents the Coach from becoming a productivity tool that just checks off goals — it stays a coaching tool that uses goals as a window into deeper patterns.

### Focus areas as a separate DB table, not narrative text (2026-02-12)
Focus areas could live inside the understanding narrative (text-only). Chose a separate table because: (1) lifecycle — areas are created from multiple sources (onboarding, chat, future manual add) and individually archivable, (2) display — the home screen shows them as discrete items with source labels, (3) session linking — each focus area can reference the session where it was suggested, (4) future Journey tab needs queryable data, not regex on narrative text. The narrative still discusses focus areas contextually — the table is the source of truth, the narrative is the interpretation.

### Backfill legacy users with direct pipeline calls, not admin UI (2026-02-12)
Noga had 9 sessions (1,361 messages) from before the understanding narrative system existed. Rather than requiring the admin dashboard, we ran the same pure functions (`seedUnderstanding` → `evolveUnderstanding` × 9 → `prepareSession`) in a standalone script via `npx tsx`. This is the right pattern for one-off backfills: import the coaching package functions directly, load data with the admin Supabase client, run the pipeline. No new code needed — the functions are already pure and framework-free by design.

### Session notes get understanding narrative context (2026-02-12)
Haiku was writing session notes in a vacuum — no knowledge of who the person is beyond the current transcript. Now it receives the understanding narrative, stage of change, and previous session headline. This lets notes reference known patterns ("this connects to the avoidance pattern you've been working on") and show trajectory ("last session was about X, this time you went deeper into Y"). Added two prompt rules: connect to the larger journey, and show movement vs. previous headline. Cost: 300-800 extra words in the Haiku user message (cheap, once per session close).

### Coach prompt bridges the briefing explicitly (2026-02-12)
The Coach prompt's "Use what you know:" hints referenced concepts (breakthroughs, resistance patterns, emotional vocabulary) as if they were discrete data fields — but they're now woven into the understanding narrative. Added a briefing bridge (80 words) at the end of CORE_PRINCIPLES that maps each briefing section to its purpose. Updated coaching flow hints to point at "the narrative" explicitly. Also fixed stale reference to "session strategy" (now hypothesis + curiosities) and broadened session opening from "reference the previous session" to "reference what's most relevant" — the narrative might surface something from several sessions ago.

### Understanding narrative replaces knowledge fragments (2026-02-11)
Replaced the category-based knowledge extraction pipeline (`reflectOnSession()` → `buildKnowledgeUpdates()` → `user_knowledge` rows → reconstruct in `prepareSession()`) with a single evolving clinical narrative on `profiles.understanding`. The LLM thinks in narrative, not categories — forcing observations into `newTriggers[]`, `newBreakthroughs[]` strips the connections between them. The Strategist at session open was reconstructing who the person is from fragments — wasted work when the understanding already exists. New flow: `seedUnderstanding()` after onboarding → `evolveUnderstanding()` at each session close → `prepareSession()` reads the pre-formed narrative. Deleted `reflect.ts` and `personModel.ts`. `user_knowledge` table kept (focus card reflections still write to it) but no longer part of the main coaching pipeline.

### Sonnet for evolveUnderstanding, not Haiku (2026-02-11)
`evolveUnderstanding()` uses Sonnet (not Haiku). This is real clinical thinking — integrating new observations into an existing narrative, deciding what to deepen vs. what to add vs. what's no longer true. Worth the cost. The old `reflectOnSession()` used Haiku because it was pure extraction; narrative evolution requires judgment.

### Growth edges absorbed into narrative (2026-02-11)
Growth edges (7 lenses with active/stabilizing/not_ready status as structured JSONB) are no longer tracked separately. They're woven into the understanding narrative. "Financial awareness is growing — she checked her accounts twice" beats `{ active: ["financial_awareness"] }`. The growth lenses still exist as a thinking framework in `constants.ts` — they guide how `evolveUnderstanding()` thinks about growth dimensions. They're just not stored as structured data.

### Seed understanding after onboarding, before first session (2026-02-11)
`seedUnderstanding()` runs after onboarding quiz completion via `POST /api/seed`, creating the initial understanding narrative + determining tension type. This means `prepareSession()` never needs special-casing for "no understanding exists yet" — understanding always exists by session open. Legacy users without understanding get seeded inline at next session open.

### Drop behavioral_intel and coach_memories with no fallback (2026-02-11)
Removed both legacy tables and all code that read from them. The chat route's legacy fallback (reading behavioral_intel when no briefing exists) was the last consumer. Since prepareSession() now handles all sessions including first sessions, every user gets a briefing at session open — the fallback path is unreachable. Keeping dead fallback code added complexity and gave the false impression that the old system was still active. Migration 017 drops all 4 tables (prod + sim mirrors).

### Keep sessions and coaching_briefings as separate tables (2026-02-11)
Considered merging coaching_briefings columns into the sessions table (1:1 relationship today). Kept them separate for three reasons: (1) Different query patterns — chat route needs "latest briefing for this user" which is a clean single-row query on coaching_briefings; if it were a column on sessions, you'd need WHERE briefing_content IS NOT NULL ORDER BY created_at DESC LIMIT 1. (2) Briefing lifecycle is decoupled from sessions — the Coach reads the previous session's briefing until the new one is generated. (3) Versioning is cross-session (version field increments across all sessions). The separation costs one extra table but keeps queries clean and leaves room for mid-session re-planning.

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
