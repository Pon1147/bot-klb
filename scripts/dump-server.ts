/**
 * Script Node.js trích xuất toàn bộ cấu trúc Server (Categories, Channels, IDs, Types).
 * Sử dụng Bot Token để kết nối và tự động xuất file Markdown.
 *
 * Cách dùng:
 *   npm run dump:server
 *   npm run dump:server -- <guild_id>
 *   npx tsx scripts/dump-server.ts [guild_id]
 */

import {
  Client,
  GatewayIntentBits,
  ChannelType,
  GuildChannel,
  CategoryChannel,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { botConfig } from '../src/config/bot.config.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('DumpServer');

const CHANNEL_TYPE_LABELS: Partial<Record<ChannelType, { icon: string; label: string }>> = {
  [ChannelType.GuildText]: { icon: '💬 #', label: 'Văn bản' },
  [ChannelType.GuildVoice]: { icon: '🔊', label: 'Thoại' },
  [ChannelType.GuildAnnouncement]: { icon: '📢 #', label: 'Thông báo' },
  [ChannelType.GuildStageVoice]: { icon: '🎭', label: 'Sân khấu' },
  [ChannelType.GuildForum]: { icon: '🧵 #', label: 'Diễn đàn' },
  [ChannelType.GuildMedia]: { icon: '🖼️ #', label: 'Media' },
  [ChannelType.PublicThread]: { icon: '🧵 #', label: 'Luồng công khai' },
  [ChannelType.PrivateThread]: { icon: '🔒 #', label: 'Luồng riêng tư' },
};

function getChannelLabel(type: ChannelType): string {
  const meta = CHANNEL_TYPE_LABELS[type];
  if (meta) return `${meta.icon} (${meta.label})`;
  return `📁 (Type ${type})`;
}

async function dumpGuild(guildId: string, client: Client): Promise<string> {
  const guild = await client.guilds.fetch({ guild: guildId, force: true });
  if (!guild) {
    throw new Error(`Không tìm thấy guild với ID: ${guildId}`);
  }

  const channels = await guild.channels.fetch();
  logger.info(`Đang trích xuất cấu trúc máy chủ: "${guild.name}" (ID: ${guild.id})...`);

  // Tách categories và channels
  const categories: CategoryChannel[] = [];
  const normalChannels: GuildChannel[] = [];

  for (const channel of channels.values()) {
    if (!channel) continue;
    if (channel.type === ChannelType.GuildCategory) {
      categories.push(channel as CategoryChannel);
    } else {
      normalChannels.push(channel as GuildChannel);
    }
  }

  // Sắp xếp Category theo position
  categories.sort((a, b) => a.position - b.position);

  // Group các kênh theo categoryId
  const channelsByCategory = new Map<string | null, GuildChannel[]>();
  channelsByCategory.set(null, []); // Nhóm không có danh mục

  for (const cat of categories) {
    channelsByCategory.set(cat.id, []);
  }

  for (const ch of normalChannels) {
    const parentId = ch.parentId;
    if (parentId && channelsByCategory.has(parentId)) {
      channelsByCategory.get(parentId)!.push(ch);
    } else {
      channelsByCategory.get(null)!.push(ch);
    }
  }

  // Sắp xếp các kênh trong từng category theo position
  for (const list of channelsByCategory.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  // Tạo nội dung Markdown
  const lines: string[] = [];
  lines.push(`# 🏰 Cấu Trúc Máy Chủ: ${guild.name}`);
  lines.push('');
  lines.push(`- **Server ID:** \`${guild.id}\``);
  lines.push(`- **Tổng số kênh:** ${normalChannels.length} kênh (${categories.length} danh mục)`);
  lines.push(`- **Thời gian xuất:** ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} (UTC+7)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. Kênh không thuộc danh mục nào
  const noCatChannels = channelsByCategory.get(null) || [];
  if (noCatChannels.length > 0) {
    lines.push('## 📂 (Không có danh mục)');
    for (const ch of noCatChannels) {
      const typeInfo = CHANNEL_TYPE_LABELS[ch.type]?.icon || '•';
      lines.push(`- ${typeInfo} **${ch.name}** \`(ID: ${ch.id})\``);
    }
    lines.push('');
  }

  // 2. Kênh theo từng danh mục
  for (const cat of categories) {
    lines.push(`## 📁 ${cat.name} \`(ID: ${cat.id})\``);
    const catChannels = channelsByCategory.get(cat.id) || [];
    if (catChannels.length === 0) {
      lines.push('- _(Danh mục trống)_');
    } else {
      for (const ch of catChannels) {
        const typeInfo = CHANNEL_TYPE_LABELS[ch.type]?.icon || '•';
        lines.push(`- ${typeInfo} **${ch.name}** \`(ID: ${ch.id})\``);
      }
    }
    lines.push('');
  }

  const markdown = lines.join('\n');
  const safeGuildName = guild.name.replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, '_');
  const fileName = `${safeGuildName}_channels.md`;
  const filePath = path.resolve(process.cwd(), fileName);

  fs.writeFileSync(filePath, markdown, 'utf-8');
  logger.info(`✅ Đã xuất cấu trúc thành công: ${filePath}`);
  return filePath;
}

async function main() {
  const targetGuildId = process.argv[2] || (botConfig.guildId !== '000000000000000000' ? botConfig.guildId : undefined);

  logger.info('Khởi động Discord Client để lấy cấu trúc server...');
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  await client.login(botConfig.token);
  logger.info(`Đăng nhập thành công bot: ${client.user?.tag}`);

  try {
    const guilds = await client.guilds.fetch();
    logger.info(`Bot hiện đang tham gia ${guilds.size} máy chủ.`);

    if (targetGuildId) {
      await dumpGuild(targetGuildId, client);
    } else {
      // Nếu không chỉ định guild, dump tất cả các server bot đang ở
      for (const oauthGuild of guilds.values()) {
        await dumpGuild(oauthGuild.id, client);
      }
    }
  } finally {
    client.destroy();
    logger.info('Hoàn tất và đóng kết nối.');
  }
}

main().catch((err) => {
  logger.error(`Lỗi khi trích xuất server: ${err.message}`, { err });
  process.exit(1);
});
