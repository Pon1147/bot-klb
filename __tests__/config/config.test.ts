/**
 * Test cho Config files.
 * Verify default settings, container variables, và bot config exports.
 */
import { defaultGuildSettings, cloneDefaultSettings } from '../../src/config/default.settings.js';
import {
  WELCOME_CONTAINER_DEFAULTS,
  LEAVE_CONTAINER_DEFAULTS,
  BOOSTER_CONTAINER_DEFAULTS,
  CONTAINER_COLORS,
} from '../../src/config/container.variables.js';
import { LOG_COLORS, LEVEL_BADGES, LEVEL_ICONS } from '../../src/config/logger.variables.js';

describe('Config - Default Settings', () => {
  describe('defaultGuildSettings', () => {
    it('phải có welcome settings hợp lệ', () => {
      expect(defaultGuildSettings.welcome).toBeDefined();
      expect(typeof defaultGuildSettings.welcome.enabled).toBe('boolean');
      expect(defaultGuildSettings.welcome.container).toBeDefined();
    });

    it('phải có leave settings hợp lệ', () => {
      expect(defaultGuildSettings.leave).toBeDefined();
      expect(typeof defaultGuildSettings.leave.enabled).toBe('boolean');
      expect(defaultGuildSettings.leave.container).toBeDefined();
    });

    it('phải có booster settings hợp lệ', () => {
      expect(defaultGuildSettings.booster).toBeDefined();
      expect(typeof defaultGuildSettings.booster.enabled).toBe('boolean');
      expect(defaultGuildSettings.booster.container).toBeDefined();
    });

    it('phải có container accentColor cho từng type', () => {
      expect(defaultGuildSettings.welcome.container.accentColor).toBeDefined();
      expect(defaultGuildSettings.leave.container.accentColor).toBeDefined();
      expect(defaultGuildSettings.booster.container.accentColor).toBeDefined();
    });

    it('phải có headerTemplate cho từng type', () => {
      expect(defaultGuildSettings.welcome.container.headerTemplate).toBeDefined();
      expect(defaultGuildSettings.leave.container.headerTemplate).toBeDefined();
      expect(defaultGuildSettings.booster.container.headerTemplate).toBeDefined();
    });

    it('phải có contentLines array cho từng type', () => {
      expect(Array.isArray(defaultGuildSettings.welcome.container.contentLines)).toBe(true);
      expect(Array.isArray(defaultGuildSettings.leave.container.contentLines)).toBe(true);
      expect(Array.isArray(defaultGuildSettings.booster.container.contentLines)).toBe(true);
    });
  });

  describe('cloneDefaultSettings()', () => {
    it('phải trả về bản copy độc lập (không phải cùng reference)', () => {
      const cloned = cloneDefaultSettings();

      expect(cloned).not.toBe(defaultGuildSettings);
      expect(cloned.welcome).not.toBe(defaultGuildSettings.welcome);
      expect(cloned.booster).not.toBe(defaultGuildSettings.booster);
    });

    it('phải có cùng giá trị với defaultGuildSettings', () => {
      const cloned = cloneDefaultSettings();

      expect(cloned.welcome.enabled).toBe(defaultGuildSettings.welcome.enabled);
      expect(cloned.booster.container.accentColor).toBe(
        defaultGuildSettings.booster.container.accentColor,
      );
    });

    it('phải không mutate object gốc khi sửa clone', () => {
      const cloned = cloneDefaultSettings();
      cloned.welcome.enabled = false;
      cloned.booster.channelId = 'modified';

      expect(defaultGuildSettings.welcome.enabled).not.toBe(false);
      expect(defaultGuildSettings.booster.channelId).not.toBe('modified');
    });
  });
});

