---
name: migration
description: Write a Supabase database migration for Toney. Handles the sim_ mirror table, TypeScript type updates, code consumer updates, and reminds about PROD/DEV application. Use when you need a schema change.
argument-hint: <describe the schema change>
---

The user needs a database schema change for Toney.

They said: $ARGUMENTS

---

## Step 1: Design the migration

Before writing SQL, answer:

1. **What table(s) are affected?** New table, new column, altered column, dropped column?
2. **Does it need RLS?** User-facing tables need RLS policies. Internal telemetry (like `llm_usage`) can skip RLS.
3. **Does it need indexes?** Any column used in WHERE clauses or JOINs should have one.
4. **Does it have foreign keys?** What's the ON DELETE behavior? (`CASCADE`, `SET NULL`, `RESTRICT`)
5. **Does it affect the simulator?** If yes, a `sim_` mirror is needed.

## Step 2: Determine the migration number

Read the latest migration file in `supabase/migrations/` to find the next number. The pattern is `NNN_descriptive_name.sql` (e.g., `036_profile_language.sql` → next is `037`).

## Step 3: Write the SQL

Create the migration file at `supabase/migrations/NNN_description.sql`.

Follow these patterns from existing migrations:

**Adding a column:**
```sql
ALTER TABLE table_name ADD COLUMN column_name TYPE DEFAULT default_value;
-- Mirror for simulator:
ALTER TABLE sim_table_name ADD COLUMN column_name TYPE DEFAULT default_value;
```

**Creating a table:**
```sql
CREATE TABLE table_name (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  -- ... columns
);

CREATE INDEX idx_table_name_user_id ON table_name(user_id);

-- RLS (skip for internal tables)
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own rows" ON table_name
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rows" ON table_name
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Simulator mirror (no FK to auth.users, no RLS)
CREATE TABLE sim_table_name (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id UUID NOT NULL,
  -- ... same columns, but FK to sim_ tables instead of prod tables
);

CREATE INDEX idx_sim_table_name_user_id ON sim_table_name(user_id);
```

**Important:**
- `sim_` tables reference `sim_sessions(id)` not `sessions(id)`
- `sim_` tables use bare `UUID NOT NULL` for `user_id` — no FK to `auth.users`
- `sim_` tables don't need RLS (accessed via service role)
- Add a comment explaining what the migration does and why

## Step 4: Update TypeScript types

Read the relevant type file in `packages/types/src/` and add/modify the type to match the new schema.

- If it's a new table, create a new type and add it to `packages/types/src/index.ts`
- If it's a new column, add it to the existing type
- If the column is nullable, type it as `type | null`
- If the column has a default, make it optional with `?`

## Step 5: Update code consumers

Search the codebase for every place that reads from or writes to the affected table(s):

1. **Grep for the table name** in all `.ts` and `.tsx` files
2. **Check API routes** — any route that queries this table needs to handle the new column
3. **Check hooks** — any hook that fetches this data needs updating
4. **Check ToneyContext** — if the data is in global state, update the context type and any state initializers
5. **Check admin queries** — `apps/admin/src/lib/queries/` may need updating
6. **Check coaching package** — if the data feeds into prompts, check `packages/coaching/`
7. **Check `after()` callbacks** — if the data is read/written by `after()` in session close or open routes

## Step 6: Update simulator clone

If a new table was added or columns changed on a cloned table, check the simulator clone logic:

- `apps/admin/src/app/api/simulator/personas/clone/route.ts` — deep-copy logic
- Ensure new columns are included in SELECT and INSERT
- **Gotcha**: `sim_wins` has `content TEXT NOT NULL` — clone must set both `content` and `text`

## Step 7: Build

Run: `export PATH="/opt/homebrew/bin:$PATH" && pnpm build`

Fix any type errors. The build will catch missing fields, wrong types, and broken imports.

## Step 8: Remind about deployment

Tell the user:

> **This migration needs to be applied to both Supabase projects:**
> - **DEV**: `dpunrkhndskfmtdajesi.supabase.co` — apply now for testing
> - **PROD**: `vnuhtgkqkrlsbtukjgwp.supabase.co` — apply when deploying to production
>
> Run the SQL in each project's SQL Editor (Supabase Dashboard → SQL Editor → paste → Run).

Do NOT apply the migration automatically. The user must do this.
