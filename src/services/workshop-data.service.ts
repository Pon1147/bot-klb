/**
 * Workshop data service — fetches item names from playdeltaforce.com JS files
 * instead of hardcoding them. Data is cached in memory after first load.
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('WorkshopData');

const COLLECTIONS_URL = 'https://www.playdeltaforce.com/basic_info/collections_vi.js';
const CRAFT_RECIPES_URL = 'https://www.playdeltaforce.com/basic_info/craft_recipes_vi.js';

/** Cache TTL — 1 hour */
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  data: Record<string, string>;
  loadedAt: number;
}

let cache: CacheEntry | null = null;

/** Extract key-value pairs from a JS file that defines a variable assignment like `var name = [{prop_id: "123", language: {vi: "Name"}}, ...]` */
function parseCollectionsJs(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Match the basic_info_collection array items
  const itemRegex = /{"prop_id":"(\d+)","language":{"vi":"([^"]*)"}}/g;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const id = match[1];
    const name = match[2].replace(/\\u[\dA-F]{4}/gi, (m) =>
      String.fromCharCode(parseInt(m.slice(2), 16)),
    );
    result[id] = name;
  }

  return result;
}

/** Extract item names from craft_recipes_vi.js */
function parseCraftRecipesJs(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Match recipe items with item_id and item_name
  const itemRegex = /"item_id":"(\d+)","item_name":"([^"]*)"/g;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const id = match[1];
    const name = match[2];
    result[id] = name;
  }

  return result;
}

/** Fetch and parse workshop item names from the website */
async function fetchItemNames(): Promise<Record<string, string>> {
  const names: Record<string, string> = {};

  try {
    const [collectionsRes, recipesRes] = await Promise.all([
      fetch(COLLECTIONS_URL, { signal: AbortSignal.timeout(10_000) }),
      fetch(CRAFT_RECIPES_URL, { signal: AbortSignal.timeout(10_000) }),
    ]);

    if (collectionsRes.ok) {
      const text = await collectionsRes.text();
      const collected = parseCollectionsJs(text);
      Object.assign(names, collected);
      logger.info(`Loaded ${Object.keys(collected).length} items from collections_vi.js`);
    }

    if (recipesRes.ok) {
      const text = await recipesRes.text();
      const recipes = parseCraftRecipesJs(text);
      Object.assign(names, recipes);
      logger.info(`Loaded ${Object.keys(recipes).length} items from craft_recipes_vi.js`);
    }
  } catch (error) {
    logger.warn(`Failed to fetch workshop data: ${(error as Error).message}`);
  }

  return names;
}

/** Get item name by ID — loads from website if cache is stale */
export async function getWorkshopItemName(itemId: string): Promise<string> {
  const now = Date.now();

  // Return cached data if fresh
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.data[itemId] || `Item ${itemId}`;
  }

  // Load and cache
  const names = await fetchItemNames();
  cache = { data: names, loadedAt: now };

  return names[itemId] || `Item ${itemId}`;
}

/** Clear cache — useful for testing or forcing reload */
export function clearWorkshopDataCache(): void {
  cache = null;
}
