import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.vercel/**',
      'playwright-report/**',
      'test-results/**',
      'e2e/screenshots/**',
      'e2e/.auth/**',
      '__sandbox__/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['apps/server/**/*.ts', 'packages/shared/**/*.ts', 'api/**/*.ts', 'e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Fastify's plugin and handler contracts are async by signature, so many
      // legitimately contain no await.
      '@typescript-eslint/require-await': 'off',
    },
  },

  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [react.configs.flat.recommended, react.configs.flat['jsx-runtime']],
    languageOptions: { globals: globals.browser },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs['recommended-latest'].rules,
  },

  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  prettier,
);
