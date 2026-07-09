# Modal cut off on mobile viewport — design

## Problem

On mobile, the edit-venue modal ("Schwingkeller bearbeiten") is taller than
the actual visible viewport. Its header/close button is cut off at the top
and its footer action buttons ("Speichern & schliessen", "Abbrechen",
"Speichern & neu") are cut off at the bottom, hidden behind the browser's
address bar and bottom nav bar (reported on Samsung Internet / Android;
issue #22).

Root cause: `src/components/Modal.tsx:20` sizes the modal with
`maxHeight: '92vh'`. On mobile browsers, `vh` is based on the *largest*
viewport (browser chrome collapsed), which is taller than the real visible
area once the address bar / nav bar are shown — so the modal overflows the
true visible viewport.

`App.tsx:237` already solves the identical problem for the app's root
container by using `100dvh` instead of `100vh`, with no fallback (relying on
`dvh` support in modern mobile browsers, which is broad, including Samsung
Internet).

## Approach

Change `Modal.tsx`'s `maxHeight: '92vh'` to `maxHeight: '92dvh'`, matching
the existing pattern in `App.tsx`. `dvh` tracks the actual visible viewport
as browser chrome shows/hides, keeping the modal's header and footer inside
the real visible area. The modal's existing `overflow: 'auto'` /
`sk-scroll` class continues to handle scrolling of the inner content when it
doesn't fit.

One alternative was considered and rejected:

- **`dvh` with an explicit `vh` fallback for older browsers** (as literally
  suggested in the issue text) — rejected because inline React style objects
  can't hold two values for the same CSS property (`maxHeight` can only be
  set once per object), so a real fallback would require introducing a new
  CSS class/stylesheet rule. `App.tsx` already established the simpler
  dvh-only convention for this exact class of bug without a fallback, and
  this app does not otherwise target legacy browsers — matching that
  existing convention keeps the codebase consistent rather than introducing
  a second, more complex pattern for the same problem.

## Scope boundary

`Modal.tsx` is the single shared modal component used throughout the app
(edit/add venue dialog and any other modal), so this one-line change fixes
the cutoff everywhere `<Modal>` is used. No other component defines its own
modal viewport sizing (confirmed: `maxHeight`/`92vh` appears nowhere else in
`src/`).

## Out of scope

- No i18n impact — no user-facing text changes.
- No changes to modal width, padding, or other styling.
- No new npm dependency or CSS file.

## Verification

No existing unit test covers `Modal.tsx`'s inline styles, and this is a
single CSS-value change with no logic branch, so no unit test is meaningful
here. Verification is manual/visual:

1. Start the dev server.
2. Emulate a mobile viewport with visible browser chrome (devtools mobile
   emulation, or a real device) and open the edit-venue modal.
3. Confirm the modal header and footer action buttons stay within the
   visible viewport, with inner content scrolling as needed.
