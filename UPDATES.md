# Toney Updates

> What changed in the product, explained in plain language. No code, no jargon — just what's different for people using Toney.

---

## February 23, 2026

### Session notes now appear instantly when you end a session

- When you tap "End Session," a **notes overlay slides up immediately** with a loading indicator while Toney prepares your session summary. Previously, there was a 3-5 second gap where nothing appeared on screen — you had no idea anything was happening. Now you see the overlay right away, and the notes fill in when they're ready.
- When the notes appear, Toney asks **"How are you leaving this session?"** with emoji options like Lighter, Curious, Stuck, or Energized. You must tap one before you can dismiss — this helps Toney understand how its coaching is landing. You can optionally add a text note too.
- When you tap Done, the overlay **slides down smoothly** instead of vanishing instantly.

### Session notes work correctly in all languages

- If you use Toney in a non-English language (like Hebrew or Spanish), session notes were sometimes showing raw data instead of a readable summary. This is now fixed — notes render correctly regardless of language.

### New suggestions appear after each session

- After ending a session, your **new personalized suggestions** now appear within about 15 seconds — even without refreshing the app. Previously, you had to close and reopen the app to see updated suggestions.

### Cards now appear reliably in chat

- When Toney co-creates a card with you during a session (a reframe, truth, plan, practice, or conversation kit), it should appear as an interactive card you can tap to save. In some sessions, the card wasn't appearing — Toney would describe the card in text but you'd never see the save button. This is now fixed. The card will always render properly, even if the AI formats it slightly differently than expected.
- Toney no longer says "This is saved to your Rewire cards" when offering a card. Cards aren't automatically saved — they appear as drafts, and you choose whether to save them by tapping "Save to Rewire."

### Multi-language support

- Toney now **detects your language automatically** from your first message and responds in the same language for the rest of the session — and all future sessions. If you write in Hebrew, Spanish, or any other language, the Coach, session notes, suggestions, and growth observations will all be in your language.
- The app interface stays in English, but all coaching content adapts to you.

### Toney's learning is more reliable (improved)

