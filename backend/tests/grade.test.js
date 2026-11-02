import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GRADES,
  calculateGradeDiscount,
  couponPackMonth,
  couponPackPolicies,
  resolveGrade,
} from '../src/services/grade.service.js';
import { calculateStoreQuote, quotePoints } from '../src/services/checkout.service.js';
import { validateCouponPolicy } from '../src/services/coupon.service.js';

test('최근 구매 확정 금액 구간으로 등급과 다음 등급까지 남은 금액을 정한다', () => {
  assert.equal(resolveGrade(0).grade.code, 'WELCOME');
  assert.equal(resolveGrade(49999).grade.code, 'WELCOME');
  assert.equal(resolveGrade(50000).grade.code, 'FRIENDS');
  assert.equal(resolveGrade(499999).grade.code, 'BRONZE');
  assert.equal(resolveGrade(499999).remainingToNext, 1);
  const top = resolveGrade(5000000);
  assert.equal(top.grade.code, 'PLATINUM');
  assert.equal(top.nextGrade, null);
  assert.equal(top.remainingToNext, 0);
});

test('등급이 오를수록 할인율·적립율·쿠폰 수가 줄지 않는다', () => {
  for (let i = 1; i < GRADES.length; i += 1) {
    assert.ok(GRADES[i].minAmount > GRADES[i - 1].minAmount);
    assert.ok(GRADES[i].discountRate >= GRADES[i - 1].discountRate);
    assert.ok(GRADES[i].earnRate >= GRADES[i - 1].earnRate);
    assert.ok(GRADES[i].couponPack.length >= GRADES[i - 1].couponPack.length);
  }
});

test('등급 할인은 원 단위 내림이고 남은 결제 금액을 넘지 않는다', () => {
  assert.equal(calculateGradeDiscount(33333, 3), 999);
  assert.equal(calculateGradeDiscount(10000, 5, 300), 300);
  assert.equal(calculateGradeDiscount(10000, 0), 0);
});

test('주문 견적은 쿠폰 할인과 등급 할인을 함께 반영한다', () => {
  const group = { storeId: 's', itemsAmount: 50000, items: [] };
  const fulfillment = { deliveryFee: 3000, option: { fulfillmentType: 'DELIVERY' } };
  const quote = calculateStoreQuote(group, fulfillment, null, 'u', true, new Date(), 3);
  assert.equal(quote.gradeDiscountAmount, 1500);
  assert.equal(quote.couponDiscountAmount, 0);
  assert.equal(quote.discountAmount, 1500);
  assert.equal(quote.totalAmount, 51500);
});

test('적립 예정금은 등급 적립율로 계산한다', () => {
  const orders = [{ totalAmount: 10000 }];
  const input = { pointsUse: 0, useExpectedPoints: false };
  assert.equal(quotePoints(0, orders, input).earnAmount, 100);
  assert.equal(quotePoints(0, orders, input, 4).earnAmount, 400);
});

test('쿠폰팩 정책은 기존 쿠폰 규칙을 통과하고 이번 달 말일까지 유효하다', () => {
  const month = couponPackMonth(new Date('2026-11-15T03:00:00Z'));
  assert.equal(month.key, '2611');
  assert.equal(month.validFrom, '2026-10-31T15:00:00.000Z');
  assert.equal(month.validUntil, '2026-11-30T14:59:59.000Z');
  for (const grade of GRADES) {
    const policies = couponPackPolicies(grade, month);
    assert.equal(new Set(policies.map((row) => row.code)).size, policies.length);
    for (const policy of policies) {
      assert.ok(policy.code.length <= 30, policy.code);
      validateCouponPolicy({ ...policy, issued_count: 0, is_active: true });
      if (policy.applies_to === 'DELIVERY') assert.ok(policy.code.startsWith('DELIVERY_'));
    }
  }
});
