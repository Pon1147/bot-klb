/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true,
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  // Exclude bot.config.ts: loads env vars at module-level (line 12 throw branch
  // requires missing env vars which would crash all tests). The requireEnvVariable
  // error path is a startup safeguard, not testable in ESM context.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/deploy-commands.ts',
    '!src/config/bot.config.ts',
    '!src/scraper/**/*.ts',
    '!src/services/deltaforce.scraper.ts',
    '!src/commands/df/df-link.command.ts',
    '!src/commands/df/df-matches.command.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 95,
      lines: 100,
      statements: 95,
    },
  },
};
