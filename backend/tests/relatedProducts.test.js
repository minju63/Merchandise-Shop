import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductService } from '../src/services/product.service.js';

for (const hasContent of [true, false]) {
  test(`함께 보면 좋은 상품은 콘텐츠 장르로 추천한다 (장르 ${hasContent ? '있음' : '없음'})`, async () => {
    let relatedCalls = 0;
    const listing = { id: 'listing', product_id: 'product', store_id: 'store', status: 'ON_SALE', stock: 10 };
    const service = createProductService({
      storeProduct: {
        async findById() { return listing; },
        async findPage(filters) {
          assert.deepEqual(filters.relatedProductIds, ['same-genre']);
          assert.equal(filters.excludeStoreProductId, 'listing');
          return { items: [], totalCount: 0 };
        },
      },
      product: { async findById() { return { id: 'product', name: '상품' }; } },
      store: { async findById() { return { id: 'store', is_operating: true }; } },
      productImage: { async findByProductId() { return []; } },
      productCategory: {
        async findByProductId() {
          return [
            { category_id: 'keyring', category: { type: 'GOODS' } },
            ...(hasContent ? [{ category_id: 'film', category: { type: 'CONTENT' } }] : []),
          ];
        },
        async findRelatedProductIds({ categoryIds, productId }) {
          relatedCalls++;
          assert.deepEqual(categoryIds, ['film']);
          assert.equal(productId, 'product');
          return ['same-genre'];
        },
      },
    });
    assert.deepEqual(await service.getRelatedProducts('listing'), []);
    assert.equal(relatedCalls, hasContent ? 1 : 0);
  });
}
