import { Collection, REST, Routes } from 'discord.js';
import { readdirSync, statSync } from 'fs';
import path from 'path';
import { botConfig } from '../config/bot.config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('CommandHandler');

/**
 * Interface cho một module command.
 * Mỗi file command phải export `data` (SlashCommandBuilder) và `execute` function.
 */
export interface CommandModule {
  data: any;
  execute: (...args: any[]) => Promise<any>;
}

/**
 * Đệ quy thu thập tất cả files .js/.ts từ một thư mục.
 * Hỗ trợ thư mục lồng nhau (ví dụ: welcome/welcome-setup.command.js).
 */
function collectCommandFiles(dirPath: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        // Đệ quy vào subdirectories
        const nestedFiles = collectCommandFiles(fullPath);
        files.push(...nestedFiles.map((f) => path.join(entry, f)));
      } else if ((entry.endsWith('.js') || entry.endsWith('.ts')) && !entry.endsWith('.d.ts')) {
        files.push(entry);
      }
    }
  } catch (error) {
    logger.error(`Không thể đọc thư mục: ${dirPath}`, { error });
  }

  return files;
}

/**
 * Kiểm tra xem một module có phải là command hợp lệ không.
 * Valid command = có export `data` (với name) + có export `execute` (function).
 */
function isValidCommandModule(module: any): module is CommandModule {
  if (!module.data) return false;
  if (!module.data.name) return false;
  if (typeof module.execute !== 'function') return false;
  return true;
}

/**
 * Load tất cả command modules từ thư mục commands.
 * Tự động phát hiện và chỉ load các file có export `data` + `execute`.
 * Các file không phải command (handler, builder, utils...) sẽ được bỏ qua im lặng.
 */
export function loadCommands(collection: Collection<string, CommandModule>): void {
  const commandsPath = path.join(__dirname, '..', 'commands');

  logger.debug(`Scanning directory: ${commandsPath}`);

  // Guard clause: thư mục phải tồn tại
  try {
    statSync(commandsPath);
  } catch {
    logger.fatal(`Commands directory không tồn tại: ${commandsPath}`);
    return;
  }

  const allFiles = collectCommandFiles(commandsPath);
  logger.debug(`Tìm thấy ${allFiles.length} file(s) trong thư mục commands`, { files: allFiles });

  if (!allFiles.length) {
    logger.warn('Không tìm thấy file nào. Bot sẽ khởi động với 0 commands.');
    return;
  }

  let loadedCount = 0;
  let skippedCount = 0;

  for (const file of allFiles) {
    const filePath = path.join(commandsPath, file);

    try {
      const commandModule = require(filePath);

      // Kiểm tra xem module có phải command hợp lệ không
      if (!isValidCommandModule(commandModule)) {
        // Không phải command → bỏ qua im lặng (không log warning)
        skippedCount++;
        continue;
      }

      const commandName = commandModule.data.name;
      collection.set(commandName, commandModule);
      loadedCount++;

      logger.info(`✓ Đã load command: /${commandName}`, {
        file,
        description: commandModule.data.description || 'N/A',
      });
    } catch (error) {
      logger.error(`✗ Không thể load file "${file}":`, { error, filePath });
      skippedCount++;
    }
  }

  logger.info(
    `Đã load ${loadedCount} command(s), bỏ qua ${skippedCount} file(s) không phải command`,
    {
      loaded: loadedCount,
      skipped: skippedCount,
      total: collection.size,
      commandNames: [...collection.keys()],
    },
  );
}

/**
 * Tạo fingerprint (string so sánh) cho một command.
 * Dùng để phát hiện thay đổi giữa local và Discord.
 */
function commandFingerprint(commandData: any): string {
  const cmd = typeof commandData.toJSON === 'function' ? commandData.toJSON() : commandData;
  return JSON.stringify(cmd);
}

/**
 * Kết quả phân tích diff giữa local commands và Discord commands.
 */
interface DiffResult {
  toAdd: string[]; // Commands mới cần đăng ký
  toUpdate: string[]; // Commands đã thay đổi cần cập nhật
  unchanged: string[]; // Commands không thay đổi (bỏ qua)
  toRemove: string[]; // Commands trên Discord nhưng không còn local (bỏ qua, không auto-remove)
}

/**
 * So sánh local commands với Discord commands để tìm thay đổi.
 * Trả về danh sách commands cần add, update, unchanged, và orphan trên Discord.
 */
