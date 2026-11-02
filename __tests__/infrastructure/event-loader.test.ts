/// <reference types="jest" />
/**
 * Unit tests cho event-loader.ts (NEW-01).
 * Kiểm tra wrapSafeEventListener và cơ chế bắt lỗi an toàn (sync + async) cho event listeners.
 */

import { wrapSafeEventListener, loadEvents } from '../../src/infrastructure/discord/event-loader.js';

describe('event-loader — wrapSafeEventListener (NEW-01)', () => {
  let mockLogger: {
    error: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
  });

  it('phải thực thi thành công và chuyển đầy đủ arguments khi listener bình thường', async () => {
    const mockExecute = jest.fn().mockResolvedValue('success');
    const safeListener = wrapSafeEventListener('testEvent', mockExecute, mockLogger as any);

    safeListener('arg1', 42, { key: 'val' });

    expect(mockExecute).toHaveBeenCalledWith('arg1', 42, { key: 'val' });
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('phải bắt synchronous exception và ghi log mà không làm sập tiến trình', () => {
    const syncError = new Error('Sync execution crash');
    const mockExecute = jest.fn().mockImplementation(() => {
      throw syncError;
    });

    const safeListener = wrapSafeEventListener('guildCreate', mockExecute, mockLogger as any);

    // Thực thi không được ném exception ra ngoài
    expect(() => {
      safeListener('guild-data');
    }).not.toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Event: guildCreate] Synchronous error'),
      expect.objectContaining({
        event: 'guildCreate',
        error: 'Sync execution crash',
        stack: expect.any(String),
      }),
    );
  });

  it('phải bắt asynchronous Promise rejection và ghi log mà không tạo unhandled rejection', async () => {
    const asyncError = new Error('Async network failure');
    const mockExecute = jest.fn().mockRejectedValue(asyncError);

    const safeListener = wrapSafeEventListener('interactionCreate', mockExecute, mockLogger as any);

    safeListener('interaction-data');

    // Chờ microtasks hoàn thành
    await Promise.resolve();
    await Promise.resolve();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Event: interactionCreate] Asynchronous error'),
      expect.objectContaining({
        event: 'interactionCreate',
        error: 'Async network failure',
        stack: expect.any(String),
      }),
    );
  });

  it('phải hỗ trợ cơ chế once / on của Client mà không làm thay đổi hành vi đăng ký', () => {
    const mockClient = {
      on: jest.fn(),
      once: jest.fn(),
    };

    const mockExecute = jest.fn().mockResolvedValue(undefined);
    const safeListenerOnce = wrapSafeEventListener('ready', mockExecute, mockLogger as any);
    const safeListenerOn = wrapSafeEventListener('messageCreate', mockExecute, mockLogger as any);

    mockClient.once('ready', safeListenerOnce);
    mockClient.on('messageCreate', safeListenerOn);

    expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function));
    expect(mockClient.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
  });

  it('phải bắt lỗi từ custom thenable không có method .catch', async () => {
    const customThenable = {
      then: (resolve, reject) => {
        reject(new Error('Custom thenable rejection'));
      },
    };
    const mockExecute = jest.fn().mockReturnValue(customThenable);

    const safeListener = wrapSafeEventListener('customEvent', mockExecute, mockLogger as any);
    safeListener('data');

    await Promise.resolve();
    await Promise.resolve();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Event: customEvent] Asynchronous error'),
      expect.objectContaining({
        event: 'customEvent',
        error: 'Custom thenable rejection',
      }),
    );
  });

  it('phải chuyển giao đầy đủ nhiều arguments (multiple event arguments)', () => {
    const mockExecute = jest.fn().mockReturnValue(undefined);
    const safeListener = wrapSafeEventListener('multiArgEvent', mockExecute, mockLogger as any);

    safeListener('arg1', 'arg2', 'arg3', { id: 123 }, true);

    expect(mockExecute).toHaveBeenCalledWith('arg1', 'arg2', 'arg3', { id: 123 }, true);
  });

});
