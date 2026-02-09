# Toney — AI Money Coach (Monorepo)

## What is this?
Toney is a mobile-first AI coaching app that helps people understand and transform their emotional relationship with money. Not a chatbot with a good prompt — a personalized coaching program that uses chat as one of its tools. This monorepo contains the mobile app and admin dashboard, sharing types, constants, and a 3-agent coaching engine.

## Monorepo Structure
- **Package manager:** pnpm (with Turborepo)
- **Apps:** `apps/mobile` (user-facing PWA) + `apps/admin` (admin dashboard)
- **Shared packages:** `packages/types`, `packages/constants`, `packages/coaching`, `packages/config-typescript`
- **Database:** One shared Supabase instance (migrations in `supabase/`)

## Tech Stack
- **Framework:** Next.js 16 (App Router, `src/` directory)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React (not Heroicons, not FontAwesome)
- **Auth (mobile):** Supabase Google OAuth
- **Auth (admin):** Password-based cookie auth
- **Database:** Supabase PostgreSQL with Row Level Security
- **AI:** Anthropic Claude via `@anthropic-ai/sdk` (3 agents — see Coaching Engine below)
- **State (mobile):** React Context (`ToneyContext`) — no Redux, no Zustand
- **Deployment target:** Vercel (two projects) + Supabase hosted

## Build & Run
```bash
pnpm install             # install all dependencies
pnpm build               # build all apps
pnpm dev                 # dev servers (mobile:3000, admin:3001)
pnpm dev:mobile          # mobile only
pnpm dev:admin           # admin only
pnpm build:mobile        # build mobile only
pnpm build:admin         # build admin only
pnpm lint                # lint all
```
Node 25.6.0 required (at `/opt/homebrew/bin`). If build fails with node not found:
```bash
export PATH="/opt/homebrew/bin:$PATH" && pnpm build
```

## Project Structure
```
toney/
├── apps/
│   ├── mobile/                   # User-facing PWA (@toney/mobile)
│   │   └── src/
│   │       ├── app/              # Pages + API routes
│   │       │   └── api/
│   │       │       ├── chat/     # Coach agent endpoint (Sonnet, every message)
│   │       │       ├── observer/ # Observer agent endpoint (Haiku, fire-and-forget after each response)
│   │       │       ├── strategist/ # Strategist agent endpoint (Sonnet, session boundaries)
│   │       │       ├── focus/    # Focus card API (GET current, POST complete/skip)
│   │       │       └── extract-intel/ # Legacy extraction (kept for Strategist)
│   │       ├── components/       # onboarding, chat, home, layout, rewire, wins, auth
│   │       ├── context/          # ToneyContext (global state)
│   │       ├── hooks/            # useProfile, useConversation, useFocusCard, useHomeIntel, etc.
│   │       ├── lib/supabase/     # Client/server Supabase setup
│   │       └── middleware.ts     # Auth session refresh
│   │
│   └── admin/                    # Admin dashboard (@toney/admin, port 3001)
│       └── src/
│           ├── app/              # login, dashboard (users, conversations, intel, metrics)
│           ├── components/       # LoginForm, Sidebar, StatCard, etc.
│           ├── lib/              # queries/, auth.ts, format.ts, supabase/admin.ts
│           └── middleware.ts     # Admin cookie auth
│
├── packages/
│   ├── types/                    # @toney/types — shared TypeScript types
│   ├── constants/                # @toney/constants — tensions, questions, styles, colors
│   ├── coaching/                 # @toney/coaching — 3-agent engine (see below)
│   │   └── src/
│   │       ├── prompts/          # Coach prompt builder (SystemPromptBlock[], cache-optimized)
│   │       ├── observer/         # Observer agent (analyzeExchange — Haiku)
│   │       ├── strategist/       # Strategist agent (runStrategist, generateInitialBriefing — Sonnet)
│   │       ├── session/          # Session boundary detection (>12h gap = new session)
│   │       └── extraction/       # Legacy intel extraction (used by Strategist internally)
│   └── config-typescript/        # @toney/config-typescript — shared tsconfig
│
├── supabase/migrations/          # Shared database schema + RLS (001-009)
└── _prototype/                   # Original prototype (reference only)
```

## Coaching Engine v2 — 3-Agent Architecture

The coaching engine uses three AI agents working in concert. All agent logic lives in `packages/coaching/`. API routes in `apps/mobile/src/app/api/` are thin orchestration layers (auth + data loading + save results).

### The Three Agents

