import { describe, expect, it } from 'vitest';
import { flagTagFilter, projectTags } from './flag-tags';

const flags = {
  verband: { development: true, stage: true, production: false },
  editors: { development: true, stage: false, production: false },
};
const tags = {
  verband: { on: '@verband-view', off: '@canton-view' },
  editors: { on: '@editors' },
};

describe('flagTagFilter', () => {
  it('skips the scenarios for the state a flag does not have in that environment', () => {
    expect(flagTagFilter('production', flags, tags)).toBe('not @verband-view and not @editors');
  });

  it('skips only the off tag where a flag is on', () => {
    expect(flagTagFilter('development', flags, tags)).toBe('not @canton-view');
  });

  it('mixes the two when the flags differ', () => {
    expect(flagTagFilter('stage', flags, tags)).toBe('not @canton-view and not @editors');
  });

  it('is empty when nothing needs skipping', () => {
    expect(flagTagFilter('development', flags, { editors: { on: '@editors' } })).toBe('');
  });
});

describe('projectTags', () => {
  it('keeps the phone and tablet scenarios out of a desktop project', () => {
    expect(projectTags('production', undefined, flags, tags)).toBe(
      'not @verband-view and not @editors and not @phone and not @tablet',
    );
  });

  it('runs only the scenarios for its layout in a phone or tablet project', () => {
    expect(projectTags('production', 'phone', flags, tags)).toBe('not @verband-view and not @editors and @phone');
  });

  it('starts with the layout when no flag needs skipping', () => {
    expect(projectTags('stage', 'tablet', flags, {})).toBe('@tablet');
    expect(projectTags('stage', undefined, flags, {})).toBe('not @phone and not @tablet');
  });
});