describe('Config - Container Variables', () => {
  describe('WELCOME_CONTAINER_DEFAULTS', () => {
    it('phải có ACCENT_COLOR', () => {
      expect(typeof WELCOME_CONTAINER_DEFAULTS.ACCENT_COLOR).toBe('number');
    });

    it('phải có HEADER_TEMPLATE', () => {
      expect(typeof WELCOME_CONTAINER_DEFAULTS.HEADER_TEMPLATE).toBe('string');
      expect(WELCOME_CONTAINER_DEFAULTS.HEADER_TEMPLATE.length).toBeGreaterThan(0);
    });

    it('phải có CONTENT_LINES array', () => {
      expect(Array.isArray(WELCOME_CONTAINER_DEFAULTS.CONTENT_LINES)).toBe(true);
    });

    it('phải có SHOW_SEPARATOR boolean', () => {
      expect(typeof WELCOME_CONTAINER_DEFAULTS.SHOW_SEPARATOR).toBe('boolean');
    });
  });

  describe('LEAVE_CONTAINER_DEFAULTS', () => {
    it('phải có ACCENT_COLOR', () => {
      expect(typeof LEAVE_CONTAINER_DEFAULTS.ACCENT_COLOR).toBe('number');
    });

    it('phải có HEADER_TEMPLATE', () => {
      expect(typeof LEAVE_CONTAINER_DEFAULTS.HEADER_TEMPLATE).toBe('string');
    });
  });

  describe('BOOSTER_CONTAINER_DEFAULTS', () => {
    it('phải có ACCENT_COLOR', () => {
      expect(typeof BOOSTER_CONTAINER_DEFAULTS.ACCENT_COLOR).toBe('number');
    });

    it('phải có HEADER_TEMPLATE', () => {
      expect(typeof BOOSTER_CONTAINER_DEFAULTS.HEADER_TEMPLATE).toBe('string');
    });

    it('phải có CONTENT_LINES array', () => {
      expect(Array.isArray(BOOSTER_CONTAINER_DEFAULTS.CONTENT_LINES)).toBe(true);
    });
  });

  describe('CONTAINER_COLORS', () => {
    it('phải có WELCOME color', () => {
      expect(typeof CONTAINER_COLORS.WELCOME).toBe('number');
    });

    it('phải có LEAVE color', () => {
      expect(typeof CONTAINER_COLORS.LEAVE).toBe('number');
    });

    it('phải có SUCCESS color', () => {
      expect(typeof CONTAINER_COLORS.SUCCESS).toBe('number');
    });

    it('phải có WARNING color', () => {
      expect(typeof CONTAINER_COLORS.WARNING).toBe('number');
    });

    it('phải có BOOSTER color', () => {
      expect(typeof CONTAINER_COLORS.BOOSTER).toBe('number');
    });

    it('màu sắc phải khác nhau', () => {
      const colors = Object.values(CONTAINER_COLORS);
      expect(colors.length).toBeGreaterThanOrEqual(7);
      colors.forEach(color => {
        expect(typeof color).toBe('number');
        expect(color).toBeGreaterThan(0);
      });
    });
  });
});

describe('Config - Logger Variables', () => {
  describe('LOG_COLORS', () => {
    it('phải có các màu ANSI codes', () => {
      expect(typeof LOG_COLORS.RED).toBe('string');
      expect(typeof LOG_COLORS.GREEN).toBe('string');
      expect(typeof LOG_COLORS.YELLOW).toBe('string');
      expect(typeof LOG_COLORS.CYAN).toBe('string');
      expect(typeof LOG_COLORS.RESET).toBe('string');
    });
  });

  describe('LEVEL_BADGES', () => {
    it('phải có badge cho từng level', () => {
      expect(LEVEL_BADGES.info).toBeDefined();
      expect(LEVEL_BADGES.warn).toBeDefined();
      expect(LEVEL_BADGES.error).toBeDefined();
      expect(LEVEL_BADGES.debug).toBeDefined();
      expect(LEVEL_BADGES.fatal).toBeDefined();
    });
  });

  describe('LEVEL_ICONS', () => {
    it('phải có icon cho từng level', () => {
      expect(LEVEL_ICONS.info).toBeDefined();
      expect(LEVEL_ICONS.warn).toBeDefined();
      expect(LEVEL_ICONS.error).toBeDefined();
      expect(LEVEL_ICONS.debug).toBeDefined();
      expect(LEVEL_ICONS.fatal).toBeDefined();
    });
  });
});
