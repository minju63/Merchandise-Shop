import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReviewKinds } from '../src/repositories/review.repository.js';
import { reviewListOptions } from '../src/controllers/review.controller.js';

test('가게 별점과 상품 별점은 분리하고 공개 리뷰 수만 더한다', () => {
  assert.deepEqual(summarizeReviewKinds({ count: 2, sum: 8 }, { count: 3, sum: 12 }), {
    storeReviewCount: 2,
    productReviewCount: 3,
    totalReviewCount: 5,
    storeRating: 4,
    productRating: 4,
  });
  assert.deepEqual(summarizeReviewKinds({ count: 0, sum: 0 }, { count: 3, sum: 12 }), {
    storeReviewCount: 0,
    productReviewCount: 3,
    totalReviewCount: 3,
    storeRating: null,
    productRating: 4,
  });
});

test('리뷰 조회는 기존 기본값을 유지하고 잘못된 필터와 범위를 거절한다', () => {
  const parse = (query) => reviewListOptions({ query });
  assert.deepEqual(parse({}), { type: 'store', sort: 'latest', page: 1, size: 20, mineOnly: false });
  assert.deepEqual(parse({ type: 'product', sort: 'likes', page: '3', size: '50', mineOnly: 'true' }), {
    type: 'product', sort: 'likes', page: 3, size: 50, mineOnly: true,
  });
  for (const query of [
    { type: 'all' }, { type: ['store', 'product'] }, { sort: 'random' },
    { page: '0' }, { page: '1.5' }, { page: '9007199254740991', size: '100' },
    { size: '101' }, { size: '0' }, { mineOnly: 'yes' },
  ]) assert.throws(() => parse(query), { status: 400 });
});
