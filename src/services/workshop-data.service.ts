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

export interface DfItemInfo {
  id: string;
  name: string;
  imageUrl?: string;
  value?: number;
  grade?: string;
  description?: string;
}

interface CacheEntry {
  data: Record<string, string>;
  items: Record<string, DfItemInfo>;
  loadedAt: number;
}

interface RecipeImageEntry {
  images: Record<string, string>;
  loadedAt: number;
}

let recipeImageCache: RecipeImageEntry | null = null;
let cache: CacheEntry | null = null;

/** Extract item info from collections_vi.js */
export function parseCollectionsJs(text: string): {
  names: Record<string, string>;
  items: Record<string, DfItemInfo>;
} {
  const names: Record<string, string> = {};
  const items: Record<string, DfItemInfo> = {};

  try {
    const jsonStr = text.replace(/^var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
    const data = JSON.parse(jsonStr);
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.prop_id) {
          const id = String(item.prop_id);
          const rawName = item.language?.vi || item.name || '';
          const name = rawName.replace(/\\u[\dA-F]{4}/gi, (m: string) =>
            String.fromCharCode(parseInt(m.slice(2), 16)),
          );
          if (name) {
            names[id] = name;
            const rawDesc = item.description_i18n?.vi || '';
            const description =
              rawDesc.replace(/\\u[\dA-F]{4}/gi, (m: string) =>
                String.fromCharCode(parseInt(m.slice(2), 16)),
              ) || undefined;
            items[id] = {
              id,
              name,
              imageUrl: item.image_url || undefined,
              value: typeof item.value === 'number' ? item.value : Number(item.value) || undefined,
              grade: item.grade ? String(item.grade) : undefined,
              description,
            };
          }
        }
      }
    }
  } catch {
    // Fallback regex match
    const itemRegex = /"prop_id":"(\d+)"[\s\S]*?"language":{"vi":"([^"]*)"}/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const id = match[1];
      const name = match[2].replace(/\\u[\dA-F]{4}/gi, (m) =>
        String.fromCharCode(parseInt(m.slice(2), 16)),
      );
      names[id] = name;
      items[id] = { id, name };
    }
  }

  return { names, items };
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

/** Fetch and parse workshop item names and metadata from the website */
async function fetchItemNames(): Promise<{
  names: Record<string, string>;
  items: Record<string, DfItemInfo>;
}> {
  const names: Record<string, string> = {};
  const items: Record<string, DfItemInfo> = {};

  try {
    const [collectionsRes, recipesRes] = await Promise.all([
      fetch(COLLECTIONS_URL, { signal: AbortSignal.timeout(10_000) }),
      fetch(CRAFT_RECIPES_URL, { signal: AbortSignal.timeout(10_000) }),
    ]);

    if (collectionsRes.ok) {
      const text = await collectionsRes.text();
      const collected = parseCollectionsJs(text);
      Object.assign(names, collected.names);
      Object.assign(items, collected.items);
      logger.info(`Loaded ${Object.keys(collected.names).length} items from collections_vi.js`);
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

  return { names, items };
}

/** Ensure cache is fresh */
async function ensureCache(): Promise<CacheEntry> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache;
  }
  const { names, items } = await fetchItemNames();
  cache = { data: names, items, loadedAt: now };
  return cache;
}

/** Get item name by ID — loads from website if cache is stale */
export async function getWorkshopItemName(itemId: string): Promise<string> {
  const currentCache = await ensureCache();
  return currentCache.data[itemId] || `Item ${itemId}`;
}

/** Get detailed item info (name, image, value, grade) by ID */
export async function getWorkshopItemInfo(itemId: string): Promise<DfItemInfo | null> {
  const currentCache = await ensureCache();
  return currentCache.items[itemId] || null;
}

/** Clear cache — useful for testing or forcing reload */
export function clearWorkshopDataCache(): void {
  cache = null;
}

/** Extract item image URLs from craft_recipes_vi.js content */
export function parseRecipeImages(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Match recipe objects with item_id and item_image_url
  // Supports both JSON ("key":"value") and JS (key: 'value') formats
  // (?<!material_) lookbehind skips "material_image_url" inside materials[]
  const recipeRegex =
    /item_id["']?\s*:\s*["']?([\d]+)["']?[\s\S]*?(?<!material_)item_image_url["']?\s*:\s*["']([^"']*)["']/gs;
  let match;
  while ((match = recipeRegex.exec(text)) !== null) {
    const itemId = match[1];
    const imageUrl = match[2];
    if (imageUrl) {
      result[itemId] = imageUrl;
    }
  }

  return result;
}

/** Fetch and parse recipe image URLs from the website */
async function fetchRecipeImages(): Promise<Record<string, string>> {
  try {
    const res = await fetch(CRAFT_RECIPES_URL, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const text = await res.text();
      const images = parseRecipeImages(text);
      const keys = Object.keys(images);
      logger.info(`Loaded ${keys.length} recipe images from craft_recipes_vi.js`);
      if (keys.length > 0) {
        logger.info(`Sample: ${keys[0]} -> ${images[keys[0]].substring(0, 60)}...`);
      }
      return images;
    }
  } catch (error) {
    logger.warn(`Failed to fetch recipe images: ${(error as Error).message}`);
  }
  return {};
}

/** Get item image URL by item ID — loads from website if cache is stale */
export async function getWorkshopItemImage(itemId: string): Promise<string> {
  const now = Date.now();

  if (recipeImageCache && now - recipeImageCache.loadedAt < CACHE_TTL_MS) {
    const url = recipeImageCache.images[itemId] || cache?.items?.[itemId]?.imageUrl || '';
    if (!url) {
      logger.debug(
        `No image for itemId=${itemId}, cache has ${Object.keys(recipeImageCache.images).length} entries`,
      );
    }
    return url;
  }

  const images = await fetchRecipeImages();
  recipeImageCache = { images, loadedAt: now };
  logger.info(
    `Item image cache refreshed: ${Object.keys(images).length} entries, itemId=${itemId} -> ${images[itemId] ? 'FOUND' : 'MISS'}`,
  );

  return images[itemId] || cache?.items?.[itemId]?.imageUrl || '';
}

/** Clear recipe image cache — useful for testing */
export function clearRecipeImageCache(): void {
  recipeImageCache = null;
}
