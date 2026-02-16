# Toney — Changelog

## 2026-02-15 — Journey Timeline Redesign
- **Journey timeline with emoji markers**: The Journey tab now shows a vertical timeline with emoji circles on a line — ⭐ for breakthrough milestones, 🏆 for wins, 🌱 for your first session. Each node has a colored bubble with the text, focus area label (for milestones), and date.
- **Different colors per focus area**: Milestones connected to different focus areas get different hues (indigo, pink, sky, purple, orange, yellow, emerald). Wins are green, first session is amber.
- **Bigger, more readable nodes**: Text is 14px (up from 13px), bubbles have more padding, and nodes are well-spaced on the timeline.
- **Sim clone win dates fixed**: Cloning a user into the simulator now preserves original win timestamps instead of resetting them all to the clone time.

## 2026-02-15 — Journey Redesign + Intel Rebuild
- **Journey tab redesigned as a growth dashboard**: Focus areas and narrative growth are the main content. Sessions are accessible via a BookOpen icon in the top-right corner (like Settings on the home screen) — they're not shown inline. A "Where you are" card at the top shows Toney's current understanding + a before/after contrast using your earliest focus area reflection. Focus areas show as tappable cards with win counts and reflection counts. Wins section always visible for logging wins.
- **Journey works even without focus areas**: If you have sessions but no focus areas (e.g., you started before focus areas were added), the Journey shows your 5 most recent session headlines as tappable cards. Tap one to read its notes.
- **Full intel rebuild generates all coaching data**: Running "Full Intel" on a user in admin now produces everything the app needs — understanding snippet (for home screen), focus areas (from onboarding goals), focus area reflections (per session), and session suggestions. Previously it only updated the understanding narrative.
- **Simulator clone copies everything**: Cloning a user into the simulator now deep-copies sessions, messages, focus areas (with reflections), wins (linked to focus areas), session suggestions, and the understanding snippet. Previously only copied profile + cards + wins.
- **Simulator displays session data correctly**: Hooks that read session history now work in sim mode. Previously the simulator showed "No sessions yet" even for users with many sessions.

## 2026-02-15 — Wins-First Strategy (Phases 1-3)
- **Animated win card**: DraftWin rewritten with a 1.2s celebration sequence — thin green line expands into a warm glowing card, trophy icon rotates, "Saved to your Journey" fades in. Calm, not confetti.
- **Coach win delivery pattern**: Coach now reflects the user's words back before the `[WIN]` marker, then grounds it with a bigger-picture statement. Connects to focus areas when relevant. Bold-as-checkpoint rule: every bold phrase triggers the question "does this deserve a marker?"
- **Wins in session notes**: Haiku now receives session wins and weaves them into the narrative. Wins are the highlights.
- **Win-referencing suggestions**: At least one suggestion from `evolveAndSuggest()` explicitly builds on a recent win.
- **Win Momentum Strip on home screen**: Replaces the old "Latest Win" tile. Shows win count, latest win text, and a momentum label ("3 wins this week" / "Most active week yet"). Position 2 after Last Session hero.
- **Enriched `formatWins()`**: Now includes dates (relative), total count, session velocity, pattern summary. Groups by focus area when linked. Chat route increased from `limit(5)` to `limit(20)`.
- **Wins as growth evidence**: Promoted from secondary context to primary evidence in `evolveAndSuggest()`. Instructions to reference wins as proof, track acceleration, update narrative when wins contradict resistance patterns.
- **Win milestones**: At counts 3, 7, 15, 30, Coach's opening message naturally observes the pattern. Not "Congratulations!" — observational: "Seven moments now where you did something different."
- **Win–focus area linking (migration 029)**: `focus_area_id` column on wins + sim_wins. Coach uses `[WIN:focus=X]...[/WIN]` syntax. API fuzzy-matches focus area text (exact then substring). Backward compatible — plain `[WIN]...[/WIN]` still works.
- **Win evidence in Focus Area Growth View**: New "Evidence" section showing linked wins as green cards above the growth reflections timeline.
- 3 commits: `3e924cc` (Phase 1), `8826733` (Phase 2), `e4c15b5` (Phase 3). Build passes. Deployed.

