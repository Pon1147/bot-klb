/** Generic TTL-based in-memory store with periodic cleanup */

import { createLogger } from './logger.js';

const logger = createLogger('TTLStore');

export interface TTLStoreOptions {
  /** Milliseconds before entries expire */
  ttlMs: number;
  /** Milliseconds between cleanup runs */
  cleanupIntervalMs: number;
  /** Optional log prefix for this store instance */
  name?: string;
}

/** Entry with a fixed expiration timestamp */
export interface ExpiryEntry {
  expiresAt: number;
}

/** Entry with a refreshable last-interaction timestamp */
export interface TouchEntry {
  lastInteractionAt: number;
}

/**
 * Generic TTL store supporting both fixed-expiresAt and refreshable lastInteractionAt patterns.
 *
 * For fixed TTL (e.g., df-claim-store): use `expiresAt` field
 * For refreshable TTL (e.g., container-session): use `lastInteractionAt` field + call `touch()` after updates
 */
export class TTLStore<K extends string, V extends ExpiryEntry | TouchEntry> {
  private readonly store = new Map<K, V>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly name: string;

  constructor(private readonly options: TTLStoreOptions) {
    this.name = options.name ?? 'Store';
  }

  /** Set an entry. Computes expiresAt from now + ttlMs if not provided. */
  set(key: K, value: V): void {
    const entry = this.computeExpiry(value);
    this.store.set(key, entry);
  }

  /** Get an entry. Returns undefined if expired or missing. */
  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  /** Delete a specific entry. */
  delete(key: K): void {
    this.store.delete(key);
  }

  /** Touch an entry — refresh its lastInteractionAt (for refreshable TTL). No-op if entry doesn't exist. */
  touch(key: K): void {
    const entry = this.store.get(key);
    if (entry && 'lastInteractionAt' in entry) {
      (entry as TouchEntry).lastInteractionAt = Date.now();
    }
  }

  /** Check if an entry is expired. */
  private isExpired(entry: V): boolean {
    if ('expiresAt' in entry) {
      return Date.now() > (entry as ExpiryEntry).expiresAt;
    }
    if ('lastInteractionAt' in entry) {
      return Date.now() - (entry as TouchEntry).lastInteractionAt > this.options.ttlMs;
    }
    return false;
  }

  /** Compute expiresAt for an entry that doesn't have one. */
  private computeExpiry(entry: V): V {
    if ('expiresAt' in entry) return entry;
    if ('lastInteractionAt' in entry) {
      return {
        ...entry,
        expiresAt: (entry as TouchEntry).lastInteractionAt + this.options.ttlMs,
      } as V;
    }
    return entry;
  }

  /** Cleanup all expired entries. Returns count of deleted entries. */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.store.entries()) {
      if ('expiresAt' in entry && now > (entry as ExpiryEntry).expiresAt) {
        this.store.delete(key);
        cleaned++;
      } else if (
        'lastInteractionAt' in entry &&
        now - (entry as TouchEntry).lastInteractionAt > this.options.ttlMs
      ) {
        this.store.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`[${this.name}] Cleaned ${cleaned} expired entries`);
    }
    return cleaned;
  }

  /** Start periodic cleanup. Idempotent. */
  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.options.cleanupIntervalMs);
    logger.info(
      `[${this.name}] Cleanup started (${this.options.cleanupIntervalMs / 1000}s interval)`,
    );
  }

  /** Stop periodic cleanup. */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.info(`[${this.name}] Cleanup stopped`);
    }
  }

  /** Clear all entries (for testing). */
  clear(): void {
    this.store.clear();
  }

  /** Get all entries (for testing). */
  entries(): IterableIterator<[K, V]> {
    return this.store.entries();
  }

  /** Get size (for testing). */
  get size(): number {
    return this.store.size;
  }
}
