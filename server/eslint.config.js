# ==============================================================================
# Server ESLint configuration
# Extends the root config with Node/ES module specifics.
# ==============================================================================

import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      // Warn on unused vars but allow underscore-prefixed intentional ones
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Discourage console.log in favour of the structured logger utility
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // Relaxed rules for test files
    files: ['tests/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
