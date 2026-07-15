# "Suggest an edit" for anonymous visitors + runtime feature flags — Design

**Date:** 2026-07-15
**Issue:** [#15](https://github.com/hoferan/schwingkeller/issues/15)
**Status:** Approved

## Summary

Anonymous visitors can suggest corrections to a venue's contact details from the
detail view. Suggestions land in a moderated queue (`venue_suggestions`) that
admins accept (one-click apply) or dismiss. The feature is gated behind a new
reusable **runtime feature-flag system** backed by a `feature_flags` table —
the first flag is `suggest_edit`, usable as a kill switch if abuse appears.

Decisions made during brainstorming:

- **Flag mechanism:** general, reusable, runtime (DB-backed); toggled in the
  Supabase Studio table editor only — no in-app flag UI.
- **Form scope:** contact fields (address, person, phone, website) + optional
  free-text note. No name/canton/coordinates/photos.
- **Accept flow:** one-click apply from a per-field diff.
- **Spam guard:** hidden honeypot field + DB length caps; the flag is the
  emergency brake. No CAPTCHA, no Edge Functions.
- **Review surfaces:** central queue in the sidebar Verwaltung band **and** a
  pending-suggestions chip in the venue detail (admins only).

## Architecture

Pure client + RLS (matches every existing pattern): supabase-js, RLS policies,
TanStack Query hooks, no new npm dependencies, no new infrastructure.

Alternatives rejected: Edge Function–mediated inserts (first Edge Function in
the project; deploy/dev complexity not justified at this traffic level) and a
single JSONB `app_config` row for flags (weaker typing, clumsier to toggle in
Studio than a boolean cell per flag).

## Data model & RLS

### Migration `0007_feature_flags.sql`

```sql
create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text default '',
  updated_at timestamptz not null default now()
);
```

- Reuses the existing `set_updated_at()` trigger function.
- RLS: public `select`; `authenticated` `update`. No client `insert`/`delete` —
  new flags are seeded by migration.
- Seed: `('suggest_edit', true, 'Anonymous "Suggest an edit" on venue detail')`.

### Migration `0008_venue_suggestions.sql`

```sql
create table public.venue_suggestions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  address text,
  person text,
  phone text,
  website text,
  note text default '',
  status text not null default 'pending'
    check (status in ('pending','accepted','dismissed')),
  created_at timestamptz not null default now()
);
```

- Suggested-field columns are **nullable**: `null` = "no change proposed for
  this field". This drives the per-field diff and one-click apply.
- Length caps as check constraints: `address`, `person`, `website` ≤ 200,
  `phone` ≤ 50, `note` ≤ 500. Enforced server-side even against direct REST
  calls.
- RLS:
  - `insert` for `anon` and `authenticated`, `with check (status = 'pending')`
    so nobody can self-accept.
  - `select` / `update` for `authenticated` only. In this app every
    authenticated user is an admin (same model as `venues_auth_*` policies),
    so `to authenticated` **is** admin-only; no extra role machinery.
  - No client `delete` — dismiss is a status update.

## Feature-flag mechanism (client)

New folder `src/features/flags/`:

- `types.ts` — `type FlagKey = 'suggest_edit'` (union grows per flag);
  `type FeatureFlags = Record<FlagKey, boolean>`.
- `api.ts` — `listFlags(): Promise<FeatureFlags>` via supabase-js with the
  shared `toError` style. Unknown DB keys are ignored; known keys missing from
  the DB default to `false`.
- `useFeatureFlag.ts` — TanStack Query hook, `staleTime` 5 minutes:
  `useFeatureFlag(key: FlagKey): boolean`. **Fails closed** while loading and
  on error: gated UI simply doesn't render until flags arrive.

One fetch per session (TanStack Query cache); flipping the Studio row takes
effect on next load/refetch.

## Visitor flow ("Suggest an edit")

- Entry point in `DetailModal`: a low-emphasis link-style button under the
  contact block, rendered when `useFeatureFlag('suggest_edit')` is true and
  the user is **not** admin (admins have the real Edit button).
- `src/features/venue-suggest/SuggestForm.tsx` — modal form (reuses `Modal`):
  - Prefilled inputs: address, person, phone, website; optional note textarea.
  - Hidden honeypot input; if filled, the client silently pretends success
    without inserting.
  - On submit, fields equal to the current venue values are sent as `null`.
    Submit is disabled when all four fields are unchanged and the note is
    empty.
  - `maxLength` attributes mirror the DB caps.
- `venue-suggest/api.ts` `createSuggestion()` + TanStack `useMutation`.
  Success → inline thank-you state in the modal; error → existing error
  styling.
- All new strings in DE/FR/IT via the i18n layer.

## Admin review

- **Central queue:** a "Suggestions" row in the existing collapsible
  Verwaltung band in `Sidebar`, with a pending-count badge (hidden at 0).
  Count via `usePendingSuggestions()` — TanStack Query over
  `venue_suggestions` with `status = 'pending'`, joined with venue names,
  fetched only when `isAdmin`.
- **`SuggestionQueueModal`** (`src/features/venue-suggest/`): lists pending
  suggestions with venue name, date, note, and a diff table showing only
  non-null fields as `current → suggested`.
  - **Accept:** `updateVenue(venueId, changedFields)` (existing API), then set
    the suggestion's `status = 'accepted'`; invalidate venue + suggestion
    queries. The diff always renders the *live* current value, so if the venue
    changed since submission the admin sees exactly what Accept overwrites —
    no separate staleness guard.
  - **Dismiss:** set `status = 'dismissed'`.
- **Venue-detail indicator:** when `isAdmin` and the open venue has pending
  suggestions, `DetailModal` shows an amber "N pending suggestions" chip that
  opens the same `SuggestionQueueModal` pre-filtered to that venue. One modal
  component, two entry points.

## Error handling

All mutations use the shared `toError` pattern; failures surface through the
existing error styling; unexpected throws reach Sentry as today.

## Testing (TDD, Vitest + RTL, Supabase mocked)

- Flags: `api.ts` mapping (unknown keys ignored, missing keys false);
  `useFeatureFlag` fail-closed on loading/error.
- Suggestions api: null-for-unchanged mapping; honeypot drop (no insert call).
- `SuggestForm`: prefill, disabled submit when unchanged, submitted payload,
  thank-you state.
- `SuggestionQueueModal`: diff rendering (only non-null fields), accept
  (updateVenue called with only changed fields + status update), dismiss.
- `DetailModal`: suggest button gated by flag + non-admin; chip gated by
  admin + pending count.
- `Sidebar`: badge count, hidden at 0, admin-only fetch.

## Out of scope (YAGNI)

Email notifications, suggestion history UI, editing suggestions before accept,
rate limiting beyond honeypot/length caps, CAPTCHA, in-app flag toggle UI.
