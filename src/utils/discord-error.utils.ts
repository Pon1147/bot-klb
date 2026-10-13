/**
 * Utility xác định các lỗi interaction phổ biến từ Discord API
 * có thể an toàn bỏ qua (expired token, double acknowledgment, invalid webhook).
 */
export function isIgnorableInteractionError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { code?: number | string; message?: string };
  const code = err.code;
  const msg = error instanceof Error ? error.message : String(error);

  return (
    code === 10062 ||
    code === 40060 ||
    code === 50027 ||
    msg.includes('10062') ||
    msg.includes('Unknown interaction') ||
    msg.includes('40060') ||
    msg.includes('Interaction has already been acknowledged') ||
    msg.includes('50027') ||
    msg.includes('Invalid Webhook Token')
  );
}
