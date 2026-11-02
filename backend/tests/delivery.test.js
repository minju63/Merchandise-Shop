import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDeliveryFee } from '../src/services/checkout.service.js';

const policy = {
  delivery_fee: 3000,
  min_order_amount: 10000,
  free_threshold: 50000,
};

test('전국 배송은 지역 데이터 없이 매장 기본 배송비를 적용한다', () => {
  assert.deepEqual(calculateDeliveryFee(20000, policy), {
    issue: null,
    deliveryFee: 3000,
  });
});

test('전국 배송도 매장의 무료배송 기준과 최소 주문금액은 유지한다', () => {
  assert.deepEqual(calculateDeliveryFee(50000, policy), {
    issue: null,
    deliveryFee: 0,
  });
  assert.deepEqual(calculateDeliveryFee(9000, policy), {
    issue: 'MIN_DELIVERY_ORDER_AMOUNT',
    deliveryFee: null,
  });
});
