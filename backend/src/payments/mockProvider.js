// 모의 결제 제공자 — 실제 PG 호출 없이 항상 승인한다 (시연용).
// 실제 PG 로 바꿀 때는 같은 모양의 모듈(charge · cancel)을 만들어 payments/index.js 에서 고르면 된다.
import { randomUUID } from 'node:crypto';

export const name = 'MOCK';

// 결제 승인: { transactionId, methodLabel, approvedAt, isMock }
export async function charge({ amount }) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw Object.assign(new Error('결제 금액이 올바르지 않아요.'), { status: 400, code: 'INVALID_AMOUNT' });
  }
  return {
    transactionId: `mock_${randomUUID()}`,
    methodLabel: '모의결제',
    approvedAt: new Date().toISOString(),
    isMock: true,
  };
}

// 결제 취소(환불): 모의이므로 항상 성공한다.
export async function cancel({ transactionId }) {
  return { transactionId, canceledAt: new Date().toISOString(), isMock: true };
}
