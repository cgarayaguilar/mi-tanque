import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Section numbers (§) refer to ENGINEERING_PRINCIPLES.md
const principleRules = {
  // §8.8: no native alert/confirm/prompt dialogs
  'no-alert': 'error',
  // §6.8: no debug logging. console.error/warn stay allowed until error
  // reporting (§7.2) is wired; then they move behind a single reporter.
  'no-console': ['error', { allow: ['error', 'warn'] }],
  // §7.1: never swallow an error with an empty catch
  'no-empty': ['error', { allowEmptyCatch: false }],
  // §8.13: colors come from the design tokens, never as loose hex values
  'no-restricted-syntax': [
    'error',
    {
      selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
      message:
        'Use a design token (src/theme/tokens.ts), not a hex color (§8.13).',
    },
    {
      selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
      message:
        'Use a design token (src/theme/tokens.ts), not a hex color (§8.13).',
    },
  ],
  // §6.9: lodash only through named imports from lodash-es (tree-shaking)
  'no-restricted-imports': [
    'error',
    {
      paths: [
        { name: 'lodash', message: 'Use named imports from lodash-es (§6.9).' },
        {
          name: 'lodash-es',
          importNames: ['default'],
          message: 'Use named imports from lodash-es (§6.9).',
        },
      ],
      patterns: [
        {
          group: ['lodash/*'],
          message: 'Use named imports from lodash-es (§6.9).',
        },
      ],
    },
  ],
}

const unusedVarsOptions = {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
}

export default defineConfig([
  globalIgnores(['build', 'dist', 'dev-dist', 'coverage']),

  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...principleRules,
      'no-unused-vars': ['error', unusedVarsOptions],
    },
  },

  // Legacy JavaScript (ADR 0001): classic hook rules only. The React Compiler
  // rules below apply to TypeScript, so code is held to them as it is migrated
  // instead of through a mass refactor (§3.4).
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // TypeScript: strict, type-aware rules (§6.1, §6.2)
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', unusedVarsOptions],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // The design tokens are the one place where hex colors are defined
  {
    files: ['src/theme/tokens.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  {
    files: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/setupTests.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.vitest } },
  },

  {
    files: ['*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },

  // Formatting belongs to Prettier (§6.7)
  prettier,
])
