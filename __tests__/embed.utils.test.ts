import { EmbedBuilder } from 'discord.js';
import { buildWelcomeEmbed, buildErrorEmbed, buildSuccessEmbed, embedColors } from '../src/utils/embed.utils';

// Mock GuildMember for testing embed builders
function createMockGuildMember(): any {
  return {
    user: {
      tag: 'TestUser#1234',
      createdTimestamp: 1672531200000,
      displayAvatarURL: jest.fn().mockReturnValue('https://cdn.example.com/avatar.png'),
      toString: jest.fn().mockReturnValue('<@123456789>'),
    },
    guild: {
      id: 'guild_123',
      memberCount: 42,
    },
    joinedAt: new Date(1672617600000),
  };
}

describe('Embed Utils', () => {
  describe('embedColors', () => {
    it('should have welcome color defined', () => {
      expect(embedColors.welcome).toBe(0x00FF00);
    });

    it('should have leave color defined', () => {
      expect(embedColors.leave).toBe(0xFF0000);
    });

    it('should have error color defined', () => {
      expect(embedColors.error).toBe(0xFF0000);
    });

    it('should have success color defined', () => {
      expect(embedColors.success).toBe(0x00FF00);
    });

    it('should have info color defined', () => {
      expect(embedColors.info).toBe(0x0099FF);
    });
  });

  describe('buildWelcomeEmbed', () => {
    it('should return an EmbedBuilder instance', () => {
      const mockMember = createMockGuildMember();
      const result = buildWelcomeEmbed(mockMember);

      expect(result).toBeInstanceOf(EmbedBuilder);
    });

    it('should set correct title', () => {
      const mockMember = createMockGuildMember();
      const result = buildWelcomeEmbed(mockMember);

      expect(result.data.title).toBe('Welcome to the Server!');
    });

    it('should set welcome description', () => {
      const mockMember = createMockGuildMember();
      const result = buildWelcomeEmbed(mockMember);

      expect(result.data.description).toContain('We');
      expect(result.data.description).toContain('glad to have you');
    });

    it('should include account created field', () => {
      const mockMember = createMockGuildMember();
      const result = buildWelcomeEmbed(mockMember);

      const fields = result.data.fields || [];
      const accountField = fields.find(f => f.name === 'Account Created');
      expect(accountField).toBeDefined();
      expect(accountField?.inline).toBe(true);
    });

    it('should include joined server field', () => {
      const mockMember = createMockGuildMember();
      const result = buildWelcomeEmbed(mockMember);

      const fields = result.data.fields || [];
      const joinField = fields.find(f => f.name === 'Joined Server');
      expect(joinField).toBeDefined();
      expect(joinField?.inline).toBe(true);
    });

    it('should include member count field', () => {
      const mockMember = createMockGuildMember();
      const result = buildWelcomeEmbed(mockMember);

      const fields = result.data.fields || [];
      const countField = fields.find(f => f.name === 'Member Count');
      expect(countField).toBeDefined();
      expect(countField?.value).toBe('42');
      expect(countField?.inline).toBe(true);
    });

    it('should set thumbnail to member avatar', () => {
      const mockMember = createMockGuildMember();
      const result = buildWelcomeEmbed(mockMember);

      expect(result.data.thumbnail?.url).toBe('https://cdn.example.com/avatar.png');
    });

    it('should set welcome color', () => {
      const mockMember = createMockGuildMember();
      const result = buildWelcomeEmbed(mockMember);

      expect(result.data.color).toBe(0x00FF00);
    });

    it('should set footer text', () => {
      const mockMember = createMockGuildMember();
      const result = buildWelcomeEmbed(mockMember);

      expect(result.data.footer?.text).toBe('Welcome Bot');
    });

    it('should use current date when joinedAt is null', () => {
      const mockMember = {
        ...createMockGuildMember(),
        joinedAt: null,
      };
      const result = buildWelcomeEmbed(mockMember);

      const fields = result.data.fields || [];
      const joinField = fields.find(f => f.name === 'Joined Server');
      expect(joinField).toBeDefined();
    });
  });

  describe('buildErrorEmbed', () => {
    it('should return an EmbedBuilder instance', () => {
      const result = buildErrorEmbed('Something went wrong');
      expect(result).toBeInstanceOf(EmbedBuilder);
    });

    it('should set error title', () => {
      const result = buildErrorEmbed('Test error');
      expect(result.data.title).toBe('Error');
    });

    it('should set error description', () => {
      const errorMsg = 'Something went wrong';
      const result = buildErrorEmbed(errorMsg);
      expect(result.data.description).toBe(errorMsg);
    });

    it('should set error color', () => {
      const result = buildErrorEmbed('Error msg');
      expect(result.data.color).toBe(0xFF0000);
    });
  });

  describe('buildSuccessEmbed', () => {
    it('should return an EmbedBuilder instance', () => {
      const result = buildSuccessEmbed('Operation successful');
      expect(result).toBeInstanceOf(EmbedBuilder);
    });

    it('should set success title', () => {
      const result = buildSuccessEmbed('Done');
      expect(result.data.title).toBe('Success');
    });

    it('should set success description', () => {
      const successMsg = 'Operation successful';
      const result = buildSuccessEmbed(successMsg);
      expect(result.data.description).toBe(successMsg);
    });

    it('should set success color', () => {
      const result = buildSuccessEmbed('Done');
      expect(result.data.color).toBe(0x00FF00);
    });
  });
});