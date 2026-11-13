/**
 * Trích xuất toàn bộ canonical command paths và options từ danh sách SlashCommandBuilder.
 * Đóng vai trò là parser nền tảng để đối chiếu với Command Policies, Help và i18n.
 */

export interface ParsedOption {
  name: string;
  nameLocalizations?: Record<string, string> | null;
  description: string;
  type: number;
  required: boolean;
}

export interface ParsedCommand {
  path: string;
  root: string;
  group: string | null;
  subcommand: string | null;
  nameVi: string | null;
  description: string;
  descriptionLocalizations?: Record<string, string> | null;
  options: ParsedOption[];
}

export interface CommandLike {
  name: string;
  name_localizations?: Record<string, string> | null;
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
    const rootNameVi = json.name_localizations?.vi || null;

    if (!hasSubcommandsOrGroups) {
      // Lệnh 1 cấp (root-only, ví dụ: donate)
      result.push({
        path: root,
        root,
        group: null,
        subcommand: null,
        nameVi: rootNameVi ? `/${rootNameVi}` : `/${root}`,
        description: json.description || '',
        descriptionLocalizations: json.description_localizations || null,
        options: rootOptions.map((opt: any) => ({
          name: opt.name,
          nameLocalizations: opt.name_localizations || null,
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
        const optNameVi = opt.name_localizations?.vi || opt.name;
        const fullVi = rootNameVi ? `/${rootNameVi} ${optNameVi}` : `/${root} ${optNameVi}`;

        result.push({
          path: `${root}.${opt.name}`,
          root,
          group: null,
          subcommand: opt.name,
          nameVi: fullVi,
          description: opt.description || '',
          descriptionLocalizations: opt.description_localizations || null,
          options: subOptions.map((subOpt: any) => ({
            name: subOpt.name,
            nameLocalizations: subOpt.name_localizations || null,
            description: subOpt.description || '',
            type: subOpt.type,
            required: Boolean(subOpt.required),
          })),
        });
      } else if (opt.type === 2) {
        // Subcommand Group 3 cấp: root.group.sub (ví dụ: config.roles.set, df.code.show)
        const groupName = opt.name;
        const groupNameVi = opt.name_localizations?.vi || groupName;
        const groupSubs = opt.options || [];
        for (const sub of groupSubs) {
          const subOptions = sub.options || [];
          const subNameVi = sub.name_localizations?.vi || sub.name;
          const fullVi = rootNameVi
            ? `/${rootNameVi} ${groupNameVi} ${subNameVi}`
            : `/${root} ${groupNameVi} ${subNameVi}`;

          result.push({
            path: `${root}.${groupName}.${sub.name}`,
            root,
            group: groupName,
            subcommand: sub.name,
            nameVi: fullVi,
            description: sub.description || '',
            descriptionLocalizations: sub.description_localizations || null,
            options: subOptions.map((subOpt: any) => ({
              name: subOpt.name,
              nameLocalizations: subOpt.name_localizations || null,
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