## 2026-02-15 — Rewire Flashcard Deck
- **Rewire screen redesigned as a swipeable flashcard deck**: Cards now show only the title and category icon on the front. Tap to flip (3D animation) to see the full content, date, and action buttons on the back.
- **Horizontal carousel navigation**: Swipe left/right to browse cards. The carousel loops infinitely — no dead ends. Dot indicators at the bottom show your position.
- **Velocity-aware swiping**: A quick flick commits the swipe even with minimal distance. Slow drags past 25% of the card width also commit. Under 25% snaps back smoothly. The animation decelerates naturally (iOS-style easing) and adapts its speed — cards close to their destination animate faster.
- **Shadow artifacts fixed**: Removed a visual glitch where card shadows were clipped at the bottom corners of the carousel.
- **Category filter tabs unchanged**: Same horizontal tabs (All, Reframes, Truths, Plans, Practices, Kits) with count badges.
- **Code refactored**: Monolithic 438-line file split into 4 focused files — shared constants, flashcard component, carousel component, and a slim orchestrator.

## 2026-02-15 — Wins Dedup Fix
- **Fixed duplicate wins**: When Toney celebrated a win in chat, it was being saved multiple times (3-10x) to the database. Added deduplication at both the client (prevents redundant API calls during streaming) and server (checks for existing identical wins before inserting). Existing duplicates in the database are unaffected — only future wins are deduplicated.

## 2026-02-14 — Focus Area Growth Reflections
- **Focus areas now show your evolution**: After each session, Toney writes a 1-3 sentence observation about each focus area the session touched. These accumulate over time, creating a visible growth timeline anchored to your declared intentions.
- **Home screen focus areas upgraded**: Focus areas are now cards (not flat pills) showing the latest reflection underneath. Before your first session, they say "Reflections appear after your next session."
- **Journey tab: Focus area growth timeline**: Tapping a focus area (on Home or Journey) opens a bottom-sheet overlay with your full growth story — reverse-chronological reflections with dates, source label, and age. You can archive focus areas from here too.
- **Coach sees your growth**: The Coach now reads the latest reflection for each focus area, giving it continuity across sessions — it can reference specific progress you've made.
- **Session notes mention focus areas**: When a session makes progress on a focus area, Toney's session notes now weave that in naturally.
- **No new AI costs**: Reflections are generated inside the same AI call that already runs at session close (~50-150 extra words).
- Migration 028: `reflections` column added to focus_areas table.

## 2026-02-14 — Tone/Depth Scale + Coach Prompt Tuning
- **Tone and depth scales unified**: Both are now 1-5 sliders (tone was 1-10, depth was text labels). Database migrated, all code updated.
- **Coach prompt tuned from real session analysis** (6 fixes):
  - No more repetitive dramatic reveals ("There it is" said 4x in one session — now explicitly blocked)
  - Bold used sparingly — max one bold phrase per response instead of 2-4
  - Coach won't infer facts you haven't stated (no more "you have a lot of money" when you never said that)
  - Card signals detected — when you ask to see something again or express satisfaction with a co-created phrase, Toney now wraps it in a saveable card
  - Win threshold lowered — recognizing your own capability ("I can do this") now counts as a win, not just deep pattern insights
  - Coach stays in exploration longer before jumping to solutions — the first thing you say is usually the presenting problem, not the real one

## 2026-02-14 — Seed Speed Optimization
- **Faster onboarding**: The "Getting to know you..." wait after the quiz is now ~50% faster. Two AI calls run in parallel instead of one large sequential call, prompts are compressed, and unnecessary database reads and API calls are eliminated.
- **Fixed broken first session**: After onboarding, the suggestion picker now reliably appears. Previously, 4 bugs caused a ~45-second wait, empty coaching fields, and duplicate suggestions — all traced to a race condition where the app started the session before the AI finished processing quiz answers.
- **Loading indicator**: A "Getting to know you..." screen now shows during onboarding processing, with a spinner and status text.

## 2026-02-13 — Kill Coaching Briefings
- **Faster session opens**: Opening a session now makes 1 AI call instead of 2. The system prompt is built instantly from pure code — no more waiting for the Strategist to prepare a briefing.
- **Faster session closes**: Understanding evolution and suggestion generation now happen in a single AI call instead of two separate ones. Combined with the existing "notes return immediately" pattern, this cuts background processing time by ~40%.
- **Faster onboarding**: After the quiz, understanding + tension + initial suggestions are all generated in one AI call instead of two.
- **Dropped the `coaching_briefings` table**: Coaching plan fields (hypothesis, leverage point, curiosities) are now stored directly on the session row. One less table, simpler queries, no stale briefing snapshots.
- **Chat system prompt is always fresh**: Each message rebuilds the system prompt from the latest profile, cards, wins, and focus areas — not a stale briefing snapshot. If you save a card mid-session, the next message's coaching context includes it.
- Admin intel page reads coaching plan from sessions instead of briefings. Full intel rebuild simplified.

