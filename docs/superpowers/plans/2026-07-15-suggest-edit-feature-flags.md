# Suggest-an-Edit + Runtime Feature Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anonymous visitors can suggest corrections to a venue's contact fields; admins review them in a moderated queue; the feature is gated by a new reusable runtime feature-flag system.

**Architecture:** Two new Postgres tables (`feature_flags`, `venue_suggestions`) accessed purely through supabase-js + RLS. New client features `src/features/flags/` (typed flag keys, fail-closed TanStack Query hook) and `src/features/venue-suggest/` (form, queue modal, hooks). UI entry points: link-button in `DetailModal` (visitors), badge row in the sidebar Verwaltung band + amber chip in `DetailModal` (admins).

**Tech Stack:** React 19, TypeScript, Supabase (supabase-js, RLS), TanStack Query, Vitest + React Testing Library. **No new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-15-suggest-edit-feature-flags-design.md` (issue #15)

## Global Constraints

- Branch: all commits go on `claude/new-session-c2jn3v`; push with `git push -u origin claude/new-session-c2jn3v`.
- No new npm dependencies.
- No `any` in TypeScript — use proper types or `unknown`.
- Every user-facing string goes through the i18n layer with keys in **all three** of DE/FR/IT (`src/i18n/translations.ts`).
- All Supabase data access via TanStack Query hooks — never fetch directly in components.
- Never use the service-role key on the client; RLS is the security boundary.
- New tables MUST include explicit `grant` statements (see `supabase/migrations/0006_grant_venue_photos.sql` for why: migration-created tables get no automatic privileges in prod).
- Run `npm run test` and `npm run lint` before claiming any task complete.
- Conventional Commits format for commit messages.
- Run test commands from the repo root `/home/user/schwingkeller`.

---

### Task 1: Shared `toError` helper

`src/features/venues/api.ts` has a private `toError` that converts Supabase errors to `Error` with a `[code]` prefix and `cause`. Two new API modules need it — extract it to `src/lib/`.

**Files:**
- Create: `src/lib/supabaseError.ts`
- Create: `src/lib/supabaseError.test.ts`
- Modify: `src/features/venues/api.ts:7-11` (replace local helper with import)

**Interfaces:**
- Produces: `toError(e: SupabaseErrorLike): Error` where `SupabaseErrorLike = { message: string; code?: string; hint?: string; details?: string }`. Used by Tasks 4 and 8.

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabaseError.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toError } from './supabaseError';

describe('toError', () => {
  it('prefixes the message with the code when present', () => {
    expect(toError({ message: 'boom', code: '42P01' }).message).toBe('[42P01] boom');
  });

  it('uses the message alone when there is no code', () => {
    expect(toError({ message: 'boom' }).message).toBe('boom');
  });

  it('sets cause to the raw error object so Sentry receives hint and details', () => {
    const raw = { message: 'boom', hint: 'h', details: 'd' };
    expect(toError(raw).cause).toBe(raw);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/lib/supabaseError.test.ts`
Expected: FAIL — cannot resolve `./supabaseError`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/supabaseError.ts`:

```ts
export interface SupabaseErrorLike {
  message: string;
  code?: string;
  hint?: string;
  details?: string;
}

export const toError = (e: SupabaseErrorLike): Error => {
  const err = new Error(e.code ? `[${e.code}] ${e.message}` : e.message);
  err.cause = e;
  return err;
};
```

In `src/features/venues/api.ts`, delete the local `toError` (lines 7–11):

```ts
const toError = (e: { message: string; code?: string; hint?: string; details?: string }): Error => {
  const err = new Error(e.code ? `[${e.code}] ${e.message}` : e.message);
  err.cause = e;
  return err;
};
```

and add to the imports at the top:

```ts
import { toError } from '../../lib/supabaseError';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- run src/lib/supabaseError.test.ts src/features/venues/api.test.ts`
Expected: PASS (the existing `venues/api` error tests prove the refactor is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabaseError.ts src/lib/supabaseError.test.ts src/features/venues/api.ts
git commit -m "refactor: extract shared Supabase toError helper"
```

---

### Task 2: Migration `0007_feature_flags.sql`

**Files:**
- Create: `supabase/migrations/0007_feature_flags.sql`

**Interfaces:**
- Produces: table `public.feature_flags(key text pk, enabled bool, description text, updated_at timestamptz)`; RLS public select / authenticated update; seeded row `suggest_edit` = `true`. Consumed by Task 4's `listFlags()`.

No unit test — SQL is applied by `supabase db push` at deploy time. Verification is careful review against the constraints below.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0007_feature_flags.sql`:

```sql
-- Runtime feature flags, toggled in the Supabase Studio table editor (no
-- in-app UI). New flags are seeded by migration; the client only reads.
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text default '',
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_feature_flags_updated_at on public.feature_flags;
create trigger trg_feature_flags_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;

drop policy if exists "feature_flags_public_read" on public.feature_flags;
create policy "feature_flags_public_read" on public.feature_flags
  for select using (true);

drop policy if exists "feature_flags_auth_update" on public.feature_flags;
create policy "feature_flags_auth_update" on public.feature_flags
  for update to authenticated using (true) with check (true);

-- Explicit grants: migration-created tables get no automatic privileges in
-- prod (see 0006_grant_venue_photos.sql). RLS is only consulted after the
-- role holds the table-level privilege.
grant select on public.feature_flags to anon, authenticated;
grant update on public.feature_flags to authenticated;
grant all on public.feature_flags to service_role;

insert into public.feature_flags (key, enabled, description)
values ('suggest_edit', true, 'Anonymous "Suggest an edit" on venue detail')
on conflict (key) do nothing;
```

- [ ] **Step 2: Verify against constraints**

Check the file has: RLS enabled, no client insert/delete policy, explicit grants for `anon`/`authenticated`/`service_role`, idempotent seed (`on conflict do nothing`), reuses existing `set_updated_at()`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_feature_flags.sql
git commit -m "feat: feature_flags table with RLS + suggest_edit seed"
```

---

### Task 3: Migration `0008_venue_suggestions.sql`

**Files:**
- Create: `supabase/migrations/0008_venue_suggestions.sql`

**Interfaces:**
- Produces: table `public.venue_suggestions` with nullable suggested-field columns (`address`, `person`, `phone`, `website`), `note`, `status`, `created_at`. Length caps: address/person/website ≤ 200, phone ≤ 50, note ≤ 500. RLS: public insert (`status='pending'` only), authenticated select/update, no client delete. Consumed by Task 8.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0008_venue_suggestions.sql`:

```sql
-- Anonymous "Suggest an edit" queue (issue #15). Visitors propose corrections
-- to a venue's contact fields; admins accept or dismiss. A null field column
-- means "no change proposed for this field".
create table if not exists public.venue_suggestions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  address text check (address is null or char_length(address) <= 200),
  person text check (person is null or char_length(person) <= 200),
  phone text check (phone is null or char_length(phone) <= 50),
  website text check (website is null or char_length(website) <= 200),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now()
);

create index venue_suggestions_status_idx on public.venue_suggestions(status);
create index venue_suggestions_venue_id_idx on public.venue_suggestions(venue_id);

alter table public.venue_suggestions enable row level security;

-- Anyone (incl. anonymous) may file a suggestion, but only as 'pending' —
-- nobody can self-accept through the public API.
drop policy if exists "venue_suggestions_public_insert" on public.venue_suggestions;
create policy "venue_suggestions_public_insert" on public.venue_suggestions
  for insert to anon, authenticated with check (status = 'pending');

