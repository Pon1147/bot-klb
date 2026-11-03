/**
 * Unit tests cho team-find-session.ts
 * Kiểm tra đầy đủ lifecycle: creation, selection update, renewal (touch), expiration, deletion và cleanup.
 */

import {
  createSession,
  getSession,
  updateSelection,
  deleteSession,
  isDone,
  startSessionCleanup,
  stopSessionCleanup,
  _clearSessionsForTest,
} from '../../src/services/team-find-session.js';

describe('TeamFindSession Lifecycle & TTLStore semantics', () => {
  beforeEach(() => {
    _clearSessionsForTest();
    jest.useFakeTimers();
  });

  afterEach(() => {
    stopSessionCleanup();
    jest.useRealTimers();
  });

  it('tạo session mới với giá trị mặc định chính xác', () => {
    const session = createSession('user-1', 'guild-1', 'msg-1', 'chan-1');
    expect(session.userId).toBe('user-1');
    expect(session.guildId).toBe('guild-1');
    expect(session.messageId).toBe('msg-1');
    expect(session.channelId).toBe('chan-1');
    expect(session.map).toBeNull();
    expect(session.mode).toBeNull();
    expect(session.rank).toBeNull();
    expect(typeof session.lastInteractionAt).toBe('number');

    expect(getSession('user-1')).toBeDefined();
    expect(isDone(session)).toBe(false);
  });

  it('cập nhật selection và làm mới lastInteractionAt', () => {
    const session = createSession('user-1', 'guild-1', 'msg-1', 'chan-1');
    const firstTouch = session.lastInteractionAt;

    jest.advanceTimersByTime(1000);
    updateSelection('user-1', 'map', 'Đập Nước Zero');
    expect(getSession('user-1')?.map).toBe('Đập Nước Zero');
    expect(getSession('user-1')!.lastInteractionAt).toBeGreaterThan(firstTouch);

    updateSelection('user-1', 'mode', 'Bình thường');
    expect(getSession('user-1')?.mode).toBe('Bình thường');
    expect(isDone(getSession('user-1')!)).toBe(true);

    updateSelection('user-1', 'rank', 'Thượng Tá');
    expect(getSession('user-1')?.rank).toBe('Thượng Tá');
  });

  it('xóa session khi gọi deleteSession', () => {
    createSession('user-1', 'guild-1', 'msg-1', 'chan-1');
    expect(getSession('user-1')).toBeDefined();

    deleteSession('user-1');
    expect(getSession('user-1')).toBeUndefined();
  });

  it('tự động hết hạn (expire) sau khi quá TTL (10 phút)', () => {
    createSession('user-1', 'guild-1', 'msg-1', 'chan-1');
    expect(getSession('user-1')).toBeDefined();

    // 9 phút trôi qua -> vẫn còn
    jest.advanceTimersByTime(9 * 60 * 1000);
    expect(getSession('user-1')).toBeDefined();

    // Thêm 2 phút (tổng 11 phút > 10 phút) -> session tự expire
    jest.advanceTimersByTime(2 * 60 * 1000);
    expect(getSession('user-1')).toBeUndefined();
  });

  it('tương tác mới (updateSelection) sẽ gia hạn TTL', () => {
    createSession('user-1', 'guild-1', 'msg-1', 'chan-1');

    // Sau 7 phút, người dùng bấm chọn Map -> gia hạn
    jest.advanceTimersByTime(7 * 60 * 1000);
    updateSelection('user-1', 'map', 'Thung lũng Layali');

    // Trôi tiếp 7 phút (tổng 14 phút từ lúc tạo, nhưng chỉ 7 phút từ lúc touch) -> vẫn còn
    jest.advanceTimersByTime(7 * 60 * 1000);
    expect(getSession('user-1')).toBeDefined();
    expect(getSession('user-1')?.map).toBe('Thung lũng Layali');

    // Trôi tiếp 4 phút nữa (> 10 phút từ lúc touch) -> hết hạn
    jest.advanceTimersByTime(4 * 60 * 1000);
    expect(getSession('user-1')).toBeUndefined();
  });

  it('startSessionCleanup và stopSessionCleanup hoạt động ổn định', () => {
    startSessionCleanup();
    // Idempotent
    startSessionCleanup();

    createSession('user-1', 'guild-1', 'msg-1', 'chan-1');
    jest.advanceTimersByTime(11 * 60 * 1000);

    stopSessionCleanup();
    expect(getSession('user-1')).toBeUndefined();
  });
});
