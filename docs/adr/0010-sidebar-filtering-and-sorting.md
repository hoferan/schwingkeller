---
status: accepted
date: 2026-07-14
decision-makers: André Hofer
---

# Filter the sidebar only, and ask for the location only on request

## Context and problem statement

Three features landed together in July 2026: indoor and outdoor filters, a list that shows every
canton, and sorting by name or by distance from the user. They share the sidebar, and each one could
have spilled onto the map or into the URL.

## Considered options

For the filters:

* Filter both the map and the list
* Filter the list only

For sorting by distance:

* Keep the canton groups and order them by their nearest venue
* Flatten the list

For the location:

* Watch the location continuously with `watchPosition`
* Ask once per user action with `getCurrentPosition`

## Decision outcome

Chosen options:

* The search text and the facets narrow the sidebar list only. The map always shows every venue.
  Facets combine with OR among themselves and with AND against the text search.
* While nothing is being searched or filtered, all 26 cantons are listed, including empty ones.
  While filtering, only cantons with matches show.
* Canton grouping is the default sort, and the choice resets on reload. Filter and sort state isn't
  lifted into `App` or the URL.
* Sorting by name or distance flattens the list and shows a small coat of arms on each row. Ordering
  canton groups by their nearest venue was rejected: it looks sorted while hiding closer venues in
  later groups.
* One shared geolocation hook makes a one-shot `getCurrentPosition` call when the user asks for it,
  never on page load. `watchPosition` would drain phone batteries, and no geolocation library is
  needed.
* A "request access" link for empty cantons was deferred to the user-management work.

### Consequences

* Good, because the map stays a stable overview while the list does the narrowing.
* Good, because the location prompt only appears after a deliberate tap.
* Bad, because a filtered list and the unfiltered map show different sets of venues.

## More information

* `src/features/venues/grouping.ts`, `src/features/sidebar/Sidebar.tsx`, `src/features/geo/useGeolocation.ts`
* Issue [#67](https://github.com/hoferan/schwingkeller/issues/67) replaces canton grouping with
  Teilverband and Verband grouping.
