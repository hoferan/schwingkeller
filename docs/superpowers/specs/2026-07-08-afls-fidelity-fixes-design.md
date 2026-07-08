# Design: AFLS Fidelity Fixes (Header, Language Toggle, Map)

**Date:** 2026-07-08
**Status:** Approved

## Problem

The soft rounded-card restyle (spec: `2026-07-08-afls-soft-restyle-design.md`) shipped the palette, typography, and shape system correctly, but a live PR preview revealed the app still doesn't fully match the AFLS reference (afls-schwinglokale.wasmer.app) in several concrete ways:

- The Topbar hides its wordmark on mobile and collapses the language switcher into a flag+chevron dropdown; AFLS always shows its full name and both language options as visible pills, at every width.
- The Topbar has a hamburger menu button; AFLS has none — its venue list is a bottom sheet revealed by dragging a handle, a pattern this app's `Sidebar` already implements independently on mobile.
- The map uses CartoDB Voyager tiles for "Karte" and overlays Esri road/label reference layers on "Satellit"; AFLS uses plain OpenStreetMap-style tiles and a clean, unlabeled satellite view.
- The map dims everything outside Switzerland's borders and draws canton boundary lines; AFLS shows a plain, full-color, unmarked map.

This spec covers closing those gaps. Some of them (removing the border mask, canton lines, and hamburger) are functional simplifications beyond pure styling — each was explicitly chosen by the user after being flagged as such during brainstorming, not silently assumed.

## Scope

Touches `src/components/Topbar.tsx`, `src/components/Topbar.test.tsx`, `src/App.tsx`, and `src/features/map/MapView.tsx`. No changes to palette, typography, shape tokens (`theme.ts`), Sidebar, modals, markers, or i18n copy beyond what's listed below.

## Decisions From Brainstorming

- **Wordmark:** shortens to "SCHWINGKELLER" (drops "SCHWEIZ") and is shown at every width, including mobile — chosen over keeping it hidden on mobile or a two-row mobile header, to fit alongside the 3-language toggle and login button without overflow.
- **Language toggle:** flag emojis replace with text labels ("DE"/"FR"/"IT", matching AFLS's own text-pill style), shown as three pills at every width — the separate mobile dropdown-with-chevron variant is removed entirely, leaving one toggle implementation for all screen sizes.
- **Hamburger:** removed entirely, mobile and tablet both. Mobile's `Sidebar` drag-handle is a pre-existing, independent toggle for the same `sidebarOpen` state, so the header button was redundant there. Tablet's `Sidebar` already renders as an always-visible static 344px column regardless of `sidebarOpen` (confirmed by reading `Sidebar.tsx`'s layout branch, which only distinguishes `isMobile` — true mobile — from everything else) — so `sidebarOpen` and the tablet scrim in `App.tsx` are already non-functional there today. Removing the hamburger makes that explicit rather than leaving dead plumbing.
- **Map tiles ("Karte"):** switches to `tile.openstreetmap.org`, the official OSM raster tile server, accepting its non-commercial/low-volume usage policy as a reasonable trade-off for a small app (revisit hosting if traffic ever grows). Chosen over CartoDB's paler "Positron" style, which doesn't visually match AFLS's more colorful classic-OSM look.
- **Satellite view:** keeps the existing Esri World Imagery base layer, but drops the two reference overlay layers (`World_Transportation`, `World_Boundaries_and_Places`) that currently draw roads and place labels on top of it — AFLS's satellite view has no such overlay.
- **Outside-Switzerland mask:** removed. It was a deliberate, documented feature ("keeps focus on the country") unrelated to AFLS-matching, but the user chose to drop it anyway for a map that looks the same everywhere, like the reference.
- **Canton boundary lines:** removed. Canton grouping remains fully visible in the Sidebar's "by canton" list; it's just no longer drawn on the map itself.
- **Cleanup consequence:** since the mask and the canton lines were the only two consumers of the `/cantons.geojson` fetch in `MapView.tsx`, removing both features means that entire fetch/parse/render code path (`maskLayerRef`, `cantonLayerRef`, `cantonStyle`, `applyMaskTint`, the `init()` effect that loads the GeoJSON) is now dead and gets deleted, not left in place unused. The static asset `public/cantons.geojson` itself is left alone (harmless unused file, not in scope).

## Component-by-Component Treatment

### `Topbar.tsx` / `Topbar.test.tsx`
- `TopbarProps` drops `showHamburger` and `onToggleSidebar` — no longer needed.
- The hamburger `<button>` and its conditional block are deleted.
- Wordmark text changes from `SCHWINGKELLER <span>SCHWEIZ</span>` (with the mobile-hiding `{!isMobile && (...)}` wrapper) to a single always-rendered `SCHWINGKELLER` line, no split span, no mobile gate.
- The mobile-specific dropdown-with-chevron language switcher block (`isMobile ? (...) : (...)`) is removed; the desktop-style pill row (`LANGS.map(...)`) becomes the only implementation, rendered unconditionally, with `LANG_FLAGS` (emoji lookup) replaced by plain uppercase language codes.
- `Topbar.test.tsx` drops the now-nonexistent `showHamburger`/`onToggleSidebar` props from its render call.

### `App.tsx`
- Drops the `showHamburger={mode !== 'd'}` / `onToggleSidebar={...}` props passed to `<Topbar>`.
- Removes the tablet scrim block (`{scrimShow && (...)}`) and the `scrimShow` computation, since it can no longer be triggered.
- `Sidebar`'s own `onToggleSidebar` prop (used by its mobile drag-handle) is unaffected — that path stays.

### `MapView.tsx`
- `setTile('map')`'s tile URL changes from CartoDB Voyager to `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; attribution updates to `© OpenStreetMap contributors`.
- `setTile('sat')` keeps the Esri `World_Imagery` layer but no longer adds the `World_Transportation`/`World_Boundaries_and_Places` reference layers.
- The GeoJSON-loading `init()` effect, `maskLayerRef`, `cantonLayerRef`, `cantonStyle`, and `applyMaskTint` are all removed, along with their call sites in the mount effect and the base-layer-change effect.
- No change to markers, clusters, popups, the base/satellite radio card, the fit-all button, or pin geometry — all already correct from the prior restyle.

## Testing

Purely structural/visual for `Topbar.tsx` (prop removal, JSX simplification) — `Topbar.test.tsx` needs its render call updated to match the new prop signature, and continues to assert the wordmark text and login button render. `MapView.tsx` has no dedicated test file; `npm run test`/`lint`/`typecheck`/`build` are the regression check, same posture as both prior restyle passes. A manual visual pass in the dev server (or a fresh `docs/screenshot.png`) confirms the map now shows OpenStreetMap tiles with no mask/canton lines, and the header shows the full pill language row with no hamburger, before calling it done.

## Non-Goals

- No changes to the color palette, typography, or shape/shadow tokens — those are already correct.
- No changes to the Sidebar, modals, markers/popups/clusters, or i18n copy beyond the language-toggle label change (which doesn't touch `STR`/translations — it's a hardcoded UI label change in `Topbar.tsx`, not user-facing venue/app text).
- Not reintroducing canton visualization on the map via a different mechanism (e.g., color-coded regions) — out of scope; canton grouping stays Sidebar-only.
- Not addressing OSM tile server reliability/rate-limiting beyond accepting the trade-off noted above — no fallback-provider logic is being added.
