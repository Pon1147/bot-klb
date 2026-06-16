/**
 * Unit tests cho df.token.db.ts — CRUD functions cho bảng df_tokens.
 * Mock better-sqlite3 để test logic thuần túy.
 */

jest.mock('better-sqlite3', () => {
  const prepareMock = jest.fn(() => ({
    get: jest.fn(),
    run: jest.fn(),
  }));
  return jest.fn(() => ({
    exec: jest.fn(),
    pragma: jest.fn(() => [
      { name: 'discord_id' },
      { name: 'openid' },
      { name: 'token' },
      { name: 'ts' },
      { name: 's' },
      { name: 'u' },
      { name: 'linked_at' },
      { name: 'last_used_at' },
    ]),
    prepare: prepareMock,
  }));
}, { virtual: true });

describe('df.token.db', () => {
  let Database: jest.Mock;
  let mockDb: any;

  beforeEach(() => {
    jest.resetModules();
    Database = require('better-sqlite3');
    mockDb = new Database();
    // Reset prepare chain
    const prepared = { get: jest.fn(), run: jest.fn() };
    mockDb.prepare.mockReturnValue(prepared);
  });

  describe('initializeDfTokensTable', () => {
    it('nên exec CREATE TABLE IF NOT EXISTS', () => {
      const { initializeDfTokensTable } = require('../src/database/df.token.db.js');
      initializeDfTokensTable(mockDb);
      expect(mockDb.exec).toHaveBeenCalledTimes(1);
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS df_tokens'),
      );
    });

    it('nên tạo bảng với đúng columns', () => {
      const { initializeDfTokensTable } = require('../src/database/df.token.db.js');
      initializeDfTokensTable(mockDb);
      const sql = mockDb.exec.mock.calls[0][0];
      expect(sql).toContain('discord_id TEXT PRIMARY KEY');
      expect(sql).toContain('openid TEXT NOT NULL');
      expect(sql).toContain('token TEXT NOT NULL');
      expect(sql).toContain('linked_at');
      expect(sql).toContain('last_used_at');
    });
  });

  describe('getDfToken', () => {
    beforeEach(() => {
      jest.resetModules();
      const prepared = { get: jest.fn(), run: jest.fn() };
      mockDb = new Database();
      mockDb.prepare.mockReturnValue(prepared);
    });

    it('nên trả về token row khi tìm thấy', () => {
      const mockRow = {
        discord_id: '123',
        openid: '987654321',
        token: 'abc123',
        linked_at: '2026-06-09',
        last_used_at: null,
      };
      const prepared = mockDb.prepare();
      prepared.get.mockReturnValue(mockRow);

      const { getDfToken } = require('../src/database/df.token.db.js');
      const result = getDfToken(mockDb, '123');

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM df_tokens WHERE discord_id = ?');
      expect(prepared.get).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockRow);
    });

    it('nên trả về undefined khi không tìm thấy', () => {
      const prepared = mockDb.prepare();
      prepared.get.mockReturnValue(undefined);

      const { getDfToken } = require('../src/database/df.token.db.js');
      const result = getDfToken(mockDb, '999');
      expect(result).toBeUndefined();
    });
  });

  describe('saveDfToken', () => {
    it('nên INSERT token mới và trả về true khi thành công', () => {
      const prepared = mockDb.prepare();
      prepared.run.mockReturnValue({ changes: 1 });

      const { saveDfToken } = require('../src/database/df.token.db.js');
      const result = saveDfToken(mockDb, '123', 'openid1', 'token1');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO df_tokens'),
      );
      expect(prepared.run).toHaveBeenCalledWith('123', 'openid1', 'token1', null, null, null);
      expect(result).toBe(true);
    });
  });

  describe('touchDfToken', () => {
    it('nên cập nhật last_used_at', () => {
      const prepared = mockDb.prepare();
      prepared.run.mockReturnValue(undefined);

      const { touchDfToken } = require('../src/database/df.token.db.js');
      touchDfToken(mockDb, '123');

      expect(prepared.run).toHaveBeenCalledWith('123');
      const sql = mockDb.prepare.mock.calls[mockDb.prepare.mock.calls.length - 1][0];
      expect(sql).toContain('last_used_at');
    });
  });

  describe('deleteDfToken', () => {
    it('nên xóa token theo discord_id', () => {
      const prepared = mockDb.prepare();
      prepared.run.mockReturnValue(undefined);

      const { deleteDfToken } = require('../src/database/df.token.db.js');
      deleteDfToken(mockDb, '123');

      expect(prepared.run).toHaveBeenCalledWith('123');
      const sql = mockDb.prepare.mock.calls[mockDb.prepare.mock.calls.length - 1][0];
      expect(sql).toContain('DELETE FROM df_tokens');
    });
  });
});
