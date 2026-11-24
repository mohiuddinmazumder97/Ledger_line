import { next } from '@ledgerline/config/eslint/next';

export default next({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['playwright-report/**', 'test-results/**'],
});
