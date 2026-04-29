module.exports = {
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-typescript',
      ],
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zustand)/)',
  ],
  setupFiles: ['./tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    'engine/**/*.ts',
    'store/**/*.ts',
    'services/**/*.ts',
    'db/**/*.ts',
    'constants/**/*.ts',
    'types/**/*.ts',
    '!**/*.d.ts',
  ],
};
