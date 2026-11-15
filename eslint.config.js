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
      // eslint-config-expo 58 trae eslint-plugin-react-hooks 7, cuyas reglas de
      // React Compiler marcan como error patrones que ya existían (94 casos).
      // Se dejan en aviso hasta revisarlas una a una; no afectan al runtime.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    // TypeScript ya comprueba los miembros de los namespaces; eslint-plugin-import
    // no sigue algunos `export *` (p. ej. Notifications.AndroidImportance).
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'import/namespace': 'off',
    },
  },
]);