-- Every authenticated user is an admin in this app (same model as the
-- venues_auth_* policies), so `to authenticated` IS admin-only.
drop policy if exists "venue_suggestions_auth_read" on public.venue_suggestions;
create policy "venue_suggestions_auth_read" on public.venue_suggestions
  for select to authenticated using (true);

drop policy if exists "venue_suggestions_auth_update" on public.venue_suggestions;
create policy "venue_suggestions_auth_update" on public.venue_suggestions
  for update to authenticated using (true) with check (true);

-- No delete policy on purpose: dismiss is a status update, history stays.

-- Explicit grants (see 0006_grant_venue_photos.sql for why).
grant insert on public.venue_suggestions to anon, authenticated;
grant select, update on public.venue_suggestions to authenticated;
grant all on public.venue_suggestions to service_role;
```

- [ ] **Step 2: Verify against constraints**

Check: length caps present on all five text columns; insert policy restricted with `with check (status = 'pending')`; no delete policy; grants include `insert` for `anon`; the embedded read in Task 8's `select('*, venues(name)')` works because `venues` already has public read.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_venue_suggestions.sql
git commit -m "feat: venue_suggestions table with RLS + length caps"
```

---

### Task 4: Flags feature — types + API

**Files:**
- Create: `src/features/flags/types.ts`
- Create: `src/features/flags/api.ts`
- Create: `src/features/flags/api.test.ts`

**Interfaces:**
- Consumes: `toError` from `src/lib/supabaseError` (Task 1).
- Produces: `FLAG_KEYS` const array, `type FlagKey = 'suggest_edit'`, `type FeatureFlags = Record<FlagKey, boolean>`, `listFlags(): Promise<FeatureFlags>`. Consumed by Task 5.

- [ ] **Step 1: Write the failing test**

Create `src/features/flags/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { from, select } = vi.hoisted(() => {
  const select = vi.fn();
  const from = vi.fn(() => ({ select }));
  return { from, select };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from } }));

import { listFlags } from './api';

beforeEach(() => { vi.clearAllMocks(); });

describe('listFlags', () => {
  it('maps DB rows onto known keys and ignores unknown keys', async () => {
    select.mockResolvedValue({
      data: [
        { key: 'suggest_edit', enabled: true },
        { key: 'not_a_flag', enabled: true },
      ],
      error: null,
    });
    await expect(listFlags()).resolves.toEqual({ suggest_edit: true });
    expect(from).toHaveBeenCalledWith('feature_flags');
    expect(select).toHaveBeenCalledWith('key,enabled');
  });

  it('defaults known keys missing from the DB to false', async () => {
    select.mockResolvedValue({ data: [], error: null });
    await expect(listFlags()).resolves.toEqual({ suggest_edit: false });
  });

  it('throws a code-prefixed error when Supabase fails', async () => {
    select.mockResolvedValue({ data: null, error: { message: 'boom', code: '42P01' } });
    await expect(listFlags()).rejects.toThrow('[42P01] boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/features/flags/api.test.ts`
Expected: FAIL — cannot resolve `./api`.

- [ ] **Step 3: Write the implementation**

Create `src/features/flags/types.ts`:

```ts
// Add new flag keys here (and seed the row in a migration). The union keeps
// useFeatureFlag('…') compile-checked.
export const FLAG_KEYS = ['suggest_edit'] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];
export type FeatureFlags = Record<FlagKey, boolean>;
```

Create `src/features/flags/api.ts`:

```ts
import { supabase } from '../../lib/supabase';
import { toError } from '../../lib/supabaseError';
import { FLAG_KEYS, type FeatureFlags, type FlagKey } from './types';

export const listFlags = async (): Promise<FeatureFlags> => {
  const { data, error } = await supabase.from('feature_flags').select('key,enabled');
  if (error) throw toError(error);
  const flags = Object.fromEntries(FLAG_KEYS.map((k) => [k, false])) as FeatureFlags;
  for (const row of (data ?? []) as { key: string; enabled: boolean }[]) {
    if ((FLAG_KEYS as readonly string[]).includes(row.key)) flags[row.key as FlagKey] = row.enabled;
  }
  return flags;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/features/flags/api.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/flags/types.ts src/features/flags/api.ts src/features/flags/api.test.ts
git commit -m "feat: feature-flags api with typed flag keys"
```

---

### Task 5: `useFeatureFlag` hook (fail-closed)

**Files:**
- Create: `src/features/flags/useFeatureFlag.ts`
- Create: `src/features/flags/useFeatureFlag.test.tsx`

**Interfaces:**
- Consumes: `listFlags`, `FlagKey`, `FeatureFlags` (Task 4).
- Produces: `useFeatureFlag(key: FlagKey): boolean` — `false` while loading and on error. Consumed by Task 11.

- [ ] **Step 1: Write the failing test**

Create `src/features/flags/useFeatureFlag.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('./api', () => ({ listFlags: vi.fn() }));
import { listFlags } from './api';
import { useFeatureFlag } from './useFeatureFlag';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => { vi.clearAllMocks(); });

describe('useFeatureFlag', () => {
  it('returns false while loading, then the flag value once fetched', async () => {
    vi.mocked(listFlags).mockResolvedValue({ suggest_edit: true });
    const { result } = renderHook(() => useFeatureFlag('suggest_edit'), { wrapper });
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('fails closed (false) when the fetch errors', async () => {
    vi.mocked(listFlags).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useFeatureFlag('suggest_edit'), { wrapper });
    await waitFor(() => expect(vi.mocked(listFlags)).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/features/flags/useFeatureFlag.test.tsx`
Expected: FAIL — cannot resolve `./useFeatureFlag`.

- [ ] **Step 3: Write the implementation**

Create `src/features/flags/useFeatureFlag.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { listFlags } from './api';
import type { FlagKey } from './types';

const KEY = ['feature_flags'] as const;

// Fails closed: gated UI simply doesn't render until flags arrive (or at all,
// if the fetch errors). One fetch per session, shared via the query cache.
export const useFeatureFlag = (key: FlagKey): boolean => {
  const { data } = useQuery({ queryKey: KEY, queryFn: listFlags, staleTime: 5 * 60 * 1000 });
  return data?.[key] ?? false;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/features/flags/useFeatureFlag.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/flags/useFeatureFlag.ts src/features/flags/useFeatureFlag.test.tsx
git commit -m "feat: fail-closed useFeatureFlag hook"
```

---

### Task 6: i18n strings (DE/FR/IT)

**Files:**
- Modify: `src/i18n/translations.ts` (add 10 keys to each of `STR.de`, `STR.fr`, `STR.it`)
- Modify: `src/i18n/translations.test.ts`

**Interfaces:**
- Produces: keys `suggestEdit`, `suggestNote`, `suggestSend`, `suggestThanks`, `suggestError`, `suggestions`, `suggestionsEmpty`, `suggestAccept`, `suggestDismiss`, `suggestPending` on `t`. Consumed by Tasks 10–13. `suggestPending` contains an `{n}` placeholder (same convention as the existing `galleryCapReached`).

- [ ] **Step 1: Write the failing test**

In `src/i18n/translations.test.ts`, add inside the `describe('translations', …)` block:

