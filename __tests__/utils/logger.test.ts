/**
 * Test cho Logger utility (createLogger factory).
 * Verify log levels, format, và output.
 */
import { createLogger } from '../../src/utils/logger.js';

// Helper: strip ANSI escape codes để test text content
function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

describe('Logger (createLogger)', () => {
  let loggedMessages: { method: string; args: unknown[] }[];

  beforeEach(() => {
    loggedMessages = [];
    jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      loggedMessages.push({ method: 'log', args });
    });
    jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      loggedMessages.push({ method: 'warn', args });
    });
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      loggedMessages.push({ method: 'error', args });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('info()', () => {
    it('phải gọi console.log với formatted message', () => {
      const logger = createLogger('TestModule');
      logger.info('Test message');

      expect(loggedMessages.length).toBeGreaterThan(0);
      const lastCall = loggedMessages[loggedMessages.length - 1];
      expect(lastCall.method).toBe('log');
    });

    it('phải include module name trong output', () => {
      const logger = createLogger('MyModule');
      logger.info('Hello');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = stripAnsi(lastCall.args.join(' '));
      expect(output).toContain('MyModule');
    });

    it('phải include level INFO trong output', () => {
      const logger = createLogger('TestModule');
      logger.info('Test');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = stripAnsi(lastCall.args.join(' '));
      expect(output).toContain('INFO');
    });

    it('phải include timestamp format [HH:MM:SS]', () => {
      const logger = createLogger('TestModule');
      logger.info('Test');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = stripAnsi(lastCall.args.join(' '));
      expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
    });
  });

  describe('warn()', () => {
    it('phải gọi console.warn với WARN level', () => {
      const logger = createLogger('TestModule');
      logger.warn('Warning message');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      expect(lastCall.method).toBe('warn');
      const output = stripAnsi(lastCall.args.join(' '));
      expect(output).toContain('WARN');
    });
  });

  describe('error()', () => {
    it('phải gọi console.error với ERROR level', () => {
      const logger = createLogger('TestModule');
      logger.error('Error message');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      expect(lastCall.method).toBe('error');
      const output = stripAnsi(lastCall.args.join(' '));
      expect(output).toContain('ERROR');
    });

    it('phải include metadata nếu có', () => {
      const logger = createLogger('TestModule');
      logger.error('Failed', { key: 'value' });

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = lastCall.args.join(' ');
      expect(output).toContain('"key"');
      expect(output).toContain('"value"');
    });
  });

  describe('debug()', () => {
    it('phải gọi console.log với DEBUG level', () => {
      const logger = createLogger('TestModule');
      logger.debug('Debug message');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = stripAnsi(lastCall.args.join(' '));
      expect(output).toContain('DEBUG');
    });
  });

  describe('fatal()', () => {
    it('phải gọi console.log với FATAL level', () => {
      const logger = createLogger('TestModule');
      logger.fatal('Fatal message');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = stripAnsi(lastCall.args.join(' '));
      expect(output).toContain('FATAL');
    });
  });

  describe('divider()', () => {
    it('phải gọi console.log với divider line', () => {
      const logger = createLogger('TestModule');
      logger.divider();

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = lastCall.args.join(' ');
      const stripped = stripAnsi(output);
      expect(stripped.length).toBeGreaterThan(20);
    });

    it('phải hỗ trợ custom character', () => {
      const logger = createLogger('TestModule');
      logger.divider('=');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = lastCall.args.join(' ');
      const stripped = stripAnsi(output);
      expect(stripped).toContain('=');
    });
  });

  describe('header()', () => {
    it('phải gọi console.log với header block', () => {
      const logger = createLogger('TestModule');
      logger.header('Test Header');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = lastCall.args.join(' ');
      expect(output).toContain('Test Header');
    });

    it('phải có box drawing characters', () => {
      const logger = createLogger('TestModule');
      logger.header('Title');

      const lastCall = loggedMessages[loggedMessages.length - 1];
      const output = lastCall.args.join(' ');
      expect(output).toContain('╔');
      expect(output).toContain('╗');
      expect(output).toContain('╚');
      expect(output).toContain('╝');
    });
  });
});