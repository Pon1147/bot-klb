/** Tập hợp tất cả custom IDs cho container editor buttons/modals */

export const ContainerIds = {
  /** Prefix cho tất cả container-related custom IDs */
  PREFIX: 'container_',
  /** Pencil button prefix — bắt đầu editor từ live container message */
  EDIT_PENCIL: 'container_edit_pencil_',
  /** Navigation: quay lại editor chính */
  BACK: 'container_back',
  /** Actions: lưu, reset, hủy */
  SAVE: 'container_edit_save',
  RESET: 'container_edit_reset',
  CANCEL: 'container_edit_cancel',
  /** Property Editors */
  LINES: 'container_edit_lines',
  COLOR: 'container_edit_color',
  SEPARATOR: 'container_edit_separator',
  MEDIA: 'container_edit_media',
  /** Lines Submenu */
  LINES_ADD: 'container_lines_add',
  LINES_EDIT: 'container_lines_edit',
  LINES_REMOVE: 'container_lines_remove',
  LINES_CLEAR: 'container_lines_clear',
  /** Color Picker */
  COLOR_PRESET: 'container_color_preset_',
  COLOR_CUSTOM: 'container_color_custom',
} as const;

/** Prefix cho tất cả modal submissions */
export const ContainerModalPrefix = 'container_modal_';
