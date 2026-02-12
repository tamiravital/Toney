# Toney — AI Money Coach (Monorepo)

## What is this?
Toney is a mobile-first AI coaching app that helps people understand and transform their emotional relationship with money. Not a chatbot with a good prompt — a personalized coaching program that uses chat as one of its tools. This monorepo contains the mobile app and admin dashboard, sharing types, constants, and a 2-agent coaching engine.

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
- **AI:** Anthropic Claude via `@anthropic-ai/sdk` (2 agents — see Coaching Engine below)
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
│   │       │       ├── session/  # Session open + close pipelines
│   │       │       ├── seed/     # Seed understanding after onboarding
│   │       │       └── focus/    # Focus card API (GET current, POST complete/skip)
│   │       ├── components/       # onboarding, chat, home, layout, rewire, wins, auth
│   │       ├── context/          # ToneyContext (global state)
│   │       ├── hooks/            # useProfile, useSession, useRewireCards, useWins, useFocusCard
│   │       ├── lib/supabase/     # Client/server Supabase setup
│   │       └── middleware.ts     # Auth session refresh
│   │
│   └── admin/                    # Admin dashboard (@toney/admin, port 3001)
│       └── src/
│           ├── app/              # login, dashboard (users, sessions, intel, metrics)
│           ├── components/       # LoginForm, Sidebar, StatCard, etc.
│           ├── lib/              # queries/, auth.ts, format.ts, supabase/admin.ts
│           └── middleware.ts     # Admin cookie auth
│
├── packages/
│   ├── types/                    # @toney/types — shared TypeScript types
│   ├── constants/                # @toney/constants — tensions, questions, styles, colors
│   ├── coaching/                 # @toney/coaching — 2-agent engine (see below)
│   │   └── src/
│   │       ├── prompts/          # Coach prompt builder (SystemPromptBlock[], cache-optimized)
│   │       ├── strategist/       # Strategist: prepareSession, evolveUnderstanding, seedUnderstanding
│   │       ├── session/          # Session boundary detection (>12h gap = new session)
│   │       ├── session-notes/    # User-facing session notes (Haiku)
│   │       └── pipelines/        # openSessionPipeline, closeSessionPipeline (pure functions)
│   └── config-typescript/        # @toney/config-typescript — shared tsconfig
│
├── supabase/migrations/          # Shared database schema + RLS (001-018)
└── _prototype/                   # Original prototype (reference only)
```

## Coaching Engine — 2-Agent Architecture

The coaching engine uses two agents. All agent logic lives in `packages/coaching/`. API routes in `apps/mobile/src/app/api/` are thin orchestration layers (auth + data loading + pipeline + save).

### The Two Agents

| Agent | Model | Temp | When it runs | What it does |
|-------|-------|------|-------------|--------------|
| **Coach** | Sonnet 4.5 | 0.7 | Every user message | The main chat endpoint (`/api/chat`). Reads the Strategist briefing. Requires a briefing to exist (no legacy fallback). Prompt-cached. |
| **Strategist** (decomposed) | Sonnet 4.5 / Haiku | varies | Session open + close | Decomposed into pipeline functions. Open: `prepareSession()` (Sonnet). Close: `evolveUnderstanding()` (Sonnet) + `generateSessionNotes()` (Haiku) in parallel. |

### Understanding Narrative — How Toney Learns

The system maintains a single evolving clinical narrative (`profiles.understanding`) that represents everything Toney knows about a person. This replaces the old category-based knowledge extraction.

**How it works:**
1. After onboarding, `seedUnderstanding()` creates an initial narrative from quiz answers + goals
2. After each session, `evolveUnderstanding()` reads the current narrative + transcript and produces an updated one
3. At session open, `prepareSession()` reads the pre-formed narrative — no reconstruction from fragments

The narrative is written in third person, 300-800 words, covering: triggers, breakthroughs, resistance patterns, emotional vocabulary, coaching observations, growth dimensions, and stage of change. It evolves — doesn't replace. Each update deepens what's known and integrates new observations in context.

A snapshot of the understanding BEFORE each evolution is stored in `sessions.narrative_snapshot` for trajectory tracking.

### Data Flow
```
[Onboarding] → seedUnderstanding() → profiles.understanding (initial narrative + tension)
                                            ↓
