# Zoom Control Border Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the custom "zoom to fit" button's border match Leaflet's native +/- zoom control by reading the native control's real rendered border at runtime, instead of guessing a static CSS value.

**Architecture:** `MapView.tsx` already measures the native Leaflet zoom control's DOM element once at mount (`map.whenReady`) to size/position the custom fit-to-bounds button. Extend that same measurement to also read `getComputedStyle(zoomEl)`'s border and apply it to the custom button's style, replacing a hardcoded `border: '2px solid rgba(0,0,0,.2)'` guess. A Playwright script (not committed) verifies the fix against a real touch-emulated browser render.

**Tech Stack:** React 19, TypeScript, Leaflet, Vite dev server, Playwright (environment-global, not a project dependency).

## Global Constraints

- Don't use `any` in TypeScript — use proper types or `unknown` (CLAUDE.md).
- Don't add new npm dependencies without discussing them first (CLAUDE.md) — Playwright is used only as the environment's globally-installed tool for one-off verification; it is never imported by application code and never added to `package.json`.
- Run `npm run lint` and `npm run test` before claiming any task complete (CLAUDE.md).
- No i18n impact in this change — no user-facing text changes.
- No `.env` or Supabase secrets get committed (CLAUDE.md) — a local `.env` created for dev-server verification stays untracked (already covered by `.gitignore`) and is never added to git.

---

### Task 1: Mirror the native zoom control's border at runtime

**Files:**
- Modify: `src/features/map/MapView.tsx:29-39` (comment + `nativeCtrlStyle`)
- Modify: `src/features/map/MapView.tsx:51-58` (`FIT_ALL_DEFAULT_*` constants + `fitAllWrapStyle`)
- Modify: `src/features/map/MapView.tsx:75-76` (component state)
- Modify: `src/features/map/MapView.tsx:190-197` (map-init effect, native control measurement)
- Modify: `src/features/map/MapView.tsx:265` (JSX usage of `fitAllWrapStyle`)

**Interfaces:**
- Consumes: nothing new from outside this file — this task only touches `MapView.tsx` internals (`L.Map.zoomControl.getContainer()` from the already-imported `leaflet` package).
- Produces: no new exports. `fitAllWrapStyle` gains a third parameter (`border: string`), used only within this component.

**Context — why no unit test step here:** `MapView.tsx` has zero existing unit test coverage. Leaflet requires real layout/DOM APIs (`getBoundingClientRect`, real image loading for tiles, etc.) that aren't available under Vitest's `jsdom` environment, and no test file exists for this component today (confirmed: no `MapView.test.*` anywhere in the repo). This task does not introduce that gap — it follows the existing pattern. The automated gate for this task is typecheck/build/lint; the actual runtime behavior is verified in Task 2 against a real browser.

- [ ] **Step 1: Update the block comment and remove the hardcoded border from `nativeCtrlStyle`**

Replace the comment block and `nativeCtrlStyle` declaration at `src/features/map/MapView.tsx:29-39`:

```ts
// Mirrors Leaflet's own .leaflet-bar control look (leaflet/dist/leaflet.css), not the app's
// soft-card theme tokens — the goal here is to blend in with the native zoom control.
//
// The border is deliberately NOT hardcoded here. Two rounds of guessing a static border
// value (once from leaflet.css source, once re-verified "by eye" against a screenshot) both
// failed to match what real browsers/devices actually render (see issues #8 and #21). Instead,
// the border is read at runtime from the real native zoom control via getComputedStyle (see the
// map-init effect below) and passed into fitAllWrapStyle, so the two controls match by
// construction — regardless of Leaflet version, browser rendering, or device pixel ratio.
const nativeCtrlStyle: CSSProperties = {
  background: '#fff', borderRadius: '4px', overflow: 'hidden',
};
```

- [ ] **Step 2: Add the border fallback constant and thread `border` through `fitAllWrapStyle`**

Replace `src/features/map/MapView.tsx:51-58`:

```ts
// Defaults before the real zoom-control is measured (see the mount effect):
// - top/size: 10px (Leaflet's own top-control margin) + 26px (default non-touch zoom-control
//   height) + 10px (gap).
// - border: today's best-known value, used only until the real control's computed border loads.
const FIT_ALL_DEFAULT_TOP = 46;
const FIT_ALL_DEFAULT_SIZE = 30;
const FIT_ALL_DEFAULT_BORDER = '2px solid rgba(0,0,0,.2)';
const fitAllWrapStyle = (top: number, size: number, border: string): CSSProperties => ({
  ...nativeCtrlStyle, position: 'absolute', left: '10px', top: `${top}px`,
  width: `${size}px`, height: `${size}px`, border, zIndex: 1000,
});
```

- [ ] **Step 3: Add `fitAllBorder` state**

In `src/features/map/MapView.tsx:75-76`, add a third state variable right after `fitAllSize`:

```ts
  const [fitAllTop, setFitAllTop] = useState(FIT_ALL_DEFAULT_TOP);
  const [fitAllSize, setFitAllSize] = useState(FIT_ALL_DEFAULT_SIZE);
  const [fitAllBorder, setFitAllBorder] = useState(FIT_ALL_DEFAULT_BORDER);
```

- [ ] **Step 4: Read the native control's real computed border in the map-init effect**

In `src/features/map/MapView.tsx:190-197`, extend the `map.whenReady` block:

```ts
    map.whenReady(() => {
      if (!mapRef.current) return;
      map.invalidateSize();
      const zoomEl = map.zoomControl.getContainer();
      if (zoomEl) {
        setFitAllTop(10 + zoomEl.offsetHeight + 10);
        setFitAllSize(zoomEl.offsetWidth);
        const zoomStyle = getComputedStyle(zoomEl);
        setFitAllBorder(`${zoomStyle.borderWidth} ${zoomStyle.borderStyle} ${zoomStyle.borderColor}`);
      }
      window.setTimeout(() => {
        if (!mapRef.current || !markerGroupRef.current) return;
        map.invalidateSize();
        if (!map.hasLayer(markerGroupRef.current)) markerGroupRef.current.addTo(map);
        refreshMarkers();
      }, 160);
    });
```

- [ ] **Step 5: Pass `fitAllBorder` into `fitAllWrapStyle` in the JSX**

In `src/features/map/MapView.tsx:265`, update the call:

```tsx
      <div style={fitAllWrapStyle(fitAllTop, fitAllSize, fitAllBorder)}>
```

- [ ] **Step 6: Typecheck, lint, and run the existing test suite**