## 2026-02-13 — UX Revamp — Calm Dashboard
- **Home screen redesigned as a calm dashboard**: No scrolling, no streaks, no gamification. Five tiles — last session card, "What Toney Sees" (a single evolving sentence about you), your latest Rewire Card, focus area pills, and your last win. Everything fits on one screen.
- **Session suggestions moved to chat screen**: When you open Chat with no active session, you see the suggestion picker (featured card + compact rows + "Or just start talking"). When a session is active, you see the conversation. Home screen no longer shows suggestions.
- **"What Toney Sees" tile**: A new one-sentence snapshot of Toney's current understanding of you — generated after each session and after onboarding. Changes meaningfully session to session. Shows growth through language, not numbers.
- **Chat input auto-expands**: The text box grows as you type (up to 3 lines), so you can see what you're writing.
- New `understanding_snippet` column on profiles (migration 024).

## 2026-02-13 — Suggestion Picker Fix
- **Session suggestions now appear when you open chat** — previously, returning users with all completed sessions would see stale messages from their last conversation instead of the suggestion picker. Now the picker shows correctly with personalized suggestions.
- **Starting a new session no longer fails with "I'm having trouble"** — tapping a suggestion was triggering a redundant 15-20 second close operation on an already-finished session, which often timed out. Removed the unnecessary close.

## 2026-02-13 — Fast Session Close
- **Ending a session now responds in ~3-5 seconds** instead of 15-20s. Session notes appear immediately; understanding evolution and suggestion generation happen in the background.
- Fixed Vercel timeout issue where tapping "End Session" would show "Wrapping up..." and then nothing would happen — the session actually closed server-side but the client never received the response.
- Added `maxDuration = 60` to all AI-calling API routes (chat, session open, session close, onboarding seed) to prevent Vercel's 10-second default timeout from killing long-running calls.
- Coaching depth changed from text labels (Surface/Balanced/Deep) to a 1-5 slider scale, matching the tone slider. Settings screen updated.

## 2026-02-12 — Home Screen Redesign
- **Session suggestions on home screen**: Personalized session ideas displayed as a vertical list — featured card with gradient treatment at top, compact rows below, each showing title, teaser, and time estimate
- **Personalized greeting**: "Good evening, Tamir" using first name from Google sign-in
- **Settings button**: Labeled pill ("Settings") instead of just a gear icon
- **"Or just start talking"**: Free conversation link below suggestions for when none of the ideas fit
- **Removed**: "What Toney Sees" (static tension label), "Your Rewire Cards" (duplicate of Rewire tab)
- Backfilled session suggestions for both existing users (Tamir: 8, Noga: 9)

## 2026-02-12 — Session Suggestions System
- **Session suggestions**: After each session closes, Toney generates 4-10 personalized session ideas for next time — each with a title, teaser, estimated length (quick/medium/deep/standing), and full coaching direction
- **Faster session opens**: When suggestions exist, session open skips the Strategist LLM call entirely (~5-8s → ~2-4s) using pure-code briefing assembly
- Close pipeline is now sequential: evolve understanding → generate notes → generate suggestions (each step feeds the next)
- Initial suggestions generated after onboarding so new users have options from the start
- New GET `/api/suggestions` endpoint for the future home screen UI
- New `session_suggestions` table (migration 020)
- Home screen UI shipped separately (see Home Screen Redesign above)

## 2026-02-12 — Focus Areas System
- **Focus Areas**: New coaching entity for tracking what the user is working on — ongoing intentions, not completable goals
- Focus areas come from three sources: onboarding Q7 goals, Coach suggestions via `[FOCUS]...[/FOCUS]` chat markers, or user-created
- Home screen shows "What I'm Working On" section with focus areas, source labels, and archive buttons
- Coach can suggest focus areas in conversation, rendered as interactive DraftFocusArea cards (indigo accent)
- Strategist reads focus areas and bridges surface goals to deeper coaching work in the briefing
- Understanding evolution and session notes now receive focus area context
- Archival model: no completion — focus areas are active or archived (archived_at timestamp)
- New `focus_areas` table with RLS (migration 019)

