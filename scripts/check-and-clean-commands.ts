import { REST, Routes } from 'discord.js';
import { botConfig } from '../src/config/bot.config.js';

const rest = new REST().setToken(botConfig.token);

async function main() {
  console.log('--- KIỂM TRA SLASH COMMANDS TRÊN DISCORD ---');
  console.log(`Bot Client ID: ${botConfig.clientId}`);
  console.log(`Guild ID: ${botConfig.guildId}`);

  const globalCommands = (await rest.get(
    Routes.applicationCommands(botConfig.clientId),
  )) as any[];

  const guildCommands = (await rest.get(
    Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId),
  )) as any[];

  console.log(`\n📌 GLOBAL COMMANDS (${globalCommands.length}):`);
  globalCommands.forEach((c) => console.log(` - /${c.name} (id: ${c.id})`));

  console.log(`\n🏠 GUILD COMMANDS (${guildCommands.length}):`);
  guildCommands.forEach((c) => console.log(` - /${c.name} (id: ${c.id})`));

  const shouldClearGlobal = process.argv.includes('--clear-global');
  const shouldClearGuild = process.argv.includes('--clear-guild');

  if (shouldClearGlobal) {
    console.log('\n🧹 Đang xóa toàn bộ Global Commands để tránh duplicate...');
    await rest.put(Routes.applicationCommands(botConfig.clientId), { body: [] });
    console.log('✓ Đã xóa sạch Global Commands!');
  }

  if (shouldClearGuild) {
    console.log('\n🧹 Đang xóa toàn bộ Guild Commands để chỉ dùng Global...');
    await rest.put(
      Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId),
      { body: [] },
    );
    console.log('✓ Đã xóa sạch Guild Commands!');
  }
}

main().catch((err) => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});

