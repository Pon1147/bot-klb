/**
 * RBAC Decorator — kiểm tra quyền role trước khi execute command.
 *
 * Usage:
 *   class MyCommand {
 *     @requireRole('Admin', 'Moderator')
 *     async execute(interaction) { ... }
 *   }
 */

import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { hasRequiredRole, ROLE_IDS } from '../config/permissions.js';

import { GuildMember } from 'discord.js';

/**
 * Decorator kiểm tra role permissions.
 * @param requiredRoleNames - Danh sách role names được phép (VD: 'Admin', 'Moderator')
 */
export function requireRole(...requiredRoleNames: string[]) {
  // Convert role names → role IDs
  const requiredRoleIds = requiredRoleNames
    .map((name) => ROLE_IDS[name])
    .filter(Boolean) as string[];

  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: any,
      interaction: ChatInputCommandInteraction,
      ...args: unknown[]
    ): Promise<unknown> {
      // Skip check nếu không phải guild interaction
      if (!interaction.guild) {
        return originalMethod.call(this, interaction, ...args);
      }

      // Lấy user roles
      const member = interaction.member;
      if (!(member instanceof GuildMember)) {
        await interaction.reply({
          content: '🔒 Lệnh này yêu cầu role: ' + requiredRoleNames.join(', '),
          flags: MessageFlags.Ephemeral,
        });
        return null;
      }

      const userRoleIds = member.roles.cache.map((r: import('discord.js').Role) => r.id);
      const hasPermission = hasRequiredRole(userRoleIds, requiredRoleIds);

      if (!hasPermission) {
        await interaction.reply({
          content: '🔒 Lệnh này yêu cầu ít nhất một trong các vai trò: ' + requiredRoleNames.join(', '),
          flags: MessageFlags.Ephemeral,
        });
        return null;
      }

      return originalMethod.call(this, interaction, ...args);
    };

    return descriptor;
  };
}
