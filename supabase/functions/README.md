# Rondo Edge Functions

These functions are versioned here so the repository is the source of truth for production backend behavior.

## Auth posture

- `cancel-match`: `verify_jwt=true`; user JWT is required and organizer ownership is checked before any service-role mutation.
- `cancel-participation`: `verify_jwt=true`; user JWT is required and the participant row must belong to the caller.
- `auto-confirm-attendance`: `verify_jwt=false` only because it is a scheduled endpoint; callers must provide `X-Cron-Secret`.
- `waitlist`: `verify_jwt=false` because it is public; hCaptcha is verified before service-role writes.

Deploy with `supabase functions deploy <name>` after validating `supabase/config.toml`.

