# Toney — Changelog

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
