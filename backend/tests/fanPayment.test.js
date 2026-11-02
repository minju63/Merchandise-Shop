import assert from 'node:assert/strict';
import test from 'node:test';
import { FAN_PAYMENT_OPTIONS, fanPaymentOptionLabel } from '../src/services/fan.service.js';

test('응원권 현금 구매에서 허용하는 모의 결제 채널을 표시명으로 바꾼다', () => {
  assert.deepEqual(FAN_PAYMENT_OPTIONS, {
    GOODSPICK_PAY: '굿즈픽페이',
    TOSS_PAY: '토스페이',
    NAVER_PAY: '네이버페이',
    KAKAO_PAY: '카카오페이',
    CARD: '카드 결제',
    VIRTUAL_ACCOUNT: '가상계좌',
    MOBILE: '휴대폰 결제',
  });
  assert.equal(fanPaymentOptionLabel('GOODSPICK_PAY'), '굿즈픽페이');
  assert.equal(fanPaymentOptionLabel('TOSS_PAY'), '토스페이');
  assert.equal(fanPaymentOptionLabel('REGISTERED_ACCOUNT'), null);
});

test('허용 목록에 없는 결제 채널은 서버에서 거절한다', () => {
  assert.throws(
    () => fanPaymentOptionLabel('BITCOIN'),
    { status: 400, code: 'FAN_INVALID_PAYMENT_OPTION' },
  );
  assert.throws(
    () => fanPaymentOptionLabel(),
    { status: 400, code: 'FAN_INVALID_PAYMENT_OPTION' },
  );
});
