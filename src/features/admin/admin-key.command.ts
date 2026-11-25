/**
 * /admin-key — Lệnh quản lý mã bản quyền Delta Force dành cho Bot Owner.
 * Phân quyền: Policy.BOT_OWNER
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import Database from 'better-sqlite3';
import { generateSubscriptionKey } from '../subscription/subscription.service.js';
import { SubscriptionKeyRecord } from '../../database/subscription.db.js';
import { BOT_BRANDING } from '../../config/branding.config.js';

export const data = new SlashCommandBuilder()
  .setName('admin-key')
  .setNameLocalizations({
    vi: 'quan-ly-key',
  })
  .setDescription('Quản lý mã bản quyền Delta Force (Chỉ dành cho Bot Owner).')
  .setDescriptionLocalizations({
    'en-US': 'Manage Delta Force subscription license keys (Bot Owner only).',
  })
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setNameLocalizations({ vi: 'tao' })
      .setDescription('Sinh mã bản quyền mới.')
      .setDescriptionLocalizations({ 'en-US': 'Generate a new subscription license key.' })
      .addIntegerOption((opt) =>
        opt
          .setName('duration_days')
          .setNameLocalizations({ vi: 'so_ngay' })
          .setDescription('Số ngày hiệu lực bản quyền (ví dụ: 30, 90, 180).')
          .setDescriptionLocalizations({ 'en-US': 'Duration in days (e.g. 30, 90, 180).' })
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(3650),
      )
      .addStringOption((opt) =>
        opt
          .setName('note')
          .setNameLocalizations({ vi: 'ghi_chu' })
          .setDescription('Ghi chú cấp key (tên server, người nhận).')
          .setDescriptionLocalizations({ 'en-US': 'Note for key issuance.' }),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('expires_days')
          .setNameLocalizations({ vi: 'han_kich_hoat' })
          .setDescription('Hạn chót kích hoạt key tính theo ngày (bỏ trống = vĩnh viễn).')
          .setDescriptionLocalizations({ 'en-US': 'Days until key expires if unredeemed.' })
          .setMinValue(1),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setNameLocalizations({ vi: 'danh-sach' })
      .setDescription('Xem danh sách mã bản quyền đã cấp.')
      .setDescriptionLocalizations({ 'en-US': 'List generated license keys.' })
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setNameLocalizations({ vi: 'trang_thai' })
          .setDescription('Lọc theo trạng thái.')
          .setDescriptionLocalizations({ 'en-US': 'Filter by status.' })
          .addChoices(
            { name: 'Tất cả (All)', value: 'all' },
            { name: 'Chưa dùng (Unused)', value: 'unused' },
            { name: 'Đã dùng (Used)', value: 'used' },
            { name: 'Đã thu hồi (Revoked)', value: 'revoked' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('revoke')
      .setNameLocalizations({ vi: 'thu-hoi' })
      .setDescription('Thu hồi một mã bản quyền chưa sử dụng.')
      .setDescriptionLocalizations({ 'en-US': 'Revoke an unused license key.' })
      .addStringOption((opt) =>
        opt
          .setName('key')
          .setNameLocalizations({ vi: 'ma_key' })
          .setDescription('Mã key cần thu hồi (KLB-XXXX-XXXX-XXXX-XXXX).')
          .setDescriptionLocalizations({ 'en-US': 'Key to revoke.' })
          .setRequired(true),
      ),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  database?: Database.Database,
): Promise<void> {
  const db = (database ?? interaction.client.database) as Database.Database;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'create') {
    const durationDays = interaction.options.getInteger('duration_days', true);
    const note = interaction.options.getString('note');
    const expiresDays = interaction.options.getInteger('expires_days');
    const expiresAt = expiresDays ? Date.now() + expiresDays * 86_400_000 : null;

    const keyRecord = generateSubscriptionKey(db, {
      durationDays,
      createdBy: interaction.user.id,
      note,
      expiresAt,
    });

    const embed = new EmbedBuilder()
      .setTitle('🔑 Sinh Mã Bản Quyền Mới Thành Công')
      .setColor(0x2ecc71)
      .setDescription(
        `Mã key bản quyền đã được lưu vào hệ thống:\n\n` +
          `\`\`\`\n${keyRecord.key}\n\`\`\`\n` +
          `*(Chạm hoặc bôi đen chuỗi phía trên để sao chép)*`,
      )
      .addFields(
        { name: 'Thời hạn', value: `**+${keyRecord.duration_days} ngày**`, inline: true },
        { name: 'Trạng thái', value: '`Chưa dùng (unused)`', inline: true },
        {
          name: 'Hạn chót kích hoạt',
          value: keyRecord.expires_at
            ? `<t:${Math.floor(keyRecord.expires_at / 1000)}:R>`
            : '*Vĩnh viễn*',
          inline: true,
        },
        { name: 'Ghi chú', value: keyRecord.note || '*Không có*', inline: false },
      )
      .setFooter({ text: BOT_BRANDING.watermarkText })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  if (subcommand === 'list') {
    const filter = interaction.options.getString('status') || 'all';
    let query = 'SELECT * FROM subscription_keys';
    const params: unknown[] = [];
    if (filter !== 'all') {
      query += ' WHERE status = ?';
      params.push(filter);
    }
    query += ' ORDER BY created_at DESC LIMIT 15';

    const keys = db.prepare(query).all(...params) as SubscriptionKeyRecord[];

    if (keys.length === 0) {
      await interaction.reply({
        content: `ℹ️ Không có mã bản quyền nào phù hợp với bộ lọc \`${filter}\`.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const statusBadge: Record<string, string> = {
      unused: '🟢 Chưa dùng',
      used: '🔵 Đã dùng',
      revoked: '🔴 Đã thu hồi',
    };

    const lines = keys.map((k, i) => {
      const status = statusBadge[k.status] || k.status;
      const targetGuild = k.used_by_guild ? ` • Guild: \`${k.used_by_guild}\`` : '';
      return `\`${i + 1}.\` \`${k.key}\` — **${k.duration_days}d** (${status})${targetGuild}${k.note ? `\n> *Ghi chú: ${k.note}*` : ''}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`📋 Danh Sách Mã Bản Quyền (${keys.length} gần nhất)`)
      .setColor(0x3498db)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Lọc: ${filter} • ${BOT_BRANDING.watermarkText}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  if (subcommand === 'revoke') {
    const key = interaction.options.getString('key', true).trim().toUpperCase();
    const updateRes = db
      .prepare(
        "UPDATE subscription_keys SET status = 'revoked' WHERE key = ? AND status = 'unused'",
      )
      .run(key);

    if (updateRes.changes === 1) {
      await interaction.reply({
        content: `✅ Đã thu hồi thành công mã bản quyền \`${key}\`. Mã này sẽ không thể kích hoạt được nữa.`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: `❌ Không thể thu hồi mã \`${key}\` (Mã không tồn tại hoặc đã được sử dụng trước đó).`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }
}
