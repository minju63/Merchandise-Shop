// These SECURITY INVOKER RPCs are executable by service_role only.
// The caller's user ID comes from verified Supabase Auth in the API middleware.
export async function couponRpc(name, args) {
  const { supabase } = await import('../lib/supabase.js');
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const conflict = error.code === 'P0001';
    let details;
    try { details = JSON.parse(error.details); } catch { /* older RPCs have no structured detail */ }
    const knownCodes = ['COUPON_ISSUE_EXPIRED', 'COUPON_SOLD_OUT', 'COUPON_EXPIRED', 'COUPON_USED', 'COUPON_NOT_OWNED', 'COUPON_NOT_USABLE', 'COUPON_MIN_ORDER_AMOUNT', 'SALE_CHANGED'];
    const code = conflict && knownCodes.includes(details?.code) ? details.code : conflict ? (error.message === '쿠폰 발급 수량이 모두 소진됐어요.' ? 'COUPON_SOLD_OUT' : 'COUPON_ORDER_CHANGED') : 'DATABASE_ERROR';
    const messages = {
      COUPON_EXPIRED: '선택한 쿠폰의 사용 기간이 종료되었습니다. 주문금액을 다시 확인해 주세요.',
      SALE_CHANGED: '상품 가격·재고가 변경됐어요. 주문금액을 다시 확인해 주세요.',
    };
    throw Object.assign(new Error(messages[code] ?? (conflict ? error.message : '쿠폰·주문 DB 처리에 실패했어요. 잠시 후 다시 시도해 주세요.')), {
      status: conflict ? 409 : 503,
      code,
      details: knownCodes.includes(code) ? details : null,
      databaseCode: error.code,
    });
  }
  return data;
}