| Agent | Model | Temp | When it runs | What it does |
|-------|-------|------|-------------|--------------|
| **Coach** | Sonnet | 0.7 | Every user message | The main chat endpoint (`/api/chat`). This is the original Sonnet call that was always there — not a new agent. What changed in v2 is what it reads: when a Strategist briefing exists, it reads the briefing instead of raw data dumps. When no briefing exists (first conversation, simulator), it falls back to the legacy prompt path (`buildSystemPromptBlocks`). Prompt-cached. |
| **Observer** | Haiku | 0 | Fire-and-forget after each Coach response | New in v2. Lightweight per-turn analysis. Detects deflections, breakthroughs, emotional signals, practice check-ins. Writes signals to `observer_signals` table. Replaced the old "every 5th message" Sonnet extraction. |
| **Strategist** | Sonnet | 0.3 | On session boundaries (>12h gap) + after onboarding | New in v2. Reads Observer signals + all user data. Produces a "Coach Briefing" — a narrative coaching document the Coach reads instead of raw data dumps. Handles clinical sequencing, journey narrative, Focus card prescription. |

**The Coach is the existing chat endpoint, not a separate new system.** The Observer and Strategist are new agents that wrap around it — the Observer watches what the Coach produces, the Strategist prepares what the Coach reads. The Coach itself is the same Sonnet call with the same 10 prompt modules, just with a better input (briefing instead of raw arrays) when one is available.

### Data Flow (NOT real-time)
```
User message → Coach (/api/chat, reads static briefing) → Response
                                                              ↓
                                                       Observer (async, fire-and-forget)
                                                              ↓
                                                       observer_signals table
                                                              ↓
                                          [next session boundary: >12h gap]
                                                              ↓
                                                       Strategist runs
                                                              ↓
                                                       New coaching_briefings row
                                                              ↓
                                          [next message: Coach reads fresh briefing]
```

The Observer and Strategist do NOT feed the Coach in real-time. The Coach reads a static briefing for the entire session. Observer signals accumulate in the DB and are consumed by the Strategist between sessions.

### Prompt Caching
System prompt is structured as `SystemPromptBlock[]` with `cache_control: { type: 'ephemeral' }`:
- Block 1: Core coaching principles (~1500 tokens, cached across ALL users)
- Block 2: Strategist briefing OR legacy context (cached within a session)
- Messages: `cache_control` on second-to-last message for incremental caching

~80% input cost reduction vs v1 (uncached single prompt).

### Session Model
- **No topics** — conversations are session-based, not topic-bounded
- **New session**: first message after >12h gap
- **Session boundary**: triggers Strategist to write new briefing
- **Hash routing**: `#home`, `#chat`, `#rewire`, `#wins` (no `#chat/topicKey`)
- **`finishOnboarding()`** takes no arguments — goes straight to home screen

### Focus Card
One active card per user on the home screen. Set by the Strategist.
- Lifecycle: created in conversation → set as Focus → tracked daily → graduated when internalized → in toolkit forever
- Home screen shows: title, content, "Did it" / "Not today" buttons, optional reflection input
- API: `GET /api/focus` (current card), `POST /api/focus` (complete/skip with optional reflection)
- Hook: `useFocusCard()` — `fetchFocusCard()`, `completeFocusCard(reflection?)`, `skipFocusCard()`

### Strategist Triggers
The Strategist runs via `POST /api/strategist` with a `trigger` parameter:

| Trigger | When | Context loaded |
|---------|------|---------------|
| `onboarding` | After user finishes onboarding | Profile only (minimal) |
| `session_start` | First message after >12h gap | Full: profile, behavioral_intel, coach_memories (30), wins (10), rewire_cards (20), previous briefing, observer signals from last session |
| `session_end` | End of session (wired but no UI trigger yet) | Same as session_start + full session transcript |
| `urgent` | Observer detects critical moment | Same as session_end |

### Strategist Output — Full Spec

The Strategist produces a `StrategistOutput` with these fields. Each field is saved to a specific table:

**Saved to `coaching_briefings` table (one row per run, versioned):**

| Field | Type | What it is |
|-------|------|-----------|
| `briefing_content` | text | Full 7-section narrative document (see sections below) |
| `hypothesis` | text | One-sentence coaching thesis for this person right now |
| `session_strategy` | text | 1-2 sentences on what this session should accomplish |
| `journey_narrative` | text | 2-3 sentence story arc of their coaching journey |
| `growth_edges` | JSONB | 7 growth lenses with status per lens (see below) |
| `version` | integer | Auto-incrementing per user |

**Merged into `behavioral_intel` table (one row per user, cumulative):**

