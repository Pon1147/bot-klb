/**
 * Trích xuất toàn bộ canonical command paths và options từ danh sách SlashCommandBuilder.
 * Đóng vai trò là parser nền tảng để đối chiếu với Command Policies, Help và i18n.
 */

export interface ParsedOption {
  name: string;
  description: string;
  type: number;
  required: boolean;
}

export interface ParsedCommand {
  path: string;
  root: string;
  group: string | null;
  subcommand: string | null;
  description: string;
  descriptionLocalizations?: Record<string, string> | null;
  options: ParsedOption[];
}

export interface CommandLike {
  name: string;
  description?: string;
  description_localizations?: Record<string, string> | null;
  options?: any[];
}

export function extractCommandPathsFromBuilders(
  builders: Array<{ toJSON: () => any }>,
): ParsedCommand[] {
  const result: ParsedCommand[] = [];

  for (const builder of builders) {
    const json: CommandLike = builder.toJSON();
    const root = json.name;
    const rootOptions = json.options || [];

    // Kiểm tra xem root có subcommand hoặc subcommand group không
    const hasSubcommandsOrGroups = rootOptions.some((opt: any) => opt.type === 1 || opt.type === 2);

    if (!hasSubcommandsOrGroups) {
      // Lệnh 1 cấp (root-only, ví dụ: donate)
      result.push({
        path: root,
        root,
        group: null,
        subcommand: null,
        description: json.description || '',
        descriptionLocalizations: json.description_localizations || null,
        options: rootOptions.map((opt: any) => ({
          name: opt.name,
          description: opt.description || '',
          type: opt.type,
          required: Boolean(opt.required),
        })),
      });
      continue;
    }

    // Duyệt qua các options của root
    for (const opt of rootOptions) {
      if (opt.type === 1) {
        // Subcommand 2 cấp: root.sub (ví dụ: df.stats, team.find)
        const subOptions = opt.options || [];
        result.push({
          path: `${root}.${opt.name}`,
          root,
          group: null,
          subcommand: opt.name,
          description: opt.description || '',
          descriptionLocalizations: opt.description_localizations || null,
          options: subOptions.map((subOpt: any) => ({
            name: subOpt.name,
            description: subOpt.description || '',
            type: subOpt.type,
            required: Boolean(subOpt.required),
          })),
        });
      } else if (opt.type === 2) {
        // Subcommand Group 3 cấp: root.group.sub (ví dụ: config.roles.set, df.code.show)
        const groupName = opt.name;
        const groupSubs = opt.options || [];
        for (const sub of groupSubs) {
          const subOptions = sub.options || [];
          result.push({
            path: `${root}.${groupName}.${sub.name}`,
            root,
            group: groupName,
            subcommand: sub.name,
            description: sub.description || '',
            descriptionLocalizations: sub.description_localizations || null,
            options: subOptions.map((subOpt: any) => ({
              name: subOpt.name,
              description: subOpt.description || '',
              type: subOpt.type,
              required: Boolean(subOpt.required),
            })),
          });
        }
      }
    }
  }

  return result;
}
