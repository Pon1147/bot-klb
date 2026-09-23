/** Tập hợp tất cả custom IDs cho container editor buttons/modals */

export const ContainerIds = {
  /** Prefix cho tất cả container-related custom IDs */
  PREFIX: 'container_',
  /** Pencil button prefix — bắt đầu editor từ live container message */
  EDIT_PENCIL: 'container_edit_pencil_',
  /** Actions: lưu, reset, hủy */
  SAVE: 'container_edit_save',
  RESET: 'container_edit_reset',
  CANCEL: 'container_edit_cancel',
  /** Property Editors — mở modal trực tiếp */
  LINES: 'container_edit_lines',
  COLOR: 'container_edit_color',
  HEADER: 'container_edit_header',
  SEPARATOR: 'container_edit_separator',
  MEDIA: 'container_edit_media',
} as const;

/** Prefix cho tất cả modal submissions */
export const ContainerModalPrefix = 'container_modal_';