| Field | Type | Merge behavior |
|-------|------|---------------|
| `triggers` | string[] | Appended (deduplicated) |
| `emotional_vocabulary.used_words` | string[] | Appended (deduplicated) |
| `emotional_vocabulary.avoided_words` | string[] | Appended (deduplicated) |
| `emotional_vocabulary.deflection_phrases` | string[] | Appended (deduplicated) |
| `resistance_patterns` | string[] | Appended (deduplicated) |
| `breakthroughs` | string[] | Appended (deduplicated) |
| `coaching_notes` | string[] | Appended (deduplicated) |
| `stage_of_change` | enum | Replaced (not appended) |
| `journey_narrative` | text | Replaced (also in coaching_briefings) |
| `growth_edges` | JSONB | Replaced (also in coaching_briefings) |
| `last_strategist_run` | timestamp | Set to now |

**Applied to `rewire_cards` table via `focus_card_prescription`:**

| Action | What happens |
|--------|-------------|
| `create_new` | Clears current focus, creates new card with `prescribed_by: 'strategist'`, sets as focus |
| `set_existing` | Clears current focus, promotes existing card by ID to focus |
| `keep_current` | No change |
| `graduate` | Graduates current focus card (`graduated_at` timestamp), then creates new focus card |

Each prescription includes a `rationale` explaining why.

### Coaching Briefing Sections
The `briefing_content` is a narrative document (not arrays/bullet points) with 7 sections:
- **WHO THEY ARE** — tension, life context, emotional why in their own words, cross-answer hypothesis
- **WHERE THEY ARE IN THEIR JOURNEY** — narrative arc, what shifted, what's stabilizing vs raw, stage of change from behavior
- **WHAT WE KNOW** — triggers (specific situations), emotional vocabulary (used/avoided/deflection), resistance patterns, breakthroughs, what coaching approaches work
- **THEIR FOCUS RIGHT NOW** — active Focus card, completion data, whether it's landing
- **WHERE GROWTH IS AVAILABLE** — which growth lenses are active/stabilizing/not ready, next edge
- **SESSION STRATEGY** — what to accomplish, what to check in on, what NOT to push, how to handle urgency
- **COACHING STYLE** — tone, depth, learning style, what language resonates vs falls flat

### Growth Lenses (Strategist thinking framework, not user-facing)
7 dimensions stored as JSONB in `growth_edges` with status `active` | `stabilizing` | `not_ready` per lens:
- **Self-receiving** — Can they spend on themselves without guilt? Accept gifts, rest?
- **Earning mindset** — Do they believe they can generate income? Ask for what they're worth?
- **Money identity** — Do they see themselves as someone who can have/make/manage money?
- **Money relationships** — Can they have healthy money conversations with partners, family, friends?
- **Financial awareness** — Do they know their numbers? Engaged or avoiding?
- **Decision confidence** — Can they make money decisions without spiraling or freezing?
- **Future orientation** — Can they plan without anxiety? Do they trust the future?

### Coach Memories
Specific facts, decisions, life events, and commitments the Coach remembers across sessions. Stored in `coach_memories` table.
- Each memory has `importance` ranking (`high` | `medium` | `low`) and `active` flag
- Up to 30 active memories fed to the Strategist
- Can expire (set `active: false`)
- Examples: "Has a partner named David", "Committed to checking balance weekly", "Lost her job in January"

## Shared Packages

### @toney/types
All TypeScript type definitions: `TensionType`, `Profile`, `Message`, `Conversation`, `BehavioralIntel`, `Win`, `RewireCard`, `CoachMemory`, `CoachingBriefing`, `ObserverSignal`, `SystemPromptBlock`, plus admin aggregate types.

### @toney/constants
Tension details/colors, onboarding questions, style options, stage/engagement colors. Exports `tensionColor()`, `stageColor()`, `identifyTension()`, `ALL_TENSIONS`, `ALL_STAGES`.

### @toney/coaching
3-agent coaching engine. Exports:
- **Coach**: `buildSystemPromptBlocks()`, `buildSystemPromptFromBriefing()`, `buildLegacyBriefing()`, `buildSystemPrompt()` (legacy compat)
- **Observer**: `analyzeExchange()`
- **Strategist**: `runStrategist(ctx: StrategistContext)`, `generateInitialBriefing(profile)` — returns `StrategistOutput`
- **Types**: `StrategistContext`, `StrategistOutput`, `FocusCardPrescription`
- **Session**: `detectSessionBoundary()`
- **Extraction**: `extractBehavioralIntel()`, `mergeIntel()` (used by Strategist internally)

## Key Architecture Decisions

