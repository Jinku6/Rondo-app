# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rondo** is a cross-platform mobile app (iOS, Android, Web) built with Expo and React Native. It's a social platform for organizing and discovering football (soccer) matches, connecting players, and managing game logistics.

## Stack & Architecture

### Core Technologies
- **Framework**: Expo with React Native + React Native Web
- **Routing**: Expo Router (file-based routing in `app/` directory)
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Styling**: Tailwind CSS via NativeWind
- **Language**: TypeScript (strict mode)
- **Authentication**: Supabase Auth (email/password + Google OAuth)

### Key Directories

```
app/                     # Expo Router file-based routing
  (auth)/               # Login/Register/Password recovery flows
  (tabs)/               # Main app - create, home, messages, my matches, profile
  chat/                 # Match chat threads
  match/                # Match details and reviews
  search/               # Search functionality
  user/                 # User profile viewing

contexts/               # React Context (AuthContext for session management)
components/             # Reusable UI components (CiudadInput, ProfileStats, etc.)
hooks/                  # Custom hooks (useColorScheme, useThemeColor)
lib/                    # Utilities (supabase client, geocoding, message filters)
types/                  # TypeScript interfaces (database.ts for Supabase types)
```

### Path Aliases
TypeScript is configured with `@/*` pointing to the root. Use this for all imports:
```typescript
import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types/database';
```

## Architecture Patterns

### Authentication Flow
- `AuthContext` wraps the app and manages Supabase session state
- `RootLayout` (app/_layout.tsx) handles auth redirects: unauthenticated → `/(auth)`, authenticated → `/(tabs)`
- Birthday gate modal intercepts users from Google OAuth who lack a birthdate
- Password recovery via Supabase deep linking triggers `reset-password` route

### Navigation Structure
- **Unauthenticated**: Stack of login, register, forgot-password, reset-password screens
  - `app/(auth)/login.tsx`
  - `app/(auth)/register.tsx`
  - `app/(auth)/forgot-password.tsx`
  - `app/(auth)/reset-password.tsx`
- **Authenticated**: Tabs (create, home/index, messages, my-matches, profile) with additional Stack screens for details/modals
- Screen options configured via Expo Router's `screenOptions`

### Data & State Management
- **Profile data**: Fetched via AuthContext from `users` table and cached in context
- **Real-time data**: Supabase subscriptions (e.g., messages, match updates)
- **Local caching**: React state + AsyncStorage for persistent data (handled in contexts or screens)

### Form Inputs
- Custom location/city inputs (CiudadInput, UbicacionInput) integrate with Photon/Nominatim geolocation APIs
- Date pickers differ by platform (Android inline, iOS spinner)
- hCaptcha integration for signup validation

## Common Development Commands

```bash
# Start development server (all platforms)
npm start

# Run on specific platform
npm run web          # Web browser
npm run android      # Android emulator/device
npm run ios          # iOS simulator/device

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Reset project (useful for dependency issues)
npm run reset-project
```

## Key Concepts & Important Details

### Supabase Integration
- Client initialized in `lib/supabase.ts`
- Authentication handled through Supabase Auth with Supabase Google OAuth provider
- Database types should be kept in sync with `types/database.ts` using Supabase CLI (`supabase gen types`)

### Styling
- **Framework**: Tailwind CSS applied via NativeWind for React Native
- **Color scheme**: App detects system dark/light mode (useColorScheme hook)
- **Inline styles**: Still used in some screens for platform-specific or dynamic styling; prefer Tailwind classes when possible
- **Primary color**: #22C55E (green)

### Localization
- App defaults to Spanish (es-ES) for date formatting and labels
- Some screens use Spanish text strings (Guardar, Cancelar, etc.)

### Multi-Platform Considerations
- Platform-specific code uses `Platform.OS` checks (Android/iOS/web)
- `react-native-web` enables web support with Expo; some dependencies have `.web.ts` variants
- Gesture handling and reanimated for smooth animations across platforms

### Common Patterns in Code
- **useAuth hook**: Access session, user, profile, and auth methods anywhere
- **Error handling**: Supabase errors typically return `{ error, data }` tuples
- **Async state**: Common pattern is `[state, setState]` + `[loading, setLoading]` + `[error, setError]`
- **RefreshProfile**: Called after user updates to sync AuthContext profile state with database

## Debugging Tips

- **Supabase logs**: Check Supabase dashboard or use `supabase logs --project-ref <ref>`
- **Dev server output**: `npm start` shows Metro bundler output and React warnings
- **Deep links**: Test password recovery and auth redirects with Supabase email preview
- **Permissions**: Location and image picker require runtime permissions on Android/iOS
- **Geolocation APIs**: App uses Photon and OpenStreetMap Nominatim for location search; test with actual addresses

## Known Workflow Details

- New screens typically placed in `app/` following file-based routing
- Auth state changes trigger redirects via `useSegments()` + `useRouter()`
- Modal overlays (like BirthdayGateModal) handled in RootLayout
- Chat/match routes use dynamic segments: `[match_id]`, `[player_id]`, `[id]`
- Reviews are separate screens per role: `review-organizer`, `review-player`

## Custom Skills

### Project-Specific Skills (in `.agents/skills/`)

- **brainstorming** - Use before any creative work (features, components, functionality). Explores user intent, requirements, and design before implementation. Outputs a written spec doc.
- **lint-and-validate** - MANDATORY: Run after every code change. Executes `expo lint` and `tsc --noEmit` to ensure code quality and type safety.
- **ui-ux-pro-max** - Professional UI/UX design toolkit with data and styles for multiple stacks (React Native, React, Flutter, SwiftUI, etc.).

### Anthropic Skills (Available Globally)

Also available for use:
- **debugger** - Debugging errors, test failures, and unexpected behavior using root cause analysis.
- **systematic-debugging** - Methodical debugging of complex issues.
- **react-ui-patterns** - React UI patterns for loading states, error handling, data fetching.
- **react-patterns** - Modern React patterns, hooks, composition, performance, TypeScript best practices.
- **api-security-best-practices** - Secure API design patterns.
- **backend-security-coder** - Secure backend coding practices.
- **frontend-security-coder** - Secure frontend coding practices (XSS prevention, sanitization).
- **security-auditor** - DevSecOps and compliance frameworks.
- **android-ui-verification** - Automated E2E UI testing on Android Emulator.
- **kaizen** - Continuous improvement and standardization.
- And others (see `/help` for full list).
