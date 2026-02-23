---
name: end
description: End a working session. Summarizes today's work, updates MEMORY.md, CHANGELOG.md, and DECISIONS.md, then shows the updates for approval before saving.
---

End the current working session for Toney.

## Step 1: Gather what happened

Run `git log --oneline -20` and `git diff --stat HEAD~5..HEAD` (adjust range to cover today's work) to understand what was done this session. Also check `git status` for uncommitted work.

## Step 2: Draft updates

Prepare updates for up to five files. **Do not save yet** — show the user first.

### MEMORY.md (`/Users/tamiravital/.claude/projects/-Users-tamiravital-Toney/memory/MEMORY.md`)
- Read the current file
- Add a dated work summary under a `## Session Log` section at the bottom
- Update any sections in the body that are now outdated based on today's work (status, key files, architecture, etc.)
- Keep MEMORY.md under 200 lines total — be concise

### CHANGELOG.md (project root)
- Read the current file (create if it doesn't exist)
- Add today's changes under a dated heading at the top
- Format: `## YYYY-MM-DD` followed by bullet points of what changed
- Focus on what's different for the user/product, not implementation details

### DECISIONS.md (project root)
- Read the current file (create if it doesn't exist)
- Add any important decisions made today — architectural choices, product direction, tradeoffs, things rejected
- Format: `### Decision Title (YYYY-MM-DD)` with a brief explanation of the decision and reasoning
- Only add entries if real decisions were made. Skip if nothing notable.

### HOW-IT-WORKS.md (project root)
- Read the current file
- **Only update if** this session involved changes to product logic, coaching flow, screens, user-facing behavior, or the coaching engine
- Update the relevant sections to keep them accurate — this is the non-technical explanation of how Toney works
- Write in plain language for non-technical readers (no function names, no code references, no migration numbers)
- Skip if nothing product-facing changed (e.g., pure refactors, CI changes, dependency updates)

### UPDATES.md (project root)
- Read the current file
- **Only update if** this session involved changes that affect what users experience
- Add a dated entry at the top describing what changed, in plain non-technical language
- Format: `## Month Day, Year` heading, then `### Change Title` with bullet points
- Write so that anyone (Noga, investors, new team members) can understand it — no code, no jargon, no function names
- Focus on what's different for the person using Toney, not how it was implemented
- Example tone: "Cards you save in chat now persist properly — they won't disappear when you close the app"
- Skip if nothing user-facing changed

## Step 3: Suggest a session name

Based on the work done, suggest a short session name (2-5 words) that captures the theme of this session. Examples: "Understanding Narrative", "Strategist Revamp", "Session Latency Debug", "Noga Backfill".

Use this name in the MEMORY.md session log heading: `### YYYY-MM-DD — Session Name`.

Format: `YYYY-MM-DD — Session Name` (e.g., `2026-02-16 — Chat Screen State Fixes`). This makes the log scannable and searchable.

Present the suggested name and let the user rename it if they want.

## Step 4: Show the user

Display all three proposed updates clearly, showing what will change in each file. Use diff-style formatting where helpful.

## Step 5: Wait for approval

Ask: **"Look good? I'll save these once you confirm."**

Only save the files after the user approves. If they want changes, adjust and show again.