function computeDiff(
  localCollection: Collection<string, CommandModule>,
  existingCommands: any[],
): DiffResult {
  const result: DiffResult = {
    toAdd: [],
    toUpdate: [],
    unchanged: [],
    toRemove: [],
  };

  // Tạo map từ existing commands (name → fingerprint)
  const existingMap = new Map<string, string>();
  for (const cmd of existingCommands) {
    existingMap.set(cmd.name, commandFingerprint(cmd));
  }

  // Kiểm tra từng local command
  for (const [name, command] of localCollection) {
    const localFingerprint = commandFingerprint(command.data);
    const existingFingerprint = existingMap.get(name);

    if (!existingFingerprint) {
      // Command không tồn tại trên Discord → cần đăng ký mới
      result.toAdd.push(name);
    } else if (localFingerprint !== existingFingerprint) {
      // Command tồn tại nhưng đã thay đổi → cần cập nhật
      result.toUpdate.push(name);
    } else {
      // Command không thay đổi → bỏ qua
      result.unchanged.push(name);
    }
  }

  // Kiểm tra commands trên Discord nhưng không còn trong local
  for (const existingCmd of existingCommands) {
    if (!localCollection.has(existingCmd.name)) {
      result.toRemove.push(existingCmd.name);
    }
  }

  return result;
}

/**
 * Deploy commands đến Discord API với cơ chế incremental.
 *
 * Logic:
 * 1. Fetch danh sách commands hiện tại từ Discord
 * 2. So sánh với local commands để tìm thay đổi
 * 3. Chỉ register/cập nhật những commands mới hoặc đã thay đổi
 * 4. Bỏ qua những commands không thay đổi
 * 5. Báo cáo kết quả chi tiết
 */
export async function deployCommands(
  commandCollection: Collection<string, CommandModule>,
): Promise<void> {
  // Guard clause: không có command để deploy
  if (!commandCollection.size) {
    logger.warn('Không có command để deploy. Kiểm tra log load command ở trên.');
    return;
  }

  const rest = new REST().setToken(botConfig.token);

  // Bước 1: Fetch existing commands từ Discord
  let existingCommands: any[] = [];
  try {
    existingCommands = (await rest.get(
      Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId),
    )) as any[];
    logger.info(`Đã fetch ${existingCommands.length} command(s) từ Discord`, {
      guildId: botConfig.guildId,
      existingCommands: existingCommands.map((c: any) => c.name),
    });
  } catch (error) {
    logger.warn('Không thể fetch existing commands. Sẽ deploy tất cả commands.', { error });
  }

  // Bước 2: So sánh local vs Discord để tìm thay đổi
  const diff = computeDiff(commandCollection, existingCommands);

  logger.info('=== Phân tích thay đổi commands ===', {
    newCommands: diff.toAdd.length,
    changedCommands: diff.toUpdate.length,
    unchangedCommands: diff.unchanged.length,
    orphanOnDiscord: diff.toRemove.length,
  });

  // Báo cáo commands mới
  if (diff.toAdd.length > 0) {
    logger.info(`🆕 ${diff.toAdd.length} command(s) MỚI cần đăng ký:`, {
      commands: diff.toAdd,
    });
  }

  // Báo cáo commands đã thay đổi
  if (diff.toUpdate.length > 0) {
    logger.info(`🔄 ${diff.toUpdate.length} command(s) ĐÃ THAY ĐỔI cần cập nhật:`, {
      commands: diff.toUpdate,
    });
  }

  // Báo cáo commands không thay đổi
  if (diff.unchanged.length > 0) {
    logger.info(`✅ ${diff.unchanged.length} command(s) KHÔNG THAY ĐỔI (bỏ qua):`, {
      commands: diff.unchanged,
    });
  }

  // Báo cáo commands orphan trên Discord
  if (diff.toRemove.length > 0) {
    logger.info(`🗑️ ${diff.toRemove.length} command(s) trên Discord nhưng không còn trong code:`, {
      commands: diff.toRemove,
    });
  }

  // Bước 3: Nếu không có thay đổi gì → bỏ qua deployment
  const needsDeployment = diff.toAdd.length > 0 || diff.toUpdate.length > 0;

  if (!needsDeployment) {
    logger.info('Không có thay đổi. Bỏ qua deployment.');
    return;
  }

  // Bước 4: Build danh sách commands cần deploy (TẤT CẢ local commands)
  // Discord API PUT /guild/commands thay thế TOÀN BỘ, nên phải gửi full list
  // Nhưng chỉ log những command thực sự thay đổi
  const localCommands = [];
  for (const [_name, command] of commandCollection) {
    localCommands.push(command.data.toJSON());
  }

  // Bước 5: Deploy đến Discord
  logger.info(`Deploying ${localCommands.length} command(s) đến Guild: ${botConfig.guildId}`, {
    clientId: botConfig.clientId,
    guildId: botConfig.guildId,
    newCommands: diff.toAdd,
    changedCommands: diff.toUpdate,
  });

  try {
    await rest.put(Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId), {
      body: localCommands,
    });

    logger.info('✓ Deploy commands thành công!', {
      totalDeployed: localCommands.length,
      newRegistered: diff.toAdd,
      updated: diff.toUpdate,
      skipped: diff.unchanged,
    });
  } catch (error) {
    logger.error('✗ Thất bại khi deploy commands:', { error });
  }
}
