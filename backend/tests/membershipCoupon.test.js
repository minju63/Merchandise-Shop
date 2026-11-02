import test from 'node:test';
import assert from 'node:assert/strict';

import { couponPackMonth, couponPackPolicies, GRADES } from '../src/services/grade.service.js';
import {
  MEMBERSHIP_COUPON_PACKS,
  membershipCouponPolicies,
} from '../src/services/membershipCoupon.service.js';
import { validateCouponPolicy } from '../src/services/coupon.service.js';

const PLANS = [
  { code: 'CONSUMER_BASIC', name: '베이직' },
  { code: 'CONSUMER_PLUS', name: '플러스' },
];

test('멤버십 쿠폰 수는 베이직 1장, 플러스 3장이다', () => {
  assert.equal(MEMBERSHIP_COUPON_PACKS.CONSUMER_BASIC.length, 1);
  assert.equal(MEMBERSHIP_COUPON_PACKS.CONSUMER_PLUS.length, 3);
});

test('멤버십 쿠폰 정책은 기존 쿠폰 규칙을 통과하고 이번 달 말일까지 유효하다', () => {
  const month = couponPackMonth(new Date('2026-11-15T03:00:00Z'));
  for (const plan of PLANS) {
    const policies = membershipCouponPolicies(plan, month);
    assert.equal(new Set(policies.map((row) => row.code)).size, policies.length);
    for (const policy of policies) {
      assert.ok(policy.code.length <= 30, policy.code);
      assert.equal(policy.valid_until, '2026-11-30T14:59:59.000Z');
      validateCouponPolicy({ ...policy, issued_count: 0, is_active: true });
      if (policy.applies_to === 'DELIVERY') assert.ok(policy.code.startsWith('DELIVERY_'));
    }
  }
});

test('멤버십 쿠폰 코드는 등급 쿠폰 코드와 겹치지 않는다', () => {
  const month = couponPackMonth(new Date('2026-11-15T03:00:00Z'));
  const gradeCodes = new Set(GRADES.flatMap((grade) => couponPackPolicies(grade, month).map((row) => row.code)));
  for (const plan of PLANS) {
    for (const policy of membershipCouponPolicies(plan, month)) assert.ok(!gradeCodes.has(policy.code));
  }
});

test('쿠폰팩이 없는 플랜은 정책이 비어 있다', () => {
  const month = couponPackMonth(new Date('2026-11-15T03:00:00Z'));
  assert.deepEqual(membershipCouponPolicies({ code: 'STORE_BASIC', name: '입점 베이직' }, month), []);
});
