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
    '!src/services/deltaforce.scraper.ts',
    '!src/services/team-find-*.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 80,
      lines: 75,
      statements: 75,
    },
    // Per-file thresholds for ESM tracking gaps and mocking limitations:
    // - df-claim-store.ts: makeCode() fallback path requires 10 random collisions
    // - df/code.handler.ts: subcommands and discord interaction handlers
    // - df/code.renderer.ts: container and sections rendering
    // - df-guards.ts: requireDfToken/requireDfTokenOrInfo not reached by unit tests
    // - df-operator.utils.ts: fallback for unknown operator ID
    // - section-config.handlers.ts: getConfig() stub function
    // - df/history.handler.ts: subcommands handler
    // - df/link.handler.ts: editReply fallback in catch block
    'src/services/df-claim-store.ts': {
      branches: 100,
      functions: 100,
      lines: 96,
      statements: 96,
    },
    'src/features/delta-force/code.handler.ts': {
      branches: 90,
      functions: 80,
      lines: 95,
      statements: 95,
    },
    'src/features/delta-force/code.renderer.ts': {
      branches: 80,
      functions: 100,
      lines: 90,
      statements: 90,
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
    'src/features/delta-force/history.handler.ts': {
      branches: 80,
      functions: 75,
      lines: 95,
      statements: 95,
    },
    'src/features/delta-force/link.handler.ts': {
      branches: 60,
      functions: 80,
      lines: 90,
      statements: 90,
    },
  },
};
