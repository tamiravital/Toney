---
name: review
description: Review recent changes for correctness. Checks the Toney gotchas list, sim-mode support, Supabase pitfalls, and common mistakes. Run after any non-trivial change.
---

Review the most recent changes for correctness. This is the Toney-specific checklist — things the build won't catch.

## Step 1: Identify what changed

Run `git diff --name-only HEAD~1` (or the appropriate range for uncommitted work via `git diff --name-only` + `git diff --name-only --cached`). Build a list of every changed file.

Categorize the changes:
- **Coaching prompts** — anything in `packages/coaching/src/`
- **API routes** — anything in `apps/mobile/src/app/api/`
- **Database** — new migrations in `supabase/migrations/`
- **Types** — changes to `packages/types/`
- **Components** — anything in `apps/mobile/src/components/` or `apps/admin/src/components/`
- **Context/hooks** — `ToneyContext.tsx` or `apps/mobile/src/hooks/`

## Step 2: Supabase gotchas

For every file that touches Supabase queries (`.from()`, `.update()`, `.insert()`, `.select()`):

- [ ] **No unknown columns in updates** — If ANY column in `.update({...})` doesn't exist on the table, the ENTIRE update silently fails. Check every column name against the actual schema in `supabase/migrations/`.
- [ ] **PromiseLike handled** — Supabase query builder returns PromiseLike, not Promise. Every query must be in try/catch or use `.then()`. A bare `supabase.from(...).insert(...)` without `await` silently does nothing.
- [ ] **No phantom columns** — `ended_at`, `message_count`, `session_number` don't exist on `sessions`. Check that no code references them.
- [ ] **Dynamic table names typed as `any`** — `supabase.from(dynamicString)` returns `never`. If using `ctx.table()` (sim mode), the supabase client must be typed as `any`.

## Step 3: Sim-mode support

If any API route was added or modified:

- [ ] **Uses `resolveContext()`** — Every API route in `apps/mobile/src/app/api/` must call `resolveContext()` from `@/lib/supabase/sim` to support both real auth and sim mode.
- [ ] **Uses `ctx.table()` for table names** — Never hardcode table names. `ctx.table('messages')` returns `'sim_messages'` in sim mode.
- [ ] **Sim tables exist** — If a new table was added, check that a `sim_` mirror exists (see migration check below).

## Step 4: Type safety

If `packages/types/` changed:

- [ ] **Barrel export updated** — New types added to `packages/types/src/index.ts`
- [ ] **All consumers updated** — Grep for the old type name if renamed. Check that no file imports the old name.
- [ ] **Coaching package aligned** — If a type changed shape (new field, removed field), check that `packages/coaching/` still compiles against it.

## Step 5: API route checks

For any new or modified API route:

- [ ] **`maxDuration` exported** — Any route that calls Claude MUST export `maxDuration`. Routes using `after()` for background work should use `maxDuration = 300` (Vercel Pro). Simple LLM routes can use `maxDuration = 60`.
- [ ] **Usage tracking** — Any route that calls Claude should call `saveUsage()` after getting the response. Check `apps/mobile/src/lib/saveUsage.ts` for the pattern.
- [ ] **Model IDs correct** — Haiku: `claude-haiku-4-5-20251001`. Sonnet: `claude-sonnet-4-5-20250929`. NOT `claude-haiku-4-20250414`.
- [ ] **`after()` error handling** — Any `after()` callback must wrap in try/catch. Set `evolution_status='failed'` on error for evolution pipelines.

## Step 6: Context/state checks

If `ToneyContext.tsx` or any hook changed:

- [ ] **`loadingChat` never starts `false`** — Must initialize `true`. If it starts `false`, the suggestion picker flashes for one frame.
- [ ] **`endSession()` clears messages** — Must call `setMessages([])` or users get stuck on old messages.
- [ ] **Session boundary detection runs first** — The 12h boundary check must run BEFORE suggestions/messages guards in the auto-open effect.

## Step 7: Report

Summarize findings as:
- **Clean** — No issues found
- **Issues** — List each issue with the file, line, and what needs fixing

If issues are found, fix them. Don't just report — fix, then run the build.