```ts
  it('defines the suggest-an-edit keys in every language', () => {
    for (const lang of LANGS) {
      expect(STR[lang].suggestEdit).toBeTruthy();
      expect(STR[lang].suggestNote).toBeTruthy();
      expect(STR[lang].suggestSend).toBeTruthy();
      expect(STR[lang].suggestThanks).toBeTruthy();
      expect(STR[lang].suggestError).toBeTruthy();
      expect(STR[lang].suggestions).toBeTruthy();
      expect(STR[lang].suggestionsEmpty).toBeTruthy();
      expect(STR[lang].suggestAccept).toBeTruthy();
      expect(STR[lang].suggestDismiss).toBeTruthy();
      expect(STR[lang].suggestPending).toContain('{n}');
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/i18n/translations.test.ts`
Expected: FAIL — `suggestEdit` undefined (TypeScript will also complain; that's the point).

- [ ] **Step 3: Add the keys**

In `src/i18n/translations.ts`, append to `STR.de` (before the closing brace of the `de` object):

```ts
    suggestEdit: 'Änderung vorschlagen',
    suggestNote: 'Anmerkung (optional)',
    suggestSend: 'Vorschlag senden',
    suggestThanks: 'Danke! Der Vorschlag wird geprüft.',
    suggestError: 'Senden fehlgeschlagen',
    suggestions: 'Vorschläge',
    suggestionsEmpty: 'Keine offenen Vorschläge.',
    suggestAccept: 'Übernehmen',
    suggestDismiss: 'Verwerfen',
    suggestPending: '{n} offene Vorschläge',
```

Append to `STR.fr`:

```ts
    suggestEdit: 'Proposer une modification',
    suggestNote: 'Remarque (facultatif)',
    suggestSend: 'Envoyer la proposition',
    suggestThanks: 'Merci ! La proposition sera examinée.',
    suggestError: "Échec de l'envoi",
    suggestions: 'Propositions',
    suggestionsEmpty: 'Aucune proposition en attente.',
    suggestAccept: 'Appliquer',
    suggestDismiss: 'Rejeter',
    suggestPending: '{n} propositions en attente',
```

Append to `STR.it`:

```ts
    suggestEdit: 'Suggerisci una modifica',
    suggestNote: 'Nota (facoltativa)',
    suggestSend: 'Invia suggerimento',
    suggestThanks: 'Grazie! Il suggerimento sarà esaminato.',
    suggestError: 'Invio non riuscito',
    suggestions: 'Suggerimenti',
    suggestionsEmpty: 'Nessun suggerimento in sospeso.',
    suggestAccept: 'Applica',
    suggestDismiss: 'Rifiuta',
    suggestPending: '{n} suggerimenti in sospeso',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- run src/i18n/translations.test.ts`
Expected: PASS, including the pre-existing "all languages share the same keys" parity test.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/translations.ts src/i18n/translations.test.ts
git commit -m "feat: i18n strings for suggest-an-edit (de/fr/it)"
```

---

### Task 7: venue-suggest types + diff helpers

**Files:**
- Create: `src/features/venue-suggest/types.ts`
- Create: `src/features/venue-suggest/diff.ts`
- Create: `src/features/venue-suggest/diff.test.ts`

**Interfaces:**
- Consumes: `Venue`, `VenueInput` from `src/features/venues/types`.
- Produces (used by Tasks 8–12):

```ts
SUGGESTION_FIELDS = ['address', 'person', 'phone', 'website'] as const
type SuggestionField = 'address' | 'person' | 'phone' | 'website'
SUGGESTION_MAX = { address: 200, person: 200, phone: 50, website: 200, note: 500 }
interface SuggestionInput {
  venue_id: string; address: string | null; person: string | null;
  phone: string | null; website: string | null; note: string;
}
interface VenueSuggestion extends SuggestionInput {
  id: string; status: 'pending' | 'accepted' | 'dismissed';
  created_at: string; venues: { name: string } | null;
}
toSuggestionInput(venue: Venue, draft: Record<SuggestionField, string>, note: string): SuggestionInput | null
suggestionChanges(s: VenueSuggestion): Partial<VenueInput>
```

- [ ] **Step 1: Write the types**

Create `src/features/venue-suggest/types.ts`:

```ts
export const SUGGESTION_FIELDS = ['address', 'person', 'phone', 'website'] as const;
export type SuggestionField = (typeof SUGGESTION_FIELDS)[number];

// Mirrors the DB check constraints in 0008_venue_suggestions.sql.
export const SUGGESTION_MAX = { address: 200, person: 200, phone: 50, website: 200, note: 500 } as const;

export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';

// A null field means "no change proposed for this field".
export interface SuggestionInput {
  venue_id: string;
  address: string | null;
  person: string | null;
  phone: string | null;
  website: string | null;
  note: string;
}

export interface VenueSuggestion extends SuggestionInput {
  id: string;
  status: SuggestionStatus;
  created_at: string;
  venues: { name: string } | null; // embedded venue name from the select join
}
```

- [ ] **Step 2: Write the failing test**

Create `src/features/venue-suggest/diff.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toSuggestionInput, suggestionChanges } from './diff';
import type { VenueSuggestion } from './types';
import type { Venue } from '../venues/types';

const venue: Venue = {
  id: 'v1', name: 'A', canton: 'BE', address: 'Old St 1', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: 'Hans', phone: '031 111 11 11',
  website: 'a.ch', photos: [],
};
const unchanged = { address: 'Old St 1', person: 'Hans', phone: '031 111 11 11', website: 'a.ch' };

describe('toSuggestionInput', () => {
  it('nulls fields equal to the current venue values', () => {
    expect(toSuggestionInput(venue, { ...unchanged, phone: '031 222 22 22' }, '')).toEqual({
      venue_id: 'v1', address: null, person: null, phone: '031 222 22 22', website: null, note: '',
    });
  });

  it('trims values and treats whitespace-only edits as unchanged', () => {
    expect(toSuggestionInput(venue, { ...unchanged, address: ' Old St 1 ' }, '  ')).toBeNull();
  });

  it('returns null when nothing changed and the note is empty', () => {
    expect(toSuggestionInput(venue, unchanged, '')).toBeNull();
  });

  it('allows a note-only suggestion', () => {
    const input = toSuggestionInput(venue, unchanged, 'Closed on Mondays');
    expect(input).toEqual({
      venue_id: 'v1', address: null, person: null, phone: null, website: null, note: 'Closed on Mondays',
    });
  });
});

