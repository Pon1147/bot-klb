/**
 * Unit tests cho workshop-data.service.ts — parseRecipeImages regex.
 * Regex match item_id → item_image_url (API trả về item_id, không có recipe_id).
 */

import { parseRecipeImages } from '../../src/services/workshop-data.service.js';

describe('parseRecipeImages', () => {
  // Mock JS format (unquoted keys, single-quoted values, multi-line)
  const mockJsText = `var basic_info_craft_recipes = [
  {
    recipe_id: '371030002',
    workshop_id: '1007',
    item_id: '37100300002',
    item_name: '5.56*45mm M855 APC',
    materials: [
      { slot_index: 1, material_id: '15020010028', material_name: 'Nhiên Liệu', material_image_url: 'https://www.playdeltaforce.com/basic_info/collections_mat1.png', material_grade: '3' },
      { slot_index: 2, material_id: '15020010021', material_name: 'Máy Mài Góc', material_image_url: 'https://www.playdeltaforce.com/basic_info/collections_mat2.png', material_grade: '2' },
      { slot_index: 3, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
      { slot_index: 4, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
    ],
    item_image_url:
      'https://www.playdeltaforce.com/basic_info/bullets_142352295a1b83b2131b0434893dbf21.png',
  },
  {
    recipe_id: '371040002',
    item_id: '37100400002',
    item_name: '5.56*45mm M855A1 APC+',
    materials: [
      { slot_index: 1, material_id: '15080050024', material_name: 'Delta Force', material_image_url: 'https://www.playdeltaforce.com/basic_info/collections_mat3.png', material_grade: '4' },
      { slot_index: 2, material_id: '15020010007', material_name: 'Búa Phá Tường', material_image_url: 'https://www.playdeltaforce.com/basic_info/collections_mat4.png', material_grade: '2' },
      { slot_index: 3, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
      { slot_index: 4, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
    ],
    item_image_url:
      'https://www.playdeltaforce.com/basic_info/bullets_c22edaad1506ce33ed539eaf7b05.png',
  },
];`;

  it('JS format: map item_image_url theo item_id, khong nhuan material_image_url', () => {
    const result = parseRecipeImages(mockJsText);

    // Keys là item_id (không phải recipe_id)
    expect(result['37100300002']).toBe(
      'https://www.playdeltaforce.com/basic_info/bullets_142352295a1b83b2131b0434893dbf21.png',
    );
    expect(result['37100400002']).toBe(
      'https://www.playdeltaforce.com/basic_info/bullets_c22edaad1506ce33ed539eaf7b05.png',
    );
  });

  it('JS format: khong tra ve material_image_url trong ket qua', () => {
    const result = parseRecipeImages(mockJsText);

    const allUrls = Object.values(result);
    expect(allUrls).not.toContain('https://www.playdeltaforce.com/basic_info/collections_mat1.png');
    expect(allUrls).not.toContain('https://www.playdeltaforce.com/basic_info/collections_mat2.png');
    expect(allUrls).not.toContain('https://www.playdeltaforce.com/basic_info/collections_mat3.png');
    expect(allUrls).not.toContain('https://www.playdeltaforce.com/basic_info/collections_mat4.png');
  });

  it('JS format: chi tra ve 1 URL cho moi item_id', () => {
    const result = parseRecipeImages(mockJsText);

    expect(Object.keys(result)).toHaveLength(2);
  });

  it('JS format: xu ly item voi material_image_url rong', () => {
    const text = `var basic_info_craft_recipes = [
  {
    recipe_id: '371030001',
    item_id: '37100300001',
    materials: [
      { slot_index: 1, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
      { slot_index: 2, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
      { slot_index: 3, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
      { slot_index: 4, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
    ],
    item_image_url:
      'https://www.playdeltaforce.com/basic_info/bullets_empty.png',
  },
];`;

    const result = parseRecipeImages(text);
    expect(result['37100300001']).toBe('https://www.playdeltaforce.com/basic_info/bullets_empty.png');
  });

  it('JS format: bo qua item co item_image_url rong', () => {
    const text = `var basic_info_craft_recipes = [
  {
    recipe_id: '371030009',
    item_id: '37100300009',
    materials: [
      { slot_index: 1, material_id: '123', material_name: 'Test', material_image_url: 'https://example.com/mat.png', material_grade: '1' },
      { slot_index: 2, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
      { slot_index: 3, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
      { slot_index: 4, material_id: '', material_name: '', material_image_url: '', material_grade: '-1' },
    ],
    item_image_url: '',
  },
];`;

    const result = parseRecipeImages(text);
    expect(result['37100300009']).toBeUndefined();
  });

  // JSON format (remote live file) — double-quoted keys and values
  const mockJsonText = JSON.stringify([
    {
      recipe_id: '371030002',
      workshop_id: '1007',
      item_id: '37100300002',
      item_name: '5.56*45mm M855 APC',
      materials: [
        { material_id: '15020010028', material_name: 'Nhiên Liệu', material_image_url: 'https://www.playdeltaforce.com/basic_info/collections_mat1.png' },
        { material_id: '15020010021', material_name: 'Máy Mài Góc', material_image_url: 'https://www.playdeltaforce.com/basic_info/collections_mat2.png' },
        { material_id: '', material_name: '', material_image_url: '' },
        { material_id: '', material_name: '', material_image_url: '' },
      ],
      item_image_url: 'https://www.playdeltaforce.com/basic_info/bullets_142352295a1b83b2131b0434893dbf21.png',
    },
    {
      recipe_id: '371040002',
      item_id: '37100400002',
      item_name: '5.56*45mm M855A1 APC+',
      materials: [
        { material_id: '15080050024', material_name: 'Delta Force', material_image_url: 'https://www.playdeltaforce.com/basic_info/collections_mat3.png' },
        { material_id: '15020010007', material_name: 'Búa Phá Tường', material_image_url: 'https://www.playdeltaforce.com/basic_info/collections_mat4.png' },
        { material_id: '', material_name: '', material_image_url: '' },
        { material_id: '', material_name: '', material_image_url: '' },
      ],
      item_image_url: 'https://www.playdeltaforce.com/basic_info/bullets_c22edaad1506ce33ed539eaf7b05.png',
    },
  ]);

  it('JSON format: map item_image_url theo item_id', () => {
    const result = parseRecipeImages(mockJsonText);

    expect(result['37100300002']).toBe(
      'https://www.playdeltaforce.com/basic_info/bullets_142352295a1b83b2131b0434893dbf21.png',
    );
    expect(result['37100400002']).toBe(
      'https://www.playdeltaforce.com/basic_info/bullets_c22edaad1506ce33ed539eaf7b05.png',
    );
  });

  it('JSON format: khong tra ve material_image_url', () => {
    const result = parseRecipeImages(mockJsonText);

    const allUrls = Object.values(result);
    expect(allUrls).not.toContain('https://www.playdeltaforce.com/basic_info/collections_mat1.png');
    expect(allUrls).not.toContain('https://www.playdeltaforce.com/basic_info/collections_mat3.png');
  });

  it('JSON format: chi tra ve 1 URL cho moi item_id', () => {
    const result = parseRecipeImages(mockJsonText);

    expect(Object.keys(result)).toHaveLength(2);
  });
});

