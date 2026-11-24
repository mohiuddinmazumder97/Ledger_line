import { base } from '@ledgerline/config/eslint';

export default [
  ...base({ tsconfigRootDir: import.meta.dirname, ignores: ['src/generated/**'] }),
  {
    rules: {
      // Nest injects classes by their runtime reference, so constructor param types must stay value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
