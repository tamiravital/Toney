# Toney — AI Money Coach (Monorepo)

## What is this?
Toney is a mobile-first AI coaching app that helps people understand and transform their emotional relationship with money. This monorepo contains the mobile app and admin dashboard, sharing types, constants, and coaching engine.

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
- **AI:** Anthropic Claude Sonnet (`claude-sonnet-4-5-20250929`) via `@anthropic-ai/sdk`
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
│   │       ├── app/              # Pages + API routes (chat, auth, extract-intel)
│   │       ├── components/       # onboarding, chat, home, layout, rewire, wins, auth
│   │       ├── context/          # ToneyContext (global state)
│   │       ├── hooks/            # useProfile, useConversation, etc.
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
│   ├── coaching/                 # @toney/coaching — prompt builder + extraction engines
│   └── config-typescript/        # @toney/config-typescript — shared tsconfig
│
├── supabase/migrations/          # Shared database schema + RLS
└── _prototype/                   # Original prototype (reference only)
```

## Shared Packages

### @toney/types
All TypeScript type definitions: `TensionType`, `Profile`, `Message`, `Conversation`, `BehavioralIntel`, `Win`, `RewireCard`, `CoachMemory`, plus admin aggregate types (`UserWithStats`, `OverviewStats`, etc.).

### @toney/constants
Tension details/colors, onboarding questions, style options, stage/engagement colors. Exports `tensionColor()`, `stageColor()`, `identifyTension()`, `ALL_TENSIONS`, `ALL_STAGES`.

### @toney/coaching
Prompt system builder (`buildSystemPrompt`) and extraction engines (`extractBehavioralIntel`, `closeSession`, `analyzeBetaConversation`). Only used by mobile app.

## Key Architecture Decisions

### Prompt System
`packages/coaching/src/prompts/systemPromptBuilder.ts` assembles the system prompt from 10 modules:
`safetyRails`, `awareMethod`, `tensionPrompts`, `tonePrompts`, `depthPrompts`, `learningStylePrompts`, `biasDetection`, `stageMatching`, `motivationalInterviewing`, `firstConversation`

### Coaching Tone
Tone is a continuous 1-10 scale (not discrete buckets). 1-4 = Gentle, 5-6 = Balanced, 7-10 = Direct.

### Money Tensions (not "patterns")
7 tension types: `avoid`, `worry`, `chase`, `perform`, `numb`, `give`, `grip`. Use "tension" terminology.

### Behavioral Intel Extraction
Fire-and-forget every 5th user message. Extracts triggers, emotional vocabulary, resistance patterns, breakthroughs.

### Mobile-First PWA
All mobile UI constrained to `max-w-[430px]` centered on desktop.

## Data Model (7 tables)
- `profiles` — user settings (tension_type, tone, depth, learning_style, etc.)
- `conversations` — chat sessions
- `messages` — individual chat messages
- `rewire_cards` — saved insight cards
- `wins` — small victories
- `behavioral_intel` — extracted coaching data
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
- The extraction endpoint (`/api/extract-intel`) is called internally via fetch — needs `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL`

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
NEXT_PUBLIC_SITE_URL=          # optional, for production extraction calls
```

### Admin (`apps/admin/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
```
