/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.expo/'],
  collectCoverageFrom: [
    'utils/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'stores/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
