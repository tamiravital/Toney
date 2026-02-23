---
name: improve-coaching
description: Build and validate a feature for Toney. Use when the user describes something they want to add, improve, or change in the app. Builds the feature, then pressure-tests it against non-cooperative personas to make sure it delivers real coaching value. One command — build and validate in one go.
argument-hint: <describe what you want>
---

The user wants to improve Toney — an AI coaching app that helps people transform their emotional relationship with money.

They said: $ARGUMENTS

---

# Part 1: Build

## Step 1: Who is this for?

Describe the person who needs this. Not "users" — a specific person. What tension type are they? What are they feeling when they'd encounter this? Are they in their first week or their third month? Are they in crisis or making progress?

## Step 2: What's the smallest version that delivers emotional value?

Not the full feature. The version you could ship today that would make that person feel something — seen, supported, motivated, safe. Describe what it does in one sentence.

## Step 3: Where does it touch?

Toney has four layers. Identify which ones this feature needs:

- **Coaching brain** — Does this change what Toney says? → prompt modules in `src/lib/prompts/`
- **Memory** — Does this change what Toney remembers? → `src/lib/extraction/`, `src/hooks/useBehavioralIntel.ts`
- **Product surface** — Does this change what users see? → `src/components/`, `src/context/ToneyContext.tsx`
- **Data** — Does this need new storage? → `src/types/`, `supabase/migrations/`, hooks

Read the relevant files before proposing changes. Don't assume you know what's there.

## Step 4: What already exists?

Before designing anything new, check what Toney already knows and stores. The behavioral intel system extracts triggers, vocabulary, breakthroughs, resistance patterns, and stage of change. The prompt builder already weaves in wins, rewire cards, and intel. The data you need might already be flowing through the system. Don't reinvent what's there.

## Step 5: Coaching framework fit

Where does this feature sit in the AWARE method (Assess → Witness → Align → Reframe → Engage)? Which stage of change is it most relevant to? Does it respect motivational interviewing principles — or does it give unsolicited advice, push before someone is ready, or assume readiness? A feature that belongs in Reframe but fires during Assess will break trust.

## Step 6: Tension check

Walk through how this feature works for at least 3 different tension types (pick the ones most affected). A feature that works for "worry" might feel punishing for "avoid." A feature that celebrates progress might feel hollow for "numb." A feature that encourages spending might terrify "grip."

## Step 7: Bad states

Think through the failure modes:
- **Empty** — What happens when there's no data yet? First-time user, first conversation, no wins logged.
- **Negative** — What happens when the data tells a bad story? No progress, broken streaks, repeated struggles.
- **Stagnant** — What happens when nothing has changed in weeks?
- **Over time** — How does this feature feel on day 1 vs day 30 vs day 60? The first time Toney references a breakthrough is magical. The 10th time is annoying.

## Step 8: Safety gut-check

One sentence: could this feature shame someone, make them feel surveilled, or push them before they're ready? If yes, how do you guard against it.

## Step 9: Scope check

Does this feature stay within Toney's current boundaries — private, solo, emotional coaching — or does it intentionally expand them? If it expands (adding social features, financial data, external integrations), flag it explicitly. That's a product decision, not an engineering one.

## Step 10: Build it

Now write the code. Follow the conventions in CLAUDE.md.

---

# Part 2: Pressure-test what you just built

## Step 11: Build the personas

Create 3-4 specific personas to test against. Each persona is a combination of:

- **Tension type** — avoid, worry, chase, perform, numb, give, grip
- **Stage of change** — precontemplation, contemplation, preparation, action, maintenance, relapse
- **Learning style** — analytical, somatic, narrative, experiential
- **Tone preference** — where on the 1-10 scale
- **Resistance mode** — how they show up when it gets hard:
  - The deflector — "It's not a big deal, can we talk about something else"
  - The intellectualizer — analyzes endlessly to avoid feeling
  - The tester — says something provocative to see if Toney will judge
  - The silent one — one-word answers, doesn't offer much
  - The yeah-but — has a reason why every suggestion won't work
  - The spiral — one question sends them into shame and overwhelm
  - The performer — says what they think Toney wants to hear

Pick personas that would stress this feature the most. Don't pick easy ones. At least one persona should be actively resisting.

## Step 12: Simulate each persona

For each persona, walk through the feature as that person. Not cooperatively — as they would actually show up. What do they see? What does Toney say to them? How do they respond? Where do they disengage, shut down, or push back?

Write this out as a short narrative, not a test case.

## Step 13: Is it card-worthy?

For each persona, answer: would this interaction produce something worth saving as a rewire card? A reframe that shifts how they see their behavior. A ritual they'd try. A truth that clicks. A mantra they'd hold onto.

If nothing in the interaction is card-worthy, the feature isn't delivering enough coaching value. It might be safe, it might be correct, but it's not moving anyone.

## Step 14: Is it good coaching?

Not "did it follow the AWARE steps." Did it:

- **Listen before advising?** — Or did it jump to a reframe before the person felt heard?
- **Ask before telling?** — Or did it assume it knew what the person needed?
- **Respect where they are?** — Or did it push action on someone in precontemplation? Hold back someone who's ready to move?
- **Handle resistance well?** — When the persona deflected, shut down, or pushed back — did Toney roll with it or bulldoze through?
- **Create a shift?** — Even a small one. A new connection. A moment of self-compassion. A question that sticks.

## Step 15: Is it safe?

- Could this **shame** someone? Especially someone already carrying money shame.
- Could this feel like **surveillance**? Tracking, measuring, or quantifying someone's emotional life in a way that feels invasive.
- Could this **push** someone before they're ready? Assuming action when someone is still contemplating.
- Does it **give financial advice**? Toney is an emotional coach, never a financial advisor.

## Step 16: Fix what failed

If any persona simulation revealed a problem — something that isn't card-worthy, coaching that doesn't land, a safety concern — fix the code now. Don't just flag it. Fix it, then briefly explain what you changed and why.

## Step 17: What's next

Note what the natural next iteration of this feature would be — but don't build it yet.

---

## Non-negotiable coaching principles (these override technical convenience):

- Toney is an emotional coach, never a financial advisor
- "Tension" not "pattern" — the 7 types: avoid, worry, chase, perform, numb, give, grip
- Questions before advice. Witness before reframe. One thing per message.
- No unsolicited advice. Roll with resistance. Support autonomy.
- Identity over behavior: "you're becoming someone who..." not "you should..."
- Safety first: crisis detection, shame prevention, normalization of struggle
