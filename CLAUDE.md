# Toney — AI Money Coach

## What is this?
Toney is a mobile-first AI coaching app that helps people understand and transform their emotional relationship with money. It uses Claude Sonnet as the coaching engine and Supabase for auth/data. This is a **beta** product.

## Tech Stack
- **Framework:** Next.js 16 (App Router, `src/` directory)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React (not Heroicons, not FontAwesome)
- **Auth:** Supabase Google OAuth
- **Database:** Supabase PostgreSQL with Row Level Security
- **AI:** Anthropic Claude Sonnet (`claude-sonnet-4-5-20250929`) via `@anthropic-ai/sdk`
- **State:** React Context (`ToneyContext`) — no Redux, no Zustand
- **Deployment target:** Vercel + Supabase hosted

## Build & Run
```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # eslint
```
Node 25.6.0 required (at `/opt/homebrew/bin`). If build fails with node not found:
```bash
export PATH="/opt/homebrew/bin:$PATH" && npx next build
```

## Project Structure
```
src/
  app/                    # Next.js App Router pages + API routes
    api/chat/route.ts     # Main chat endpoint (calls Claude)
    api/extract-intel/    # Behavioral intel extraction endpoint
    auth/                 # OAuth callback + sign-in page
  components/
    auth/                 # SignInScreen
    chat/                 # ChatScreen, MessageReaction, SaveInsightSheet, ConversationRating
    home/                 # HomeScreen
    layout/               # MobileShell, TabBar, SettingsOverlay
    onboarding/           # Multi-step onboarding flow (Welcome, Pattern, Questions, StyleQuiz)
    rewire/               # RewireScreen (reframe cards)
    wins/                 # WinsScreen (progress tracking)
  context/
    ToneyContext.tsx       # Global state provider — all app state lives here
  hooks/
    useProfile.ts         # Profile CRUD
    useConversation.ts    # Conversation + message management
    useBehavioralIntel.ts # Intel read/write
    useRewireCards.ts     # Rewire card CRUD
    useWins.ts            # Win logging
  lib/
    constants/            # Tensions, onboarding questions, style options
    extraction/           # intelExtractor.ts, betaAnalyzer.ts
    prompts/              # 10 prompt modules + systemPromptBuilder.ts
    supabase/             # client.ts, server.ts, middleware.ts
  types/                  # TypeScript types (tension, user, chat, intel)
  middleware.ts           # Auth middleware (refreshes Supabase session)
supabase/
  migrations/             # SQL schema + RLS policies
_prototype/               # Original single-file React prototype (reference only)
```

## Key Architecture Decisions

### Prompt System
`src/lib/prompts/systemPromptBuilder.ts` assembles the system prompt from 10 modules:
`safetyRails`, `awareMethod`, `tensionPrompts`, `tonePrompts`, `depthPrompts`, `learningStylePrompts`, `biasDetection`, `stageMatching`, `motivationalInterviewing`, `firstConversation`

The prompt is built dynamically per-request based on user profile, behavioral intel, wins, and conversation state.

### Coaching Tone
Tone is a continuous 1-10 scale (not discrete buckets). 1-4 = Gentle, 5-6 = Balanced, 7-10 = Direct. It controls the entire coaching personality.

### Money Tensions (not "patterns")
The core concept is "tension" — a user's emotional relationship with money. Types: `avoid`, `worry`, `chase`, `perform`, `numb`, `give`, `grip`. Use "tension" terminology, not "pattern" (renamed in migration 002).

### Behavioral Intel Extraction
Runs as a fire-and-forget call every 5th user message. Claude analyzes the conversation and extracts behavioral patterns, stage of change, and other coaching-relevant data.

### Mobile-First PWA
All UI is constrained to `max-w-[430px]` centered on desktop. Designed as a mobile app experience. Has PWA manifest and apple-mobile-web-app meta tags.

## Data Model (7 tables)
- `profiles` — user settings (tension_type, tone, depth, learning_style, stage_of_change, etc.)
- `conversations` — chat sessions with message_count and optional rating
- `messages` — individual chat messages (role: user | assistant)
- `rewire_cards` — reframe/insight cards saved from conversations
- `wins` — small victories logged by the user
- `behavioral_intel` — extracted coaching data (JSON blobs)
- `beta_analytics` — usage tracking for beta period

Profile is auto-created on signup via a Supabase database trigger.

## Coding Conventions
- Path alias: `@/*` maps to `./src/*`
- Barrel exports via `index.ts` in types/, hooks/, constants/, components/onboarding/
- Supabase client: `createClient()` from `@/lib/supabase/server` (server components/routes) or `@/lib/supabase/client` (client components)
- API routes return 200 even on chat errors (with error message in response body) so UI degrades gracefully
- Non-critical data loads wrapped in try/catch with silent failures (intel, wins, rewire cards)
- Font: Geist Sans via `next/font/google`

## Gotchas
- Supabase `StageOfChange` enum needs explicit cast from string
- Supabase query builder `.rpc()` has no `.catch()` — always use try/catch
- `middleware.ts` uses deprecated Next.js 16 middleware pattern (warning only, still works)
- npm package names cannot have capital letters
- The extraction endpoint (`/api/extract-intel`) is called internally via fetch — needs `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL` env var in production

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SITE_URL=          # optional, for production extraction calls
```
