# Design: ESV.ch-Style Visual Restyle

**Date:** 2026-07-07
**Status:** Approved

## Problem

The app currently uses a warm parchment/brown/gold "alpine tavern" theme (serif `Bitter` headings, `Work Sans` body, rounded corners, soft shadows and gradients) hardcoded as duplicated inline hex values across 8 files. The user wants the app restyled to match the visual identity of [esv.ch](https://esv.ch/) — the official Eidgenössischer Schwingerverband site — instead.

Reference screenshots (mobile, esv.ch) show:

- **Palette:** white background, black text/borders, Swiss red (`#e30613`-ish) as the sole accent. High contrast, no gradients. (Screenshots also showed an inverted black-background variant — confirmed to be Android's forced dark-mode color inversion, not part of ESV's real design, and not used as a reference.)
- **Typography:** bold condensed all-caps sans for headings/section titles; bold italic sans for teaser headlines; plain sans for body text.
- **Shape:** sharp rectangles everywhere — thin 1-2px borders, no rounded corners, no drop shadows.
- **Header:** light gray bar, red-square logo mark, plain hamburger nav.
- **Content blocks:** flat bordered teaser cards (red border/red text, or solid black/white).
- **Imagery:** real photography, no illustrative icon style.

## Scope

Full re-theme of the app's visual chrome: colors, typography, corner radius, and shadows, across every component. The map's third-party tile imagery (CartoDB Voyager / Esri satellite) is out of scope — only the UI drawn on top of it (toggle buttons, canton overlay, markers, popups) is restyled.

Out of scope: layout/structure changes, new features, copy changes, i18n key changes.

## Decisions From Brainstorming

- **Full re-theme**, not just chrome or just palette (user's explicit choice over narrower options).
- **Typography:** replace `Bitter` with `Oswald` (bold condensed, all-caps for headings); keep `Work Sans` for body text — minimizes font-loading changes while matching ESV's bold-condensed-caps heading style.
- **Shape:** fully flat — sharp corners (`0px` radius) and no `box-shadow` anywhere, including map popups/pins/modals. No "keep shadows for floating elements" exception.
- **Accent color:** Swiss red (`#e30613`) replaces gold *and* green everywhere, including the admin-mode badge (previously green, signaling "elevated permission") — one accent color throughout, matching ESV's single-accent system.
- **Shared tokens:** introduce `src/theme.ts`, a plain TypeScript constants object (no CSS/SCSS), imported by every component. Rationale: the codebase has zero CSS-module/SCSS precedent (styling is 100% inline `style={{}}` objects), and several consumption sites are non-CSS — `markers.ts` builds raw HTML strings for Leaflet popups via string concatenation, and `MapView.tsx` passes colors into Leaflet's `L.PathOptions` (a JS object) — so plain JS/TS values drop in everywhere a CSS custom property could not reliably reach. Adding SCSS would also be a new npm dependency, which the project's CLAUDE.md says to discuss first; a `.ts` constants file needs no new tooling.

## Theme Tokens (`src/theme.ts`, new file)

```ts
export const theme = {
  color: {
    bg: '#ffffff',        // page/card background
    ink: '#111111',       // primary text, borders, footer bg
    paper: '#f2f2f2',     // subtle panel bg (was parchment)
    accent: '#e30613',    // Swiss red — primary actions, active states, alerts
    accentInk: '#ffffff', // text on accent
    line: '#111111',      // border color (1-2px, everywhere)
    muted: '#6b6b6b',     // secondary text
  },
  font: {
    display: "'Oswald', sans-serif", // headings, all-caps, weight 600/700
    body: "'Work Sans', sans-serif", // body text, labels, buttons (unchanged)
  },
  radius: '0px', // used everywhere borderRadius currently appears
} as const;
```

`index.css`'s Google Fonts `@import` swaps `Bitter` for `Oswald` (weights 500/600/700) and keeps `Work Sans`.

## Component-by-Component Treatment

### `index.css`
- Leaflet popup/tooltip: corners → `0px`, border → `1px solid` `theme.color.line`, shadows removed, background → white. Canton tooltip → black bg / white text, sharp corners.
- Scrollbar thumb → `theme.color.ink` (was gold).

### `Topbar.tsx`
- Bar background: solid black (was brown gradient). Bottom border: `3px solid` red (was gold).
- Logo swatch: red square, sharp corners, white "S" monogram (kept as a monogram rather than a Swiss-cross emblem, to stay stylistically inspired by ESV without reproducing its actual logo).
- Wordmark: Oswald bold uppercase, white, "SCHWEIZ" in red (was gold).
- Admin pill: black bg / white text / red dot, sharp corners (was green, rounded).
- Language switcher: flat toggle; active state red bg / white text (was gold pill).
- Login button: red bg / white text. Logout button: white bg / black border. Both sharp corners, no shadow.

### `components/Modal.tsx` (shared shell for Login/Detail/Edit modals)
- Backdrop: `rgba(0,0,0,.55)` (was warm-brown tint).
- Panel: white bg, `2px solid` black border, sharp corners, no shadow (was cream, `16px` radius, heavy shadow).

### `features/sidebar/Sidebar.tsx`
- Background: white (was parchment).
- Search box: sharp corners, `1px solid` black border (was rounded pill).
- Admin "add" button: red flat. Export/import buttons: white bg, black border, sharp corners.
- Canton header label: Oswald uppercase (was Bitter). Count badge: flat rectangle, black bg / white text (was rounded gold pill).
- Venue row: selected left-border and chevron → red (was gold); selected background light gray (was cream).
- Mobile drawer: top corners sharp (was rounded), shadow removed, drag-handle bar black (was tan).

### `features/auth/LoginModal.tsx`, `features/venue-detail/DetailModal.tsx`, `features/venue-edit/EditForm.tsx`
- Titles: Oswald bold uppercase (was Bitter). Body/labels/inputs: Work Sans (unchanged font, restyled colors).
- Primary buttons: red flat. Secondary/cancel buttons: white bg, black border.
- Inputs: sharp corners, black border (was tan, rounded).
- All corners sharp; borders black `1-2px`; no shadows.

### `features/map/MapView.tsx`
- Base/satellite toggle and "fit all" button: white bg, `1px solid` black border, sharp corners, no shadow. Active toggle state: red bg / white text.
- Canton boundary stroke: black (was gold `#9a7c45`).
- Outside-Switzerland mask tint: dark neutral gray (was warm brown/sepia) — keeps the dimming effect without the warm cast.

### `features/map/markers.ts`
- Pin: keeps the teardrop marker shape (a wayfinding convention worth preserving), recolored solid red with white border and white center dot (was gold gradient), no drop-shadow.
- Cluster bubble: solid red circle, white border, white bold number (was gold radial gradient), no shadow.
- Popup card: white bg, `1px solid` black border, sharp corners (was cream, rounded `13px`). Venue name: Oswald bold uppercase (was Bitter). Indoor/outdoor tags: flat rectangle, black border/text on white (was tan filled pill). "Details →" button: red flat, white text, sharp corners.
- Photo placeholder (no photo yet): diagonal hatch pattern in grayscale (was tan), "FOTO" label black-on-white.

### `App.tsx`
- Page shell background: white/light gray (was `#efe3c9`).
- Delete/unsaved-changes confirmation dialogs and the import-mismatch resolution UI: same substitution pattern — Oswald uppercase headings, red primary action, black-border secondary action, sharp corners, no shadow.
- Flash/toast message: success moves to a flat black/white style (still reads as "ok" without the green association we're retiring); error stays in the red family, flat style — both lose the current soft rounded/tinted look.

## Files Touched

`src/theme.ts` (new), `src/index.css`, `src/App.tsx`, `src/components/Topbar.tsx`, `src/components/Modal.tsx`, `src/features/sidebar/Sidebar.tsx`, `src/features/auth/LoginModal.tsx`, `src/features/venue-detail/DetailModal.tsx`, `src/features/venue-edit/EditForm.tsx`, `src/features/map/MapView.tsx`, `src/features/map/markers.ts`.

## Testing

Purely visual/CSS change — confirmed none of the existing Vitest/RTL tests assert on colors or inline style values, so `npm run test` passes unchanged. `npm run lint` and `npm run build` verify no TS errors from the new `theme.ts` imports and its usage. Because this is a large visual change, it also needs a manual pass in a running dev server (map, sidebar, popups, modals, mobile drawer, admin views) before being called done, per the project's UI-verification practice.

## Non-Goals

- No new npm dependencies (no SCSS, no font-loading library beyond the existing Google Fonts `@import`).
- No layout, i18n, or feature changes — visual restyle only.
- No changes to map tile providers or third-party imagery.
- Not attempting to reproduce ESV's actual logo/wordmark — the design is *inspired by* ESV's visual style, not a copy of its brand mark.