[Session open] → prepareSession() ← reads understanding → coaching_briefings (briefing for Coach)
                                            ↓
[Every message] → Coach (/api/chat) ← reads briefing → Response
                                            ↓
[Session close] → evolveUnderstanding() + generateSessionNotes() → updated profiles.understanding + session notes
```

### Prompt Caching
System prompt is structured as `SystemPromptBlock[]` with `cache_control: { type: 'ephemeral' }`:
- Block 1: Core coaching principles (~1500 tokens, cached across ALL users)
- Block 2: Strategist briefing (cached within a session)
- Messages: `cache_control` on second-to-last message for incremental caching

~80% input cost reduction vs v1 (uncached single prompt).

### Session Model
- **No topics** — sessions are time-bounded (>12h gap = new session)
- **New session**: first message after >12h gap
- **Session boundary**: triggers Strategist to write new briefing
- **Hash routing**: `#home`, `#chat`, `#rewire`, `#wins` (no `#chat/topicKey`)
- **`finishOnboarding()`** takes no arguments — goes straight to chat

### Cards (Co-Created in Chat)
Cards are co-created in-chat via `[CARD:category]...[/CARD]` markers, rendered as interactive DraftCard components.
- Categories: reframe, truth, plan, practice, conversation_kit
- Focus card widget removed from home screen
- API: `GET /api/focus` (current card), `POST /api/focus` (complete/skip with optional reflection)
- Hook: `useFocusCard()` — `fetchFocusCard()`, `completeFocusCard(reflection?)`, `skipFocusCard()`

### Session Lifecycle

| Event | Route | What runs |
|-------|-------|-----------|
| **Session open** | `POST /api/session/open` | `planSessionStep()` → builds briefing → streams opening message. If `previousSessionId` passed, runs `closeSessionPipeline()` first (deferred close). |
| **Session close** | `POST /api/session/close` | `closeSessionPipeline()`: `evolveUnderstanding()` (Sonnet) + `generateSessionNotes()` (Haiku) in parallel via `Promise.allSettled`. |
| **First session** | `POST /api/session/open` | `prepareSession()` — unified path for all sessions. Detects first session by absence of previous briefing. |
| **After onboarding** | `POST /api/seed` | `seedUnderstanding()` — creates initial understanding + determines tension type from quiz answers. |

### Strategist Output

The Strategist (`prepareSession()`) produces a `SessionPreparation` saved to `coaching_briefings`:

| Field | Type | What it is |
|-------|------|-----------|
| `briefing` | text | Full narrative briefing document the Coach reads |
| `hypothesis` | text | One-sentence coaching thesis for this person right now |
| `leveragePoint` | text | Their strength + goal + what's in the way — the fulcrum for change |
| `curiosities` | text | What the Coach should explore — open questions, not directives |
| `tensionLabel` | text | Tension type (first session only, from seed) |
| `secondaryTensionLabel` | text | Secondary tension (first session only, from seed) |

Session close produces an evolved understanding narrative via `evolveUnderstanding()`, which may also shift the `stage_of_change` on `profiles`.

### Coaching Briefing Assembly
The briefing document includes:
- **WHO THEY ARE AND WHERE THEY ARE** — the understanding narrative (pre-formed, not reconstructed)
- **HYPOTHESIS** — coaching thesis for this session
- **LEVERAGE POINT** — strength + goal + obstacle
- **CURIOSITIES** — what to explore
- **THEIR TOOLKIT** — rewire cards they've saved
- **RECENT WINS** — what they've logged
- **WHAT THEY SHARED** — quiz answers + goals
- **COACHING STYLE** — tone, depth, learning styles

