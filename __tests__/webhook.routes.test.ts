/**
 * Unit tests cho webhook.routes.ts — handleClaimRequest handler.
 */

jest.mock('../src/services/df-claim-store.js', () => ({
  consumeCode: jest.fn(),
}));

jest.mock('../src/database/df.token.db.js', () => ({
  saveDfToken: jest.fn(),
}));

jest.mock('discord.js', () => ({
  Client: class Client {
    users = { fetch: jest.fn() };
  },
}));

import { handleClaimRequest } from '../src/server/webhook.routes.js';
import { consumeCode } from '../src/services/df-claim-store.js';
import { saveDfToken } from '../src/database/df.token.db.js';
import { Client } from 'discord.js';

describe('webhook.routes — handleClaimRequest', () => {
  const mockDb: any = {
    prepare: jest.fn(() => ({ get: jest.fn(), run: jest.fn() })),
  };

  const mockDm: any = { send: jest.fn().mockResolvedValue(undefined) };
  const mockUser: any = { createDM: jest.fn().mockResolvedValue(mockDm) };
  let mockClient: Client;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new Client();
    (mockClient.users.fetch as jest.Mock).mockResolvedValue(mockUser);
  });

  it('nên trả về 400 khi body rỗng', async () => {
    const res = await handleClaimRequest(null, mockDb, mockClient);
    expect(res.status).toBe(400);
  });

  it('nên trả về 400 khi thiếu trường', async () => {
    const res = await handleClaimRequest({ code: 'ABC123', openid: '123' }, mockDb, mockClient);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Thiếu thông tin');
  });

  it('nên trả về 400 khi mã claim không hợp lệ', async () => {
    (consumeCode as jest.Mock).mockReturnValue(null);
    const res = await handleClaimRequest(
      { code: 'INVALID', openid: '123', token: 'abc' },
      mockDb,
      mockClient,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('không hợp lệ');
  });

  it('nên lưu token và trả về 200', async () => {
    (consumeCode as jest.Mock).mockReturnValue('discord-123');
    const res = await handleClaimRequest(
      { code: 'ABC123', openid: '123', token: 'abc' },
      mockDb,
      mockClient,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('linked');
    expect(saveDfToken).toHaveBeenCalledWith(mockDb, 'discord-123', '123', 'abc', undefined, undefined, undefined);
  });

  it('nên DM user khi liên kết thành công', async () => {
    (consumeCode as jest.Mock).mockReturnValue('discord-123');
    await handleClaimRequest(
      { code: 'ABC123', openid: '123', token: 'abc' },
      mockDb,
      mockClient,
    );

    expect(mockClient.users.fetch).toHaveBeenCalledWith('discord-123');
    expect(mockUser.createDM).toHaveBeenCalled();
    expect(mockDm.send).toHaveBeenCalled();
  });

  it('nên không crash khi DM fail', async () => {
    (consumeCode as jest.Mock).mockReturnValue('discord-123');
    mockUser.createDM.mockRejectedValue(new Error('DM blocked'));
    const res = await handleClaimRequest(
      { code: 'ABC123', openid: '123', token: 'abc' },
      mockDb,
      mockClient,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('linked');
  });

  it('nên không crash khi user fetch fail', async () => {
    (consumeCode as jest.Mock).mockReturnValue('discord-123');
    (mockClient.users.fetch as jest.Mock).mockRejectedValue(new Error('user not found'));
    const res = await handleClaimRequest(
      { code: 'ABC123', openid: '123', token: 'abc' },
      mockDb,
      mockClient,
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('linked');
  });
});