## 2026-02-12 (session 10) — Legacy User Backfill
- **Backfilled understanding narrative for Noga (nogaavital@gmail.com)**: Ran seed → evolve × 9 sessions → prepareSession using the coaching pipeline functions directly. 1,361 messages across 9 sessions processed into a rich 7,600-char understanding narrative. Stage progressed from precontemplation → action.
- Coaching briefing generated and saved — she can now open the app with full context continuity from all prior sessions
- Narrative snapshots saved on all 9 sessions for trajectory tracking

## 2026-02-12 (session 9) — Performance Investigation
- **Timing instrumentation** added to `/api/session/open` — logs elapsed ms at each step (auth, data load, legacy seed, deferred close, session create, prepareSession, first stream delta, stream complete) to diagnose slow session opens
- Discovered existing Settings screen already has tone slider, depth selector, and learning style chips

## 2026-02-12 — Prompt Tuning + Session Notes + Deploy
- **Committed + deployed understanding narrative** (`22737af`): 27 files, evolveUnderstanding + seedUnderstanding + migration 018
- **Coach prompt tuned for narrative briefings**: added briefing bridge (how to read each section), updated coaching flow hints to reference the narrative explicitly, fixed stale "session strategy" reference, broadened session opening from "previous session" to "what's most relevant"
- **Session notes enriched**: Haiku now receives the understanding narrative, stage of change, and previous session headline — enables trajectory-aware, arc-conscious notes
- **Migration 018 applied** to live Supabase: `profiles.understanding`, `sessions.narrative_snapshot` + sim mirrors
- Both apps deployed to Vercel

## 2026-02-11 (session 7) — Understanding Narrative Architecture
- **Understanding narrative replaces knowledge extraction**: Single evolving clinical narrative on `profiles.understanding` replaces the `reflectOnSession()` → `buildKnowledgeUpdates()` → `user_knowledge` rows pipeline
- **New `evolveUnderstanding()`** (Sonnet): Reads current narrative + session transcript → produces evolved narrative. Replaces Haiku reflection + code-based knowledge updates.
- **New `seedUnderstanding()`** (Sonnet): Creates initial narrative from onboarding quiz answers + goals. Called via `POST /api/seed` after onboarding.
- **`prepareSession()` simplified**: Reads pre-formed understanding narrative instead of reconstructing from 100+ knowledge fragments. No more first-session vs ongoing-session branching.
- **Close pipeline simplified**: `evolveUnderstanding()` + `generateSessionNotes()` in parallel (Promise.allSettled). Was: `reflectOnSession()` + `generateSessionNotes()` → `buildKnowledgeUpdates()`.
- **Narrative snapshots**: `sessions.narrative_snapshot` stores understanding BEFORE each evolution for trajectory tracking
- Deleted `reflect.ts` and `personModel.ts` — replaced by `evolveUnderstanding.ts`
- Admin fullIntel rewritten: seed → evolve → prepare loop (wins/cards loaded once, briefing tracked in-memory)
- HomeScreen "intel" variables renamed to "observations"
- Migration 018: `understanding` column on profiles/sim_profiles, `narrative_snapshot` on sessions/sim_sessions
- Documentation updated: CLAUDE.md rewritten, MEMORY.md and DECISIONS.md updated
- 22 files changed, ~1000 lines changed, ~310 deleted. Net: simpler system.

## 2026-02-11 (session 6) — Legacy Cleanup + API Optimizations
- **Dropped legacy tables**: `behavioral_intel`, `coach_memories`, `sim_behavioral_intel`, `sim_coach_memories` — all replaced by `user_knowledge`
- **No legacy fallback**: Chat route now requires a briefing (returns 400 if missing). No more `behavioral_intel`/`coach_memories` reading.
- Removed `useHomeIntel` hook and all legacy intel display from HomeScreen
- Focus card reflections save to `user_knowledge` instead of `coach_memories`
- Admin simulator and overview queries cleaned of all legacy references
- `systemPromptBuilder.ts` reduced from 515 → 135 lines (core principles + briefing only)
- Removed `BehavioralIntel`, `CoachMemory`, `EmotionalVocabulary`, `MemoryType`, `MemoryImportance` types
- **API optimizations**: removed dead profile load from chat route, moved Anthropic client to module level in session/open, fixed stale comments
- Migration 017: DROP TABLE for all 4 legacy tables
- Production tables: 7 (down from 9)

