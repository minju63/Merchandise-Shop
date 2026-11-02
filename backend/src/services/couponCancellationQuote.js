// Future partial cancellation calculation ONLY. The app currently supports full cancellation
// and return/exchange requests, without an item cancellation/refund execution endpoint.
export function quotePartialCouponCancellation({ itemsAmount, couponDiscount, policy, cancelAmount,
  previouslyCanceledAmount = 0, previouslyRefundedAmount = 0 }) {
  for (const value of [itemsAmount, couponDiscount, cancelAmount, previouslyCanceledAmount, previouslyRefundedAmount]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('취소 금액을 확인해 주세요.');
  }
  if (couponDiscount > itemsAmount || cancelAmount === 0 || cancelAmount + previouslyCanceledAmount > itemsAmount)
    throw new RangeError('취소 가능한 상품금액을 초과했습니다.');
  if (couponDiscount > 0 && !policy) throw new RangeError('주문의 쿠폰 스냅샷이 필요합니다.');
  // The policy must come from the immutable order coupon_snapshot, never current coupons.
  if (policy && (!['FIXED', 'RATE'].includes(policy.discount_type) || !Number.isSafeInteger(policy.discount_value)
    || policy.discount_value < 0 || (policy.discount_type === 'RATE' && policy.discount_value > 100)
    || !Number.isSafeInteger(policy.min_order_amount) || policy.min_order_amount < 0
    || (policy.max_discount != null && (!Number.isSafeInteger(policy.max_discount) || policy.max_discount < 0))))
    throw new RangeError('주문의 쿠폰 스냅샷을 확인해 주세요.');
  const remainingItemsAmount = itemsAmount - previouslyCanceledAmount - cancelAmount;
  const paidItemsAmount = itemsAmount - couponDiscount;
  if (previouslyRefundedAmount > paidItemsAmount) throw new RangeError('기존 환불금액이 결제금액을 초과합니다.');
  const raw = policy?.discount_type === 'RATE' ? Math.floor(remainingItemsAmount * policy.discount_value / 100) : policy?.discount_value ?? 0;
  const remainingDiscount = policy && remainingItemsAmount >= policy.min_order_amount
    ? Math.min(raw, remainingItemsAmount, policy.max_discount ?? remainingItemsAmount, couponDiscount) : 0;
  const remainingPayable = remainingItemsAmount - remainingDiscount;
  const refundableTotal = Math.max(0, paidItemsAmount - remainingPayable);
  const additionalAmountDue = Math.max(0, remainingPayable + previouslyRefundedAmount - paidItemsAmount);
  return { remainingItemsAmount, remainingDiscount,
    refundAmount: Math.min(paidItemsAmount - previouslyRefundedAmount, Math.max(0, refundableTotal - previouslyRefundedAmount)),
    additionalAmountDue, canRefund: additionalAmountDue === 0,
    restoreCoupon: Boolean(policy) && remainingItemsAmount === 0,
    requiresSeparateAllocation: true }; // Shipping, points, global coupons and a refund ledger need their own allocation.
}
