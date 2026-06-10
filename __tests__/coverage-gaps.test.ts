/**
 * Coverage gap fillers — targets specific uncovered lines.
 * Uses jest.requireActual for real modules to avoid mock pollution.
 */

// ─── df.token.db.ts migration (lines 34-42) ──────────────────────

describe('df.token.db — migration columns', () => {
  let Database: any;

  beforeEach(() => {
    jest.resetModules();
    Database = jest.requireActual('better-sqlite3');

    // Prevent bot.config from being imported (throws on missing env)
    jest.mock('../src/config/bot.config.js', () => ({
      botConfig: { databasePath: ':memory:' },
    }), { virtual: true });

    // Prevent ensureDatabaseDirectory from trying to mkdir
    jest.mock('../src/database/welcome.database.js', () => ({
      ensureDatabaseDirectory: jest.fn(),
    }), { virtual: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('phải ADD COLUMN ts/s/u khi bảng thiếu columns', () => {
    const db = new Database(':memory:');

    // Create table WITHOUT ts/s/u columns
    db.exec(`
      CREATE TABLE df_tokens (
        discord_id TEXT PRIMARY KEY,
        openid TEXT NOT NULL,
        token TEXT NOT NULL,
        linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME
      )
    `);

    const { initializeDfTokensTable } = require('../src/database/df.token.db.js');
    initializeDfTokensTable(db);

    const info = db.pragma("table_info('df_tokens')") as Array<{ name: string }>;
    const columns = new Set(info.map((c) => c.name));
    expect(columns.has('ts')).toBe(true);
    expect(columns.has('s')).toBe(true);
    expect(columns.has('u')).toBe(true);

    db.close();
  });

  it('phải không ADD COLUMN khi bảng đã đủ columns', () => {
    const db = new Database(':memory:');

    db.exec(`
      CREATE TABLE df_tokens (
        discord_id TEXT PRIMARY KEY,
        openid TEXT NOT NULL,
        token TEXT NOT NULL,
        ts TEXT,
        s TEXT,
        u TEXT,
        linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME
      )
    `);

    const { initializeDfTokensTable } = require('../src/database/df.token.db.js');
    initializeDfTokensTable(db);

    const info = db.pragma("table_info('df_tokens')") as Array<{ name: string }>;
    expect(info.length).toBe(8);

    db.close();
  });
});
