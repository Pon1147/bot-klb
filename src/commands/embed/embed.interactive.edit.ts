import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction,
} from 'discord.js';
import { getSettingsService } from '../../services/settings.service.js';
import { EmbedSettings } from '../../types/settings.types.js';
import {
  buildDraftPreviewEmbed,
  buildEditorInfoEmbed,
  COLOR_PRESETS,
  colorToHex,
  parseColorForEmbed,
} from '../../utils/embed.preview.utils.js';
import { buildErrorEmbed, buildSuccessEmbed } from '../../utils/embed.utils.js';
import { cloneDefaultSettings } from '../../config/default.settings.js';

/**
 * Interface cho session edit tạm thời.
 * Mỗi user có 1 session riêng để tránh conflict.
 */
interface EditSession {
  guildId: string;
  type: 'welcome' | 'leave';
  draft: EmbedSettings;
  messageId: string;
  channelId: string;
  createdAt: number;
}

/**
 * In-memory cache lưu draft settings đang edit.
 * Key = userId để mỗi user có session riêng.
 *
 * WHY: Discord button interactions không lưu state giữa các nhấn,
 * nên cần cache tạm để giữ draft cho đến khi Save hoặc Cancel.
 */
const editSessions = new Map<string, EditSession>();

/**
 * Thời gian sống tối đa của 1 session (15 phút = 900000ms).
 * Discord giới hạn interaction timeout là 15 phút.
 */
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Deep clone EmbedSettings để tránh mutate object gốc.
 */
function cloneEmbedSettings(settings: EmbedSettings): EmbedSettings {
  return JSON.parse(JSON.stringify(settings));
}

/**
 * Kiểm tra session có còn sống không (chưa quá timeout).
 */
function isSessionValid(session: EditSession | undefined): session is EditSession {
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
  draft: EmbedSettings,
  messageId: string,
  channelId: string,
): EditSession {
  const session: EditSession = {
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
 * Build hàng button chính (hàng 1: edit properties).
 */
function buildEditRow1(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embed_edit_title').setLabel('📝 Title').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_edit_description').setLabel('📄 Desc').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_edit_color').setLabel('🎨 Color').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_edit_footer').setLabel('🦶 Footer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_edit_thumbnail').setLabel('📌 Thumb').setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Build hàng button chính (hàng 2: edit properties tiếp).
 */
function buildEditRow2(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embed_edit_image').setLabel('🖼️ Image').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_edit_url').setLabel('🔗 URL').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_edit_timestamp').setLabel('⏰ Time').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_edit_fields').setLabel('📎 Fields').setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Build hàng button action (hàng 3: save/reset/cancel).
 */
function buildActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embed_edit_save').setLabel('💾 Save').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('embed_edit_reset').setLabel('🔄 Reset').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('embed_edit_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Primary),
  );
}

/**
 * Build toàn bộ rows buttons cho editor.
 */
function buildAllEditorRows(): ActionRowBuilder<ButtonBuilder>[] {
  return [buildEditRow1(), buildEditRow2(), buildActionRow()];
}

/**
 * Build hàng button color presets (6 màu + custom).
 */
function buildColorPresetRow(): ActionRowBuilder<ButtonBuilder> {
  const buttons: ButtonBuilder[] = COLOR_PRESETS.map((preset, index) =>
    new ButtonBuilder()
      .setCustomId(`embed_color_preset_${index}`)
      .setLabel(preset.label)
      .setStyle(ButtonStyle.Secondary),
  );

  buttons.push(
    new ButtonBuilder().setCustomId('embed_color_custom').setLabel('🎯 Custom').setStyle(ButtonStyle.Secondary),
  );

  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

/**
 * Build hàng button back cho color picker.
 */
function buildColorBackRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embed_color_back').setLabel('⬅️ Quay lại').setStyle(ButtonStyle.Primary),
  );
}

/**
 * Build hàng button fields submenu.
 */
function buildFieldsSubmenuRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embed_fields_add').setLabel('➕ Add').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('embed_fields_remove').setLabel('➖ Remove').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('embed_fields_clear').setLabel('🗑️ Clear').setStyle(ButtonStyle.Danger),
  );
}

/**
 * Build hàng button back cho fields submenu.
 */
function buildFieldsBackRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embed_fields_back').setLabel('⬅️ Quay lại').setStyle(ButtonStyle.Primary),
  );
}

// ─── Modal Builders ────────────────────────────────────────────

/**
 * Build modal nhập text ngắn.
 */
function buildTextModal(customId: string, label: string, placeholder: string, value?: string): ModalBuilder {
  const textInput = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(placeholder);

  if (value !== undefined && value !== null) {
    textInput.setValue(value);
  }

  return new ModalBuilder()
    .setCustomId(`modal_${customId}`)
    .setTitle(`Chỉnh sửa ${label}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
    );
}

/**
 * Build modal nhập text dài (dùng cho description).
 */
function buildLongTextModal(customId: string, label: string, placeholder: string, value?: string): ModalBuilder {
  const textInput = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(placeholder)
    .setMaxLength(4096);

  if (value !== undefined && value !== null) {
    textInput.setValue(value);
  }

  return new ModalBuilder()
    .setCustomId(`modal_${customId}`)
    .setTitle(`Chỉnh sửa ${label}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
    );
}

/**
 * Build modal thêm field mới.
 */
function buildFieldAddModal(): ModalBuilder {
  const nameInput = new TextInputBuilder()
    .setCustomId('field_name')
    .setLabel('Tên field')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ví dụ: Thông tin')
    .setRequired(true);

  const valueInput = new TextInputBuilder()
    .setCustomId('field_value')
    .setLabel('Giá trị field')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Ví dụ: {memberCount}, {member}...')
    .setRequired(true);

  const inlineInput = new TextInputBuilder()
    .setCustomId('field_inline')
    .setLabel('Inline? (true/false)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('true hoặc false')
    .setValue('false')
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId('modal_add_field')
    .setTitle('Thêm Field Mới')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(valueInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inlineInput),
    );
}

// ─── Message Builders ──────────────────────────────────────────

/**
 * Gửi message editor ban đầu với preview + buttons.
 */
