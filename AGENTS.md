# AGENTS.md - Rondo (Behavioral & Technical)

## 1. Project & Stack
- **Rondo**: Social football platform (iOS/Android/Web) via Expo + Supabase.
- **Stack**: React Native (NativeWind), Expo Router, TypeScript (Strict).
- **Imports**: Always use `@/*` aliases.

## 2. Critical Commands
- Dev: `npm start` | Type Check: `npx tsc --noEmit`.
- Lint: `npm run lint` | Reset: `npm run reset-project`.

## 3. Hard Rules (Mistake Prevention)
- **Surgical Changes**: Touch ONLY what is requested. Don't "improve" adjacent code or formatting.
- **Simplicity First**: Minimum code to solve the problem. No speculative features or abstractions[cite: 1].
- **MANDATORY**: Use `ui-ux-pro-max` skill for ANY styling or UI/UX task[cite: 1].
- **Safety**: NEVER commit `.env`. All async calls MUST use try/catch[cite: 1].
- **Sync**: IMPORTANT: Run `npx tsc --noEmit` after logic changes. Use `RefreshProfile` to sync AuthContext[cite: 1].

## 4. Execution Workflow (Think Before Coding)
- **Assumptions**: State assumptions explicitly before coding. If uncertain, ask[cite: 1].
- **Verification Loop**: 1. Plan step → 2. Execute → 3. Verify (lint/type check)[cite: 1].
- **Minimalism**: If you write 200 lines and 50 suffice, rewrite it[cite: 1].
- **Style**: Match existing project style, even if you prefer otherwise[cite: 1].
- **Commits**: Create separate, logical commits (feat:, fix:, refactor:)[cite: 1].

## 5. Architecture Map
- `app/`: Expo Router (`(auth)`=Public, `(tabs)`=Main)[cite: 1].
- `contexts/AuthContext.tsx`: Session/Profile source of truth[cite: 1].
- `lib/`: Supabase client and shared logic[cite: 1].
- `types/database.ts`: Sync via Supabase CLI only[cite: 1].

## 6. Out of Scope
- No SSR logic. No modifications to `memory/` or Obsidian vault[cite: 1].
- Do not remove pre-existing dead code unless explicitly asked[cite: 1].