import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Guild,
  GuildMember,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ContainerSettings } from '../../types/settings.types.js';
import { buildContainer } from '../../utils/container.utils.js';
import {
  MAX_CONTAINER_TEXT_LENGTH,
  MEDIA_URL_PLACEHOLDER,
  MOCK_USER_TAG,
  MOCK_USER_NAME,
  DEFAULT_DISCORD_AVATAR,
} from '../../config/app.constants.js';
import { ContainerIds, ContainerModalPrefix } from './container-ids.js';

// ─── Button Row Builders ───────────────────────────────────────

/**
 * Build hàng button chính — tất cả property edit đều mở modal trực tiếp.
 * Không cần submenu navigation.
 */
export function buildMainEditorRow(draft: ContainerSettings): ActionRowBuilder<ButtonBuilder> {
  const linesLabel =
    draft.contentLines.length > 0 ? `${draft.contentLines.length} dòng` : 'Thêm dòng';

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ContainerIds.LINES)
      .setLabel(`📝 ${linesLabel}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ContainerIds.HEADER)
      .setLabel('📌 Header')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ContainerIds.COLOR)
      .setLabel(`🎨 ${draft.accentColor.toString(16).padStart(6, '0')}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ContainerIds.MEDIA)
      .setLabel(draft.mediaUrl ? '🖼️ Media ✓' : '🖼️ Media')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ContainerIds.SEPARATOR)
      .setLabel(draft.showSeparator ? '➖ Bỏ Sep' : '➖ Separator')
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Build hàng button action: save/reset/cancel.
 */
export function buildActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ContainerIds.SAVE)
      .setLabel('💾 Save')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(ContainerIds.RESET)
      .setLabel('🔄 Reset')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(ContainerIds.CANCEL)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Primary),
  );
}

/**
 * Build toàn bộ rows buttons cho editor chính.
 */
export function buildAllEditorRows(draft: ContainerSettings): ActionRowBuilder<ButtonBuilder>[] {
  return [buildMainEditorRow(draft), buildActionRow()];
}

// ─── Modal Builders ────────────────────────────────────────────

/**
 * Build modal nhập media URL + description.
 */
export function buildMediaModal(
  currentUrl: string | null,
  currentDesc: string | null,
): ModalBuilder {
  const urlInput = new TextInputBuilder()
    .setCustomId('media_url')
    .setLabel('URL ảnh/GIF')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(MEDIA_URL_PLACEHOLDER)
    .setValue(currentUrl || '');

  const descInput = new TextInputBuilder()
    .setCustomId('media_description')
    .setLabel('Mô tả (tùy chọn)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Văn bản thay thế cho ảnh')
    .setValue(currentDesc || '');

  return new ModalBuilder()
    .setCustomId(`${ContainerModalPrefix}media`)
    .setTitle('Chỉnh sửa Media/GIF')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    );
}

/**
 * Build modal quản lý tất cả lines trong 1 modal duy nhất.
 * Hiển thị textarea với tất cả lines, user có thể edit trực tiếp.
 * KHÔNG thêm prefix số — user submit raw content, tránh corrupt stored data.
 */
export function buildLinesModal(contentLines: string[]): ModalBuilder {
  const preview = contentLines.join('\n') || '(chưa có dòng nào)';

  const textarea = new TextInputBuilder()
    .setCustomId('lines_content')
    .setLabel('Text Lines (mỗi dòng 1 entry)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Dòng 1\nDòng 2\nDòng 3')
    .setMaxLength(MAX_CONTAINER_TEXT_LENGTH)
    .setValue(preview)
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(`${ContainerModalPrefix}lines`)
    .setTitle('Chỉnh sửa Text Lines')
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textarea));
}

/**
 * Build modal chọn accent color với preset buttons + custom input.
 */
export function buildColorModal(currentColor: number): ModalBuilder {
  const currentHex = '#' + currentColor.toString(16).padStart(6, '0');

  const colorInput = new TextInputBuilder()
    .setCustomId('color_value')
    .setLabel('Nhập mã màu (hoặc giữ nguyên để không đổi)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(currentHex)
    .setValue(currentHex);

  return new ModalBuilder()
    .setCustomId(`${ContainerModalPrefix}color`)
    .setTitle('Chọn Accent Color')
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput));
}

/**
 * Build modal chỉnh sửa header template.
 */
export function buildHeaderModal(currentHeader: string | null): ModalBuilder {
  const headerInput = new TextInputBuilder()
    .setCustomId('header_value')
    .setLabel('Header template')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Chào mừng {user} đến với {guild}!')
    .setMaxLength(MAX_CONTAINER_TEXT_LENGTH)
    .setValue(currentHeader || '')
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(`${ContainerModalPrefix}header`)
    .setTitle('Chỉnh sửa Header')
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(headerInput));
}

// ─── Preview Builder ───────────────────────────────────────────

/**
 * Build live preview container từ draft settings.
 *
 * WHY: Dùng buildContainer với mock context để resolve template variables.
 */
export function buildLivePreviewContainer(
  draft: ContainerSettings,
): ReturnType<typeof buildContainer> {
  const mockContext = {
    member: {
      user: {
        tag: MOCK_USER_TAG,
        username: MOCK_USER_NAME,
        createdTimestamp: Date.now(),
        // WHY: buildContainer cần displayAvatarURL để render avatar member vào MediaGallery.
        displayAvatarURL: () => DEFAULT_DISCORD_AVATAR,
      },
      joinedAt: new Date(),
    } as GuildMember,
    guild: {
      name: 'Preview Server',
      memberCount: 0,
    } as Guild,
  };

  return buildContainer(draft, mockContext);
}

// ─── Editor Utilities ──────────────────────────────────────────

/**
 * Update message editor với draft mới (live preview).
 *
 * WHY: Dùng interaction.update() thay vì delete+recreate để giữ message ID,
 * tránh lose collector và UX mượt hơn (không flicker).
 */
export async function updateEditorMessage(
  interaction: import('discord.js').ButtonInteraction,
  draft: ContainerSettings,
): Promise<void> {
  const preview = buildLivePreviewContainer(draft);

  await interaction.update({
    components: [...preview.toJSON(), ...buildAllEditorRows(draft)],
    flags: preview.flags,
    files: preview.files,
  });
}
