import assert from 'node:assert/strict';
import test from 'node:test';
import { FAN_REFUND_DAYS, isPackRefundable, refundPack } from '../src/services/fan.service.js';

const DAY = 86400000;
const NOW = Date.parse('2026-11-02T12:00:00.000Z');

function pack(overrides = {}) {
  return {
    source: 'CASH',
    status: 'ACTIVE',
    quantity: 5,
    remaining: 5,
    created_at: new Date(NOW - 10 * DAY).toISOString(),
    ...overrides,
  };
}

test('응원권 환불 가능 기간은 구매 후 30일이다', () => {
  assert.equal(FAN_REFUND_DAYS, 30);
  assert.equal(isPackRefundable(pack({ created_at: new Date(NOW - 30 * DAY).toISOString() }), NOW), true);
  assert.equal(isPackRefundable(pack({ created_at: new Date(NOW - 30 * DAY - 1).toISOString() }), NOW), false);
});

test('현금·적립금 구매분 모두 남은 응원권이 있으면 일부만 써도 환불할 수 있다', () => {
  assert.equal(isPackRefundable(pack({ remaining: 4 }), NOW), true);
  assert.equal(isPackRefundable(pack({ source: 'CREDIT', remaining: 4 }), NOW), true);
  assert.equal(isPackRefundable(pack({ remaining: 0 }), NOW), false);
  assert.equal(isPackRefundable(pack({ status: 'REFUNDED' }), NOW), false);
});

test('환불 장수가 정수가 아니면 환불을 시작하지 않는다', async () => {
  await assert.rejects(
    () => refundPack('user-id', 'pack-id', { quantity: 1.5 }),
    { status: 400, code: 'FAN_INVALID_COUNT' },
  );
});
