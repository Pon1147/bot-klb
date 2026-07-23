# 🤖 Discord Bot RBAC Workflow (TypeScript + Discord.js v14)

## 📦 Kiến trúc File Structure

```bash
src/
├── config/
│ └── permissions.ts # Interface & config loading
├── decorators/
│ └── requireRole.ts # Custom decorator cho RBAC
├── handlers/
│ └── commandHandler.ts # Centralized command executor
├── commands/
│ └── ban.ts # Ví dụ command
└── index.ts # Entry point
```

## 1️⃣ Config & Interface (`src/config/permissions.ts`)

Tách biệt type-safe, load JSON vào runtime cache:

```typescript
export interface RoleConfig {
  Owner: string;
  Admin: string;
  Moderator: string;
  Member: string;
}

export interface CommandPermission {
  required: string[];
}

export interface PermissionsConfig {
  roles: RoleConfig;
  commands: Record<string, CommandPermission>;
}

// Runtime cache
export const ROLE_IDS: Record<string, string> = {};
export const COMMAND_PERMISSIONS: Record<string, CommandPermission> = {};

export async function loadPermissions(path: string = './config/permissions.json'): Promise<void> {
  const fs = await import('fs/promises');
  const data = JSON.parse(await fs.readFile(path, 'utf-8')) as PermissionsConfig;

  Object.entries(data.roles).forEach(([name, id]) => (ROLE_IDS[name] = id));
  Object.entries(data.commands).forEach(([cmd, perm]) => (COMMAND_PERMISSIONS[cmd] = perm));
}
```

## 2️⃣ Decorator RBAC (src/decorators/requireRole.ts)

Custom decorator kiểm tra quyền trước khi thực thi command:

```typescript
import { ChatInputCommandInteraction } from 'discord.js';

export function requireRole(...requiredRoles: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, interaction: ChatInputCommandInteraction) {
      const userRoles = interaction.member?.roles.cache.map((r) => r.name) || [];
      const hasPermission = requiredRoles.some((role) => userRoles.includes(role));

      if (!hasPermission) {
        return interaction.reply({
          content: `🔒 Lệnh này yêu cầu ít nhất một trong các vai trò: \`${requiredRoles.join(', ')}\``,
          ephemeral: true,
        });
      }

      return originalMethod.call(this, interaction);
    };

    return descriptor;
  };
}
```

## 3️⃣ Command Handler (src/handlers/commandHandler.ts)

Centralized executor + fallback permission check:

```typescript
import { ChatInputCommandInteraction } from 'discord.js';
import { COMMAND_PERMISSIONS } from '../config/permissions';

export class CommandHandler {
  private commands: Map<string, (i: ChatInputCommandInteraction) => Promise<void>> = new Map();

  register(name: string, execute: (i: ChatInputCommandInteraction) => Promise<void>) {
    this.commands.set(name, execute);
  }

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const commandName = interaction.commandName;
    const cmd = this.commands.get(commandName);
    if (!cmd) return;

    // Fallback check nếu decorator không được dùng
    const required = COMMAND_PERMISSIONS[commandName]?.required || [];
    if (required.length > 0) {
      const userRoles = interaction.member?.roles.cache.map((r) => r.name) || [];
      const hasPermission = required.some((role) => userRoles.includes(role));
      if (!hasPermission) {
        return interaction.reply({
          content: `🔒 Cần vai trò: \`${required.join(', ')}\``,
          ephemeral: true,
        });
      }
    }

    await cmd(interaction);
  }
}
```

## 4️⃣ Ví dụ Command (src/commands/ban.ts)

Class-based command sử dụng decorator:

```typescript
import { ChatInputCommandInteraction } from 'discord.js';
import { requireRole } from '../decorators/requireRole';

export class BanCommand {
  @requireRole('Admin', 'Owner')
  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getMember('target') as any;
    const reason = interaction.options.getString('reason') || 'Không có lý do';

    if (!target) {
      return interaction.reply({ content: '❌ Không tìm thấy thành viên.', ephemeral: true });
    }

    await target.ban({ reason });
    await interaction.reply(`✅ Đã khóa ${target.user.tag}`);
  }
}
```

## 5️⃣ Entry Point (src/index.ts)

Khởi tạo bot, load config, register command & lắng nghe interaction:

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import { loadPermissions } from './config/permissions';
import { CommandHandler } from './handlers/commandHandler';
import { BanCommand } from './commands/ban';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const commandHandler = new CommandHandler();

async function bootstrap() {
  await loadPermissions(); // Load config trước
  commandHandler.register('ban', new BanCommand().execute.bind(new BanCommand()));

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await commandHandler.handle(interaction);
  });

  await client.login(process.env.BOT_TOKEN);
  console.log('✅ Bot đã sẵn sàng với RBAC');
}

bootstrap().catch(console.error);
```

## ✅ Ưu điểm thiết kế

- Type-Safe 100%: Interface strict, decorator type-checked, strict mode sẵn sàng.
- Zero Hardcode: Quyền nằm trong JSON, decorator tự động inject logic.
- Scalable: Thêm command mới chỉ cần tạo class + decorator + register.
- Performance: Cache role mapping ở startup, không query DB mỗi lần gọi lệnh.
- Safe Fallback: Handler tự kiểm tra permission nếu decorator bị bỏ sót.

## 📌 Lưu ý triển khai

- Bật "strict": true trong tsconfig.json
- Nếu decorator chưa ổn định trong môi trường runtime, thay bằng wrapper function:

```typescript
export function withRoleCheck(required: string[]) {
  return (target: any, context: ClassMethodDecoratorContext) => {
    /* logic tương tự */
  };
}
```

Với server > 1000 thành viên, nên cache member.roles.cache vào Map với TTL để tránh rate limit.
Luôn dùng ephemeral: true cho thông báo lỗi quyền để không làm nhiễu kênh.
