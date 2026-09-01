# Rondo Edge Functions

These functions are versioned here so the repository is the source of truth for production backend behavior.

## Auth posture

- `cancel-match`: `verify_jwt=true`; user JWT is required and organizer ownership is checked before any service-role mutation.
- `cancel-participation`: `verify_jwt=true`; user JWT is required and the participant row must belong to the caller.
- `auto-confirm-attendance`: `verify_jwt=false` only because it is a scheduled endpoint; callers must provide `X-Cron-Secret`.
- `send-push`: `verify_jwt=false` because it is called by Database Webhooks; callers must provide `Authorization: Bearer <SEND_PUSH_WEBHOOK_SECRET>`.
- `scheduled-pushes`: `verify_jwt=false` only because it is a scheduled endpoint; callers must provide `X-Cron-Secret`.
- `waitlist`: `verify_jwt=false` because it is public; hCaptcha is verified before service-role writes.
- `signup-brevo`: `verify_jwt=false` because signup users may not have a session before email confirmation; the function validates `userId` + `email` against Supabase Auth before calling Brevo.
- `delete-brevo-contact`: `verify_jwt=true`; the authenticated user's email is deleted from Brevo before local account deletion.

Deploy with `supabase functions deploy <name>` after validating `supabase/config.toml`.

## Scheduled push types

- `match_reminders`: reminds joined players 30 minutes before a match, pending team members at 48 hours, and captains with open spots at 24 hours.
- `nearby_digest`: sends the daily nearby-match digest.
- `review_reminders`: reminds players 24 hours after a pending review notification if they still have not reviewed.
