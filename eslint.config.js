/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions y supabase/tests son código Deno (imports npm:/jsr:, global Deno)
    ignores: ['dist/*', 'coverage/*', 'supabase/functions/**', 'supabase/tests/**'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
]);
