import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductService } from '../src/services/product.service.js';

test('다른 굿즈 종류라도 장르·작품·캐릭터로 매장을 추천하고 무관한 상품은 제외한다', async () => {
  const source = { id: 'source', name: '루나 키링', work_title: '달빛 탐험', character_name: '루나' };
  const owners = Object.fromEntries(['current', 'genre', 'work', 'character'].map((id) => [id, { id, name: id, is_operating: true }]));
  const service = createProductService({
    product: {
      async findById() { return source; },
      async findSimilarityCandidates() {
        return [source, { id: 'genre' }, { id: 'work', work_title: '달빛탐험' }, { id: 'character', character_name: '루나' }, { id: 'unrelated' }];
      },
    },
    store: { async findById() { return owners.current; } },
    productImage: { async findByProductId() { return []; } },
    productCategory: {
      async findByProductId() { return [{ category_id: 'animation', category: { type: 'CONTENT' } }]; },
      async findProductIdsByCategories(filters) {
        assert.deepEqual(filters, { contentCategoryId: 'animation' });
        return ['source', 'genre'];
      },
    },
    storeProduct: {
      async findById() { return { id: 'listing', product_id: 'source', store_id: 'current', status: 'ON_SALE', stock: 10 }; },
      async findPage({ productIds }) {
        assert.deepEqual(new Set(productIds), new Set(['source', 'genre', 'work', 'character']));
        return { items: ['source', 'genre', 'work', 'character'].map((id) => ({
          id, product_id: id, store: owners[id === 'source' ? 'current' : id], product: { name: id },
        })), totalCount: 4 };
      },
    },
  });
  const stores = await service.getSimilarStores('listing');
  assert.deepEqual(stores.map((s) => s.id), ['character', 'work', 'genre']);
  const scope = await service.getSimilarScope('listing');
  assert.ok(scope.productIds.includes('source'));
});
