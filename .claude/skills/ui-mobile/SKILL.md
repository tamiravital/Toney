---
name: ui-mobile
description: Build or change mobile UI in Toney. Use when the user wants to add a new screen, restyle something, change layout, update colors, revamp UX, or make any visual change to the mobile app. Ensures the change is applied consistently across the entire codebase with no residuals and a passing build.
argument-hint: <describe the UI change>
---

The user wants to build or change UI in Toney.

They said: $ARGUMENTS

---

## Step 1: Understand the change

What exactly is being built or changed? Is it:
- A new component or screen
- A restyle (colors, spacing, typography)
- A layout change (nav, tabs, shell)
- A UX flow change (how screens connect)
- A revamp of something that already exists

State clearly what the end result should look like.

## Step 2: Find everything affected

Before writing any code, search the entire codebase for every file related to this change. Use grep, glob, read — whatever it takes. Build a complete list of every file that:

- Directly implements what's being changed
- References it (imports, uses the component, uses the color/class/value)
- Could be visually affected by the change (parent layouts, sibling components)

List every file. Miss nothing. If you're changing a color value, find every single place that color appears — in components, in constants, in Tailwind classes, inline styles, everywhere.

## Step 3: Build or change it

Write the code. Follow these conventions:

- **Tailwind CSS 4** — No CSS modules, no styled-components
- **Lucide React** icons — Not Heroicons, not FontAwesome
- **Mobile-first** — All UI max-w-[430px], touch targets at least 44px
- **ToneyContext** for state — No Redux, no Zustand, no local state for anything global
- **TypeScript strict** — Proper types, no `any` unless absolutely necessary
- **Path alias** `@/*` → `./src/*`
- **Geist Sans** font via `next/font/google`
- **Barrel exports** — If adding new files to types/, hooks/, or constants/, update the index.ts

If adding a new component, match the structure of existing components in the same directory. Read a sibling component first to see the patterns.

## Step 4: Apply everywhere

Go through every file from step 2 and apply the change consistently. Every instance. No exceptions. If it's a color change, every old value becomes the new value. If it's a component rename, every import updates. If it's a layout change, every screen that uses that layout adapts.

## Step 5: Clean up residuals

Search the codebase for anything left behind:

- **Old values** — Grep for the old color, old class name, old component name. If any remain, fix them.
- **Unused imports** — Check that no file imports something that was removed or renamed.
- **Orphaned files** — If a component was replaced, delete the old one.
- **Dead references** — Check ToneyContext, barrel exports, and type files for references to things that no longer exist.

Don't just search for what you changed — search for what should no longer be there.

## Step 6: Build

Run: `export PATH="/opt/homebrew/bin:$PATH" && npx next build`

If it fails, fix the errors and run it again. Do not stop until the build passes. If a build error reveals more residuals or inconsistencies, go back to step 5.
