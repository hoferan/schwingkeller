# Zoom control border mirror — design

## Problem

The custom "zoom to fit" (fit-all-bounds) button sits directly below Leaflet's
native +/- zoom control and is styled to look like part of the same control
group. Its border color is a hardcoded guess
(`border: 2px solid rgba(0,0,0,.2)` in `nativeCtrlStyle`,
`src/features/map/MapView.tsx`) meant to match the native control's rendered
border.

This has now been reported twice on real devices:

- **#8** — original UI/UX pass: border width didn't match.
- **#21** — follow-up: width now matches, but the border *color/opacity*
  still reads visibly darker than the native control on a real mobile
  browser, even after PR #20 explicitly re-verified the value against
  Leaflet's shipped `leaflet.css` (`.leaflet-touch .leaflet-bar` rule).

Two rounds of guessing a static CSS value from source/screenshots have both
failed to produce a real match on-device. Continuing to guess (e.g. bumping
to `rgba(0,0,0,.3)` as literally suggested in #21) risks a third round of the
same failure.

## Approach

Instead of hardcoding a value that *should* match the native control, read
the native control's **actual rendered border** at runtime and copy it onto
the custom button. This makes the two controls match by construction,
regardless of Leaflet version, browser rendering/anti-aliasing, or device
pixel ratio — closing off this entire class of bug rather than producing
another guessed constant.

Two other approaches were considered and rejected:

- **Static bump to `rgba(0,0,0,.3)`** — matches the issue's literal
  suggestion, but repeats the exact failure mode that produced #21 in the
  first place (guessing from CSS source rather than real rendering).
- **Pixel-sample once and hardcode that value** — more rigorous than the
  above (based on real rendering, not CSS source), but still a frozen
  snapshot that can silently drift out of sync on a Leaflet version bump, a
  different browser's anti-aliasing, or a different device pixel ratio.

## Mechanism

`MapView.tsx`'s existing map-init effect already grabs the native control's
DOM element once, in `map.whenReady`, to measure its size for positioning the
fit-to-bounds button:

```ts
const zoomEl = map.zoomControl.getContainer();
if (zoomEl) {
  setFitAllTop(10 + zoomEl.offsetHeight + 10);
  setFitAllSize(zoomEl.offsetWidth);
}
```

This is extended to also read the native control's real computed border and
store it as new state:

```ts
const zoomStyle = getComputedStyle(zoomEl);
setFitAllBorder(`${zoomStyle.borderWidth} ${zoomStyle.borderStyle} ${zoomStyle.borderColor}`);
```

`fitAllWrapStyle` applies `border: fitAllBorder` instead of spreading the
hardcoded `border` from `nativeCtrlStyle`.

Because `map.zoomControl`'s container element carries Leaflet's own
`leaflet-bar`/`leaflet-control-zoom` classes directly (no separate nested
element to reach into), `getComputedStyle` on it resolves exactly the border
Leaflet itself decided to render for the current browser/viewport — solid
non-touch style, translucent touch style, or anything a future Leaflet
version changes it to.

## Fallback

Before the measurement effect runs (first paint) or in the unlikely case
`zoomEl` isn't found, the fit-to-bounds button falls back to today's value
via a new `FIT_ALL_DEFAULT_BORDER` constant (`'2px solid rgba(0,0,0,.2)'`).
This mirrors the existing `FIT_ALL_DEFAULT_TOP`/`FIT_ALL_DEFAULT_SIZE`
fallback pattern already used for size/position — no new failure mode is
introduced.

## Scope boundary

Only `border` is mirrored (width + style + color together, read as one
unit). `background` (`#fff`) and `border-radius` (`4px`) on the custom
button stay hardcoded — they were not reported broken and already match; touching
them would be unrelated scope creep.

## Comment cleanup

The current block comment above `nativeCtrlStyle` (lines 29-36) asserts the
value was "verified against `leaflet.css`" — that false confidence is what
led directly to #21. It will be replaced with a comment explaining the
runtime-mirroring mechanism: why it reads from the live DOM instead of
hardcoding a value, referencing the recurring-mismatch problem in general
rather than a specific issue number.

## Verification

`MapView.tsx` has no existing unit test coverage — Leaflet's real-DOM/canvas
requirements make it impractical under jsdom, and no test file exists for it
today. This change doesn't introduce a new testing gap; it follows the
existing pattern.

Verification instead uses a throwaway script (not committed, not added to
`package.json`) built on the environment's globally-installed Playwright:

1. Start the dev server and load the app in a touch-emulated mobile viewport
   (`hasTouch: true`, matching Leaflet's `.leaflet-touch` detection).
2. Screenshot the zoom control area before the fix, confirming the reported
   mismatch reproduces.
3. Apply the fix, reload, screenshot again.
4. Pixel-sample the border pixels of both controls and diff them as
   objective before/after evidence.

## Out of scope

- No i18n impact — no user-facing text changes.
- No changes to `background`/`border-radius` (see Scope boundary above).
- No new npm dependency — Playwright is used only as an environment-global
  tool for one-off verification, never referenced from application code or
  `package.json`.
