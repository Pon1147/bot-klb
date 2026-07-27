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
    '!src/config/bot.config.ts',
    '!src/scraper/**/*.ts',
    '!src/services/deltaforce.scraper.ts',
    '!src/services/team-find-*.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 95,
      lines: 93,
      statements: 93,
    },
    // Per-file thresholds for ESM tracking gaps and mocking limitations:
    // - webhook.routes.ts: express router fallback parse + outer catch block
    // - df-claim-store.ts: makeCode() fallback path requires 10 random collisions
    // - df/code.command.ts: buildCodesContainer uses discord.js builders
    // - df-guards.ts: requireDfToken/requireDfTokenOrInfo not reached by unit tests
    // - df-operator.utils.ts: fallback for unknown operator ID
    // - section-config.handlers.ts: getConfig() stub function
    // - df/history.command.ts: addIntegerOption builder call
    // - df/link.command.ts: editReply fallback in catch block
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
    'src/commands/df/code.command.ts': {
      branches: 36,
      functions: 83,
      lines: 61,
      statements: 61,
    },
    'src/utils/df-guards.ts': {
      branches: 66,
      functions: 66,
      lines: 63,
      statements: 63,
    },
    'src/utils/df-operator.utils.ts': {
      branches: 0,
      functions: 100,
      lines: 100,
      statements: 87,
    },
    'src/utils/section-config.handlers.ts': {
      branches: 45,
      functions: 56,
      lines: 56,
      statements: 66,
    },
    'src/commands/df/history.command.ts': {
      branches: 81,
      functions: 75,
      lines: 98,
      statements: 98,
    },
    'src/commands/df/link.command.ts': {
      branches: 77,
      functions: 76,
      lines: 91,
      statements: 90,
    },
  },
};
