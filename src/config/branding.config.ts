/**
 * Cấu hình thương hiệu, Watermark và liên kết cộng đồng của Bot
 */

export const SUPPORT_DISCORD_INVITE =
  process.env.SUPPORT_DISCORD_INVITE || 'https://discord.gg/vz6w6c3Xe3';

export const BOT_BRANDING = {
  name: 'Delta Bot',
  author: 'Le Pham Dang Khoa',
  supportDiscordInvite: SUPPORT_DISCORD_INVITE,
  githubRepo: 'https://github.com/KhoaLPD/bot-klb',
  watermarkText: `⚡ Powered by Bot KLB • Delta Force Automation & VietQR Billing | ${SUPPORT_DISCORD_INVITE}`,
};
