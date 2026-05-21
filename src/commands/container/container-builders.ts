import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ContainerSettings } from '../../types/settings.types.js';
import { buildContainer, buildTextOnlyContainer } from '../../utils/container.utils.js';
import { CONTAINER_COLOR_PRESETS } from './container-session.js';

// ─── Button Row Builders ───────────────────────────────────────

/**
 * Build hàng button 1: chỉnh sửa text & media.
 */
export function buildEditRow1(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('container_edit_lines')
      .setLabel('📝 Text Lines')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('container_edit_color')
      .setLabel('🎨 Accent Color')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('container_edit_media')
      .setLabel('🖼️ Media/GIF')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('container_edit_separator')
      .setLabel('➖ Separator')
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Build hàng button 2: text line management.
 */
export function buildLinesRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('container_lines_add')
      .setLabel('➕ Add Line')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('container_lines_edit')
      .setLabel('✏️ Edit Line')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('container_lines_remove')
      .setLabel('➖ Remove Line')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('container_lines_clear')
      .setLabel('🗑️ Clear All')
      .setStyle(ButtonStyle.Danger),
  );
}

/**
 * Build hàng button action: save/reset/cancel.
 */
export function buildActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('container_edit_save')
      .setLabel('💾 Save')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('container_edit_reset')
      .setLabel('🔄 Reset')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('container_edit_cancel')
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Primary),
  );
}

/**
 * Build toàn bộ rows buttons cho editor chính.
 */
export function buildAllEditorRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [buildEditRow1(), buildActionRow()];
}

/**
 * Build hàng button color presets.
 */
export function buildColorPresetRow(): ActionRowBuilder<ButtonBuilder> {
  const buttons: ButtonBuilder[] = CONTAINER_COLOR_PRESETS.map(
    (preset: { label: string; value: number }, index: number) =>
      new ButtonBuilder()
        .setCustomId(`container_color_preset_${index}`)
        .setLabel(preset.label)
        .setStyle(ButtonStyle.Secondary),
  );

  buttons.push(
    new ButtonBuilder()
      .setCustomId('container_color_custom')
      .setLabel('🎯 Custom')
      .setStyle(ButtonStyle.Secondary),
  );

  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

/**
 * Build hàng button back (quay lại editor chính).
 */
export function buildBackRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('container_back')
      .setLabel('⬅️ Quay lại')
      .setStyle(ButtonStyle.Primary),
  );
}

/**
 * Build hàng buttons cho lines submenu + back.
 */
export function buildLinesSubmenuRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [buildLinesRow(), buildBackRow()];
}

/**
 * Build hàng buttons cho color picker + back.
 */
export function buildColorPickerRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [buildColorPresetRow(), buildBackRow()];
}

// ─── Modal Builders ────────────────────────────────────────────

/**
 * Build modal nhập text ngắn.
 */
export function buildTextModal(
  customId: string,
  label: string,
  placeholder: string,
  value: string,
): ModalBuilder {
  const textInput = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(placeholder)
    .setValue(value);

  return new ModalBuilder()
    .setCustomId(`container_modal_${customId}`)
    .setTitle(`Chỉnh sửa ${label}`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
}

/**
 * Build modal nhập text dài (cho content line).
 */
export function buildLongTextModal(
  customId: string,
  label: string,
  placeholder: string,
  value: string,
): ModalBuilder {
  const textInput = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(placeholder)
    .setMaxLength(4000)
    .setValue(value);

  return new ModalBuilder()
    .setCustomId(`container_modal_${customId}`)
    .setTitle(`Chỉnh sửa ${label}`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
}

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
    .setPlaceholder('https://example.com/image.gif hoặc attachment://file.gif')
    .setValue(currentUrl || '');

  const descInput = new TextInputBuilder()
    .setCustomId('media_description')
    .setLabel('Mô tả (tùy chọn)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Alt text cho ảnh')
    .setValue(currentDesc || '');

  return new ModalBuilder()
    .setCustomId('container_modal_media')
    .setTitle('Chỉnh sửa Media/GIF')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(urlInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    );
}

/**
 * Build modal edit line (nhập index + nội dung mới trong 1 modal).
 */
export function buildEditLineModal(lineCount: number): ModalBuilder {
  const indexInput = new TextInputBuilder()
    .setCustomId('edit_line_index')
    .setLabel(`Index dòng muốn sửa (0-${lineCount - 1})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ví dụ: 0')
    .setRequired(true);

  const contentInput = new TextInputBuilder()
    .setCustomId('edit_line_content')
    .setLabel('Nội dung mới')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Nhập nội dung mới cho dòng')
    .setMaxLength(4000)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId('container_modal_edit_line')
    .setTitle('Chỉnh sửa dòng text')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(indexInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput),
    );
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
        tag: 'MockUser#0000',
        username: 'MockUser',
        createdTimestamp: Date.now(),
        // WHY: buildContainer cần displayAvatarURL để render avatar member vào MediaGallery.
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
      },
      joinedAt: new Date(),
    } as any,
    guild: {
      name: 'Preview Server',
      memberCount: 0,
    } as any,
  };

  return buildContainer(draft, mockContext);
}

// ─── Info Containers ───────────────────────────────────────────

/**
 * Build info container cho lines submenu.
 */
export function buildLinesInfoContainer(contentLines: string[]) {
  const lineCount = contentLines.length;
  const linesList =
    contentLines.map((line, i) => `\`${i}\` ${line}`).join('\n') || '(không có dòng nào)';

  return buildTextOnlyContainer(
    `📝 Quản lý Text Lines\n\nSố dòng: **${lineCount}**\n\nDanh sách:\n${linesList}`,
  );
}

/**
 * Build info container cho color picker.
 */
export function buildColorPickerInfoContainer(accentColor: number) {
  const currentHex = '#' + accentColor.toString(16).padStart(6, '0');

  return buildTextOnlyContainer(
    `🎨 Chọn Accent Color\n\nMàu hiện tại: \`${currentHex}\`\n\nNhấn vào màu muốn chọn, hoặc "Custom" để nhập mã màu tùy chỉnh.`,
    accentColor,
  );
}
