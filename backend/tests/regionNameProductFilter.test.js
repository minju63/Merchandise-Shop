import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoreProductRepository } from '../src/repositories/storeProduct.repository.js';
import { REGION_NAMES } from '../src/utils/regionNames.js';
import { REGIONS } from '../../frontend/src/constants/regions.js';

test('카테고리 지역 필터는 검색 필터와 같은 17개 지역을 주소로 찾는다', async () => {
  assert.deepEqual(Object.keys(REGION_NAMES), REGIONS);
  const filtered = [];
  const stores = [
    { id: 'seoul-store', address: '서울특별시 강남구 테헤란로' },
    { id: 'chungbuk-store', address: '충청북도 청주시 상당구' },
    { id: 'jeju-store', address: '제주특별자치도 제주시' },
  ];
  const client = {
    from(table) {
      const query = {
        select() { return this; },
        eq() { return this; },
        not() { return this; },
        in(field, values) { filtered.push([table, field, values]); return this; },
        order() { return this; },
        range() {
          return Promise.resolve(table === 'stores'
            ? { data: stores, error: null }
            : { data: [], count: 0, error: null });
        },
      };
      return query;
    },
  };

  await createStoreProductRepository(client).findPage({ regionNames: ['충북', '제주'] });
  assert.deepEqual(filtered, [['store_products', 'store_id', ['chungbuk-store', 'jeju-store']]]);
});