## 2026-02-11 (session 3) — Strategist Revamp + Data Model Redesign
- **Unified Strategist**: `prepareSession()` replaces two divergent code paths (`generateInitialBriefing` for first session, `planSession` for returning sessions). One function handles all sessions — inputs grow richer over time.
- **New data model**: `user_knowledge` table replaces `behavioral_intel` arrays + `coach_memories`. Each knowledge entry is tagged with category (trigger, breakthrough, resistance, vocabulary, fact, etc.), source, and importance. Deduped by content+category.
- **New briefing fields**: `leverage_point` (strength + goal + obstacle), `curiosities` (what to explore), `tension_narrative` (evolving understanding) replace `session_strategy` and `journey_narrative`
- `stage_of_change` moved from `behavioral_intel` to `profiles` table (user-level state, not accumulated knowledge)
- `buildKnowledgeUpdates()` replaces `updatePersonModel()` — produces individual knowledge entries instead of flat array merges
- Close pipeline uses `Promise.allSettled` for error isolation (notes + reflection run independently)
- Migration 016: `user_knowledge` + `sim_user_knowledge` tables, new briefing columns, 10+ dead columns dropped
- Admin simulator fully updated: clones `user_knowledge`, uses `prepareSession`, new briefing columns
- Admin intel dashboard redesigned: shows knowledge entries grouped by category, new briefing sections
- Deleted `strategist.ts` and `planSession.ts` — old Strategist code paths fully replaced
- Legacy transition: `behavioral_intel` and `coach_memories` tables kept, chat route fallback still reads them

## 2026-02-11 (session 2) — Strategist Structural Cleanup
- **Bug fix**: Growth edges merge — reflection updates were silently discarded (shape mismatch: per-lens map vs bucket arrays). Added `mergeGrowthEdges()` in personModel.ts. Self-heals corrupted DB data.
- Created `packages/coaching/src/strategist/constants.ts` — single source of truth for GROWTH_LENS_NAMES, GROWTH_LENSES_DESCRIPTION, TENSION_GUIDANCE (was copy-pasted across 3 files)
- Removed FocusCardPrescription: dead interface + field + 4 consumer functions (never populated by LLM)
- Deleted `/api/strategist` route (superseded by `/api/session/open`)
- Deleted `/api/extract-intel` route (superseded by `reflectOnSession()`)
- Deleted `/api/migrate-b44` route (one-time migration, already executed)
- Deleted `useBehavioralIntel` hook (exported but never imported)
- Deleted `packages/coaching/src/extraction/` — entire v1 intel package (3 files, superseded by reflect.ts + personModel.ts)
- Removed dead exports from `@toney/coaching`: extractBehavioralIntel, mergeIntel, ExtractionResult, analyzeBetaConversation, BetaAnalysis
- Deleted `packages/constants/src/topics.ts` — v1 topic system (7 topic definitions + colors), no consumers. Removed export from constants index.

## 2026-02-11 (session 1) — Coaching Quality
- Coach prompt: hypothesis abandonment — Coach now watches for misalignment signals (corrections, flat answers, contradictions) and resets its model instead of doubling down
- Quiz Q3 rewritten: "dinner you can't afford" → "something for yourself you'd enjoy" (self-receiving, income-agnostic)
- Quiz Q4: added "You always have to be the one paying" option
- Quiz Q4: "You pretend money doesn't exist" softened to "You don't deal with the money stuff"
- Quiz Q7: added "Feel satisfied with what I have" goal
- Strategist hypothesis now framed as testable proposition, not locked-in diagnosis

## 2026-02-10 (session 3)
- End Session button: shows after card saved OR 20+ messages exchanged (never on first session unless card saved)
- End Session button is always active when visible — no more disabled/grayed state
- After session ends: "Start Session" button appears in header, bottom bar shows only "Home" link
- Starting new session shows previous session's messages collapsed with a "Previous session" toggle
- Previous messages render dimmed (50% opacity), cards shown as plain text (no save buttons)
- Session notes: "Added to Rewire" section now shows only cards the user actually saved, not LLM-guessed from transcript

## 2026-02-10 (session 2)
- Streaming: all Coach responses (opening + chat) stream word-by-word via SSE
- Opening message latency reduced: planSession runs first, then opening streams in parallel with DB saves
- Renamed "Save to Toolkit" → "Save to Rewire" across all UI and prompts
- End Session button: visible (dimmed) after 4+ messages, highlights and activates after saving a card
- Session restart UX: "New Session" button inline in chat after ending, old messages preserved with visual divider
- Session state persists across refresh: sessionHasCard + sessionStatus restored from DB on load
- Message type extended with 'divider' role for inline session boundaries

