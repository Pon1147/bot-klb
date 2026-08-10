/** Mask openid: giữ 4 ký tự đầu + 4 ký tự cuối, phần giữa thay bằng **** */
export function maskString(str: string): string {
  return str.length > 8 ? `${str.slice(0, 4)}****${str.slice(-4)}` : '****';
}
