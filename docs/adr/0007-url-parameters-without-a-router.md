---
status: accepted
date: 2026-07-10
decision-makers: André Hofer
---

# Read URL parameters once, without a router

## Context and problem statement

People want to share a link to a canton and to a single venue. The app is one screen with modals and
has no router. Both links had to work without adding one, and it had to be clear what happens when a
URL carries both.

## Considered options

* Add a router and sync the whole UI state to the URL
* Read the parameters once at startup and sync back only what is shareable

## Decision outcome

Chosen option: read once, and sync back only the open venue.

* `?ctn=XX` is parsed once at startup. It's case-insensitive, and unknown codes are ignored without
  an error. A valid code pre-expands that canton and flies the map to its bounds.
* `?venue=<id>` is resolved once, after the venue query succeeds (a ref guards against running it
  twice).
* If `venue` is present at all, `ctn` is ignored, even when the venue id turns out to be invalid.
  Falling back to the canton would fire two fly-to animations in a row.
* Afterwards only the open venue is written back, with `history.replaceState`, so no history entries
  pile up. Writing it always removes `ctn`.
* Sharing uses the Web Share API and falls back to the clipboard.
* Syncing everything to the URL (search, sort, expanded groups) and link previews with Open Graph
  tags were left out.

### Consequences

* Good, because there's no router dependency, and a shared link opens exactly one thing.
* Bad, because state that isn't in the URL (search, sort) can't be shared.
* Printed posters carry `?ctn=` QR codes, so the parameter can't be dropped without a redirect.

## More information

* `src/lib/permalink.ts`, `src/App.tsx`, `src/features/venues/useVenuePermalink.ts`, `src/lib/share.ts`
* Issue [#68](https://github.com/hoferan/schwingkeller/issues/68) adds `?vb=` for Verbände and maps
  old `?ctn=` links onto them.
