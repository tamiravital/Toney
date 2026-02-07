# Toney Data Model — What Toney Knows About You

This document describes the structured data Toney stores about each user to deliver coaching that feels like it truly *knows* you.

---

## The Big Idea

Every time you talk to Toney, three things happen:
1. You get coaching in the moment
2. Toney updates its "notebook" about you
3. The next conversation is better because Toney remembers

This is what makes it different from just talking to ChatGPT. ChatGPT starts fresh every time. Toney builds a **living understanding** of who you are with money.

---

## Layer 1 — Your Profile

*Captured during onboarding, updated as life changes.*

| What | Example | Why it matters |
|------|---------|----------------|
| **Money pattern** | The Avoider | Everything adapts to this |
| **Pattern score** | 8/10 | How strong the pattern is |
| **Coaching style** | Gentle tone, deep exploration | How Toney talks to you |
| **Learning style** | Somatic + Narrative | *How* Toney teaches you |
| **Life stage** | Early career / New parent / Pre-retirement | Priorities differ completely |
| **Income type** | Salary / Freelance / Variable | Changes how stress shows up |
| **Relationship status** | Single / Partner / Shared finances | Money is relational |
| **Financial goals** | Build emergency fund | Not just the goal... |
| **Emotional why** | "Stop feeling anxious every month" | ...but *why* it matters to them |

---

## Layer 2 — Behavioral Intelligence

*Built over time from conversations. This is Toney's secret weapon.*

### Triggers
What situations, emotions, or times lead to pattern behavior.

```
Example for an Emotional Spender:
- Thursday evenings after work stress → online shopping
- Payday → "treat yourself" splurge
- Fight with partner → retail therapy
- Social media scrolling → FOMO purchases
- Boredom on weekends → browsing Zara
```

**Why this is powerful:** Instead of saying "watch your spending," Toney can say:
*"It's Thursday evening. Last week around this time, you ended up on Amazon after a tough day at work. How are you feeling right now?"*

### Emotional Vocabulary
How the user actually expresses (and avoids expressing) feelings.

```
Example:
- Words they use: "stressed", "overwhelmed", "it's fine"
- Words they avoid: "ashamed", "scared", "out of control"
- Deflection phrases: "it's not that bad", "whatever", "I don't care"
- What those really mean: "I don't care" → they care deeply but it's too much
```

**Why this is powerful:** Toney can gently name the real feeling:
*"You said 'it's fine' — but the last few times you said that, something was bothering you underneath. What's really going on?"*

### Resistance Patterns
Where the user pushes back, deflects, or shuts down.

```
Example for an Avoider:
- Changes subject when savings comes up
- Says "I'll deal with it later" (never does)
- Gets quiet when asked about specific numbers
- Uses humor to dodge serious money talk
```

**Why this is powerful:** Toney can navigate around resistance instead of triggering it:
*"I notice we keep circling back to the savings question. No pressure — but I'm curious what happens inside when I bring it up."*

### Breakthroughs
The "aha moments" — when something clicked.

```
Example:
- "Realized my Thursday spending is about work stress, not actual needs"
- "Understood that checking my balance 10x a day comes from childhood money anxiety"
- "Saw that 'treating myself' is actually 'numbing myself'"
```

**Why this is powerful:** Toney can reference past breakthroughs to prevent backsliding:
*"Remember when you realized the Thursday pattern? You're in one right now. What would you tell yourself?"*

### Coaching Notes
What Toney has learned about how to coach this specific person.

```
Example:
- Responds well to body-awareness prompts ("what do you feel in your chest?")
- Gets defensive when challenged too directly — needs softer entry points
- Humor works as an icebreaker but can become deflection
- Best breakthroughs happen when exploring childhood money memories
- Prefers one small action step, not a long plan
```

---

## Layer 3 — Financial Reality (Future: via Plaid)

*From connected bank accounts. The numbers that make coaching concrete.*

| What | Example | What Toney does with it |
|------|---------|------------------------|
| **Spending by category** | $400/mo dining out | Connects to triggers ("dining spikes on stress days") |
| **Spending trends** | Up 30% this month | Proactive check-in: "Spending is up — what's been going on?" |
| **Income pattern** | Paid bi-weekly, Fridays | Knows when payday triggers hit |
| **Unusual transactions** | $800 at electronics store | "That's outside your usual pattern. How are you feeling about it?" |
| **Savings rate** | 5% of income | Frames wins: "You went from 3% to 5% — that's huge" |
| **Subscriptions** | 12 active, 4 unused | "You're paying for 4 things you haven't used in 3 months" |
| **Balance trajectory** | Trending up over 3 months | "Look at this — you're building momentum" |

**The magic:** Toney doesn't just show you the numbers (Mint does that). It connects numbers to feelings to patterns to action.

---

## How It All Works Together

Here's a real example of how these layers combine:

**User:** The Emotional Spender, gentle tone, somatic learner
**Trigger:** Thursday evening after work stress
**Financial data:** $200 charge at Target, Thursday 8pm
**Emotional vocabulary:** Uses "stressed" but avoids "ashamed"
**Resistance:** Tends to say "it's fine" when it's not
**Breakthrough:** Previously realized Thursday spending = stress coping

**Toney's message:**
> "Hey — I noticed a $200 Target trip last Thursday evening. I remember you had that insight a few weeks ago about Thursdays being your stress day. No judgment here — I'm just curious: what was going on at work that day? And when you were walking through Target, where did you feel the stress in your body?"

Compare that to a generic chatbot:
> "I see you spent $200 at Target. That's above your budget. Try setting spending limits."

Night and day.

---

## Database Tables (for Supabase)

Here's how this translates to actual storage:

1. **users** — sign-up info (email, name) — handled by Supabase Auth
2. **profiles** — pattern, style, life context, goals
3. **conversations** — each chat session
4. **messages** — individual messages within conversations
5. **insights** — saved to Rewire (cheat cards + conversation starters)
6. **wins** — pattern interrupts logged by the user
7. **behavioral_intel** — the structured data Toney builds over time:
   - triggers
   - emotional vocabulary
   - resistance patterns
   - breakthroughs
   - coaching notes
8. **financial_data** — transaction data from Plaid (future)

---

## What We Build for MVP

**Now (v1):**
- Profile (pattern + style + goals)
- Conversations + messages
- Insights (Rewire)
- Wins
- Basic behavioral intel (triggers + breakthroughs captured from chat)

**Soon (v2):**
- Full behavioral intel (emotional vocabulary, resistance patterns, coaching notes)
- Automatic extraction (Toney detects and stores behavioral signals without manual tagging)

**Later (v3):**
- Plaid integration (financial reality layer)
- Cross-referencing transactions with behavioral patterns
- Proactive coaching based on spending anomalies
