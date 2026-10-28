import { formatWon } from './orderFormat.js';

const KST = 'Asia/Seoul';

function kstDate(iso) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

// "10.05"
export function formatMonthDot(iso) {
  const p = kstDate(iso);
  return `${p.month}.${p.day}`;
}

// "2026.11.10"
export function formatFullDate(iso) {
  const p = kstDate(iso);
  return `${p.year}.${p.month}.${p.day}`;
}

// 마감일(한국시간 기준)까지 남은 일수. 오늘 마감이면 0
export function daysLeft(iso, now = new Date()) {
  const end = kstDate(iso);
  const today = kstDate(now);
  const toDay = (p) => Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  return Math.round((toDay(end) - toDay(today)) / 86400000);
}

// 01012345678 → 010-1234-5678
export function formatPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value ?? '';
}

// 쿠폰 큰 제목: "2,000원" / "10%" / "배달비 무료"
export function couponHeadline(userCoupon) {
  const { coupon, rule } = userCoupon;
  if (rule?.deliveryFee) return '배달비 무료';
  return coupon.discount_type === 'RATE'
    ? `${coupon.discount_value}%`
    : formatWon(coupon.discount_value);
}

const APPLIES = { PICKUP: '픽업 전용', DELIVERY: '배달 전용' };

// "15,000원 이상 · 전체 매장" / "최대 3,000원 · 굿즈하우스 서면점 · 픽업 전용"
export function couponConditions(userCoupon) {
  const { coupon } = userCoupon;
  const parts = [];
  if (coupon.min_order_amount > 0) parts.push(`${formatWon(coupon.min_order_amount)} 이상`);
  if (coupon.discount_type === 'RATE' && coupon.max_discount)
    parts.push(`최대 ${formatWon(coupon.max_discount)}`);
  parts.push(coupon.store?.name ?? '전체 매장');
  if (APPLIES[coupon.applies_to]) parts.push(APPLIES[coupon.applies_to]);
  return parts.join(' · ');
}

export const PAYMENT_TYPE_LABEL = { CARD: '카드', BANK_ACCOUNT: '계좌', EASY_PAY: '간편결제' };

export function paymentMethodName(method) {
  return method.last4 ? `${method.provider_name} ****${method.last4}` : method.provider_name;
}

// 요금제 혜택 한 줄. benefits가 문자열 배열이면 그대로, 아니면 요금제 필드로 만든다.
export function planBenefitText(plan) {
  if (
    Array.isArray(plan.benefits) &&
    plan.benefits.every((item) => typeof item === 'string') &&
    plan.benefits.length
  ) {
    return plan.benefits.join(' · ');
  }
  const parts = [];
  if (plan.preorder_enabled) parts.push('예약 구매');
  if (plan.alert_priority_minutes > 0) parts.push('재입고 알림 우선');
  return parts.join(' · ');
}
