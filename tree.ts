/**
 * Discord Server Channel Dumper - TypeScript Edition
 *
 * Browser userscript that extracts channel structure from a Discord server
 * and generates Markdown output with copy-to-clipboard and auto-download.
 *
 * Version: v8.7
 * Usage: Run in Discord Web (discord.com) console
 */

// ─── Type Definitions ───────────────────────────────────────────────

interface DiscordGuild {
  name: string;
  id: string;
  [key: string]: unknown;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  guild_id: string;
  parent_id?: string;
  [key: string]: unknown;
}

interface FormattedChannel {
  name: string;
  id: string;
  type: string;
}

interface CategoryGroup {
  name: string;
  position: number;
  channels: FormattedChannel[];
}

interface ChannelTree {
  serverName: string;
  serverId: string;
  categories: CategoryGroup[];
}

interface WritableExports {
  Z?: Record<string, unknown>;
  default?: Record<string, unknown>;
  [key: string]: unknown;
}

interface WritableCache {
  [key: string]: { exports?: WritableExports };
}

interface WebpackRequire {
  c: WritableCache;
}

interface GuildStore {
  getGuild?: (id: string) => DiscordGuild | undefined;
  getGuilds?: () => DiscordGuild[];
  [key: string]: unknown;
}

interface ChannelStore {
  getMutableGuildChannelsForGuild?: (
    guildId: string,
  ) => DiscordChannel[] | Record<string, DiscordChannel>;
  getMutableBasicGuildChannelsForGuild?: (
    guildId: string,
  ) => DiscordChannel[] | Record<string, DiscordChannel>;
  getGuildChannels?: (guildId: string) => DiscordChannel[] | Record<string, DiscordChannel>;
  getChannels?: () => Record<string, DiscordChannel>;
  getChannel?: (id: string) => DiscordChannel | undefined;
  [key: string]: unknown;
}

interface VencordWebpack {
  Common?: {
    GuildStore?: GuildStore;
    ChannelStore?: ChannelStore;
  };
  findStore?: (storeName: string) => GuildStore | ChannelStore | undefined;
}

interface Vencord {
  Webpack?: VencordWebpack;
}

interface AugmentedWindow extends Window {
  Vencord?: Vencord;
  webpackChunkdiscord_app?: {
    push: (args: [[string], object, (req: WebpackRequire) => void]) => void;
  };
}

// ─── Runtime Code (IIFE) ────────────────────────────────────────────