- The behind-the-scenes work that happens after each session (updating Toney's understanding of you, generating suggestions, writing growth observations) now runs with a much longer timeout — up to 5 minutes. Previously this sometimes failed silently. The improvement from February 17 has been further strengthened.

### Themes (coming soon for select users)

- A visual theme system has been built — 10 presets (like Midnight, Forest, Sunset) plus a custom theme editor. This is currently available only to select beta users. If you're interested in trying it, let us know.

---

## February 17, 2026

### Sessions open instantly now

- When you tap a session suggestion, the conversation now starts in **under 2 seconds** — compared to 6-8 seconds before. Toney now pre-writes the Coach's opening message when it generates your suggestions, so when you tap one, the greeting is already ready. No more watching bouncing dots while the AI thinks of what to say.
- If you start a free-form conversation (not from a suggestion), the Coach still streams its opening in real-time — about the same speed as before.

### Toney's learning is much more reliable now

- After you end a session, Toney does important behind-the-scenes work: updating its understanding of you, writing growth observations for your focus areas, and generating fresh suggestions for next time. Previously, this work was frequently failing silently — the app server had a strict 10-second timeout that was too short for the AI to finish thinking. Now this work runs on a dedicated server with a much longer timeout, so it completes reliably every time. Your understanding evolves, your suggestions stay fresh, and your focus area reflections are always up to date.

---

## February 16, 2026

### Home screen redesigned around your focus areas

- Your **focus areas** — the things you said you want to work on — are now front and center on the home screen, right at the top. Each one shows Toney's latest observation about your progress, plus how many observations and wins are connected to it. Tap one to see your full growth story without leaving the home screen.
- A new **coaching prompt** sits at the very top, inviting you to start or continue coaching. It changes based on where you are: "Start your first session" if you're new, "Continue your coaching" when you have focus areas, or "Welcome back" when you've been away for a few days.
- The home screen is now organized as a **growth mirror**: focus areas first (showing who you're becoming), then wins (evidence), then your last session and Toney's understanding of you (context).

### Duplicate focus areas fixed
- If you saw the same focus area appearing multiple times on your home screen, this is now fixed. The issue happened when Toney processed your quiz answers more than once, creating duplicate entries. A cleanup is needed for existing duplicates — reach out if you still see them.

### You can write your own goal during the quiz
- Question 7 ("What would feel like progress?") now has a **"Something else..."** option. If none of the preset goals feel right, you can write your own in your own words.
- The duplicate option "Stop stressing about money" was removed — it overlapped with "Stop letting money run my mood."

### Session suggestions now connect to your focus areas
- After each session, at least some of your new suggestions are now **explicitly about one of your focus areas**. Instead of generic coaching topics, you'll see suggestions like "The 10,000 shekel gap" linked to a specific thing you said you wanted to work on.
- When Toney thinks a focus area is ready for deeper reflection — maybe you've been working on it for a while, or something seems to be shifting — it generates a **check-in suggestion**. These are invitations to revisit the pain you named: "Is this still the right shape?" You can confirm it, reframe it in new words, or discover that what you actually need has changed entirely.

### You can end a session at any time now
- The "End Session" button now appears **as soon as the conversation starts** — you don't have to save a card or send 20+ messages first. If you tapped a suggestion but realized you want to talk about something different, just end the session and pick a new one.

### Short sessions don't create noise
- If you opened a session but never responded, the session is **deleted entirely** — it won't show up in your Journey or session history.
- If you only sent a message or two before ending, the session is quietly closed without generating notes, suggestions, or any behind-the-scenes processing. It won't appear in your session history.
- Full sessions (3+ messages) work exactly the same as before — notes, learning, suggestions, the whole thing.

### Sessions that got stuck open now close properly
- If you opened Toney and your last session was from days ago, it was supposed to automatically start a new session. But if your old session had suggestions or even a single message loaded, the automatic detection didn't work — the session just stayed "active" forever. This is now fixed. Toney always checks how long it's been since your last message, regardless of other state.

### Toney's learning is more reliable
- After you end a session, Toney does important behind-the-scenes work: evolving its understanding of you, generating suggestions for next time, and writing growth observations for your focus areas. Previously, if this work failed (server hiccup, timeout), it was simply lost — Toney wouldn't learn from that session. Now, Toney detects when this happened and automatically retries the next time you start a session. You might notice a slightly longer wait (~5 seconds) on that next session, but the result is the same: nothing is lost.

---

## February 15, 2026

### Journey timeline redesigned with emoji markers
- The Journey tab now shows a **vertical timeline** with emoji circles on a line — ⭐ for sessions where you had a real breakthrough or shift (not every session — only the ones where something genuinely changed), 🏆 for wins (things you did differently with money), and 🌱 for your first session.
- Each node has a **colored bubble** beside it with the text, date, and (for breakthroughs) which focus area it connects to.
- **Different focus areas get different colors** — so you can see at a glance which areas of your life are producing the most growth. Wins are always green.
- Breakthrough nodes are tappable — tap to read the full session notes from that breakthrough.

### Journey tab redesigned

- The Journey tab has been redesigned as a **growth dashboard** instead of a chronological session list.
- At the top, a **"Where you are" card** shows Toney's current understanding of you in one sentence. If you've been using Toney for a while, it also shows a contrast with an earlier observation — so you can see how far you've come.
- Your **focus areas** are the main content now. Each one shows the latest growth observation and counts of wins and reflections. Tap to see the full growth story.
- **Past sessions** are still accessible — just tap the book icon in the top right to browse them and read session notes.
- If you started using Toney before focus areas existed, the Journey shows your recent session headlines as tappable cards — so the screen is never empty.
- You can still log wins from the Journey tab.

### Rewire cards are now a swipeable flashcard deck

- Your Rewire Cards screen has been redesigned. Instead of a long scrollable list showing everything at once, cards are now displayed as a **flashcard deck** that you can swipe through.
- Each card shows just the **title and category icon** on the front — clean and easy to scan. Tap the card to **flip it over** (with a smooth 3D animation) to see the full content, date, and action buttons.
- **Swipe left or right** to browse between cards. The deck loops around — no dead ends when you reach the last card. You can keep swiping endlessly.
- Swiping feels natural — a quick flick is enough to advance, and the animation slows down smoothly like scrolling on an iPhone.
- The category filter tabs at the top (All, Reframes, Truths, Plans, etc.) work the same as before.
- Fixed a visual glitch where card shadows looked odd at the bottom corners.

### Wins no longer save multiple times
- When Toney celebrated a win during a session, it was sometimes being saved 3-10 times instead of once. You might have noticed duplicate entries on your Journey timeline. This is now fixed — each win saves exactly once.

### Wins feel like they matter now

- When Toney celebrates a win, it's no longer a flat green card that appears and disappears. The card now **animates in** — a thin green line expands into a warm, glowing card with a rotating trophy icon. It feels like a moment, not a footnote.
- Toney now **reflects your words back** before logging a win, and connects it to the bigger picture: "That's the kind of thing that rewires how your brain responds to money." If it connects to a focus area, Toney names it.
- **Session notes now mention your wins.** When you end a session, the summary highlights the victories you earned — they're woven into the narrative.
- **Session suggestions build on recent wins.** At least one suggestion for your next session explicitly references a recent win, so your progress carries forward.

### Wins are more visible everywhere

- The home screen now shows a **Win Momentum Strip** — a green card right below your last session, showing your latest win, how many you've earned this week, and a momentum label like "Most active week yet" or "3 wins this week."
- Toney's Coach now knows more about your wins — not just the text, but when they happened, how fast they're accumulating, and what patterns exist. It uses this to reference your progress more naturally.
- At **milestone win counts** (3, 7, 15, 30), Toney's opening message naturally acknowledges the pattern: "Seven moments now where you did something different. That's not random."
- When Toney's internal understanding of you evolves after each session, your wins are now treated as **primary evidence of real change** — not a sidebar.

### Wins now connect to your focus areas

- When Toney logs a win that relates to one of your focus areas (like "Feel okay spending on myself"), it **links them together**. The Coach uses a new format — `[WIN:focus=...]` — to specify which focus area a win belongs to.
- On your **Journey tab**, tapping a focus area now shows a new **"Evidence" section** — all the wins linked to that focus area, displayed as green cards with dates. You can see not just what Toney observed about your growth, but the actual moments that proved it.
- The Coach now sees your wins **grouped by focus area** in its briefing, so it can reference specific progress on specific intentions.

---

## February 14, 2026

### Focus areas now show your growth

- Your focus areas (like "Feel okay spending on myself" or "Have the money conversation with my partner") now show how you're evolving — not just what you declared.
- After each session, Toney writes a brief observation about each focus area the session touched. These accumulate over time, creating a visible growth story.
- On the **home screen**, focus areas are now cards (instead of flat pills) showing the latest observation underneath. For example: "You bought yourself coffee and didn't spiral — that's new."
- On the **Journey tab**, you can tap any focus area to see its full growth timeline — every observation, newest first, with dates. You can also archive a focus area from here.
- Toney's Coach now reads the latest observation for each focus area before every session, so it can reference your specific progress naturally.
- This doesn't add any extra processing time — the observations are generated inside the same step that already happens after each session.

### Getting started is faster
- After finishing the quiz, the "Getting to know you..." wait is about half as long as before. Toney now processes your answers in two parallel steps instead of one big sequential one.
- You'll see a proper loading screen with a spinner and message while Toney prepares your first session suggestions.

### First session suggestions now appear reliably
- After onboarding, your personalized session suggestions now show up every time. Previously, you might have seen a blank screen, a "Start a Session" button instead of suggestions, or had to wait 45+ seconds. This was caused by the app trying to start your session before it finished processing your quiz answers — now it waits properly.

---

## February 13, 2026

### Home screen is now a calm dashboard
- The home screen no longer scrolls and no longer shows session suggestions, streaks, or counts. It's a single screen with five tiles: your last session, a "What Toney Sees" snippet, your latest Rewire Card, your focus areas, and your last win.
- Growth shows through language, not numbers. The "What Toney Sees" tile is a single sentence that evolves after every session — you can watch how Toney's understanding of you deepens over time.

### Session suggestions moved to Chat
- When you open the Chat tab without an active session, you now see your personalized session suggestions (the featured card, compact rows, and "Or just start talking"). Previously these were on the home screen.
- Tapping a suggestion starts the session right there. No more navigating between screens.

### Chat input grows as you type
- The text box now expands as you write (up to 3 lines), like ChatGPT. You can see what you're typing without scrolling inside a tiny box.

### Session suggestions now show up when you open chat
- When you open the Chat tab, you should see your personalized session suggestions — cards like "What one container would choose you" or "The price that doesn't need proof." Previously, the screen was stuck showing your last completed conversation instead of these suggestions.

### Starting a session no longer fails
- Tapping a suggestion or "Start a Session" was sometimes showing an error: "I'm having trouble starting a session right now." This happened because Toney was trying to re-process your last session (which was already finished) before opening the new one. That unnecessary step has been removed.

### Ending a session is now fast
- When you tap "End Session," your session notes now appear within a few seconds. Previously, the screen would show "Wrapping up..." for 15-20 seconds (or appear to hang entirely). The behind-the-scenes learning that Toney does after each session now happens in the background — you don't have to wait for it.

### Settings: new depth slider
- Coaching depth is now a 1-5 slider (matching the tone slider) instead of three text options (Surface / Balanced / Deep). This gives you finer control over how deep Toney goes into root causes.

---

## February 13, 2025

### Cards now save properly
- Rewire Cards you create in chat now save to your collection permanently. Previously, cards would appear in the conversation but silently fail to save — meaning they'd disappear when you closed the app. This is now fixed. Cards persist across sessions.
- Cards now display their title on the Rewire screen, and content renders with proper formatting (bold, lists, etc.).
- Backfilled cards that were lost for existing users by finding them in old conversation history.

### Session notes and summaries now save properly
- When you end a session, Toney generates session notes (headline + summary + key moments). These were silently failing to save — so your Journey timeline was showing sessions without any notes or titles. This is now fixed.
- Every session now has a proper title and notes you can read on your Journey.
- Backfilled notes for all existing users' past sessions.

---

## February 12, 2025

### Focus Areas — track what you're working toward
- After onboarding, your goals from the quiz (like "stop stressing about money" or "feel okay spending on myself") now appear as Focus Areas on your home screen under "What I'm Working On."
- During conversations, Toney can suggest new focus areas when you articulate something you want to work toward. They appear as purple cards in chat — you choose whether to save them.
- Focus areas are ongoing intentions, not tasks. You can archive them when they're no longer relevant, but there's no "complete" button.
- Toney reads your focus areas before each session and uses them to connect surface-level concerns to deeper coaching work.

### Session Suggestions — personalized conversation starters
- After each session ends, Toney now generates 4–10 personalized suggestions for your next visit.
- Each suggestion has a title, a teaser, and a time estimate (quick 2–5 min, medium 5–10 min, deep 10–15 min, or always-available entry points).
- Suggestions reference your specific words, patterns, breakthroughs, and saved cards. They feel like something only Toney could say to *you*.
- Behind the scenes, each suggestion comes with a coaching strategy so the conversation starts smart if you tap it.

### Home screen redesigned
- Home now opens with a personalized greeting and a vertical list of session suggestions — the first is a featured card, the rest are compact rows.
- Your last session's headline and a snippet of notes are shown as a preview card.
- Focus areas appear under "What I'm Working On."
- Removed the old static tension type display.

### Journey tab replaces Wins tab
- The old "Wins" tab is now the "Journey" tab — a timeline of your coaching story.
- Shows sessions and wins grouped by day. Tap any session to read its notes.
- Wins that Toney celebrates in chat (when you report a real victory over your patterns) now auto-save to your Journey. Previously they were only stored temporarily and would disappear.
- You can also manually log wins with a "Log a Win" button.

---

## February 11, 2025

### Toney now learns about you through a living narrative
- Instead of storing fragmented facts about you in separate categories, Toney now maintains a single evolving narrative — like a therapist's clinical notes — that deepens after every session.
- The narrative covers your triggers, breakthroughs, resistance patterns, emotional vocabulary, life context, what coaching approaches work for you, and where you are across 7 growth dimensions.
- After each session, the narrative is updated — not rewritten. New observations integrate with existing ones. Nothing is lost.
- This means Toney's understanding of you gets richer and more nuanced with every conversation, instead of being a flat list of extracted facts.
