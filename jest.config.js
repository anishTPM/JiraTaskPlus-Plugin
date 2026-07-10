export default {
  testEnvironment: 'jsdom',
  transform: { '\\.[jt]sx?$': 'babel-jest' },
  transformIgnorePatterns: [],
  setupFiles: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
};
