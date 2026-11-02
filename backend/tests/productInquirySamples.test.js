import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductInquiryService } from '../src/services/productInquiry.service.js';
import { createProductInquiryRepository, demoInquiryIds } from '../src/repositories/productInquiry.repository.js';

const storeId = '10000000-0000-4000-8000-000000000001';
test('비로그인 요청은 지정된 샘플만 반환하고 개인 문의 조회를 실행하지 않는다', async () => {
  const service = createProductInquiryService({
    products: { async getProductDetail() { return { storeId }; } },
    repository: {
      async findDemoByStoreId(id) { assert.equal(id, storeId); return [{ id: 'sample', isSample: true }]; },
      async findByStoreId() { assert.fail('Anonymous request must not read private inquiries'); },
    },
  });
  const result = await service.getProductInquiries('listing');
  assert.deepEqual(result.items, []);
  assert.equal(result.totalCount, 0);
  assert.equal(result.samples[0].isSample, true);
});
test('로그인 요청은 개인 문의의 사용자 범위를 유지한다', async () => {
  const service = createProductInquiryService({
    products: { async getProductDetail() { return { storeId }; } },
    repository: {
      async findDemoByStoreId() { return []; },
      async findByStoreId(id, options) {
        assert.equal(id, storeId);
        assert.equal(options.userId, 'viewer');
        return { items: [{ id: 'private' }], totalCount: 1 };
      },
    },
  });
  assert.equal((await service.getProductInquiries('listing', { userId: 'viewer' })).items[0].id, 'private');
});
test('샘플 공개 쿼리는 정확한 ID·테스트 작성자·매장·카테고리를 모두 제한한다', async () => {
  const calls = [];
  const query = { select() { return this; }, in(...args) { calls.push(['in', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; }, like(...args) { calls.push(['like', ...args]); return this; },
    async order() { return { data: [{ id: 'sample' }], error: null }; } };
  const result = await createProductInquiryRepository({ from() { return query; } }).findDemoByStoreId(storeId);
  assert.ok(calls.some(([method, field, ids]) => method === 'in' && field === 'id' && ids.length === 3));
  for (const field of ['store_id', 'user_id', 'category']) assert.ok(calls.some(([method, name]) => method === 'eq' && name === field));
  assert.equal(result[0].isSample, true);
  assert.notDeepEqual(demoInquiryIds(storeId), demoInquiryIds('10000000-0000-4000-8000-000000000002'));
  assert.throws(() => demoInquiryIds('bad'), { status: 400 });
});
