import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { ContainerSettings } from '../../types/settings.types.js';
import {
  buildContainer,
  buildErrorContainer,
  buildSuccessContainer,
  buildTextOnlyContainer,
} from '../../utils/container.utils.js';
import { cloneDefaultSettings } from '../../config/default.settings.js';
import { CONTAINER_COLORS } from '../../config/container.variables.js';

/**
 * Color presets cho container accent color picker.
 * Dựa trên CONTAINER_COLORS palette.
 */
const CONTAINER_COLOR_PRESETS = [
  { label: '🟣 Blurple', value: CONTAINER_COLORS.WELCOME },
  { label: '🔴 Red', value: CONTAINER_COLORS.LEAVE },
  { label: '🟢 Green', value: CONTAINER_COLORS.SUCCESS },
  { label: '🟡 Yellow', value: CONTAINER_COLORS.WARNING },
];

// ─── Types ─────────────────────────────────────────────────────

/**
 * Interface cho session edit container tạm thời.
 * Mỗi user có 1 session riêng để tránh conflict.
 */
interface ContainerEditSession {
  guildId: string;
  type: 'welcome' | 'leave';
  draft: ContainerSettings;
  messageId: string;
  channelId: string;
  createdAt: number;
}

/**
 * In-memory cache lưu draft container settings đang edit.
 * Key = userId để mỗi user có session riêng.
 *
 * WHY: Discord button interactions không lưu state giữa các nhấn,
 * nên cần cache tạm để giữ draft cho đến khi Save hoặc Cancel.
 */
const editSessions = new Map<string, ContainerEditSession>();

/**
 * Thời gian sống tối đa của 1 session (15 phút = 900000ms).
 * Discord giới hạn interaction timeout là 15 phút.
 */
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

// ─── Session Helpers ───────────────────────────────────────────

/**
 * Deep clone ContainerSettings để tránh mutate object gốc.
 */
function cloneContainerSettings(settings: ContainerSettings): ContainerSettings {
  return JSON.parse(JSON.stringify(settings));
}

/**
 * Kiểm tra session có còn sống không (chưa quá timeout).
 */
function isSessionValid(
  session: ContainerEditSession | undefined,
): session is ContainerEditSession {
  if (!session) return false;
  return Date.now() - session.createdAt < SESSION_TIMEOUT_MS;
}

/**
 * Tạo và lưu session edit mới.
 */
function createSession(
  userId: string,
  guildId: string,
  type: 'welcome' | 'leave',
  draft: ContainerSettings,
  messageId: string,
  channelId: string,
): ContainerEditSession {
  const session: ContainerEditSession = {
    guildId,
    type,
    draft,
    messageId,
    channelId,
    createdAt: Date.now(),
  };
  editSessions.set(userId, session);
  return session;
}

/**
 * Xóa session edit của user.
 */
function deleteSession(userId: string): void {
  editSessions.delete(userId);
}

// ─── Button Row Builders ───────────────────────────────────────

/**
 * Build hàng button 1: chỉnh sửa text & media.
 */
function buildEditRow1(): ActionRowBuilder<ButtonBuilder> {
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
function buildLinesRow(): ActionRowBuilder<ButtonBuilder> {
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
function buildActionRow(): ActionRowBuilder<ButtonBuilder> {
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
function buildAllEditorRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [buildEditRow1(), buildActionRow()];
}

/**
 * Build hàng button color presets.
 */
function buildColorPresetRow(): ActionRowBuilder<ButtonBuilder> {
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
function buildBackRow(): ActionRowBuilder<ButtonBuilder> {
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
function buildLinesSubmenuRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [buildLinesRow(), buildBackRow()];
}

/**
 * Build hàng buttons cho color picker + back.
 */
function buildColorPickerRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [buildColorPresetRow(), buildBackRow()];
}

// ─── Modal Builders ────────────────────────────────────────────

/**
 * Build modal nhập text ngắn.
 */
function buildTextModal(
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
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
    );
}

/**
 * Build modal nhập text dài (cho content line).
 */
function buildLongTextModal(
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
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
    );
}

/**
 * Build modal nhập media URL + description.
 */
