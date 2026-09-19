const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'logs/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Express identifies an error-handling middleware purely by its
      // 4-argument arity - `next` must stay declared even when unused, or a
      // middleware like errorHandler.middleware.js or authenticate.middleware.js
      // silently stops being recognized as one.
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^next$' }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
];
