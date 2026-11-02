export const COUPON_MESSAGES = {
  COUPON_ISSUE_EXPIRED: '쿠폰 발급 기간이 종료되었습니다.',
  COUPON_SOLD_OUT: '쿠폰이 모두 소진되었습니다.',
  COUPON_EXPIRED: '선택한 쿠폰의 사용 기간이 종료되었습니다. 주문금액을 다시 확인해 주세요.',
  COUPON_USED: '이미 사용한 쿠폰입니다. 주문금액을 다시 확인해 주세요.',
  COUPON_MIN_ORDER_AMOUNT: '주문금액이 변경되어 쿠폰 적용 조건을 충족하지 않습니다.',
  COUPON_NOT_USABLE: '쿠폰 사용 조건이 변경되었습니다. 주문금액을 다시 확인해 주세요.',
  COUPON_NOT_OWNED: '본인 보유 쿠폰을 다시 확인해 주세요.',
  COUPON_NOT_FOUND: '쿠폰을 찾지 못했습니다. 목록을 다시 확인해 주세요.',
  COUPON_NOT_ISSUABLE: '현재 발급할 수 없는 쿠폰입니다.',
  ALREADY_OWNED: '이미 발급받은 쿠폰입니다.',
  ISSUED: '쿠폰이 발급되었습니다.',
  UNKNOWN: '발급 결과를 확인하지 못했습니다. 상태를 다시 확인해 주세요.',
};
export const uncertainRequest = (error) => error?.status === 0 || error?.status >= 500 || error?.code === 'NETWORK_ERROR';

export function couponIssueMessage(result) {
  if (result.pending) return COUPON_MESSAGES.UNKNOWN;
  if (result.issuedCount && result.failedCount) return `쿠폰 ${result.issuedCount}개 발급, ${result.failedCount}개 발급 실패했습니다.`;
  if (result.issuedCount) return COUPON_MESSAGES.ISSUED;
  const failures = result.results?.filter((row) => !['ISSUED', 'ALREADY_OWNED'].includes(row.status)) ?? [];
  if (failures.length) return COUPON_MESSAGES[failures[0].status] ?? COUPON_MESSAGES.COUPON_NOT_ISSUABLE;
  return COUPON_MESSAGES.ALREADY_OWNED;
}

// Never infer failure merely because an in-flight request is not yet visible.
export function reconcileCouponIssue(state, requested) {
  const owned = new Set(state.ownedCouponIds ?? state.items.filter((row) => row.owned).map((row) => row.id));
  const results = requested.map((coupon) => {
    const current = state.items.find((row) => row.id === coupon.id);
    const status = owned.has(coupon.id) ? 'ISSUED'
      : Date.parse(coupon.valid_until) <= Date.parse(state.serverTime) ? 'COUPON_ISSUE_EXPIRED'
        : current?.soldOut ? 'COUPON_SOLD_OUT' : 'UNKNOWN';
    return { couponId: coupon.id, name: coupon.name, status };
  });
  return { ...state, results, issuedCount: results.filter((row) => row.status === 'ISSUED').length,
    failedCount: results.filter((row) => !['ISSUED', 'UNKNOWN'].includes(row.status)).length,
    pending: results.some((row) => row.status === 'UNKNOWN') };
}

export async function issueWithRecovery({ issue, read, requested }) {
  try { return await issue(); }
  catch (error) {
    if (!uncertainRequest(error)) throw error;
    try { return reconcileCouponIssue(await read(), requested); }
    catch {
      throw Object.assign(new Error(COUPON_MESSAGES.UNKNOWN), { code: 'COUPON_ISSUE_UNKNOWN', pending: true });
    }
  }
}

export function invalidCheckoutCoupons(quote) {
  const invalid = (quote?.orders ?? []).filter((row) => row.coupon && !row.coupon.usable && row.coupon.reason !== 'QUOTE_NOT_READY')
    .map((row) => ({ storeId: row.storeId, userCouponId: row.coupon.userCouponId, reason: row.coupon.reason }));
  if (quote?.cartCoupon && !quote.cartCoupon.usable && quote.cartCoupon.reason !== 'QUOTE_NOT_READY') invalid.push({ storeId: null, userCouponId: quote.cartCoupon.userCouponId, reason: quote.cartCoupon.reason });
  return invalid;
}
export function couponReasonMessage(reason) {
  return COUPON_MESSAGES[`COUPON_${reason}`] ?? COUPON_MESSAGES.COUPON_NOT_USABLE;
}

export function invalidCartCoupons(assignments, stores, results) {
  return Object.entries(assignments).flatMap(([storeId, assignment]) => {
    const store = stores.find((row) => row.storeId === storeId);
    if (!store || store.itemsTotal <= 0) return [{ storeId, id: assignment.userCouponId, reason: 'MIN_ORDER_AMOUNT' }];
    const query = results[storeId];
    if (!query?.isSuccess || query.isFetching) return [];
    const coupon = query.data.items.find((row) => row.id === assignment.userCouponId);
    return coupon?.usable ? [] : [{ storeId, id: assignment.userCouponId, reason: coupon?.reason ?? 'NOT_OWNED' }];
  });
}
