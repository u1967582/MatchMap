/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions es código Deno (imports por URL, global Deno)
    ignores: ['dist/*', 'coverage/*', 'supabase/functions/**'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
]);
