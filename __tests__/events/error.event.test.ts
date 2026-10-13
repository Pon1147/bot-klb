/// <reference types="jest" />
import { Client, Events } from 'discord.js';
import { execute, default as errorEvent } from '../../src/events/error.event.js';
import { isIgnorableInteractionError } from '../../src/utils/discord-error.utils.js';

describe('events/error.event', () => {
  it('should export correct event name and once=false', () => {
    expect(errorEvent.name).toBe(Events.Error);
    expect(errorEvent.once).toBe(false);
    expect(typeof errorEvent.execute).toBe('function');
  });

  it('should ignore 10062 Unknown interaction without crashing', async () => {
    const mockClient = {} as Client;
    const error = Object.assign(new Error('Unknown interaction'), { code: 10062 });

    await expect(execute(mockClient, error)).resolves.not.toThrow();
  });

  it('should log other errors safely without crashing', async () => {
    const mockClient = {} as Client;
    const error = new Error('Connection reset by peer');

    await expect(execute(mockClient, error)).resolves.not.toThrow();
  });
});

describe('utils/discord-error.utils', () => {
  it('identifies 10062 as ignorable', () => {
    expect(isIgnorableInteractionError({ code: 10062 })).toBe(true);
    expect(isIgnorableInteractionError(new Error('DiscordAPIError[10062]: Unknown interaction'))).toBe(true);
  });

  it('identifies 40060 as ignorable', () => {
    expect(isIgnorableInteractionError({ code: 40060 })).toBe(true);
    expect(isIgnorableInteractionError(new Error('Interaction has already been acknowledged'))).toBe(true);
  });

  it('identifies 50027 as ignorable', () => {
    expect(isIgnorableInteractionError({ code: 50027 })).toBe(true);
    expect(isIgnorableInteractionError(new Error('Invalid Webhook Token'))).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isIgnorableInteractionError(new Error('Database timeout'))).toBe(false);
    expect(isIgnorableInteractionError(null)).toBe(false);
    expect(isIgnorableInteractionError(undefined)).toBe(false);
  });
});

