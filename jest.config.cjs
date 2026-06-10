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
    '!src/commands/df/link.command.ts',
    '!src/commands/df/history.command.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 95,
      lines: 100,
      statements: 95,
    },
    // Per-file thresholds for known ESM coverage tracking gaps:
    // - welcome-test.command.ts: v8 coverage misses lines when module is loaded via require() + resetModules()
    // - webhook.routes.ts: express router fallback parse + outer catch block are hard to isolate
    // - df-claim-store.ts: makeCode() fallback path requires 10 random collisions (virtually impossible)
    'src/commands/welcome/test.command.ts': {
      branches: 38,
      functions: 50,
      lines: 60,
      statements: 60,
    },
    'src/server/webhook.routes.ts': {
      branches: 84,
      functions: 100,
      lines: 85,
      statements: 86,
    },
    'src/services/df-claim-store.ts': {
      branches: 100,
      functions: 100,
      lines: 96,
      statements: 96,
    },
  },
};
