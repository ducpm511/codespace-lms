// Flat config gốc dùng chung cho monorepo. Mỗi package có eslint.config.mjs mỏng re-export từ đây.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/** Ignore chung. */
export const ignores = {
  ignores: [
    '**/dist/**',
    '**/generated/**',
    '**/node_modules/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/*.config.*',
  ],
};

/** Base cho code TS chạy Node (api, contracts). */
export const nodeConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: { globals: { ...globals.jest } },
  },
);

/** Base cho code React (web). */
export const webConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    languageOptions: { globals: { ...globals.node } },
  },
);
