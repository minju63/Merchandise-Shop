import assert from 'node:assert/strict';
import test from 'node:test';
import { createStoreProductRepository } from '../src/repositories/storeProduct.repository.js';

test('판매순과 재고 많은 순은 상품 목록 쿼리에서 해당 컬럼으로 정렬한다', async () => {
  const orders = [];
  const query = {
    select() { return this; },
    not() { return this; },
    order(field, options) { orders.push({ field, options }); return this; },
    async range() { return { data: [], count: 0, error: null }; },
  };
  const repository = createStoreProductRepository({ from: () => query });

  await repository.findPage({ sort: 'sales' });
  await repository.findPage({ sort: 'stock' });

  assert.deepEqual(orders.filter((order) => order.field !== 'id').map((order) => order.field), ['sales_count', 'stock']);
  assert.ok(orders.filter((order) => order.field !== 'id').every((order) => order.options.ascending === false));
});
