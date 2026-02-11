# Toney — Changelog

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
