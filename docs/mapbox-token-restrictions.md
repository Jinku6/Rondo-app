# Mapbox Public Token Restrictions

Rondo uses `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` from the Expo client. This token is public in mobile/web bundles, so it must be restricted in the Mapbox dashboard.

## Required Restrictions

- Token type: public token, not secret token.
- URL restrictions for web builds:
  - Add the production Rondo web domain when available.
  - Add localhost only for local development if web testing needs it.
- Application restrictions for native builds:
  - iOS bundle identifier: `com.jinku620.rondo`
  - Android package name: `com.jinku620.rondo`
- Scope/allowed APIs:
  - Allow Mapbox Search / Search Box API.
  - Allow Geocoding API for reverse city lookup.
  - Do not enable unrelated write, tileset, upload, or account-management scopes.

## Rotation

If this token has ever been shared outside local `.env`, rotate it in Mapbox and update `.env` locally. Do not commit `.env`.
