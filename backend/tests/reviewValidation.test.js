import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReviewInput } from '../src/services/reviewValidation.js';

const valid = {
  orderItemId: '11111111-1111-1111-1111-111111111111',
  rating: 5,
  content: '좋아요',
  images: [],
};

test('리뷰 입력은 별점 1~5와 주문 항목 ID를 검증한다', () => {
  assert.equal(validateReviewInput(valid).rating, 5);
  for (const rating of [0, 6, 3.5, '5']) {
    assert.throws(() => validateReviewInput({ ...valid, rating }), { status: 400 });
  }
  assert.throws(() => validateReviewInput({ ...valid, orderItemId: 'wrong' }), { status: 400 });
});

test('리뷰 내용과 사진 수의 상한을 검증한다', () => {
  assert.equal(validateReviewInput({ ...valid, content: '  좋아요  ' }).content, '좋아요');
  assert.throws(() => validateReviewInput({ ...valid, content: '가'.repeat(2001) }), {
    status: 400,
  });
  assert.throws(() => validateReviewInput({ ...valid, images: Array(6).fill({}) }), {
    status: 400,
  });
});
