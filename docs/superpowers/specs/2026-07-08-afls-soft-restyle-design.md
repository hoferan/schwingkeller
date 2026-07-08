# Design: Soft Rounded-Card Restyle (AFLS Reference)

**Date:** 2026-07-08
**Status:** Approved

## Problem

The app just shipped a full visual restyle to a flat, sharp-cornered, shadowless red/black/white style modeled on esv.ch (spec: `docs/superpowers/specs/2026-07-07-esv-visual-restyle-design.md`, PR #7). After seeing it live, the user shared a different reference — [afls-schwinglokale.wasmer.app](https://afls-schwinglokale.wasmer.app) (Association Fribourgeoise de Lutte Suisse's Schwingkeller-locator app) — and prefers its visual style more.

Both references share the same red/black/white palette and bold-uppercase-heading philosophy. What differs is the **shape and depth language**:

| Element | Shipped (esv.ch-flat) | AFLS reference |
|---|---|---|
| Corners | `0px`, fully flat | Rounded — pills, cards, inputs |
| Shadows | None anywhere | Soft shadows on floating elements |
| Header | Solid black bar | White background, red text |
| Top border | Thick (3px) | Thin |
| Language switcher | Flat segmented toggle | Rounded pill, gray track + red active pill |
| Count badges | Flat rectangle | Rounded pill |
| Map pins | Teardrop marker | Plain filled circle |
| Cluster markers | Numbered circle | Stacked/overlapping circles, no number |
| Zoom/layer controls | Flat, bordered, no shadow | Rounded card, soft shadow |
| Borders | Black, 1-2px | Light gray hairline |

This spec amends the shipped restyle: keep its palette, single red accent, and Oswald/Work Sans typography decisions; replace its "fully flat, no shadow, black border" shape rules with a soft rounded-card system matching the AFLS reference.

## Scope

Amends every component touched by the prior restyle (`src/theme.ts` and its 10 consumers) to use new shape/depth tokens instead of `radius: '0px'` and no-shadow. Adds one new structural element to the Sidebar (a title block with a count pill) that doesn't exist in the current layout. No palette, typography, copy, i18n, or feature changes beyond what's listed here.

One exception to "keep the numbered cluster": per the user's explicit choice, the cluster bubble stays numbered (not the reference's stacked-circle style) — restyled only.

## Decisions From Brainstorming

- **Header:** full white background (not a hybrid of keeping the black bar) — matches the reference exactly, per the user's explicit choice over the smaller "keep black bar" option.
- **Cluster markers:** stay numbered (not stacked circles) — the count is useful at-a-glance information the reference's version loses; only the visual treatment (shadow/rounding) changes.
- **Base/Satellite map switcher:** switches to native radio buttons in a rounded card, matching the reference exactly, rather than reusing the segmented-pill pattern — per the user's explicit choice, accepting a second toggle UI pattern in the app (pill for language, radio for map layer) in exchange for closer fidelity to the reference.
- **Sidebar title block:** added as new structure (bold black bar, white uppercase heading, red count pill) above the search box — the current app has no equivalent, only a small inline "NACH KANTON" label elsewhere in the list.
- **Shape convention:** "action chips" (language switcher, login button, admin badge, count pills) use `theme.radius.pill` (`999px`); everything else (buttons, inputs, cards, modals, popups, map controls) uses `theme.radius.sm` (~`10px`).

## Theme Token Changes (`src/theme.ts`)

```ts
export const theme = {
  color: {
    bg: '#ffffff',
    ink: '#111111',
    paper: '#f2f2f2',
    accent: '#e30613',
    accentInk: '#ffffff',
    line: '#e2e2e2',       // was '#111111' — hairline gray, not black
    muted: '#6b6b6b',
  },
  font: {
    display: "'Oswald', sans-serif",
    body: "'Work Sans', sans-serif",
  },
  radius: {
    sm: '10px',            // was a single flat '0px' — buttons, inputs, cards, modals, popups, map controls
    pill: '999px',         // badges, toggles, count pills, login button, admin badge
  },
  shadow: '0 4px 16px rgba(0,0,0,.12)', // floating elements: map controls, modals, popups
} as const;
```

`theme.radius` changes from a single string to an object (`sm`/`pill`) — every consumer that referenced `theme.radius` directly must be updated to `theme.radius.sm` or `theme.radius.pill` depending on the element. This is a breaking change to the token shape from the prior spec, made deliberately rather than adding a second top-level key, since every consumer is being touched in this pass anyway.

