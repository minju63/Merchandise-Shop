// 결제 모듈 진입점. 서비스는 이 파일만 부른다.
// 제공자 인터페이스: name, charge({ userId, amount }) → { transactionId, methodLabel, approvedAt, isMock }, cancel({ transactionId })
// 실제 PG 를 붙일 때는 realProvider.js 를 만들고 PAYMENT_PROVIDER 환경변수로 고르게 한다.
import * as mockProvider from './mockProvider.js';

const providers = { MOCK: mockProvider };

export function getPaymentProvider() {
  const key = (process.env.PAYMENT_PROVIDER || 'MOCK').toUpperCase();
  const provider = providers[key];
  if (!provider) {
    throw Object.assign(new Error('결제 제공자가 설정되지 않았어요.'), { status: 503, code: 'PAYMENT_UNAVAILABLE' });
  }
  return provider;
}
