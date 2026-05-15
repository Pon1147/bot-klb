(() => {
  const SCRIPT_VERSION = 'v8.7';

  function isRunningOnDiscordWeb() {
    if (!window.location.hostname.includes('discord.com')) {
      alert('Vui lòng mở Discord Web (discord.com) rồi chạy script này!');
      return false;
    }
    return true;
  }

  function extractGuildId() {
    const path = window.location.pathname.split('/');
    if (path[1] === 'channels' && path[2]) {
      return path[2];
    }

    alert(
      'HƯỚNG DẪN LẤY SERVER ID (dành cho người mới)\n\n' +
        '1. Vào Settings Discord → Advanced\n' +
        '2. BẬT "Developer Mode"\n' +
        '3. Quay lại server → Chuột phải tên server → Copy Server ID\n\n' +
        'Hoặc dán link kênh bất kỳ vào hộp thoại sau.',
    );

    const input = prompt('Dán Server ID hoặc link kênh vào đây:', '').trim();
    if (!input) return null;

    if (input.includes('discord.com/channels/')) {
      const parts = input.split('/');
      const channelsIndex = parts.indexOf('channels');
      return channelsIndex !== -1 && parts[channelsIndex + 1] ? parts[channelsIndex + 1] : null;
    }
    return input;
  }

  function findModuleByProps(props) {
    const modules = [];
    if (window.webpackChunkdiscord_app) {
      window.webpackChunkdiscord_app.push([
        ['dumper-v87'],
        {},
        (req) => {
          for (let k in req.c) {
            if (req.c[k]?.exports) modules.push(req.c[k].exports);
          }
        },
      ]);
    }

    for (let mod of modules) {
      let exp = mod;
      if (exp?.Z) exp = exp.Z;
      if (exp?.default) exp = exp.default;
      if (props.every((p) => typeof exp[p] !== 'undefined')) return exp;

      for (let key in exp) {
        const sub = exp[key];
        if (sub && props.every((p) => typeof sub[p] !== 'undefined')) return sub;
      }
    }
    return null;
  }

  function initializeStores() {
    const vencordWebpack = window.Vencord?.Webpack;
    let guildStore = null;
    let channelStore = null;

    if (vencordWebpack) {
      guildStore = vencordWebpack.Common?.GuildStore || vencordWebpack.findStore?.('GuildStore');
      channelStore =
        vencordWebpack.Common?.ChannelStore || vencordWebpack.findStore?.('ChannelStore');
    }

    if (!guildStore) guildStore = findModuleByProps(['getGuild', 'getGuilds']);
    if (!channelStore)
      channelStore = findModuleByProps(['getMutableGuildChannelsForGuild', 'getChannel']);

    return { guildStore, channelStore };
  }

  function loadGuild(guildId, guildStore) {
    if (!guildStore) return { name: `Server ${guildId}`, id: guildId };
    return guildStore.getGuild?.(guildId) || { name: `Server ${guildId}`, id: guildId };
  }

  function collectChannels(channelStore, guildId) {
    if (!channelStore) return [];

    const channels = [];
    const channelIdSet = new Set();

    const addValidChannel = (channel) => {
      if (!channel?.id?.length >= 17 || typeof channel.type !== 'number') return;
      if (channelIdSet.has(channel.id)) return;
      if (channel.guild_id && channel.guild_id !== guildId) return;

      channels.push(channel);
      channelIdSet.add(channel.id);
    };

    const methods = [
      'getMutableGuildChannelsForGuild',
      'getMutableBasicGuildChannelsForGuild',
      'getGuildChannels',
      'getChannels',
    ];

    methods.forEach((method) => {
      if (typeof channelStore[method] !== 'function') return;
      try {
        const raw =
          method === 'getChannels' ? channelStore[method]() : channelStore[method](guildId);
        const list = Array.isArray(raw) ? raw : Object.values(raw || {});
        list.forEach(addValidChannel);
      } catch (e) {}
    });

    if (channels.length === 0 && typeof channelStore.getChannels === 'function') {
      try {
        const allChannels = Object.values(channelStore.getChannels() || {});
        allChannels.filter((c) => c?.guild_id === guildId).forEach(addValidChannel);
      } catch (e) {}
    }

    return channels;
  }

  function buildChannelTree(channels, guild) {
    const categories = {};
    const noCategory = { name: '(No Category)', position: -1, channels: [] };

    channels
      .filter((c) => c.type === 4)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .forEach((cat) => {
        categories[cat.id] = {
          name: cat.name || 'Unnamed Category',
          position: cat.position || 0,
          channels: [],
        };
      });

    const typeMap = {
      0: 'Text Channel',
      2: 'Voice Channel',
      5: 'Announcement Channel',
      10: 'Thread',
      15: 'Forum',
      16: 'Media Channel',
    };

    channels
      .filter((c) => c.type !== 4)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .forEach((channel) => {
        const parent = categories[channel.parent_id];
        const target = parent || noCategory;
        target.channels.push({
          name: channel.name || 'Unnamed',
          id: channel.id,
          type: typeMap[channel.type] || `Type ${channel.type}`,
        });
      });

    const sortedCategories = Object.values(categories).sort((a, b) => a.position - b.position);

    if (noCategory.channels.length > 0) {
      sortedCategories.unshift(noCategory);
    }

    return {
      serverName: guild.name,
      serverId: guild.id,
      categories: sortedCategories,
    };
  }

  function generateMarkdown(tree) {
    let md = `# ${tree.serverName}\n\n`;
    tree.categories.forEach((category) => {
      md += `## ${category.name}\n`;
      category.channels.forEach((channel) => {
        md += ` ${channel.type} ${channel.name} (ID: ${channel.id})\n`;
      });
      md += '\n';
    });
    return md;
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        return false;
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }

  function downloadMarkdown(content, guildName) {
    const filename = `${guildName.replace(/[^a-zA-Z0-9]/g, '_')}_channels.md`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function main() {
    console.log(`DISCORD SERVER DUMPER ${SCRIPT_VERSION} (Clean Code Edition)`);

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
    const markdown = generateMarkdown(tree);

    copyTextToClipboard(markdown).then((success) => {
      if (success) console.log('ĐÃ COPY Markdown vào clipboard!');
      downloadMarkdown(markdown, guild.name);
      console.log('ĐÃ TẢI XUỐNG file .md tự động!');
    });
  }

  main();
})();
