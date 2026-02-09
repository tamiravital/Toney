# Toney — Decision Log

Architectural, product, and technical decisions. Newest first.

---

### Direct function calls instead of HTTP self-calls (2026-02-08)
The tick and message routes were calling /api/simulator/chat via HTTP fetch to themselves. This broke on Vercel (401 auth error). Extracted core chat logic into processSimChat() in lib/simulator/chat.ts — called directly as a function. Faster, no URL config needed, no auth issues.

### sim_profiles replaces simulator_personas (2026-02-08)
Eliminated the simulator_personas indirection layer. sim_profiles IS the persona now — stores profile config, user_prompt, and source_user_id directly. One table instead of two, simpler queries, consistent sim_* naming across all simulator tables.

### Drop v1 simulator code entirely (2026-02-08)
Removed all v1 backward-compat: SimulatorMessage type, getRunMessages(), v1 message fallbacks in UI, engineVersion prop, isV2 conditionals, CardBadge per-message rendering. Everything is v2-only now.

### 3-agent coaching architecture (2025-02-06)
Split coaching into Coach (Sonnet, every message), Observer (Haiku, fire-and-forget), and Strategist (Sonnet, session boundaries). Coach reads a static briefing per session rather than raw data. Observer replaces the old every-5th-message extraction. Data flow is async — Observer signals accumulate, Strategist reads them between sessions.

### Session-based conversations, topics removed (2025-02-06)
Removed topic system entirely. Conversations are now session-based (>12h gap = new session). Simpler routing, simpler state, more natural coaching flow.

### Prompt caching with SystemPromptBlock[] (2025-02-06)
Structured system prompt as cache-optimized blocks. Block 1 (core principles) cached across all users. Block 2 (briefing/context) cached within session. ~80% cost reduction.

### Monorepo with Turborepo + pnpm (2025-01-xx)
Split into apps/mobile + apps/admin with shared packages (types, constants, coaching). Packages are unbundled TS transpiled by Next.js.

### Supabase for auth + database (2025-01-xx)
Google OAuth for mobile users, password auth for admin. PostgreSQL with RLS. Profile auto-created on signup via DB trigger.