describe('suggestionChanges', () => {
  const base: VenueSuggestion = {
    id: 's1', venue_id: 'v1', address: null, person: null, phone: null, website: null,
    note: '', status: 'pending', created_at: '2026-07-15T00:00:00Z', venues: { name: 'A' },
  };

  it('returns only the non-null fields', () => {
    expect(suggestionChanges({ ...base, phone: '031 222 22 22', website: 'b.ch' }))
      .toEqual({ phone: '031 222 22 22', website: 'b.ch' });
  });

  it('returns an empty object for a note-only suggestion', () => {
    expect(suggestionChanges({ ...base, note: 'hi' })).toEqual({});
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- run src/features/venue-suggest/diff.test.ts`
Expected: FAIL — cannot resolve `./diff`.

- [ ] **Step 4: Write the implementation**

Create `src/features/venue-suggest/diff.ts`:

```ts
import type { Venue, VenueInput } from '../venues/types';
import { SUGGESTION_FIELDS, type SuggestionField, type SuggestionInput, type VenueSuggestion } from './types';

// Form draft → insert payload. Fields equal to the current venue value become
// null ("no change"). Returns null when there is nothing to submit.
export const toSuggestionInput = (
  venue: Venue,
  draft: Record<SuggestionField, string>,
  note: string,
): SuggestionInput | null => {
  const trimmedNote = note.trim();
  const input: SuggestionInput = {
    venue_id: venue.id, address: null, person: null, phone: null, website: null, note: trimmedNote,
  };
  let changed = false;
  for (const f of SUGGESTION_FIELDS) {
    const val = draft[f].trim();
    if (val !== venue[f]) {
      input[f] = val;
      changed = true;
    }
  }
  return changed || trimmedNote !== '' ? input : null;
};

// The venue-table update an accepted suggestion implies.
export const suggestionChanges = (s: VenueSuggestion): Partial<VenueInput> => {
  const changes: Partial<VenueInput> = {};
  for (const f of SUGGESTION_FIELDS) {
    const val = s[f];
    if (val !== null) changes[f] = val;
  }
  return changes;
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- run src/features/venue-suggest/diff.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/venue-suggest/types.ts src/features/venue-suggest/diff.ts src/features/venue-suggest/diff.test.ts
git commit -m "feat: suggestion types and diff helpers"
```

---

### Task 8: venue-suggest API

**Files:**
- Create: `src/features/venue-suggest/api.ts`
- Create: `src/features/venue-suggest/api.test.ts`

**Interfaces:**
- Consumes: `toError` (Task 1); `SuggestionInput`, `VenueSuggestion` (Task 7).
- Produces (used by Task 9): `createSuggestion(input: SuggestionInput): Promise<void>`, `listPendingSuggestions(): Promise<VenueSuggestion[]>`, `updateSuggestionStatus(id: string, status: 'accepted' | 'dismissed'): Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `src/features/venue-suggest/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { from, select, insert, update, selectEq, order, updateEq } = vi.hoisted(() => {
  const order = vi.fn();
  const selectEq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const insert = vi.fn();
  const updateEq = vi.fn();
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn(() => ({ select, insert, update }));
  return { from, select, insert, update, selectEq, order, updateEq };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from } }));

import { createSuggestion, listPendingSuggestions, updateSuggestionStatus } from './api';
import type { SuggestionInput } from './types';

const input: SuggestionInput = {
  venue_id: 'v1', address: null, person: null, phone: '031 222 22 22', website: null, note: '',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('createSuggestion', () => {
  it('inserts the payload into venue_suggestions', async () => {
    insert.mockResolvedValue({ error: null });
    await createSuggestion(input);
    expect(from).toHaveBeenCalledWith('venue_suggestions');
    expect(insert).toHaveBeenCalledWith(input);
  });

  it('throws a code-prefixed error on failure', async () => {
    insert.mockResolvedValue({ error: { message: 'nope', code: '42501' } });
    await expect(createSuggestion(input)).rejects.toThrow('[42501] nope');
  });
});

describe('listPendingSuggestions', () => {
  it('selects pending rows with the embedded venue name, newest first', async () => {
    const rows = [{ id: 's1', ...input, status: 'pending', created_at: 'x', venues: { name: 'A' } }];
    order.mockResolvedValue({ data: rows, error: null });
    await expect(listPendingSuggestions()).resolves.toEqual(rows);
    expect(select).toHaveBeenCalledWith('*, venues(name)');
    expect(selectEq).toHaveBeenCalledWith('status', 'pending');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('updateSuggestionStatus', () => {
  it('updates the status of the given row', async () => {
    updateEq.mockResolvedValue({ error: null });
    await updateSuggestionStatus('s1', 'dismissed');
    expect(update).toHaveBeenCalledWith({ status: 'dismissed' });
    expect(updateEq).toHaveBeenCalledWith('id', 's1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/features/venue-suggest/api.test.ts`
Expected: FAIL — cannot resolve `./api`.

- [ ] **Step 3: Write the implementation**

Create `src/features/venue-suggest/api.ts`:

```ts
import { supabase } from '../../lib/supabase';
import { toError } from '../../lib/supabaseError';
import type { SuggestionInput, VenueSuggestion } from './types';

export const createSuggestion = async (input: SuggestionInput): Promise<void> => {
  const { error } = await supabase.from('venue_suggestions').insert(input);
  if (error) throw toError(error);
};

export const listPendingSuggestions = async (): Promise<VenueSuggestion[]> => {
  const { data, error } = await supabase
    .from('venue_suggestions')
    .select('*, venues(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw toError(error);
  return (data ?? []) as VenueSuggestion[];
};

export const updateSuggestionStatus = async (
  id: string,
  status: 'accepted' | 'dismissed',
): Promise<void> => {
  const { error } = await supabase.from('venue_suggestions').update({ status }).eq('id', id);
  if (error) throw toError(error);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/features/venue-suggest/api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venue-suggest/api.ts src/features/venue-suggest/api.test.ts
git commit -m "feat: venue_suggestions api"
```

---

### Task 9: Suggestion query + mutation hooks

**Files:**
- Create: `src/features/venue-suggest/useSuggestions.ts`
- Create: `src/features/venue-suggest/useSuggestions.test.tsx`

**Interfaces:**
- Consumes: Task 8 API, `suggestionChanges` (Task 7), `updateVenue` from `src/features/venues/api`.
- Produces (used by Tasks 10, 12, 14):
  - `usePendingSuggestions(enabled: boolean)` — `useQuery` result whose `data` is `VenueSuggestion[]`; query key `['venue_suggestions', 'pending']`; only fetches when `enabled` (pass `isAdmin`).
  - `useSuggestionMutations()` → `{ create, accept, dismiss }` mutations. `create` takes `SuggestionInput`; `accept` takes a `VenueSuggestion` (applies `suggestionChanges` via `updateVenue`, then marks accepted, invalidates `['venues']` + the suggestions key); `dismiss` takes a suggestion `id`.

- [ ] **Step 1: Write the failing test**

Create `src/features/venue-suggest/useSuggestions.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('./api', () => ({
  createSuggestion: vi.fn(),
  listPendingSuggestions: vi.fn(),
  updateSuggestionStatus: vi.fn(),
}));
vi.mock('../venues/api', () => ({ updateVenue: vi.fn() }));

import { listPendingSuggestions, updateSuggestionStatus } from './api';
import { updateVenue } from '../venues/api';
import { usePendingSuggestions, useSuggestionMutations } from './useSuggestions';
import type { VenueSuggestion } from './types';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const suggestion: VenueSuggestion = {
  id: 's1', venue_id: 'v1', address: null, person: null, phone: '031 222 22 22', website: null,
  note: '', status: 'pending', created_at: '2026-07-15T00:00:00Z', venues: { name: 'A' },
};

beforeEach(() => { vi.clearAllMocks(); });

describe('usePendingSuggestions', () => {
  it('does not fetch when disabled', async () => {
    renderHook(() => usePendingSuggestions(false), { wrapper });
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(listPendingSuggestions)).not.toHaveBeenCalled();
  });

  it('fetches when enabled', async () => {
    vi.mocked(listPendingSuggestions).mockResolvedValue([suggestion]);
    const { result } = renderHook(() => usePendingSuggestions(true), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([suggestion]));
  });
});

describe('useSuggestionMutations', () => {
  it('accept applies the changed fields to the venue, then marks accepted', async () => {
    vi.mocked(updateVenue).mockResolvedValue({} as never);
    vi.mocked(updateSuggestionStatus).mockResolvedValue();
    const { result } = renderHook(() => useSuggestionMutations(), { wrapper });
    result.current.accept.mutate(suggestion);
    await waitFor(() => expect(vi.mocked(updateSuggestionStatus)).toHaveBeenCalledWith('s1', 'accepted'));
    expect(vi.mocked(updateVenue)).toHaveBeenCalledWith('v1', { phone: '031 222 22 22' });
  });

  it('accept skips the venue update for a note-only suggestion', async () => {
    vi.mocked(updateSuggestionStatus).mockResolvedValue();
    const noteOnly = { ...suggestion, phone: null, note: 'hi' };
    const { result } = renderHook(() => useSuggestionMutations(), { wrapper });
    result.current.accept.mutate(noteOnly);
    await waitFor(() => expect(vi.mocked(updateSuggestionStatus)).toHaveBeenCalledWith('s1', 'accepted'));
    expect(vi.mocked(updateVenue)).not.toHaveBeenCalled();
  });

  it('dismiss marks the suggestion dismissed', async () => {
    vi.mocked(updateSuggestionStatus).mockResolvedValue();
    const { result } = renderHook(() => useSuggestionMutations(), { wrapper });
    result.current.dismiss.mutate('s1');
    await waitFor(() => expect(vi.mocked(updateSuggestionStatus)).toHaveBeenCalledWith('s1', 'dismissed'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/features/venue-suggest/useSuggestions.test.tsx`
Expected: FAIL — cannot resolve `./useSuggestions`.

- [ ] **Step 3: Write the implementation**

Create `src/features/venue-suggest/useSuggestions.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { updateVenue } from '../venues/api';
import { createSuggestion, listPendingSuggestions, updateSuggestionStatus } from './api';
import { suggestionChanges } from './diff';
import type { SuggestionInput, VenueSuggestion } from './types';

const KEY = ['venue_suggestions', 'pending'] as const;

// Pass `isAdmin` as `enabled` — anonymous clients can't select this table.
export const usePendingSuggestions = (enabled: boolean) =>
  useQuery({ queryKey: KEY, queryFn: listPendingSuggestions, enabled });

export const useSuggestionMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  return {
    create: useMutation({ mutationFn: (input: SuggestionInput) => createSuggestion(input) }),
    accept: useMutation({
      mutationFn: async (s: VenueSuggestion) => {
        const changes = suggestionChanges(s);
        if (Object.keys(changes).length > 0) await updateVenue(s.venue_id, changes);
        await updateSuggestionStatus(s.id, 'accepted');
      },
      onSuccess: () => {
        void invalidate();
        void qc.invalidateQueries({ queryKey: ['venues'] });
      },
    }),
    dismiss: useMutation({
      mutationFn: (id: string) => updateSuggestionStatus(id, 'dismissed'),
      onSuccess: () => { void invalidate(); },
    }),
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/features/venue-suggest/useSuggestions.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venue-suggest/useSuggestions.ts src/features/venue-suggest/useSuggestions.test.tsx
git commit -m "feat: suggestion query and mutation hooks"
```

---

### Task 10: `SuggestForm` modal

**Files:**
- Create: `src/features/venue-suggest/SuggestForm.tsx`
- Create: `src/features/venue-suggest/SuggestForm.test.tsx`

**Interfaces:**
- Consumes: `Modal`, `useTranslation`, `useSuggestionMutations` (Task 9), `toSuggestionInput` + `SUGGESTION_MAX` (Task 7), i18n keys (Task 6).
- Produces: `SuggestForm({ venue: Venue; onClose: () => void })` — consumed by Task 14.

- [ ] **Step 1: Write the failing test**

Create `src/features/venue-suggest/SuggestForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('./api', () => ({
  createSuggestion: vi.fn(),
  listPendingSuggestions: vi.fn(),
  updateSuggestionStatus: vi.fn(),
}));
vi.mock('../venues/api', () => ({ updateVenue: vi.fn() }));

import { createSuggestion } from './api';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import { SuggestForm } from './SuggestForm';

const venue: Venue = {
  id: 'v1', name: 'Schwingkeller Bern', canton: 'BE', address: 'Mattenweg 3', lat: 0, lng: 0,
  indoor: true, outdoor: false, person: 'Hans', phone: '031 111 11 11', website: 'a.ch', photos: [],
};

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <SuggestForm venue={venue} onClose={() => {}} />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );

beforeEach(() => { vi.clearAllMocks(); });

describe('SuggestForm', () => {
  it('prefills the contact fields from the venue', () => {
    renderForm();
    expect(screen.getByLabelText(STR.de.address)).toHaveValue('Mattenweg 3');
    expect(screen.getByLabelText(STR.de.person)).toHaveValue('Hans');
    expect(screen.getByLabelText(STR.de.phone)).toHaveValue('031 111 11 11');
    expect(screen.getByLabelText(STR.de.website)).toHaveValue('a.ch');
  });

  it('disables submit while nothing changed and the note is empty', () => {
    renderForm();
    expect(screen.getByRole('button', { name: STR.de.suggestSend })).toBeDisabled();
  });

  it('submits changed fields as values and unchanged fields as null', async () => {
    vi.mocked(createSuggestion).mockResolvedValue();
    renderForm();
    fireEvent.change(screen.getByLabelText(STR.de.phone), { target: { value: '031 222 22 22' } });
    fireEvent.click(screen.getByRole('button', { name: STR.de.suggestSend }));
    await waitFor(() => expect(vi.mocked(createSuggestion)).toHaveBeenCalledWith({
      venue_id: 'v1', address: null, person: null, phone: '031 222 22 22', website: null, note: '',
    }));
    expect(await screen.findByText(STR.de.suggestThanks)).toBeInTheDocument();
  });

  it('silently drops the submission when the honeypot is filled', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(STR.de.phone), { target: { value: '031 222 22 22' } });
    fireEvent.change(screen.getByTestId('suggest-trap'), { target: { value: 'spam' } });
    fireEvent.click(screen.getByRole('button', { name: STR.de.suggestSend }));
    expect(await screen.findByText(STR.de.suggestThanks)).toBeInTheDocument();
    expect(vi.mocked(createSuggestion)).not.toHaveBeenCalled();
  });

  it('shows the error message when the insert fails', async () => {
    vi.mocked(createSuggestion).mockRejectedValue(new Error('boom'));
    renderForm();
    fireEvent.change(screen.getByLabelText(STR.de.phone), { target: { value: '031 222 22 22' } });
    fireEvent.click(screen.getByRole('button', { name: STR.de.suggestSend }));
    expect(await screen.findByText(STR.de.suggestError)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/features/venue-suggest/SuggestForm.test.tsx`
Expected: FAIL — cannot resolve `./SuggestForm`.

- [ ] **Step 3: Write the implementation**

Create `src/features/venue-suggest/SuggestForm.tsx`:

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { useSuggestionMutations } from './useSuggestions';
import { toSuggestionInput } from './diff';
import { SUGGESTION_FIELDS, SUGGESTION_MAX, type SuggestionField } from './types';
import type { Venue } from '../venues/types';
import { theme } from '../../theme';

interface SuggestFormProps {
  venue: Venue;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid ' + theme.color.line, borderRadius: theme.radius.sm, padding: '11px 13px',
  fontSize: '14px', color: theme.color.ink, background: theme.color.bg, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em',
  textTransform: 'uppercase', color: theme.color.muted, marginBottom: '6px',
};

export const SuggestForm = ({ venue, onClose }: SuggestFormProps) => {
  const { t } = useTranslation();
  const { create } = useSuggestionMutations();

  const [draft, setDraft] = useState<Record<SuggestionField, string>>({
    address: venue.address, person: venue.person, phone: venue.phone, website: venue.website,
  });
  const [note, setNote] = useState('');
  const [trap, setTrap] = useState('');
  const [done, setDone] = useState(false);

  const fieldLabels: Record<SuggestionField, string> = {
    address: t.address, person: t.person, phone: t.phone, website: t.website,
  };

  const input = toSuggestionInput(venue, draft, note);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;
    // Honeypot: humans never see this field; bots fill it. Pretend success.
    if (trap !== '') { setDone(true); return; }
    create.mutate(input, { onSuccess: () => setDone(true) });
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div
            style={{
              flex: 1, fontFamily: theme.font.display, textTransform: 'uppercase',
              fontSize: '18px', fontWeight: 700, color: theme.color.ink, lineHeight: 1.2,
            }}
          >
            {t.suggestEdit} — {venue.name}
          </div>
          <button
            onClick={onClose}
            aria-label={t.close}
            style={{
              border: 'none', background: 'transparent', color: theme.color.muted,
              cursor: 'pointer', padding: '2px', display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div style={{ marginTop: '18px', fontSize: '14px', color: theme.color.ink }}>
            {t.suggestThanks}
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ marginTop: '14px' }}>
            {SUGGESTION_FIELDS.map((f) => (
              <div key={f} style={{ marginBottom: '12px' }}>
                <label htmlFor={'suggest-' + f} style={labelStyle}>{fieldLabels[f]}</label>
                <input
                  id={'suggest-' + f}
                  value={draft[f]}
                  maxLength={SUGGESTION_MAX[f]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="suggest-note" style={labelStyle}>{t.suggestNote}</label>
              <textarea
                id="suggest-note"
                value={note}
                maxLength={SUGGESTION_MAX.note}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            {/* Honeypot — visually hidden, out of the tab order. */}
            <input
              data-testid="suggest-trap"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
            />
            {create.isError && (
              <div style={{ marginBottom: '12px', fontSize: '13px', color: theme.color.accent }}>
                {t.suggestError}
              </div>
            )}
            <button
              type="submit"
              disabled={!input || create.isPending}
              style={{
                width: '100%', border: 'none', cursor: input ? 'pointer' : 'default',
                background: input ? theme.color.accent : theme.color.paper,
                color: input ? theme.color.accentInk : theme.color.muted,
                fontWeight: 600, fontSize: '14px', padding: '13px', borderRadius: theme.radius.sm,
              }}
            >
              {t.suggestSend}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/features/venue-suggest/SuggestForm.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venue-suggest/SuggestForm.tsx src/features/venue-suggest/SuggestForm.test.tsx
git commit -m "feat: SuggestForm modal with honeypot and null-for-unchanged payload"
```

---

### Task 11: `DetailModal` — suggest button + pending chip

**Files:**
- Modify: `src/features/venue-detail/DetailModal.tsx`
- Modify: `src/features/venue-detail/DetailModal.test.tsx`

**Interfaces:**
- Consumes: `useFeatureFlag` (Task 5), i18n keys (Task 6).
- Produces: three new **required** props on `DetailModal`: `onSuggest: () => void`, `pendingCount: number`, `onOpenSuggestions: () => void`. Consumed by Task 14.

- [ ] **Step 1: Write the failing tests**

In `src/features/venue-detail/DetailModal.test.tsx`, add below the existing `vi.mock('../../lib/supabase', …)` block:

```tsx
const { useFeatureFlag } = vi.hoisted(() => ({ useFeatureFlag: vi.fn(() => true) }));
vi.mock('../flags/useFeatureFlag', () => ({ useFeatureFlag }));
```

Extend `renderModal`'s default props (inside the existing `<DetailModal …>`):

```tsx
          onSuggest={noop}
          pendingCount={0}
          onOpenSuggestions={noop}
```

Add to the `describe('DetailModal', …)` block:

```tsx
  it('shows the suggest-an-edit button for visitors when the flag is on', async () => {
    useFeatureFlag.mockReturnValue(true);
    const onSuggest = vi.fn();
    renderModal({ onSuggest });
    await screen.findByText(venue.name);
    fireEvent.click(screen.getByRole('button', { name: STR.de.suggestEdit }));
    expect(onSuggest).toHaveBeenCalledTimes(1);
  });

  it('hides the suggest button when the flag is off', async () => {
    useFeatureFlag.mockReturnValue(false);
    renderModal();
    await screen.findByText(venue.name);
    expect(screen.queryByRole('button', { name: STR.de.suggestEdit })).not.toBeInTheDocument();
  });

  it('hides the suggest button for admins, shows the pending chip instead', async () => {
    useFeatureFlag.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: { user: { id: 'admin' } } } });
    const onOpenSuggestions = vi.fn();
    renderModal({ pendingCount: 2, onOpenSuggestions });
    await screen.findByText(STR.de.edit);
    expect(screen.queryByRole('button', { name: STR.de.suggestEdit })).not.toBeInTheDocument();
    const chip = screen.getByRole('button', { name: STR.de.suggestPending.replace('{n}', '2') });
    fireEvent.click(chip);
    expect(onOpenSuggestions).toHaveBeenCalledTimes(1);
  });

  it('hides the pending chip when there are no pending suggestions', async () => {
    useFeatureFlag.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: { user: { id: 'admin' } } } });
    renderModal({ pendingCount: 0 });
    await screen.findByText(STR.de.edit);
    expect(screen.queryByText(STR.de.suggestPending.replace('{n}', '0'))).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test -- run src/features/venue-detail/DetailModal.test.tsx`
Expected: the 4 new tests FAIL (unknown props / missing elements); the 4 existing tests still pass.

- [ ] **Step 3: Implement the changes**

In `src/features/venue-detail/DetailModal.tsx`:

Add imports:

```tsx
import { useFeatureFlag } from '../flags/useFeatureFlag';
```

Extend the props interface:

```tsx
interface DetailModalProps {
  venue: Venue;
  onClose: () => void;
  onNavigate: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSuggest: () => void;
  pendingCount: number;
  onOpenSuggestions: () => void;
}
```

Update the component signature:

```tsx
export const DetailModal = ({
  venue, onClose, onNavigate, onShare, onEdit, onDelete,
  onSuggest, pendingCount, onOpenSuggestions,
}: DetailModalProps) => {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const suggestEnabled = useFeatureFlag('suggest_edit');
```

Insert the admin pending chip directly after the indoor/outdoor tags row (the `<div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>…</div>` block):

```tsx
        {isAdmin && pendingCount > 0 && (
          <button
            onClick={onOpenSuggestions}
            style={{
              marginTop: '10px', border: '1px solid #d9a441', background: '#fdf3df', color: '#8a5b00',
              fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: theme.radius.pill,
              cursor: 'pointer',
            }}
          >
            {t.suggestPending.replace('{n}', String(pendingCount))}
          </button>
        )}
```

Insert the visitor suggest button directly after the website contact row (the `{venue.website && (…)}` block), before the navigate/share button row:

```tsx
        {!isAdmin && suggestEnabled && (
          <button
            onClick={onSuggest}
            style={{
              border: 'none', background: 'transparent', color: theme.color.muted, fontSize: '12.5px',
              textDecoration: 'underline', cursor: 'pointer', padding: '6px 0', marginTop: '4px',
            }}
          >
            {t.suggestEdit}
          </button>
        )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- run src/features/venue-detail/DetailModal.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venue-detail/DetailModal.tsx src/features/venue-detail/DetailModal.test.tsx
git commit -m "feat: suggest-an-edit button and pending chip in DetailModal"
```

---

### Task 12: `SuggestionQueueModal`

**Files:**
- Create: `src/features/venue-suggest/SuggestionQueueModal.tsx`
- Create: `src/features/venue-suggest/SuggestionQueueModal.test.tsx`

**Interfaces:**
- Consumes: `useSuggestionMutations` (Task 9), `SUGGESTION_FIELDS` + `VenueSuggestion` (Task 7), i18n keys (Task 6).
- Produces: `SuggestionQueueModal({ suggestions: VenueSuggestion[]; venues: Venue[]; filterVenueId?: string | null; onClose: () => void })` — consumed by Task 14. Diff rows always render the **live** current value from `venues`, so the admin sees exactly what Accept will overwrite.

- [ ] **Step 1: Write the failing test**

Create `src/features/venue-suggest/SuggestionQueueModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('./api', () => ({
  createSuggestion: vi.fn(),
  listPendingSuggestions: vi.fn(),
  updateSuggestionStatus: vi.fn(),
}));
vi.mock('../venues/api', () => ({ updateVenue: vi.fn() }));

import { updateSuggestionStatus } from './api';
import { updateVenue } from '../venues/api';
import { I18nContext } from '../../i18n/useTranslation';
import { STR } from '../../i18n/translations';
import type { Venue } from '../venues/types';
import type { VenueSuggestion } from './types';
import { SuggestionQueueModal } from './SuggestionQueueModal';

const venues: Venue[] = [
  { id: 'v1', name: 'Bern', canton: 'BE', address: 'Old St 1', lat: 0, lng: 0,
    indoor: true, outdoor: false, person: 'Hans', phone: '031 111 11 11', website: 'a.ch', photos: [] },
  { id: 'v2', name: 'Luzern', canton: 'LU', address: 'B-Weg 2', lat: 0, lng: 0,
    indoor: true, outdoor: false, person: 'Vreni', phone: '', website: '', photos: [] },
];

const s = (over: Partial<VenueSuggestion>): VenueSuggestion => ({
  id: 's1', venue_id: 'v1', address: null, person: null, phone: null, website: null,
  note: '', status: 'pending', created_at: '2026-07-15T00:00:00Z', venues: { name: 'Bern' }, ...over,
});

const suggestions = [
  s({ id: 's1', venue_id: 'v1', phone: '031 222 22 22', note: 'New number' }),
  s({ id: 's2', venue_id: 'v2', venues: { name: 'Luzern' }, person: 'Ruedi' }),
];

const renderQueue = (filterVenueId: string | null = null) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
        <SuggestionQueueModal
          suggestions={suggestions}
          venues={venues}
          filterVenueId={filterVenueId}
          onClose={() => {}}
        />
      </I18nContext.Provider>
    </QueryClientProvider>,
  );

beforeEach(() => { vi.clearAllMocks(); });

describe('SuggestionQueueModal', () => {
  it('lists pending suggestions with venue name, note, and only the non-null diff rows', () => {
    renderQueue();
    expect(screen.getByText('Bern')).toBeInTheDocument();
    expect(screen.getByText('New number')).toBeInTheDocument();
    expect(screen.getByText('031 111 11 11')).toBeInTheDocument();
    expect(screen.getByText('031 222 22 22')).toBeInTheDocument();
    expect(screen.queryByText('Old St 1')).not.toBeInTheDocument();
  });

  it('filters to one venue when filterVenueId is set', () => {
    renderQueue('v2');
    expect(screen.getByText('Luzern')).toBeInTheDocument();
    expect(screen.queryByText('Bern')).not.toBeInTheDocument();
  });

  it('accept applies changes to the venue and marks the suggestion accepted', async () => {
    vi.mocked(updateVenue).mockResolvedValue({} as never);
    vi.mocked(updateSuggestionStatus).mockResolvedValue();
    renderQueue('v1');
    fireEvent.click(screen.getByRole('button', { name: STR.de.suggestAccept }));
    await waitFor(() => expect(vi.mocked(updateSuggestionStatus)).toHaveBeenCalledWith('s1', 'accepted'));
    expect(vi.mocked(updateVenue)).toHaveBeenCalledWith('v1', { phone: '031 222 22 22' });
  });

  it('dismiss marks the suggestion dismissed without touching the venue', async () => {
    vi.mocked(updateSuggestionStatus).mockResolvedValue();
    renderQueue('v1');
    fireEvent.click(screen.getByRole('button', { name: STR.de.suggestDismiss }));
    await waitFor(() => expect(vi.mocked(updateSuggestionStatus)).toHaveBeenCalledWith('s1', 'dismissed'));
    expect(vi.mocked(updateVenue)).not.toHaveBeenCalled();
  });

  it('shows the empty state when there is nothing pending', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nContext.Provider value={{ lang: 'de', t: STR.de, setLang: vi.fn() }}>
          <SuggestionQueueModal suggestions={[]} venues={venues} onClose={() => {}} />
        </I18nContext.Provider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(STR.de.suggestionsEmpty)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- run src/features/venue-suggest/SuggestionQueueModal.test.tsx`
Expected: FAIL — cannot resolve `./SuggestionQueueModal`.

- [ ] **Step 3: Write the implementation**

Create `src/features/venue-suggest/SuggestionQueueModal.tsx`:

```tsx
import { X, ArrowRight } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { useSuggestionMutations } from './useSuggestions';
import { SUGGESTION_FIELDS, type SuggestionField, type VenueSuggestion } from './types';
import type { Venue } from '../venues/types';
import { theme } from '../../theme';

interface SuggestionQueueModalProps {
  suggestions: VenueSuggestion[];
  venues: Venue[];
  filterVenueId?: string | null;
  onClose: () => void;
}

const actionBtn: React.CSSProperties = {
  flex: 1, cursor: 'pointer', fontWeight: 600, fontSize: '13px', padding: '9px',
  borderRadius: theme.radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
};

export const SuggestionQueueModal = ({
  suggestions, venues, filterVenueId = null, onClose,
}: SuggestionQueueModalProps) => {
  const { t } = useTranslation();
  const { accept, dismiss } = useSuggestionMutations();

  const fieldLabels: Record<SuggestionField, string> = {
    address: t.address, person: t.person, phone: t.phone, website: t.website,
  };

  const shown = filterVenueId
    ? suggestions.filter((s) => s.venue_id === filterVenueId)
    : suggestions;

  const venueById = new Map(venues.map((v) => [v.id, v]));

  return (
    <Modal onClose={onClose} width={520}>
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              flex: 1, fontFamily: theme.font.display, textTransform: 'uppercase',
              fontSize: '18px', fontWeight: 700, color: theme.color.ink,
            }}
          >
            {t.suggestions}
          </div>
          <button
            onClick={onClose}
            aria-label={t.close}
            style={{
              border: 'none', background: 'transparent', color: theme.color.muted,
              cursor: 'pointer', padding: '2px', display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {shown.length === 0 && (
          <div style={{ marginTop: '16px', fontSize: '14px', color: theme.color.muted }}>
            {t.suggestionsEmpty}
          </div>
        )}

        {shown.map((s) => {
          const venue = venueById.get(s.venue_id);
          return (
            <div
              key={s.id}
              style={{
                marginTop: '14px', border: '1px solid ' + theme.color.line,
                borderRadius: theme.radius.sm, padding: '13px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: theme.color.ink }}>
                  {s.venues?.name ?? venue?.name ?? ''}
                </span>
                <span style={{ fontSize: '12px', color: theme.color.muted }}>
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
              {SUGGESTION_FIELDS.map((f) =>
                s[f] === null ? null : (
                  <div key={f} style={{ marginTop: '8px', fontSize: '13px' }}>
                    <div
                      style={{
                        fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em',
                        color: theme.color.muted, fontWeight: 700,
                      }}
                    >
                      {fieldLabels[f]}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '2px' }}>
                      <span style={{ color: theme.color.muted, textDecoration: 'line-through' }}>
                        {venue?.[f] ?? ''}
                      </span>
                      <ArrowRight size={13} color={theme.color.muted} />
                      <span style={{ color: theme.color.ink, fontWeight: 600 }}>{s[f]}</span>
                    </div>
                  </div>
                ),
              )}
              {s.note && (
                <div style={{ marginTop: '8px', fontSize: '13px', color: theme.color.ink, fontStyle: 'italic' }}>
                  {s.note}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => accept.mutate(s)}
                  disabled={accept.isPending}
                  style={{
                    ...actionBtn, border: 'none',
                    background: theme.color.accent, color: theme.color.accentInk,
                  }}
                >
                  {t.suggestAccept}
                </button>
                <button
                  onClick={() => dismiss.mutate(s.id)}
                  disabled={dismiss.isPending}
                  style={{
                    ...actionBtn, border: '1.5px solid ' + theme.color.line,
                    background: theme.color.bg, color: theme.color.ink,
                  }}
                >
                  {t.suggestDismiss}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- run src/features/venue-suggest/SuggestionQueueModal.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/venue-suggest/SuggestionQueueModal.tsx src/features/venue-suggest/SuggestionQueueModal.test.tsx
git commit -m "feat: SuggestionQueueModal with per-field diff and accept/dismiss"
```

---

### Task 13: Sidebar — Suggestions row with badge

**Files:**
- Modify: `src/features/sidebar/Sidebar.tsx` (Verwaltung band, `adminOpen` block around line 522)
- Modify: `src/features/sidebar/Sidebar.test.tsx` (extend `Harness`)

**Interfaces:**
- Consumes: i18n keys (Task 6).
- Produces: two new **required** props on `Sidebar`: `pendingSuggestions: number`, `onOpenSuggestions: () => void`. Consumed by Task 14.

- [ ] **Step 1: Write the failing tests**

In `src/features/sidebar/Sidebar.test.tsx`:

Add to the `HarnessProps` interface:

```tsx
  pendingSuggestions?: number;
  onOpenSuggestions?: () => void;
```

Add to the `Harness` destructured defaults:

```tsx
  pendingSuggestions = 0,
  onOpenSuggestions = () => {},
```

Pass both through to `<Sidebar …>` inside `Harness`:

```tsx
      pendingSuggestions={pendingSuggestions}
      onOpenSuggestions={onOpenSuggestions}
```

Add these tests (admin session + open band, mirroring how existing admin tests arrange state):

```tsx
describe('suggestions row', () => {
  it('shows the row with a pending badge inside the open Verwaltung band', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'admin' } } } });
    localStorage.setItem('sk-verwaltung-open', 'true');
    const onOpenSuggestions = vi.fn();
    render(<Harness pendingSuggestions={3} onOpenSuggestions={onOpenSuggestions} />);
    const row = await screen.findByRole('button', { name: new RegExp(STR.de.suggestions) });
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(row);
    expect(onOpenSuggestions).toHaveBeenCalledTimes(1);
  });

  it('hides the badge when nothing is pending', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'admin' } } } });
    localStorage.setItem('sk-verwaltung-open', 'true');
    render(<Harness pendingSuggestions={0} />);
    await screen.findByRole('button', { name: new RegExp(STR.de.suggestions) });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
```

Note: if the existing test file's `afterEach` doesn't already call `localStorage.clear()`, add it so `sk-verwaltung-open` doesn't leak between tests.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test -- run src/features/sidebar/Sidebar.test.tsx`
Expected: the 2 new tests FAIL; existing tests still pass.

- [ ] **Step 3: Implement the changes**

In `src/features/sidebar/Sidebar.tsx`:

- Add `Inbox` to the existing `lucide-react` import.
- Add to the Sidebar props interface: `pendingSuggestions: number;` and `onOpenSuggestions: () => void;`, and destructure both in the component signature.
- Inside the `{adminOpen && (…)}` block, directly after the existing export/import button row (`<div style={{ display: 'flex', gap: '7px', marginTop: '10px' }}>…</div>`), add:

```tsx
              <button
                onClick={onOpenSuggestions}
                style={{ ...exportBtnStyle, width: '100%', marginTop: '7px', justifyContent: 'center' }}
              >
                <Inbox size={13} /> {t.suggestions}
                {pendingSuggestions > 0 && (
                  <span
                    style={{
                      background: theme.color.accent, color: theme.color.accentInk,
                      borderRadius: theme.radius.pill, fontSize: '11px', fontWeight: 700,
                      padding: '1px 7px', marginLeft: '4px',
                    }}
                  >
                    {pendingSuggestions}
                  </span>
                )}
              </button>
```

(Wrap the existing row and this button in a fragment `<>…</>` if the `adminOpen` block currently renders a single element.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- run src/features/sidebar/Sidebar.test.tsx`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/sidebar/Sidebar.tsx src/features/sidebar/Sidebar.test.tsx
git commit -m "feat: suggestions row with pending badge in Verwaltung band"
```

---

### Task 14: App wiring + full verification

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: everything above. `App` is rendered inside `AuthProvider` and `QueryClientProvider` (see `src/main.tsx`), so `useAuth()` and query hooks work here.

- [ ] **Step 1: Wire the feature into App**

In `src/App.tsx`:

Add imports:

```tsx
import { useAuth } from './features/auth/useAuth';
import { usePendingSuggestions } from './features/venue-suggest/useSuggestions';
import { SuggestForm } from './features/venue-suggest/SuggestForm';
import { SuggestionQueueModal } from './features/venue-suggest/SuggestionQueueModal';
```

Add state + data inside the `App` component, near the other modal state:

```tsx
  const { isAdmin } = useAuth();
  const pendingQuery = usePendingSuggestions(isAdmin);
  const pendingSuggestions = pendingQuery.data ?? [];
  const [suggestVenue, setSuggestVenue] = useState<Venue | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsFilter, setSuggestionsFilter] = useState<string | null>(null);
```

(`Venue` is already imported in App.tsx; if not, add `import type { Venue } from './features/venues/types';`.)

Extend the `<Sidebar …>` element (around line 299) with:

```tsx
          pendingSuggestions={pendingSuggestions.length}
          onOpenSuggestions={() => { setSuggestionsFilter(null); setSuggestionsOpen(true); }}
```

Extend the `<DetailModal …>` element (around line 332) with:

```tsx
          onSuggest={() => setSuggestVenue(detailVenue)}
          pendingCount={pendingSuggestions.filter((s) => s.venue_id === detailVenue.id).length}
          onOpenSuggestions={() => { setSuggestionsFilter(detailVenue.id); setSuggestionsOpen(true); }}
```

Render the two modals next to the other modals (after the `{showLogin && …}` line):

```tsx
      {suggestVenue && (
        <SuggestForm venue={suggestVenue} onClose={() => setSuggestVenue(null)} />
      )}

      {suggestionsOpen && (
        <SuggestionQueueModal
          suggestions={pendingSuggestions}
          venues={venues}
          filterVenueId={suggestionsFilter}
          onClose={() => setSuggestionsOpen(false)}
        />
      )}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm run test -- run`
Expected: ALL tests pass (including the pre-existing smoke test, which will catch App-level type/wiring errors).

- [ ] **Step 3: Run the linter and build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit and push**

```bash
git add src/App.tsx
git commit -m "feat: wire suggest-an-edit + suggestion queue into App (#15)"
git push -u origin claude/new-session-c2jn3v
```

---

## Verification checklist (whole feature)

- `npm run test -- run` — all green.
- `npm run lint` — clean.
- `npm run build` — succeeds.
- Migrations reviewed: RLS on both tables, `with check (status = 'pending')` on public insert, explicit grants for `anon`/`authenticated`/`service_role`, length caps present.
- No new npm dependencies (`git diff origin/main -- package.json` shows no dependency changes).
- i18n parity test passes (same keys in DE/FR/IT).
