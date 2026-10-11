import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductService } from '../src/services/product.service.js';

const listings = [
  { id: 'listing-1', product_id: 'product-1' },
  { id: 'listing-2', product_id: 'product-2' },
  { id: 'listing-3', product_id: 'product-3' },
  { id: 'listing-4', product_id: 'product-4' },
].map((item) => ({
  ...item,
  status: 'ON_SALE', stock: 1, price: 10000,
  pickup_available: true, delivery_available: true,
  product: { name: item.product_id, thumbnail_url: null },
  store: { id: 'store-1', name: '굿즈샵', is_operating: true, pickup_available: true, delivery_available: true },
}));

test('후기와 찜 조건은 전체 후보에 적용한 뒤 개수와 페이지를 계산한다', async () => {
  const calls = [];
  const service = createProductService({
    storeProduct: {
      async findPage(filters) {
        calls.push(filters);
        const offset = (filters.page - 1) * filters.size;
        return { items: listings.slice(offset, offset + filters.size), totalCount: listings.length };
      },
    },
    engagement: {
      async findRatingAverages() {
        return new Map([['product-1', 4.5], ['product-2', 3.5], ['product-3', 4.0], ['product-4', 4.8]]);
      },
      async findWishlistCounts() {
        return new Map([['listing-1', 50], ['listing-2', 100], ['listing-3', 10], ['listing-4', 75]]);
      },
    },
  });

  const first = await service.getProducts({ ratingMin: 4, wishlistMin: 50, page: 1, size: 1 });
  assert.equal(first.totalCount, 2);
  assert.deepEqual(first.items.map((item) => item.storeProductId), ['listing-1']);

  const second = await service.getProducts({ ratingMin: 4, wishlistMin: 50, page: 2, size: 1 });
  assert.equal(second.totalCount, 2);
  assert.deepEqual(second.items.map((item) => item.storeProductId), ['listing-4']);
  assert.equal(calls.every((call) => call.page === 1 && call.size === 100), true);
});