function buildMediaModal(currentUrl: string | null, currentDesc: string | null): ModalBuilder {
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

// ─── Preview Builder ───────────────────────────────────────────

/**
 * Build live preview container từ draft settings.
 *
 * WHY: Dùng buildTextOnlyContainer thay vì buildContainer đầy đủ
 * vì preview không cần context member thật (không có {user} để resolve).
 * Thay thế variables bằng placeholder text.
 */
export function buildLivePreviewContainer(
  draft: ContainerSettings,
): ReturnType<typeof buildContainer> {
  // Tạo mock context để resolve template
  // WHY: Preview không cần context member thật (không có {user} để resolve lúc test).
  // buildContainer được mock trong tests nên mockContext này chỉ dùng khi chạy real code.
  const mockContext = {
    member: {
      user: {
        tag: 'MockUser#0000',
        username: 'MockUser',
        createdTimestamp: Date.now(),
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

// ─── Message Builders ──────────────────────────────────────────

/**
 * Gửi message editor ban đầu với preview + buttons.
 */
async function sendEditorMessage(
  interaction: ChatInputCommandInteraction,
  type: 'welcome' | 'leave',
  settings: ContainerSettings,
): Promise<void> {
  const draft = cloneContainerSettings(settings);
  const preview = buildLivePreviewContainer(draft);

  // Gửi message editor với container preview + buttons
  // WHY: Không dùng ephemeral, dùng flags thuần túy (ephemeral param đã deprecated)
  await interaction.reply({
    components: [...(preview.components as any), ...buildAllEditorRows()],
    flags: preview.flags,
    files: preview.files,
  });

  // WHY: interaction.reply() trả về ChatInputCommandInteraction, không phải Message
  // Cần dùng fetchReply() để lấy message ID thật
  const message = await interaction.fetchReply();
  const messageId = message.id;

  createSession(
    interaction.user.id,
    interaction.guild!.id,
    type,
    draft,
    messageId,
    interaction.channel!.id,
  );
}

/**
 * Update message editor với draft mới (live preview).
 *
 * WHY: Dùng interaction.update() thay vì delete+recreate để giữ message ID,
 * tránh lose collector và UX mượt hơn (không flicker).
 */
async function updateEditorMessage(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const preview = buildLivePreviewContainer(session.draft);

  await interaction.update({
    components: [...(preview.components as any), ...buildAllEditorRows()],
    flags: preview.flags,
    files: preview.files,
  });
}

// ─── Property Handlers ─────────────────────────────────────────

/**
 * Xử lý khi user nhấn button "Text Lines" (chuyển sang lines submenu).
 * Dùng Container V2 thay vì Embed.
 */
async function handleLinesSubmenu(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const lineCount = session.draft.contentLines.length;
  const linesList =
    session.draft.contentLines.map((line, i) => `\`${i}\` ${line}`).join('\n') ||
    '(không có dòng nào)';

  // Dùng Container V2 thay vì Embed
  const infoContainer = buildTextOnlyContainer(
    `📝 Quản lý Text Lines\n\nSố dòng: **${lineCount}**\n\nDanh sách:\n${linesList}`,
  );

  await interaction.update({
    components: [...(infoContainer.components as any), ...buildLinesSubmenuRows()],
    flags: infoContainer.flags,
  });
}

/**
 * Xử lý khi user nhấn button "Add Line".
 */
async function handleAddLine(interaction: ButtonInteraction): Promise<void> {
  const modal = buildLongTextModal(
    'new_line',
    'Nhập dòng text mới',
    'Ví dụ: Chào mừng {user} đến với {guild}!',
    '',
  );
  await interaction.showModal(modal);
}

/**
 * Build modal edit line (nhập index + nội dung mới trong 1 modal).
 */
function buildEditLineModal(session: ContainerEditSession): ModalBuilder {
  const lineCount = session.draft.contentLines.length;

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

/**
 * Xử lý khi user nhấn button "Edit Line".
 */
async function handleEditLine(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const lineCount = session.draft.contentLines.length;

  if (lineCount === 0) {
    const errorContainer = buildErrorContainer('Không có dòng nào để chỉnh sửa.');
    await interaction.reply({
      components: errorContainer.components as any,
      // WHY: Dùng flags | Ephemeral thay vì ephemeral: true (deprecated)
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = buildEditLineModal(session);
  await interaction.showModal(modal);
}

/**
 * Xử lý khi user nhấn button "Remove Line".
 */
async function handleRemoveLine(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const lineCount = session.draft.contentLines.length;

  if (lineCount === 0) {
    const errorContainer = buildErrorContainer('Không có dòng nào để xóa.');
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = buildTextModal(
    'line_remove_index',
    `Nhập index dòng muốn xóa (0-${lineCount - 1})`,
    'Ví dụ: 0',
    '',
  );
  await interaction.showModal(modal);
}

/**
 * Xử lý khi user nhấn button "Clear All Lines".
 */
async function handleClearLines(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  session.draft.contentLines = [];
  await updateEditorMessage(interaction, session);
}

/**
 * Xử lý khi user nhấn button "Accent Color" (chuyển sang color picker).
 * Dùng Container V2 thay vì Embed.
 */
async function handleColorPicker(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const currentHex = '#' + session.draft.accentColor.toString(16).padStart(6, '0');

  // Dùng Container V2 thay vì Embed
  const infoContainer = buildTextOnlyContainer(
    `🎨 Chọn Accent Color\n\nMàu hiện tại: \`${currentHex}\`\n\nNhấn vào màu muốn chọn, hoặc "Custom" để nhập mã màu tùy chỉnh.`,
    session.draft.accentColor,
  );

  await interaction.update({
    components: [...(infoContainer.components as any), ...buildColorPickerRows()],
    flags: infoContainer.flags,
  });
}

/**
 * Xử lý khi user chọn color preset.
 */
async function handleColorPresetSelect(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
  presetIndex: number,
): Promise<void> {
  const preset = CONTAINER_COLOR_PRESETS[presetIndex];
  if (!preset) return;

  session.draft.accentColor = preset.value;
  await updateEditorMessage(interaction, session);
}

/**
 * Xử lý khi user nhấn custom color button.
 */
async function handleCustomColorModal(interaction: ButtonInteraction): Promise<void> {
  const modal = buildTextModal(
    'custom_color',
    'Nhập mã màu Hex',
    'Ví dụ: #5865F2 hoặc 5865F2',
    '',
  );
  await interaction.showModal(modal);
}

/**
 * Xử lý khi user nhấn button "Separator" (toggle).
 */
async function handleSeparatorToggle(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  session.draft.showSeparator = !session.draft.showSeparator;
  await updateEditorMessage(interaction, session);
}

/**
 * Xử lý khi user nhấn button "Media/GIF" (mở modal).
 */
async function handleMediaEdit(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const modal = buildMediaModal(session.draft.mediaUrl, session.draft.mediaDescription);
  await interaction.showModal(modal);
}

// ─── Action Handlers ───────────────────────────────────────────

/**
 * Xử lý khi user nhấn button Save.
 */
async function handleSave(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  try {
    const settingsService = getSettingsService();

    settingsService.update(session.guildId, {
      [session.type]: {
        container: session.draft,
      },
    });

    deleteSession(interaction.user.id);

    const successContainer = buildSuccessContainer(
      `Đã lưu container "${session.type}" thành công!`,
    );
    await interaction.update({
      components: successContainer.components as any,
      flags: successContainer.flags,
    });
  } catch (error) {
    console.error('Error saving container settings:', error);
    const errorContainer = buildErrorContainer(`Lỗi khi lưu: ${(error as Error).message}`);
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
  }
}

/**
 * Xử lý khi user nhấn button Reset.
 */
async function handleReset(
  interaction: ButtonInteraction,
  session: ContainerEditSession,
): Promise<void> {
  const defaults = cloneDefaultSettings();
  session.draft = cloneContainerSettings(defaults[session.type].container);
  await updateEditorMessage(interaction, session);
}

/**
 * Xử lý khi user nhấn button Cancel.
 */
async function handleCancel(interaction: ButtonInteraction): Promise<void> {
  deleteSession(interaction.user.id);

  const cancelContainer = buildErrorContainer('Đã hủy bỏ chỉnh sửa.');
  await interaction.update({
    components: cancelContainer.components as any,
    flags: cancelContainer.flags,
  });
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Entry point: bắt đầu session edit container mới.
 */
export async function startInteractiveEdit(
  interaction: ChatInputCommandInteraction,
  type: 'welcome' | 'leave',
): Promise<void> {
  try {
    const settingsService = getSettingsService();
    const currentSettings = settingsService.get(interaction.guild!.id);
    const containerSettings = currentSettings[type].container;

    await sendEditorMessage(interaction, type, containerSettings);
  } catch (error) {
    console.error('Error starting container interactive edit:', error);
    if (!interaction.replied) {
      const errorContainer = buildErrorContainer(
        `Lỗi khi khởi tạo editor: ${(error as Error).message}`,
      );
      await interaction.reply({
        components: errorContainer.components as any,
        flags: errorContainer.flags | MessageFlags.Ephemeral,
      });
    }
  }
}

/**
 * Main handler cho tất cả button interactions trong container editor.
 */
export async function handleEditorButtonInteraction(
  interaction: ButtonInteraction,
): Promise<void> {
  const session = editSessions.get(interaction.user.id);

  if (!isSessionValid(session)) {
    const errorContainer = buildErrorContainer(
      'Session edit đã hết hạn. Vui lòng bắt đầu lại với /container edit.',
    );
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const customId = interaction.customId;

  // ── Navigation: quay lại từ submenu ──
  if (customId === 'container_back') {
    await updateEditorMessage(interaction, session);
    return;
  }

  // ── Actions ──
  if (customId === 'container_edit_save') {
    await handleSave(interaction, session);
    return;
  }

  if (customId === 'container_edit_reset') {
    await handleReset(interaction, session);
    return;
  }

  if (customId === 'container_edit_cancel') {
    await handleCancel(interaction);
    return;
  }

  // ── Property Editors ──
  if (customId === 'container_edit_lines') {
    await handleLinesSubmenu(interaction, session);
    return;
  }

  if (customId === 'container_edit_color') {
    await handleColorPicker(interaction, session);
    return;
  }

  if (customId === 'container_edit_separator') {
    await handleSeparatorToggle(interaction, session);
    return;
  }

  if (customId === 'container_edit_media') {
    await handleMediaEdit(interaction, session);
    return;
  }

  // ── Lines Submenu ──
  if (customId === 'container_lines_add') {
    await handleAddLine(interaction);
    return;
  }

  if (customId === 'container_lines_edit') {
    await handleEditLine(interaction, session);
    return;
  }

  if (customId === 'container_lines_remove') {
    await handleRemoveLine(interaction, session);
    return;
  }

  if (customId === 'container_lines_clear') {
    await handleClearLines(interaction, session);
    return;
  }

  // ── Color Picker ──
  if (customId.startsWith('container_color_preset_')) {
    const index = parseInt(customId.replace('container_color_preset_', ''), 10);
    await handleColorPresetSelect(interaction, session, index);
    return;
  }

  if (customId === 'container_color_custom') {
    await handleCustomColorModal(interaction);
    return;
  }

  console.warn(`Unknown container editor button: ${customId}`);
}

/**
 * Handler cho modal submissions trong container editor.
 */
export async function handleEditorModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const session = editSessions.get(interaction.user.id);

  if (!isSessionValid(session)) {
    const errorContainer = buildErrorContainer('Session edit đã hết hạn.');
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
    return;
  }

  const modalId = interaction.customId.replace('container_modal_', '');

  try {
    if (modalId === 'new_line') {
      const value = interaction.fields.getTextInputValue('new_line');
      if (value) {
        session.draft.contentLines.push(value);
      }
    } else if (modalId === 'edit_line') {
      const indexValue = interaction.fields.getTextInputValue('edit_line_index');
      const index = parseInt(indexValue, 10);
      if (isNaN(index) || index < 0 || index >= session.draft.contentLines.length) {
        const errorContainer = buildErrorContainer(`Index không hợp lệ: "${indexValue}".`);
        await interaction.reply({
          components: errorContainer.components as any,
          flags: errorContainer.flags | MessageFlags.Ephemeral,
        });
        return;
      }
      const newContent = interaction.fields.getTextInputValue('edit_line_content');
      session.draft.contentLines[index] = newContent;
    } else if (modalId === 'line_remove_index') {
      const value = interaction.fields.getTextInputValue('line_remove_index');
      const index = parseInt(value, 10);
      if (isNaN(index) || index < 0 || index >= session.draft.contentLines.length) {
        const errorContainer = buildErrorContainer(`Index không hợp lệ: "${value}".`);
        await interaction.reply({
          components: errorContainer.components as any,
          flags: errorContainer.flags | MessageFlags.Ephemeral,
        });
        return;
      }
      session.draft.contentLines.splice(index, 1);
    } else if (modalId === 'custom_color') {
      const value = interaction.fields.getTextInputValue('custom_color');
      const hex = value.replace('#', '');
      const parsed = parseInt(hex, 16);
      if (isNaN(parsed)) {
        const errorContainer = buildErrorContainer(
          `Mã màu không hợp lệ: "${value}". Dùng định dạng #RRGGBB.`,
        );
        await interaction.reply({
          components: errorContainer.components as any,
          flags: errorContainer.flags | MessageFlags.Ephemeral,
        });
        return;
      }
      session.draft.accentColor = parsed;
    } else if (modalId === 'media') {
      const urlValue = interaction.fields.getTextInputValue('media_url');
      const descValue = interaction.fields.getTextInputValue('media_description');
      session.draft.mediaUrl = urlValue || null;
      session.draft.mediaDescription = descValue || null;
    } else {
      console.warn(`Unknown container modal submission: ${modalId}`);
      const errorContainer = buildErrorContainer('Modal không hợp lệ.');
      await interaction.reply({
        components: errorContainer.components as any,
        flags: errorContainer.flags | MessageFlags.Ephemeral,
      });
      return;
    }

    // Sau khi submit modal, dùng deferUpdate để không gửi reply
    await interaction.deferUpdate();
  } catch (error) {
    console.error('Error handling container modal submission:', error);
    const errorContainer = buildErrorContainer(`Lỗi khi xử lý: ${(error as Error).message}`);
    await interaction.reply({
      components: errorContainer.components as any,
      flags: errorContainer.flags | MessageFlags.Ephemeral,
    });
  }
}

/**
 * Export editSessions cho mục đích testing.
 */
export { editSessions };