import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { restoreFeatures } from './src/test/features';

afterEach(restoreFeatures);