(() => {
  const SCRIPT_VERSION = 'v8.7';
  const augWindow: AugmentedWindow = window as unknown as AugmentedWindow;

  enum ChannelType {
    Text = 0,
    Voice = 2,
    Announcement = 5,
    Thread = 10,
    Forum = 15,
    Media = 16,
    Category = 4,
  }

  const TYPE_LABEL: Record<number, string> = {
    [ChannelType.Text]: 'Text Channel',
    [ChannelType.Voice]: 'Voice Channel',
    [ChannelType.Announcement]: 'Announcement Channel',
    [ChannelType.Thread]: 'Thread',
    [ChannelType.Forum]: 'Forum',
    [ChannelType.Media]: 'Media Channel',
  };

  function isRunningOnDiscordWeb(): boolean {
    if (!window.location.hostname.includes('discord.com')) {
      alert('Vui lòng mở Discord Web (discord.com) rồi chạy script này!');
      return false;
    }
    return true;
  }

  function extractGuildId(): string | null {
    const segments = window.location.pathname.split('/');
    if (segments[1] === 'channels' && segments[2]) {
      return segments[2];
    }

    alert(
      'HƯỚNG DẪN LẤY SERVER ID (dành cho người mới)\n\n' +
        '1. Vào Settings Discord → Advanced\n' +
        '2. BẬT "Developer Mode"\n' +
        '3. Quay lại server → Chuột phải tên server → Copy Server ID\n\n' +
        'Hoặc dán link kênh bất kỳ vào hộp thoại sau.',
    );

    const input = prompt('Dán Server ID hoặc link kênh vào đây:', '');
    if (!input) return null;

    const trimmed = input.trim();
    if (trimmed.includes('discord.com/channels/')) {
      const parts = trimmed.split('/');
      const idx = parts.indexOf('channels');
      return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : null;
    }
    return trimmed;
  }

  function extractWebpackModules(): WritableExports[] {
    const modules: WritableExports[] = [];
    if (augWindow.webpackChunkdiscord_app) {
      augWindow.webpackChunkdiscord_app.push([
        ['dumper-v8.7'],
        {},
        (req: WebpackRequire): void => {
          for (const key in req.c) {
            if (req.c[key]?.exports) {
              modules.push(req.c[key].exports);
            }
          }
        },
      ]);
    }
    return modules;
  }

  function findModuleByProps<T extends Record<string, unknown>>(
    props: string[],
  ): T | null {
    for (const mod of extractWebpackModules()) {
      let cur: WritableExports = mod;
      if (cur?.Z) cur = cur.Z as WritableExports;
      if (cur?.default) cur = cur.default as WritableExports;
      if (props.every((p) => typeof cur[p] !== 'undefined')) return cur as T;
      for (const key in cur) {
        const sub = cur[key] as WritableExports;
        if (sub && props.every((p) => typeof sub[p] !== 'undefined')) return sub as T;
      }
    }
    return null;
  }

  function initializeStores(): {
    guildStore: GuildStore | null;
    channelStore: ChannelStore | null;
  } {
    const vw = augWindow.Vencord?.Webpack;
    let gs: GuildStore | null = null;
    let cs: ChannelStore | null = null;

    if (vw) {
      gs = vw.Common?.GuildStore ?? vw.findStore?.('GuildStore') ?? null;
      cs = vw.Common?.ChannelStore ?? vw.findStore?.('ChannelStore') ?? null;
    }
    if (!gs) gs = findModuleByProps<GuildStore>(['getGuild', 'getGuilds']);
    if (!cs)
      cs = findModuleByProps<ChannelStore>([
        'getMutableGuildChannelsForGuild',
        'getChannel',
      ]);
    return { guildStore: gs, channelStore: cs };
  }

  function loadGuild(guildId: string, gs: GuildStore | null): DiscordGuild {
    if (!gs?.getGuild) return { name: `Server ${guildId}`, id: guildId };
    return gs.getGuild(guildId) ?? { name: `Server ${guildId}`, id: guildId };
  }

  function collectChannels(
    cs: ChannelStore | null,
    guildId: string,
  ): DiscordChannel[] {
    if (!cs) return [];
    const channels: DiscordChannel[] = [];
    const seen = new Set<string>();

    const add = (ch: DiscordChannel | undefined): void => {
      if (!ch?.id || ch.id.length < 17) return;
      if (typeof ch.type !== 'number') return;
      if (seen.has(ch.id)) return;
      if (ch.guild_id && ch.guild_id !== guildId) return;
      channels.push(ch);
      seen.add(ch.id);
    };

    const methods: (keyof Pick<
      ChannelStore,
      'getMutableGuildChannelsForGuild' | 'getMutableBasicGuildChannelsForGuild' | 'getGuildChannels' | 'getChannels'
    >)[] = [
      'getMutableGuildChannelsForGuild',
      'getMutableBasicGuildChannelsForGuild',
      'getGuildChannels',
      'getChannels',
    ];

    for (const m of methods) {
      const fn = cs[m];
      if (typeof fn !== 'function') continue;
      try {
        const raw =
          m === 'getChannels'
            ? (fn as () => Record<string, DiscordChannel>)()
            : (fn as (gid: string) => DiscordChannel[] | Record<string, DiscordChannel>)(guildId);
        const list = Array.isArray(raw) ? raw : Object.values(raw ?? {});
        for (const item of list) add(item as DiscordChannel | undefined);
      } catch {
        /* skip */
      }
    }

    if (channels.length === 0 && typeof cs.getChannels === 'function') {
      try {
        const all = cs.getChannels();
        for (const ch of Object.values(all ?? {})) {
          if (ch && ch.guild_id === guildId) add(ch);
        }
      } catch {
        /* skip */
      }
    }
    return channels;
  }

  function buildChannelTree(
    channels: DiscordChannel[],
    guild: DiscordGuild,
  ): ChannelTree {
    const cats: Record<string, CategoryGroup> = {};
    const noCat: CategoryGroup = { name: '(No Category)', position: -1, channels: [] };

    for (const c of channels
      .filter((ch): ch is DiscordChannel => ch.type === ChannelType.Category)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      cats[c.id] = {
        name: c.name || 'Unnamed Category',
        position: c.position ?? 0,
        channels: [],
      };
    }

    for (const ch of channels
      .filter((c) => c.type !== ChannelType.Category)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      const target = cats[ch.parent_id ?? ''] ?? noCat;
      target.channels.push({
        name: ch.name || 'Unnamed',
        id: ch.id,
        type: TYPE_LABEL[ch.type] ?? `Type ${ch.type}`,
      });
    }

    const sorted = Object.values(cats).sort((a, b) => a.position - b.position);
    if (noCat.channels.length > 0) sorted.unshift(noCat);

    return { serverName: guild.name, serverId: guild.id, categories: sorted };
  }

  function generateMarkdown(tree: ChannelTree): string {
    let md = `# ${tree.serverName}\n\n`;
    for (const cat of tree.categories) {
      md += `## ${cat.name}\n`;
      for (const ch of cat.channels) {
        md += `• ${ch.type} ${ch.name} (ID: ${ch.id})\n`;
      }
      md += '\n';
    }
    return md;
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }

  function downloadMarkdown(content: string, guildName: string): void {
    const name = guildName.replace(/[^a-zA-Z0-9]/g, '_');
    const blob = new Blob([content], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}_channels.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function main(): void {
    console.log(`DISCORD SERVER DUMPER ${SCRIPT_VERSION} (Clean Code TypeScript Edition)`);
    if (!isRunningOnDiscordWeb()) return;

    const guildId = extractGuildId();
    if (!guildId) {
      console.error('Hủy thao tác.');
      return;
    }

    const { guildStore, channelStore } = initializeStores();
    const guild = loadGuild(guildId, guildStore);
    console.log(`Guild loaded: ${guild.name} (${guild.id})`);
    console.log('Đang extract channels...');

    const channels = collectChannels(channelStore, guildId);
    if (channels.length === 0) {
      console.error('Không lấy được channels. F5 và thử lại.');
      return;
    }
    console.log(`Loaded ${channels.length} channels`);

    const tree = buildChannelTree(channels, guild);
    const md = generateMarkdown(tree);

    copyToClipboard(md).then((ok) => {
      if (ok) console.log('ĐÃ COPY Markdown vào clipboard!');
      downloadMarkdown(md, guild.name);
      console.log('ĐÃ TẢI XUỐNG file .md tự động!');
    });
  }

  main();
})();