Run:
```bash
npm run typecheck
npm run lint
npm run test
```
Expected: all three pass with no new errors/warnings. (No test count regression — this change doesn't add or remove test files.)

- [ ] **Step 7: Commit**

```bash
git add src/features/map/MapView.tsx
git commit -m "fix: mirror native zoom control border at runtime instead of hardcoding it"
```

---

### Task 2: Verify the fix against a real touch-emulated browser render

**Files:**
- Create (scratch, not committed): `<scratchpad>/verify-zoom-border.mjs` — use the scratchpad directory from your environment's system prompt (e.g. `/tmp/claude-*/*/scratchpad/verify-zoom-border.mjs`); if no scratchpad path is available, use `/tmp/verify-zoom-border.mjs`.
- Create (local only, gitignored, skip if already present): `.env` at the repo root — needed because `src/lib/supabase.ts` calls `createClient(url, key)` at module load time, which throws synchronously on an undefined/malformed URL and would crash the whole app (including `MapView`) before the dev server can render anything.

**Interfaces:**
- Consumes: the running app at `http://localhost:5173/` (Vite's default dev port; confirmed no custom `server.port` in `vite.config.ts`), specifically `.leaflet-control-zoom` (native control) and `.sk-native-ctrl-btn`'s parent element (custom fit-to-bounds button, styled by `fitAllWrapStyle` from Task 1).
- Produces: a pass/fail console result and a saved screenshot for visual confirmation. Nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Ensure a local `.env` exists so the dev server can boot**

Check whether `.env` already exists at the repo root:
```bash
test -f .env && echo "exists" || echo "missing"
```
If `missing`, create one with placeholder values (this file is already covered by `.gitignore` — it will not be committed):
```bash
cat > .env <<'EOF'
VITE_SUPABASE_URL=https://placeholder.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder
VITE_SENTRY_DSN=
VITE_APP_ENV=
EOF
```
This only needs to satisfy `createClient()`'s synchronous URL parsing — the map's zoom controls render regardless of whether the resulting Supabase network calls succeed, since `App.tsx` defaults `venues` to `[]` (`const { data: venues = [] } = useVenues();`) rather than gating the map behind a loading/error state.

- [ ] **Step 2: Start the dev server in the background**

```bash
npm run dev -- --port 5173 > /tmp/vite-dev.log 2>&1 &
```
Wait for it to be ready:
```bash
until curl -s http://localhost:5173/ > /dev/null; do sleep 0.5; done
echo "dev server up"
```

- [ ] **Step 3: Write the verification script**

Create the file at the scratchpad path from the Files section above:

```js
// verify-zoom-border.mjs
// One-off verification script for issue #21 (zoom-to-fit border mismatch).
// Not part of the app or its test suite — run manually against a live dev server.
import { chromium } from 'playwright';

const APP_URL = 'http://localhost:5173/';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36',
});
const page = await context.newPage();
await page.goto(APP_URL, { waitUntil: 'networkidle' });

await page.waitForSelector('.leaflet-control-zoom');
await page.waitForSelector('.sk-native-ctrl-btn');

const borders = await page.evaluate(() => {
  const nativeEl = document.querySelector('.leaflet-control-zoom');
  const customBtn = document.querySelector('.sk-native-ctrl-btn');
  const customEl = customBtn ? customBtn.parentElement : null;
  const read = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return { width: s.borderWidth, style: s.borderStyle, color: s.borderColor };
  };
  return { native: read(nativeEl), custom: read(customEl) };
});

console.log('Native control border:', borders.native);
console.log('Custom button border: ', borders.custom);

const matches = borders.native && borders.custom
  && borders.native.width === borders.custom.width
  && borders.native.style === borders.custom.style
  && borders.native.color === borders.custom.color;

console.log(matches ? 'PASS: borders match exactly' : 'FAIL: borders differ');

// Visual sanity check: crop around both stacked controls (top-left, ~10px inset).
const clip = { x: 0, y: 0, width: 90, height: 100 };
await page.screenshot({ path: '/tmp/zoom-border-verify.png', clip });
console.log('Screenshot saved to /tmp/zoom-border-verify.png');

await browser.close();
process.exit(matches ? 0 : 1);
```

- [ ] **Step 4: Run the script**

```bash
node <path-to-scratchpad>/verify-zoom-border.mjs
```
Expected output:
```
Native control border: { width: '2px', style: 'solid', color: 'rgba(0, 0, 0, 0.2)' }
Custom button border:  { width: '2px', style: 'solid', color: 'rgba(0, 0, 0, 0.2)' }
PASS: borders match exactly
```
(The exact `color`/`width` values may differ from this example depending on what the real browser renders for Leaflet's touch variant — what matters is that `native` and `custom` are identical to each other, and the exit code is `0`.)

If it prints `FAIL`, do not proceed — re-open Task 1 and debug (e.g. confirm `getComputedStyle` is being read from the same element Leaflet actually applies `.leaflet-touch .leaflet-bar` classes to; log `zoomEl.className` in the app to check under `map.whenReady`).

- [ ] **Step 5: Visually inspect the screenshot**

Read `/tmp/zoom-border-verify.png` and confirm by eye that the native +/- control and the fit-to-bounds button below it look like one cohesive control group (matching border weight and opacity, no visible seam in darkness between them).

- [ ] **Step 6: Stop the dev server**

```bash
kill %1 2>/dev/null || pkill -f "vite --host" || true
```

- [ ] **Step 7: Clean up the scratch script (nothing to commit)**

This task produces no files in the repo — the verification script lives only in the scratchpad, and `.env` (if created) is gitignored. Confirm nothing unintended is staged:
```bash
git status --short
```
Expected: no output related to `.env` or the verification script (only `src/features/map/MapView.tsx` should have been touched, and that was already committed in Task 1).
