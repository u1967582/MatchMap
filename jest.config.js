/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.expo/'],
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
