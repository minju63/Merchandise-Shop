// 소비자 멤버십(베이직·플러스)의 '배달비 할인' 혜택: 매장마다 배달비에서 1,000원을 깎는다.
// 배달비가 1,000원보다 적거나 무료면 그 금액까지만 깎는다.
import * as repository from '../repositories/membership.repository.js';

export const MEMBERSHIP_DELIVERY_DISCOUNT = 1000;

// 이용 중인 소비자 멤버십이 있으면 매장당 할인 금액, 없으면 0. 해지를 예약했어도 이용 기간 안에는 혜택이 유지된다.
export async function getMembershipDeliveryDiscount(userId, now = new Date()) {
  if (!userId) return 0;
  const rows = await repository.listOwned(userId);
  const active = rows.some(
    (row) =>
      row.plan?.target === 'CONSUMER' &&
      ['ACTIVE', 'CANCELED'].includes(row.status) &&
      Date.parse(row.started_at) <= now.getTime() &&
      Date.parse(row.current_period_end) > now.getTime() &&
      (row.plan.benefits ?? []).includes('배달비 할인'),
  );
  return active ? MEMBERSHIP_DELIVERY_DISCOUNT : 0;
}

// 매장 한 곳의 실제 할인 금액 (배달비가 있을 때만)
export function applyDeliveryDiscount(deliveryFee, maxDiscount) {
  if (!Number.isInteger(deliveryFee) || deliveryFee <= 0 || !maxDiscount) return 0;
  return Math.min(maxDiscount, deliveryFee);
}
