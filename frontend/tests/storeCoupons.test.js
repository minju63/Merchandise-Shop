import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateCoupon } from '../src/pages/common/checkoutFormat.js';

const coupon = { discount_type: 'RATE', discount_value: 10, min_order_amount: 30000, max_discount: 5000, applies_to: 'ALL' };
const quote = { itemsAmount: 30000, deliveryFee: 3000, fulfillmentType: 'DELIVERY' };
test('매장별 상품 소계로 최소 금액을 판단하고 배송비를 제외한다', () => {
  assert.equal(estimateCoupon({ coupon }, quote).amount, 3000);
  assert.equal(estimateCoupon({ coupon }, { ...quote, itemsAmount: 29999 }).usable, false);
});
test('수량·선택 금액 변경 시 할인액 재계산과 최대 할인 적용', () => {
  assert.equal(estimateCoupon({ coupon }, { ...quote, itemsAmount: 40000 }).amount, 4000);
  assert.equal(estimateCoupon({ coupon }, { ...quote, itemsAmount: 100000 }).amount, 5000);
});
test('고정 할인도 상품 소계 및 최대 할인액을 초과하지 않는다', () => {
  const fixed = { ...coupon, discount_type: 'FIXED', discount_value: 5000, min_order_amount: 0 };
  assert.equal(estimateCoupon({ coupon: fixed }, { ...quote, itemsAmount: 1000 }).amount, 1000);
  assert.equal(estimateCoupon({ coupon: { ...fixed, max_discount: 0 } }, quote).amount, 0);
});
test('매장 쿠폰은 픽업·배달 동일 적용, 기존 배송비 쿠폰은 배송비 범위 유지', () => {
  assert.equal(estimateCoupon({ coupon }, { ...quote, fulfillmentType: 'PICKUP', deliveryFee: 0 }).amount, 3000);
  assert.equal(estimateCoupon({ coupon: { ...coupon, discount_type: 'FIXED', discount_value: 3000 }, rule: { deliveryFee: true } }, { ...quote, deliveryFee: 5000 }).amount, 3000);
});
