import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import eslintPrettier from 'eslint-config-prettier';

export default [
  // Bỏ qua build output và node_modules
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', 'src/scraper/'],
  },

  // TypeScript parser + recommended rules
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Cho phép underscore prefix cho params không dùng (common trong discord.js callbacks)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Warn thay vì error để không block dev
      '@typescript-eslint/no-explicit-any': 'warn',
      // Cho phép index signatures (cần cho SettingsRecord pattern)
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  // Tắt các rule xung đột với Prettier
  eslintPrettier,
];
