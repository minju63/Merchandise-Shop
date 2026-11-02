import assert from 'node:assert/strict';
import test from 'node:test';
import { COUPON_MESSAGES, couponIssueMessage, issueWithRecovery, reconcileCouponIssue, invalidCartCoupons, invalidCheckoutCoupons } from '../src/pages/common/couponSafety.js';
import { checkoutRecovery } from '../src/pages/common/checkoutRecovery.js';

const requested = [{ id: 'coupon-a', name: '매장 쿠폰', valid_until: '2027-01-01' }];
const state = { items: [], ownedCouponIds: ['coupon-a'], serverTime: '2026-11-02' };
const networkError = () => Object.assign(new Error('lost response'), { status: 0 });
const fail = async () => { throw networkError(); };
const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }; };

test('만료·소진·부분 발급 결과는 쿠폰 없음과 구분한다', () => {
  assert.equal(couponIssueMessage({ results: [{ status: 'COUPON_ISSUE_EXPIRED' }] }), '쿠폰 발급 기간이 종료되었습니다.');
  assert.equal(couponIssueMessage({ results: [{ status: 'COUPON_SOLD_OUT' }] }), '쿠폰이 모두 소진되었습니다.');
  assert.match(couponIssueMessage({ issuedCount: 1, failedCount: 1 }), /1개 발급, 1개 발급 실패/);
  assert.equal(couponIssueMessage({ results: [{ status: 'ALREADY_OWNED' }] }), '이미 발급받은 쿠폰입니다.');
});
test('발급 응답 소실 후 DB의 보유 상태를 재조회하여 성공 복구', async () => {
  const result = await issueWithRecovery({ issue: fail, read: async () => state, requested });
  assert.equal(result.issuedCount, 1); assert.equal(result.pending, false);
});
test('발급 요청이 아직 보이지 않으면 실패로 단정하지 않으며 재조회 실패도 UNKNOWN', async () => {
  const result = await issueWithRecovery({ issue: fail, read: async () => ({ ...state, ownedCouponIds: [] }), requested });
  assert.equal(result.pending, true);
  await assert.rejects(issueWithRecovery({ issue: fail, read: fail, requested }), (error) => error.pending === true);
});
test('재진입 시 만료된 보유 쿠폰도 발급 성공을 확인하고 서버 시각으로 미발급 만료 판정', () => {
  const ended = { ...state, serverTime: '2027-02-01' };
  assert.equal(reconcileCouponIssue(ended, requested).results[0].status, 'ISSUED');
  assert.equal(reconcileCouponIssue({ ...ended, ownedCouponIds: [] }, requested).results[0].status, 'COUPON_ISSUE_EXPIRED');
});
test('조회 네트워크 오류로 선택 쿠폰을 제거하지 않고 최소 미달·만료에는 제거', () => {
  const assignments = { A: { userCouponId: 'mine' } };
  const stores = [{ storeId: 'A', itemsTotal: 9999 }, { storeId: 'B', itemsTotal: 100000 }];
  assert.deepEqual(invalidCartCoupons(assignments, stores, { A: { isSuccess: false } }), []);
  assert.equal(invalidCartCoupons(assignments, stores, { A: { isSuccess: true, data: { items: [{ id: 'mine', usable: false, reason: 'MIN_ORDER_AMOUNT' }] } } })[0].reason, 'MIN_ORDER_AMOUNT');
  assert.equal(invalidCartCoupons(assignments, [{ storeId: 'A', itemsTotal: 0 }], {})[0].reason, 'MIN_ORDER_AMOUNT');
  const quote = { orders: [{ storeId: 'A', coupon: { userCouponId: 'mine', usable: false, reason: 'EXPIRED' } }, { storeId: 'B', coupon: null }] };
  assert.deepEqual(invalidCheckoutCoupons(quote), [{ storeId: 'A', userCouponId: 'mine', reason: 'EXPIRED' }]);
  assert.match(COUPON_MESSAGES.COUPON_EXPIRED, /주문금액을 다시 확인/);
  assert.deepEqual(invalidCheckoutCoupons({ orders: [{ coupon: { usable: false, reason: 'QUOTE_NOT_READY' } }] }), []);
});
test('주문 응답 소실 후 기존 주문 결과를 조회하고 같은 주문을 반환', async () => {
  const store = storage(); let sends = 0;
  const recovery = checkoutRecovery({ storage: store, accountId: 'A', makeId: () => 'request-a', send: async () => { sends++; throw networkError(); }, lookup: async () => ({ status: 'COMPLETED', result: { checkoutGroupId: 'group-a' } }) });
  assert.deepEqual(await recovery.submit({ amount: 'server calculated' }), { checkoutGroupId: 'group-a' });
  assert.equal(sends, 1); assert.equal(recovery.read(), null);
});
test('앱 종료·재진입 후 원래 ID/본문으로 재전송, 미확정 중 다른 내용 주문 차단', async () => {
  const store = storage(); const sent = [];
  const options = { storage: store, accountId: 'A', makeId: () => 'original', lookup: async () => ({ status: 'UNKNOWN' }) };
  const first = checkoutRecovery({ ...options, send: fail });
  await assert.rejects(first.submit({ items: ['original'] }), (error) => error.pending === true);
  const resumed = checkoutRecovery({ ...options, send: async (body, id) => { sent.push({ body, id }); return { checkoutGroupId: 'once' }; } });
  await assert.rejects(resumed.submit({ items: ['changed'] }), (error) => error.pending === true);
  await resumed.recover(true);
  assert.deepEqual(sent, [{ body: { items: ['original'] }, id: 'original' }]);
  assert.equal(resumed.read(), null);
});
test('계정별 보류 요청 격리·확정된 최초 실패만 정리·재조회 불가 시 보류 유지', async () => {
  const store = storage();
  const A = checkoutRecovery({ storage: store, accountId: 'A', makeId: () => 'a', send: fail, lookup: fail });
  await assert.rejects(A.submit({ a: 1 }), (error) => error.pending === true);
  const B = checkoutRecovery({ storage: store, accountId: 'B', makeId: () => 'b', send: async () => { throw Object.assign(new Error('expired'), { status: 409, code: 'COUPON_EXPIRED' }); }, lookup: fail });
  assert.equal(B.read(), null);
  await assert.rejects(B.submit({ b: 1 }), { code: 'COUPON_EXPIRED' });
  assert.equal(B.read(), null); assert.ok(A.read());
  await assert.rejects(A.recover(), (error) => error.pending === true);
  assert.ok(A.read());
});