describe('getWorkshopItemName & getWorkshopItemImage — Service Logic', () => {
  const {
    getWorkshopItemName,
    getWorkshopItemImage,
    clearWorkshopDataCache,
    clearRecipeImageCache,
  } = require('../../src/services/workshop-data.service.js');

  const originalFetch = global.fetch;

  beforeEach(() => {
    clearWorkshopDataCache();
    clearRecipeImageCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('nên fetch và parse item name từ JS files, sau đó cache kết quả', async () => {
    const mockCollections = `var basic_info_collection = [{"prop_id":"101","language":{"vi":"M4A1 Assault Rifle\\u0020Special"}}];`;
    const mockRecipes = `var craft = [{"item_id":"202","item_name":"Armor Plate"}];`;

    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('collections_vi.js')) {
        return Promise.resolve(new Response(mockCollections, { status: 200 }));
      }
      return Promise.resolve(new Response(mockRecipes, { status: 200 }));
    }) as any;

    // Lần 1: Gọi fetch
    const name1 = await getWorkshopItemName('101');
    expect(name1).toBe('M4A1 Assault Rifle Special');

    const name2 = await getWorkshopItemName('202');
    expect(name2).toBe('Armor Plate');

    // Lần 2: Đọc từ cache, không fetch lại
    const nameCached = await getWorkshopItemName('101');
    expect(nameCached).toBe('M4A1 Assault Rifle Special');
    expect(global.fetch).toHaveBeenCalledTimes(2); // 1 cho collections, 1 cho recipes
  });

  it('nên fallback trả về "Item <id>" khi không tìm thấy item trong data', async () => {
    global.fetch = jest.fn(() => Promise.resolve(new Response('var a = [];', { status: 200 }))) as any;

    const fallbackName = await getWorkshopItemName('999999');
    expect(fallbackName).toBe('Item 999999');
  });

  it('nên xử lý network fetch fail gracefully và fallback an toàn', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Connection timeout'))) as any;

    const fallbackName = await getWorkshopItemName('500');
    expect(fallbackName).toBe('Item 500');
  });

  it('nên fetch và cache recipe images cho getWorkshopItemImage', async () => {
    const mockRecipeJs = `var craft = [{ item_id: '12345', item_image_url: 'https://example.com/img12345.png' }];`;

    global.fetch = jest.fn(() => Promise.resolve(new Response(mockRecipeJs, { status: 200 }))) as any;

    const img1 = await getWorkshopItemImage('12345');
    expect(img1).toBe('https://example.com/img12345.png');

    // Lần 2: Cache hit
    const imgCached = await getWorkshopItemImage('12345');
    expect(imgCached).toBe('https://example.com/img12345.png');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Missing item image
    const notFoundImg = await getWorkshopItemImage('999');
    expect(notFoundImg).toBe('');
  });
});