### Prompt System
`packages/coaching/src/prompts/systemPromptBuilder.ts` assembles the system prompt from 10 modules:
`safetyRails`, `awareMethod`, `tensionPrompts`, `tonePrompts`, `depthPrompts`, `learningStylePrompts`, `biasDetection`, `stageMatching`, `motivationalInterviewing`, `firstConversation`

When a Strategist briefing exists, the Coach reads the briefing instead of legacy-assembled context. Legacy path is a fallback for users who haven't triggered a Strategist run yet.

### Coaching Tone
Tone is a continuous 1-10 scale (not discrete buckets). 1-4 = Gentle, 5-6 = Balanced, 7-10 = Direct.

### Money Tensions (not "patterns")
7 tension types: `avoid`, `worry`, `chase`, `perform`, `numb`, `give`, `grip`. Use "tension" terminology.

### Observer (replaced v1 extraction)
Runs on every turn via Haiku (fire-and-forget). Replaced the old "every 5th message" Sonnet extraction. Detects: deflection, breakthrough, emotional, practice_checkin, topic_shift. Signals stored in `observer_signals` and consumed by Strategist between sessions.

### Mobile-First PWA
All mobile UI constrained to `max-w-[430px]` centered on desktop.

## Data Model (10 tables)
- `profiles` — user settings (tension_type, tone, depth, learning_style, etc.)
- `conversations` — chat sessions (+ session_number, session_notes, session_status)
- `messages` — individual chat messages
- `rewire_cards` — saved insight cards (+ is_focus, focus_set_at, graduated_at, times_completed, last_completed_at, prescribed_by)
- `wins` — small victories (text, tension_type)
- `behavioral_intel` — one row per user, cumulative coaching intelligence:
  - `triggers` (string[]), `emotional_vocabulary` ({used_words, avoided_words, deflection_phrases}), `resistance_patterns` (string[]), `breakthroughs` (string[]), `coaching_notes` (string[]), `stage_of_change` (enum)
  - v2 fields: `journey_narrative` (text), `growth_edges` (JSONB), `last_strategist_run` (timestamp)
- `coach_memories` — specific facts/decisions/commitments (content, importance, active, expires_at)
- `coaching_briefings` — Strategist output per session (briefing_content, hypothesis, session_strategy, journey_narrative, growth_edges, version)
- `observer_signals` — per-turn Observer detections (signal_type, content, confidence, urgency_flag, session_id)
  - Signal types: `deflection`, `breakthrough`, `emotional`, `practice_checkin`, `topic_shift`
- `beta_analytics` — usage tracking

Profile auto-created on signup via DB trigger.

## Coding Conventions
- Path alias: `@/*` maps to `./src/*` (per app)
- Shared imports: `@toney/types`, `@toney/constants`, `@toney/coaching`
- App-internal imports: `@/lib/supabase/...`, `@/components/...`, `@/hooks/...`
- Supabase client (mobile): `createClient()` from `@/lib/supabase/server` or `@/lib/supabase/client`
- Supabase client (admin): `createAdminClient()` from `@/lib/supabase/admin` (service role key)
- Shared packages use unbundled TypeScript — Next.js transpiles via `transpilePackages`

## Gotchas
- Supabase `StageOfChange` enum needs explicit cast from string
- Supabase query builder `.rpc()` has no `.catch()` — always use try/catch
- `middleware.ts` uses deprecated Next.js 16 pattern (warning only, still works)
- Shared package names use `@toney/*` prefix
- Internal API calls (observer, strategist) need `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL`
- **No topics** — topics were removed in v2. No `activeTopic`, `topicConversations`, `selectTopic()`, or `OnboardingTopicPicker`. Conversations are session-based.
- **`finishOnboarding()`** takes no arguments — onboarding goes: welcome → questions → pattern → style_intro → style_quiz → home
- Chat route: no `topicKey` parameter, no `[TOPIC_OPENER]` logic

## Deployment (Vercel)
- **GitHub repo:** `tamiravital/Toney` (private)
- **Mobile:** https://toney-mobile.vercel.app (project: `toney-mobile`, root: `apps/mobile`)
- **Admin:** https://toney-admin.vercel.app (project: `toney-admin`, root: `apps/admin`)
- Both auto-deploy on push to `main`
- Build command uses turbo filter: `cd ../.. && pnpm turbo build --filter=@toney/mobile`
- Install command: `cd ../.. && pnpm install`
- Node version: 22.x on Vercel

## Environment Variables

### Mobile (`apps/mobile/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SITE_URL=          # for internal API calls (observer, strategist)
```

### Admin (`apps/admin/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
```
