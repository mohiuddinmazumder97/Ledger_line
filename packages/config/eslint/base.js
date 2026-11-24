import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Shared flat config. Pass `tsconfigRootDir` (usually `import.meta.dirname`) for type-aware rules.
 * @param {{ tsconfigRootDir: string, ignores?: string[] }} opts
 */
export function base({ tsconfigRootDir, ignores = [] }) {
  return tseslint.config(
    { ignores: ['dist/**', '.next/**', 'coverage/**', 'node_modules/**', ...ignores] },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
      },
    },
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      ...tseslint.configs.disableTypeChecked,
    },
    prettier,
  );
}
