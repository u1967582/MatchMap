/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Con la caché de transformación vacía (CI, sesiones en la nube, worktree
  // nuevo) la primera prueba de algunas suites tarda más de los 5 s por defecto
  // en transformar sus imports y falla por timeout aunque el código esté bien.
  testTimeout: 30000,
  // Limita la RAM: por defecto jest lanza un worker por núcleo (9 en este Mac)
  // y varias sesiones en paralelo agotaron los 16 GB. Los workers que superan
  // 512 MB se reciclan entre suites.
  maxWorkers: 3,
  workerIdleMemoryLimit: '512MB',
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.expo/',
    // Las edge functions se testean con Deno (npm run test:functions)
    '<rootDir>/supabase/',
    '<rootDir>/marketing-videos/',
  ],
  // react-native-purchases >=10 trae @revenuecat/purchases-js-hybrid-mappings
  // como dependencia, publicado en ESM sin transpilar. Mismo patrón que usa
  // el preset jest-expo (jest-expo/jest-preset.js), añadiendo @revenuecat.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|@revenuecat))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
  collectCoverageFrom: [
    'utils/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'stores/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
