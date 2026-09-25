---
status: accepted
date: 2026-07-07
decision-makers: André Hofer
---

# Style with inline style objects and a TypeScript theme module

## Context and problem statement

The restyle towards the look of esv.ch found the same colours copied across eight files. Several of
the places that need them aren't React components or CSS:

* Leaflet `divIcon` markup, which is an HTML string;
* `L.PathOptions` objects;
* later, the poster canvas.

One source of design tokens had to reach all of them.

## Considered options

* CSS custom properties
* SCSS
* A TypeScript module of tokens, used from inline style objects and string templates alike

## Decision outcome

Chosen option: `src/theme.ts`, a plain `as const` object that every consumer imports.

* Components use inline `style={{ … }}` objects.
* Marker HTML strings and canvas code interpolate the same values.
* CSS custom properties were ruled out because they couldn't reliably reach the HTML strings and the
  JavaScript option objects.
* SCSS would have been a new dependency with no precedent in the codebase.

The palette is red, black and white with one accent, set in Oswald (headings) and Work Sans (body),
with a small set of radius and shadow tokens. It's inspired by esv.ch and later by the softer,
rounded AFLS style. Neither site's logos or artwork are copied.

### Consequences

* Good, because a colour change is one edit and reaches markers, canvas and components alike.
* Bad, because inline styles can't express hover states or media queries. Those few cases live in
  `src/index.css`.
* A new style should use tokens from `theme.ts`, not literal values.

## More information

`src/theme.ts`, `src/features/map/markers.tsx`