## Shared Packages

### @toney/types
All TypeScript type definitions: `TensionType`, `Profile`, `Message`, `Session`, `Win`, `RewireCard`, `UserKnowledge`, `CoachingBriefing`, `SystemPromptBlock`, plus admin aggregate types.

### @toney/constants
Tension details/colors, onboarding questions, style options, stage/engagement colors. Exports `tensionColor()`, `stageColor()`, `identifyTension()`, `ALL_TENSIONS`, `ALL_STAGES`.

### @toney/coaching
2-agent coaching engine. Exports:
- **Coach**: `buildSystemPromptFromBriefing()`, `buildSessionOpeningBlock()`
- **Strategist**: `prepareSession()`, `evolveUnderstanding()`, `seedUnderstanding()`
- **Pipelines**: `openSessionPipeline()`, `closeSessionPipeline()`, `planSessionStep()`
- **Session**: `detectSessionBoundary()`
- **Session Notes**: `generateSessionNotes()`
- **Types**: `PrepareSessionInput`, `SessionPreparation`, `EvolveUnderstandingInput`, `EvolveUnderstandingOutput`, `SeedUnderstandingInput`, `SeedUnderstandingOutput`, `OpenSessionInput`, `OpenSessionOutput`, `CloseSessionInput`, `CloseSessionOutput`, `SessionNotesInput`

## Key Architecture Decisions

### Understanding Narrative (not knowledge fragments)
The system maintains a single evolving narrative on `profiles.understanding` instead of shredded category-based knowledge entries. The LLM thinks in narrative, not categories. `evolveUnderstanding()` (Sonnet) reads the current narrative + transcript and produces an updated one. No reconstruction from fragments at session open.

### Prompt System
`packages/coaching/src/prompts/systemPromptBuilder.ts` builds system prompt as two cache-optimized blocks:
- Block 1: Core coaching principles (static, cached across all users)
- Block 2: Strategist briefing content (per-user, cached within session)

The Coach requires a Strategist briefing to exist. No legacy fallback path.

### Coaching Tone
Tone is a continuous 1-10 scale (not discrete buckets). 1-4 = Gentle, 5-6 = Balanced, 7-10 = Direct.

### Money Tensions (not "patterns")
7 tension types: `avoid`, `worry`, `chase`, `perform`, `numb`, `give`, `grip`. Use "tension" terminology.

### Mobile-First PWA
All mobile UI constrained to `max-w-[430px]` centered on desktop.

## Data Model (7 tables)
- `profiles` — user settings (tension_type, tone, depth, learning_style, stage_of_change, understanding)
- `sessions` — chat sessions (+ session_number, session_notes, session_status, narrative_snapshot)
- `messages` — individual chat messages (session_id FK)
- `rewire_cards` — saved insight cards (+ is_focus, focus_set_at, graduated_at, times_completed, last_completed_at, prescribed_by)
- `wins` — small victories (text, tension_type)
- `user_knowledge` — tagged knowledge entries (used by focus card reflections only)
- `coaching_briefings` — Strategist output per session (briefing_content, hypothesis, leverage_point, curiosities, version)

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
- `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL` used for base URL in SSE responses
- **No topics** — topics were removed in v2. No `activeTopic`, `topicConversations`, `selectTopic()`, or `OnboardingTopicPicker`. Sessions are time-bounded.
- **`finishOnboarding()`** takes no arguments — onboarding goes: welcome → 7-question quiz → straight to chat
- Chat route: no `topicKey` parameter, no `[TOPIC_OPENER]` logic
- `user_knowledge` table still exists but is only written to by focus card reflections — the main coaching pipeline uses `profiles.understanding`

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
NEXT_PUBLIC_SITE_URL=          # for internal API calls
```

### Admin (`apps/admin/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
```
