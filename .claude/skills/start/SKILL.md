---
name: start
description: Start a new working session. Reads project context files, reports current state, recent work, and logical next steps, then asks what to work on today.
---

Start a new working session for Toney.

## Step 1: Read context files

Read these files to understand current project state:

1. `CLAUDE.md` — project structure, architecture, conventions
2. `/Users/tamiravital/.claude/projects/-Users-tamiravital-Toney/memory/MEMORY.md` — persistent memory
3. `DECISIONS.md` — architectural and product decisions log

## Step 2: Check recent activity

Run `git log --oneline -10` and `git status` to see what changed recently and what's uncommitted.

## Step 3: Report to the user

Tell the user:

- **Current project state** — What's built, what's working, what's the overall status
- **What was I working on last** — Based on recent commits, git status, and MEMORY.md
- **Logical next steps** — 3-5 concrete things that would make sense to work on next, based on the current state

Keep each section to 2-3 sentences. Be specific, not generic.

## Step 4: Ask

Ask: **"What do you want to work on today?"**