async function sendEditorMessage(
  interaction: ChatInputCommandInteraction,
  type: 'welcome' | 'leave',
  settings: EmbedSettings,
): Promise<void> {
  const draft = cloneEmbedSettings(settings);
  const previewEmbed = buildDraftPreviewEmbed(draft);
  const infoEmbed = buildEditorInfoEmbed(type, draft);

  // Gửi message editor với buttons
  await interaction.reply({
    embeds: [infoEmbed, previewEmbed],
    components: buildAllEditorRows(),
    ephemeral: false,
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
  session: EditSession,
): Promise<void> {
  const previewEmbed = buildDraftPreviewEmbed(session.draft);
  const infoEmbed = buildEditorInfoEmbed(session.type, session.draft);

  await interaction.update({
    embeds: [infoEmbed, previewEmbed],
    components: buildAllEditorRows(),
  });
}

// ─── Property Handlers ─────────────────────────────────────────

/**
 * Xử lý khi user nhấn button edit property (mở modal nhập text).
 */
async function handleTextPropertyEdit(
  interaction: ButtonInteraction,
  session: EditSession,
  property: 'title' | 'description' | 'footer' | 'image' | 'url',
): Promise<void> {
  const currentValue = session.draft[property] as string | null | undefined;

  if (property === 'description') {
    const modal = buildLongTextModal(
      property,
      `Nhập ${property} mới`,
      `Giá trị hiện tại: ${currentValue || '(trống)'}`,
      currentValue as string | undefined,
    );
    await interaction.showModal(modal);
  } else {
    const modal = buildTextModal(
      property,
      `Nhập ${property} mới`,
      `Giá trị hiện tại: ${currentValue || '(trống)'}`,
      currentValue as string | undefined,
    );
    await interaction.showModal(modal);
  }
}

/**
 * Xử lý khi user nhấn button toggle timestamp.
 */
async function handleTimestampToggle(
  interaction: ButtonInteraction,
  session: EditSession,
): Promise<void> {
  session.draft.timestamp = !session.draft.timestamp;
  await updateEditorMessage(interaction, session);
}

/**
 * Xử lý khi user nhấn button toggle thumbnail.
 * Cycle: true (avatar) -> custom URL modal -> false (off)
 */
async function handleThumbnailToggle(
  interaction: ButtonInteraction,
  session: EditSession,
): Promise<void> {
  const current = session.draft.thumbnail;

  if (current === true) {
    // Mở modal nhập URL custom
    const modal = buildTextModal(
      'thumbnail_url',
      'Nhập URL thumbnail custom',
      'Ví dụ: https://example.com/image.png',
      '',
    );
    await interaction.showModal(modal);
  } else if (current === false || current === '') {
    // Chuyển sang avatar member
    session.draft.thumbnail = true;
    await updateEditorMessage(interaction, session);
  } else {
    // Đang custom URL -> tắt
    session.draft.thumbnail = false;
    await updateEditorMessage(interaction, session);
  }
}

/**
 * Xử lý khi user nhấn button color (chuyển sang color picker view).
 */
async function handleColorPicker(
  interaction: ButtonInteraction,
  session: EditSession,
): Promise<void> {
  const currentColor = colorToHex(session.draft.color);

  const colorInfoEmbed = new EmbedBuilder()
    .setTitle('🎨 Chọn Màu Embed')
    .setDescription(`Màu hiện tại: \`${currentColor}\`\n\nNhấn vào màu muốn chọn, hoặc "Custom" để nhập mã màu tùy chỉnh.`)
    .setColor(parseColorForEmbed(session.draft.color))
    .setTimestamp();

  await interaction.update({
    embeds: [colorInfoEmbed],
    components: [buildColorPresetRow(), buildColorBackRow()],
  });
}

/**
 * Xử lý khi user chọn color preset.
 */
async function handleColorPresetSelect(
  interaction: ButtonInteraction,
  session: EditSession,
  presetIndex: number,
): Promise<void> {
  const preset = COLOR_PRESETS[presetIndex];
  if (!preset) return;

  session.draft.color = preset.value;
  await updateEditorMessage(interaction, session);
}

/**
 * Xử lý khi user nhấn custom color button.
 */
async function handleCustomColorModal(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal = buildTextModal(
    'custom_color',
    'Nhập mã màu Hex',
    'Ví dụ: #FF0000 hoặc FF0000',
    '',
  );
  await interaction.showModal(modal);
}

/**
 * Xử lý khi user nhấn button fields (chuyển sang fields submenu).
 */
async function handleFieldsSubmenu(
  interaction: ButtonInteraction,
  session: EditSession,
): Promise<void> {
  const fieldCount = session.draft.fields?.length ?? 0;
  const fieldsList = session.draft.fields?.map((f, i) =>
    `\`${i}\` **${f.name}**: ${f.value} (${f.inline ? 'inline' : 'block'})`,
  ).join('\n') || '(không có field nào)';

  const fieldsInfoEmbed = new EmbedBuilder()
    .setTitle('📎 Quản lý Fields')
    .setDescription(`Số field hiện tại: **${fieldCount}**\n\nDanh sách:\n${fieldsList}`)
    .setColor(0x0099FF)
    .setTimestamp();

  await interaction.update({
    embeds: [fieldsInfoEmbed],
    components: [buildFieldsSubmenuRow(), buildFieldsBackRow()],
  });
}

/**
 * Xử lý khi user nhấn button add field.
 */
async function handleAddField(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal = buildFieldAddModal();
  await interaction.showModal(modal);
}

/**
 * Xử lý khi user nhấn button remove field.
 */
async function handleRemoveField(
  interaction: ButtonInteraction,
  session: EditSession,
): Promise<void> {
  const fieldCount = session.draft.fields?.length ?? 0;

  if (fieldCount === 0) {
    await interaction.reply({
      embeds: [buildErrorEmbed('Không có field nào để xóa.')],
      ephemeral: true,
    });
    return;
  }

  const modal = buildTextModal(
    'field_remove_index',
    `Nhập index field muốn xóa (0-${fieldCount - 1})`,
    'Ví dụ: 0',
    '',
  );
  await interaction.showModal(modal);
}

/**
 * Xử lý khi user nhấn button clear all fields.
 */
async function handleClearFields(
  interaction: ButtonInteraction,
  session: EditSession,
): Promise<void> {
  session.draft.fields = [];
  await updateEditorMessage(interaction, session);
}

// ─── Action Handlers ───────────────────────────────────────────

/**
 * Xử lý khi user nhấn button Save.
 */
async function handleSave(
  interaction: ButtonInteraction,
  session: EditSession,
): Promise<void> {
  try {
    const settingsService = getSettingsService();

    settingsService.update(session.guildId, {
      [session.type]: {
        embed: session.draft,
      },
    });

    deleteSession(interaction.user.id);

    await interaction.update({
      embeds: [buildSuccessEmbed(`Đã lưu embed "${session.type}" thành công!`)],
      components: [],
    });
  } catch (error) {
    console.error('Error saving embed settings:', error);
    await interaction.reply({
      embeds: [buildErrorEmbed(`Lỗi khi lưu: ${(error as Error).message}`)],
      ephemeral: true,
    });
  }
}

/**
 * Xử lý khi user nhấn button Reset.
 */
async function handleReset(
  interaction: ButtonInteraction,
  session: EditSession,
): Promise<void> {
  const defaults = cloneDefaultSettings();
  session.draft = cloneEmbedSettings(defaults[session.type].embed);
  await updateEditorMessage(interaction, session);
}

/**
 * Xử lý khi user nhấn button Cancel.
 */
async function handleCancel(
  interaction: ButtonInteraction,
): Promise<void> {
  deleteSession(interaction.user.id);

  await interaction.update({
    embeds: [buildErrorEmbed('Đã hủy bỏ chỉnh sửa.')],
    components: [],
  });
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Entry point: bắt đầu session edit mới.
 */
export async function startInteractiveEdit(
  interaction: ChatInputCommandInteraction,
  type: 'welcome' | 'leave',
): Promise<void> {
  try {
    const settingsService = getSettingsService();
    const currentSettings = settingsService.get(interaction.guild!.id);
    const embedSettings = currentSettings[type].embed;

    await sendEditorMessage(interaction, type, embedSettings);
  } catch (error) {
    console.error('Error starting interactive edit:', error);
    if (!interaction.replied) {
      await interaction.reply({
        embeds: [buildErrorEmbed(`Lỗi khi khởi tạo editor: ${(error as Error).message}`)],
        ephemeral: true,
      });
    }
  }
}

/**
 * Main handler cho tất cả button interactions trong editor.
 */
export async function handleEditorButtonInteraction(
  interaction: ButtonInteraction,
): Promise<void> {
  const session = editSessions.get(interaction.user.id);

  if (!isSessionValid(session)) {
    await interaction.reply({
      embeds: [buildErrorEmbed('Session edit đã hết hạn. Vui lòng bắt đầu lại với /embed edit.')],
      ephemeral: true,
    });
    return;
  }

  const customId = interaction.customId;

  // ── Navigation: quay lại từ submenu ──
  if (customId === 'embed_color_back' || customId === 'embed_fields_back') {
    await updateEditorMessage(interaction, session);
    return;
  }

  // ── Actions ──
  if (customId === 'embed_edit_save') {
    await handleSave(interaction, session);
    return;
  }

  if (customId === 'embed_edit_reset') {
    await handleReset(interaction, session);
    return;
  }

  if (customId === 'embed_edit_cancel') {
    await handleCancel(interaction);
    return;
  }

  // ── Property Editors ──
  if (customId === 'embed_edit_title') {
    await handleTextPropertyEdit(interaction, session, 'title');
    return;
  }

  if (customId === 'embed_edit_description') {
    await handleTextPropertyEdit(interaction, session, 'description');
    return;
  }

  if (customId === 'embed_edit_footer') {
    await handleTextPropertyEdit(interaction, session, 'footer');
    return;
  }

  if (customId === 'embed_edit_image') {
    await handleTextPropertyEdit(interaction, session, 'image');
    return;
  }

  if (customId === 'embed_edit_url') {
    await handleTextPropertyEdit(interaction, session, 'url');
    return;
  }

  if (customId === 'embed_edit_timestamp') {
    await handleTimestampToggle(interaction, session);
    return;
  }

  if (customId === 'embed_edit_thumbnail') {
    await handleThumbnailToggle(interaction, session);
    return;
  }

  // ── Color Picker ──
  if (customId === 'embed_edit_color') {
    await handleColorPicker(interaction, session);
    return;
  }

  if (customId.startsWith('embed_color_preset_')) {
    const index = parseInt(customId.replace('embed_color_preset_', ''), 10);
    await handleColorPresetSelect(interaction, session, index);
    return;
  }

  if (customId === 'embed_color_custom') {
    await handleCustomColorModal(interaction);
    return;
  }

  // ── Fields Submenu ──
  if (customId === 'embed_edit_fields') {
    await handleFieldsSubmenu(interaction, session);
    return;
  }

  if (customId === 'embed_fields_add') {
    await handleAddField(interaction);
    return;
  }

  if (customId === 'embed_fields_remove') {
    await handleRemoveField(interaction, session);
    return;
  }

  if (customId === 'embed_fields_clear') {
    await handleClearFields(interaction, session);
    return;
  }

  console.warn(`Unknown embed editor button: ${customId}`);
}

/**
 * Handler cho modal submissions trong editor.
 */
export async function handleEditorModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const session = editSessions.get(interaction.user.id);

  if (!isSessionValid(session)) {
    await interaction.reply({
      embeds: [buildErrorEmbed('Session edit đã hết hạn.')],
      ephemeral: true,
    });
    return;
  }

  const modalId = interaction.customId.replace('modal_', '');

  try {
    if (modalId === 'title') {
      const value = interaction.fields.getTextInputValue('title');
      session.draft.title = value || 'No title';
    } else if (modalId === 'description') {
      const value = interaction.fields.getTextInputValue('description');
      session.draft.description = value || 'No description';
    } else if (modalId === 'footer') {
      const value = interaction.fields.getTextInputValue('footer');
      session.draft.footer = value;
    } else if (modalId === 'image') {
      const value = interaction.fields.getTextInputValue('image');
      session.draft.image = value || null;
    } else if (modalId === 'url') {
      const value = interaction.fields.getTextInputValue('url');
      session.draft.url = value || null;
    } else if (modalId === 'thumbnail_url') {
      const value = interaction.fields.getTextInputValue('thumbnail_url');
      session.draft.thumbnail = value || false;
    } else if (modalId === 'custom_color') {
      const value = interaction.fields.getTextInputValue('custom_color');
      const hex = value.replace('#', '');
      const parsed = parseInt(hex, 16);
      if (isNaN(parsed)) {
        await interaction.reply({
          embeds: [buildErrorEmbed(`Mã màu không hợp lệ: "${value}". Dùng định dạng #RRGGBB.`)],
          ephemeral: true,
        });
        return;
      }
      session.draft.color = parsed;
    } else if (modalId === 'add_field') {
      const fieldName = interaction.fields.getTextInputValue('field_name');
      const fieldValue = interaction.fields.getTextInputValue('field_value');
      const fieldInlineStr = interaction.fields.getTextInputValue('field_inline');
      const fieldInline = fieldInlineStr.toLowerCase() === 'true';

      if (!session.draft.fields) {
        session.draft.fields = [];
      }

      session.draft.fields.push({
        name: fieldName,
        value: fieldValue,
        inline: fieldInline,
      });
    } else if (modalId === 'field_remove_index') {
      const value = interaction.fields.getTextInputValue('field_remove_index');
      const index = parseInt(value, 10);
      if (isNaN(index) || index < 0 || index >= (session.draft.fields?.length ?? 0)) {
        await interaction.reply({
          embeds: [buildErrorEmbed(`Index không hợp lệ: "${value}".`)],
          ephemeral: true,
        });
        return;
      }
      session.draft.fields?.splice(index, 1);
    } else {
      console.warn(`Unknown modal submission: ${modalId}`);
      await interaction.reply({
        embeds: [buildErrorEmbed('Modal không hợp lệ.')],
        ephemeral: true,
      });
      return;
    }

    // Sau khi submit modal, cần deferring vì modal submit không có update()
    // => reply ephemeral + fetch message để update
    await interaction.deferUpdate();
  } catch (error) {
    console.error('Error handling modal submission:', error);
    await interaction.reply({
      embeds: [buildErrorEmbed(`Lỗi khi xử lý: ${(error as Error).message}`)],
      ephemeral: true,
    });
  }
}

/**
 * Export editSessions cho mục đích testing.
 */
export { editSessions };