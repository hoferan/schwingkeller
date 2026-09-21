// jest-dom ships its own vitest augmentation, but it declares
// `interface Assertion<T = any>` while vitest 5 declares
// `interface Assertion<R, T>`. Declaration merging requires identical type
// parameter lists, so that augmentation is ignored and none of the matchers
// reach the Assertion type. This file repeats it at vitest 5's arity.
//
// Remove it once @testing-library/jest-dom supports vitest 5: the symptom is
// TS2339 on every jest-dom matcher, and the check is whether
// node_modules/@testing-library/jest-dom/types/vitest.d.ts declares two type
// parameters.
import type {TestingLibraryMatchers} from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Assertion<R, T> extends TestingLibraryMatchers<unknown, T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown> {}
}