## 2026-02-10 (session 1)
- Quiz redesigned: 7 behavioral questions replacing old feeling-based quiz
  - Q1: Balance checking (kept), Q2: Stress response behavior (new), Q3: Social money scenario (later rewritten to self-receiving in session 2)
  - Q4: Mirror/identity (kept), Q5: Stress frequency (new), Q6: Money strength (new)
  - Q7: Multi-select goals — "What would feel like progress?" (absorbed from separate screen)
- Goals screen eliminated — Q7 replaces the standalone OnboardingPattern page
- Tension scoring moved from client-side points to Strategist LLM determination
- First session Coach no longer says "last time we talked"
- Onboarding finishes into chat (was: home screen)
- Quiz answer format for Strategist: human-readable "Q → A" lines instead of raw JSON

## 2026-02-09 (session 3)
- All v3 rearchitecture + onboarding v2 committed (4 commits, was all uncommitted)
- Session lifecycle wired: auto-open on chat, 12h boundary detection, session resumption
- Deferred session close: returning after 12h closes old session and opens new one in single call
- "End Session" button appears after 4+ messages (was: only after card co-created)
- Removed raw session creation fallback — all sessions go through openSessionPipeline
- Deleted stray data migration files from repo root

## 2026-02-09 (session 2)
- Onboarding redesigned: 15 screens → 10 screens
- New "What's going on with money right now?" prompt captures user's specific situation
- Style quiz eliminated — balanced defaults, Coach learns preferences over time
- Tension reveal + emotional why combined into single screen with "Start coaching" CTA
- New `what_brought_you` profile field feeds Coach, Strategist, and planSession
- Migration 014: `what_brought_you` column on profiles

## 2026-02-09
- Coaching engine rearchitected: 3 agents → 2 agents (Observer killed)
- Strategist decomposed into planSession, reflectOnSession, updatePersonModel
- Pipeline orchestration layer: openSessionPipeline + closeSessionPipeline (pure functions, no DB/framework dependency)
- Session notes engine: user-facing 4-field format (headline, narrative, keyMoments?, cardsCreated?)
- Session lifecycle: Coach opens with context-aware greeting, session closes with notes display
- In-chat card co-creation via [CARD] markers with interactive DraftCard component
- Focus card widget removed from home screen
- Closing message removed — session notes are the ending
- API routes rewritten as thin shells over pipelines
- NOTE: All changes uncommitted — pending onboarding redesign

## 2026-02-08
- Admin simulator revamped to use v2 coaching engine (3-agent: Coach + Observer + Strategist)
- Replaced simulator_personas with sim_profiles as single source of truth
- All simulator tables consolidated to sim_* naming (sim_runs, sim_messages, sim_conversations)
- Dropped unused v1 tables: simulator_personas, simulator_messages
- Removed all v1 backward-compat code (evaluate.ts, poll route, run detail page)
- Chat logic extracted to lib/simulator/chat.ts — direct function calls instead of HTTP self-calls
- Coach greeting for cloned personas (Coach speaks first)
- DB rename: `conversations` → `sessions`, `conversation_id` → `session_id` across entire codebase (~40 files)
- Types renamed: `Conversation` → `Session`, `ConversationWithMessageCount` → `SessionWithMessageCount`
- Hooks renamed: `useConversation` → `useSession`, `currentConversationId` → `currentSessionId`
- Dead v1 fields removed from PromptContext: `topicKey`, `isFirstTopicConversation`, `otherTopics`
- Dead v1 columns dropped: `pattern_type`, `pattern_score`, `topic_key`, `engine_version`
- `beta_analytics` table dropped
- Migration 012 added (rename + cleanup SQL)

## 2025-02-06
- Coaching engine v2: 3-agent architecture (Coach, Observer, Strategist)
- Topics removed — conversations are now session-based
- Focus card system: one active card on home screen, daily tracking, graduation
- Prompt caching with SystemPromptBlock[] (~80% cost reduction)
- Observer agent: per-turn deflection/breakthrough/emotional signal detection
- Strategist agent: session boundary briefings, coaching narrative, Focus card prescription

## 2025-02-04
- Visual redesign of Rewire screen as personal toolkit
- Focus badge (indigo) on active cards, graduation badge (emerald)

## 2025-02-03
- Personalized coaching flow with 5 card types
- Save UX improvements

## 2025-02-02
- Humanized simulated user messages
- Live DB schema migration fixes
