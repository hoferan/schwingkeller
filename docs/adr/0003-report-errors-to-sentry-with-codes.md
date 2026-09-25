---
status: accepted
date: 2026-06-20
decision-makers: André Hofer
---

# Report caught errors to Sentry and show a translated message with a code

## Context and problem statement

Errors caught in the app never reached Sentry, because only uncaught ones did. The ones users saw
were raw Postgres messages, sometimes in a `window.alert`. And every Sentry event was tagged
`production`, including those from deploy previews and local runs.

## Considered options

* Keep raw messages and alerts
* Capture every caught error, and show a generic translated message with a short error code
* Add Sentry uptime monitoring and a health endpoint as well

## Decision outcome

Chosen option: capture every caught error, and show a translated message with a code.

* `src/features/venues/api.ts` prefixes each thrown message with the Supabase or Postgres error code
  in brackets. Other modules follow the same pattern with their own codes, such as
  `[UNKNOWN_CANTON]` in the poster code.
* `captureAndFormat` sends the error to Sentry and returns the translated text plus the code for the
  toast, so a user can quote the code and we can find the event.
* The Sentry environment comes from `VITE_APP_ENV`, which `netlify.toml` sets per deploy context.
  It falls back to `development`.
* Uptime is watched by UptimeRobot, so Sentry uptime monitoring wasn't needed. A health endpoint was
  left out because nothing would consume it.

### Consequences

* Good, because every handled failure shows up in Sentry under the right environment.
* Good, because users never see database internals.
* Bad, because a new error path has to go through `captureAndFormat`, or it disappears again.
* The fallback in `src/lib/sentry.ts` uses `||`, not `??`, on purpose. `.env.example` ships
  `VITE_APP_ENV=` empty, and an empty string has to fall back to `development` too.

## More information

`src/lib/sentry.ts`, `src/features/venues/api.ts`, `netlify.toml`
