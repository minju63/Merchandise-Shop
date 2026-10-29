// 담당: 연수
import assert from 'node:assert/strict';
import test from 'node:test';
import { quotePoints, normalizeCheckoutInput } from '../src/services/checkout.service.js';
import { sumConfirmedPoints } from '../src/services/user.service.js';

const orders = [{ totalAmount: 30000 }, { totalAmount: 20000 }];
const base = { pointsUse: 0, useExpectedPoints: false };

test('쓰지 않으면 결제금액의 1%가 주문별로 적립 예정이 된다', () => {
  const quote = quotePoints(5000, orders, base);
  assert.deepEqual(quote.allocations, [
    { used: 0, earn: 300 },
    { used: 0, earn: 200 },
  ]);
  assert.equal(quote.expectedAmount, 500);
  assert.equal(quote.earnAmount, 500);
});

test('적립금은 주문 순서대로 나눠 쓰고 남은 현금 결제액 기준으로 적립한다', () => {
  const quote = quotePoints(40000, orders, { ...base, pointsUse: 35000 });
  assert.deepEqual(quote.allocations, [
    { used: 30000, earn: 0 },
    { used: 5000, earn: 150 },
  ]);
});

test('적립예정금 바로 사용은 예정액만큼 차감하고 추가 적립이 없다', () => {
  const quote = quotePoints(0, orders, { ...base, useExpectedPoints: true });
  assert.equal(quote.expectedUse, 500);
  assert.equal(quote.earnAmount, 0);
  assert.equal(
    quote.allocations.reduce((sum, row) => sum + row.used, 0),
    500
  );
});

test('보유 1,000원 미만·초과·결제액 초과 사용은 거절 사유가 남는다', () => {
  assert.deepEqual(quotePoints(900, orders, { ...base, pointsUse: 500 }).issues, [
    'POINTS_MIN_BALANCE',
  ]);
  assert.deepEqual(quotePoints(2000, orders, { ...base, pointsUse: 3000 }).issues, [
    'POINTS_EXCEED_BALANCE',
  ]);
  assert.deepEqual(quotePoints(99999, orders, { ...base, pointsUse: 60000 }).issues, [
    'POINTS_EXCEED_PAYABLE',
  ]);
});

test('주문 입력은 적립금 사용 값을 검증한다', () => {
  const input = { mode: 'CART', cartItemIds: ['11111111-1111-4111-8111-111111111111'] };
  assert.equal(normalizeCheckoutInput({ ...input, pointsUse: 1500 }).pointsUse, 1500);
  assert.throws(() => normalizeCheckoutInput({ ...input, pointsUse: -1 }));
  assert.throws(() => normalizeCheckoutInput({ ...input, useExpectedPoints: 'yes' }));
});

test('잔액은 확정된 내역만 합산한다', () => {
  assert.equal(
    sumConfirmedPoints([
      { status: 'CONFIRMED', amount: 4200 },
      { status: 'PENDING', amount: 450 },
      { status: 'CONFIRMED', amount: -1000 },
      { status: 'CANCELED', amount: 300 },
    ]),
    3200
  );
});