Circular shape primitives (dots, close buttons, the cluster bubble's circle, the pin's center dot) keep their own literal `50%` / pin-teardrop `50% 50% 50% 0` — unrelated to either `radius` token, same as before.

`src/index.css`'s literal color copies update `line` to `#e2e2e2` and gain the shadow value where the prior restyle had removed `box-shadow` (Leaflet popup wrapper, canton tooltip).

## Component-by-Component Treatment

**Topbar:** white background (was solid black `theme.color.ink`); wordmark in bold uppercase red (`theme.color.accent`) directly on white, no background tile; the square "S" monogram is removed entirely (the reference has no logo mark, just the wordmark); top border becomes thin (`1px solid theme.color.accent`, was `3px`); language switcher becomes a rounded pill segmented control (light gray track — `theme.color.paper` — with a `theme.radius.pill` red pill behind the active language); login button and admin badge become `theme.radius.pill` instead of `theme.radius` rectangles.

**Modal shell, LoginModal, DetailModal, EditForm:** panels get `theme.radius.sm` corners, `theme.shadow`, and a `1px solid theme.color.line` hairline border (replacing the flat `2px solid` black border with no shadow). Inputs and buttons get `theme.radius.sm`. Primary action buttons (save, login, navigate) stay solid red; secondary/cancel buttons keep a hairline border, now light gray instead of black.

**Sidebar:** new title block added above the search box — black bar (`theme.color.ink` background), bold white uppercase heading, `theme.radius.pill` red count badge (e.g. "24 SCHWINGKELLER", i18n'd). Search box becomes `theme.radius.sm` (was a fully-rounded pill in the current build — the reference uses a subtler rectangle-with-rounded-corners) with a `theme.color.line` hairline border. Canton/venue list rows keep their flat layout with `theme.color.line` (now light gray) dividers.

**MapView:** zoom control and the (now radio-button) base/satellite switcher both become rounded cards (`theme.radius.sm`) with `theme.shadow` and a `theme.color.line` hairline border. The satellite/map choice switches from segmented buttons to two native `<input type="radio">` + label rows stacked vertically in the card, styled to match (custom radio indicator using the existing circular-dot convention, red when selected).

**markers.ts:** pin shape changes from the teardrop `divIcon` to a plain circle — `theme.color.accent` fill, `theme.color.bg` ring border, `theme.color.bg` center dot (no color-based selected state, unchanged from the prior restyle's simplification). Cluster bubble keeps its number, gains `theme.shadow`. Popup card becomes `theme.radius.sm` with `theme.shadow`, replacing the flat bordered card.

**App.tsx:** delete-confirm and import-confirm dialogs, the placing banner, and the flash/toast all move from `theme.radius` (flat) to `theme.radius.sm` and gain `theme.shadow` (previously explicitly shadowless).

## Files Touched

Same file list as the prior restyle, since every consumer of `theme.radius` needs updating to the new `sm`/`pill` shape: `src/theme.ts`, `src/theme.test.ts`, `src/index.css`, `src/App.tsx`, `src/components/Topbar.tsx`, `src/components/Modal.tsx`, `src/features/sidebar/Sidebar.tsx`, `src/features/auth/LoginModal.tsx`, `src/features/venue-detail/DetailModal.tsx`, `src/features/venue-edit/EditForm.tsx`, `src/features/map/MapView.tsx`, `src/features/map/markers.ts`. Plus new i18n keys for the Sidebar's title-block heading and count text (DE/FR/IT), and a refreshed `docs/screenshot.png`.

## Testing

Same posture as the prior restyle: purely visual/shape change, no test currently asserts on colors, radius, or shadow values, so `npm run test` is a regression safety net rather than a source of new required tests. `theme.test.ts` needs updating for the new `radius.sm`/`radius.pill`/`shadow` shape (replacing its old single-`radius` assertion). New i18n keys need entries in all three language files, verified by the existing i18n completeness test if one exists, or added if the Sidebar title block introduces user-visible text not yet covered. `npm run lint`, `npm run typecheck`, and `npm run build` gate the final task same as before. A manual visual pass in the dev server (or a fresh `docs/screenshot.png`) confirms the result before calling it done.

## Non-Goals

- No changes to the palette (still red/black/white, one accent), typography choice (Oswald/Work Sans), or any i18n text beyond the new Sidebar title-block strings.
- No new npm dependencies (native `<input type="radio">` needs no library).
- Not attempting to reproduce AFLS's logo/branding — inspired by its shape language, not a copy of its brand identity.
- No changes to map tile providers or third-party imagery.
