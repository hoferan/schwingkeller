# Modal Mobile Viewport Cutoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the edit-venue modal (and every other modal, since they all share the same component) being cut off at the top and bottom on mobile browsers.

**Architecture:** `src/components/Modal.tsx` sizes its content box with `maxHeight: '92vh'`. Mobile `vh` is based on the largest viewport (browser chrome collapsed), which overflows the real visible area once the address bar / bottom nav bar are shown. Change this single value to `92dvh`, the dynamic-viewport unit that tracks the actual visible viewport — the same fix `App.tsx:237` already applies to the root container via `100dvh`.

**Tech Stack:** React 19, TypeScript, Vite. No new dependencies.

## Global Constraints

- Don't use `any` in TypeScript — not applicable here (no type changes).
- Keep i18n keys in sync across DE/FR/IT — not applicable here (no user-facing text changes).
- Run `npm run test` and `npm run lint` before claiming the task complete.

---

### Task 1: Use dynamic viewport height for the modal's max-height

**Files:**
- Modify: `src/components/Modal.tsx:20`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a same-shape style-value change, no signature changes to `Modal` or its props.

There is no existing automated test covering `Modal.tsx`'s inline styles (confirmed: no `Modal.test.tsx` exists, and this is a single CSS value with no logic branch to unit test). Verification for this task is a manual/visual check in a mobile viewport, per the steps below, in place of an automated test.

- [ ] **Step 1: Change the style value**

In `src/components/Modal.tsx`, line 20, change:

```tsx
        boxShadow: theme.shadow, width, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', animation: 'popIn .26s ease',
```

to:

```tsx
        boxShadow: theme.shadow, width, maxWidth: '100%', maxHeight: '92dvh', overflow: 'auto', animation: 'popIn .26s ease',
```

The full file after this change:

```tsx
import type { ReactNode } from 'react';
import { theme } from '../theme';

interface ModalProps { onClose: () => void; width?: number; children: ReactNode; zIndex?: number }

export const Modal = ({ onClose, width = 440, children, zIndex = 1300 }: ModalProps) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      animation: 'fadeIn .2s ease',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="sk-scroll"
      style={{
        background: theme.color.bg, border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm,
        boxShadow: theme.shadow, width, maxWidth: '100%', maxHeight: '92dvh', overflow: 'auto', animation: 'popIn .26s ease',
      }}
    >
      {children}
    </div>
  </div>
);
```

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint`
Expected: no errors (this is a valid CSS string value change; no type or lint rule affects it).

- [ ] **Step 3: Run the test suite**

Run: `npm run test`
Expected: PASS — no test covers this value today, so the full suite should pass unchanged, confirming the change didn't break anything else.

- [ ] **Step 4: Manual visual verification in a mobile viewport**

Run: `npm run dev`

In a browser, open devtools, switch to mobile device emulation (e.g. a Pixel or Galaxy preset) with the toolbar/URL-bar chrome visible in the emulated view. Enable admin mode in the app and open the edit-venue modal (or add-venue modal).

Expected: the modal's title bar ("SCHWINGKELLER BEARBEITEN") is visible at the top and the action buttons ("Speichern & schliessen", "Abbrechen", "Speichern & neu") are visible at the bottom, with only the modal's inner content scrolling if it doesn't fit — no part of the modal chrome is cut off by simulated browser chrome.

- [ ] **Step 5: Commit**

```bash
git add src/components/Modal.tsx
git commit -m "fix: use dvh for modal max-height to avoid mobile viewport cutoff"
```
