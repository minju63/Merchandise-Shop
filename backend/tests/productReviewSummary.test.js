import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProductReviews } from '../src/repositories/review.repository.js';

test('리뷰 만족도는 4점 이상 비율이며 빈 리뷰는 만족도를 만들지 않는다', () => {
  assert.deepEqual(summarizeProductReviews([]), { reviewCount: 0, averageRating: null, satisfactionPercent: null });
  assert.deepEqual(summarizeProductReviews([{ rating: 5 }, { rating: 4 }, { rating: 3 }, { rating: 2 }]), {
    reviewCount: 4, averageRating: 3.5, satisfactionPercent: 50,
  });
});
