import { formatWon } from '../my/orderFormat.js';

const KST = 'Asia/Seoul';

// "2026-10-04" — 한국 날짜 기준
function kstYmd(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KST }).format(date);
}

// 오늘부터 3일치 픽업 날짜 칩. 라벨 예: "오늘 10.04 (토)"
export function pickupDateOptions(now) {
  return [0, 1, 2].map((offset) => {
    const date = new Date(now.getTime() + offset * 86400000);
    const [, month, day] = kstYmd(date).split('-');
    const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: KST, weekday: 'short' }).format(
      date,
    );
    const prefix = ['오늘 ', '내일 ', ''][offset];
    return { value: kstYmd(date), label: `${prefix}${month}.${day} (${weekday})` };
  });
}

export function kstClock(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KST,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

// 매장 주소에서 구·동 수준만 보여 준다. "부산 부산진구 서면로 12" → "부산진구 서면로"
export function shortAddress(address) {
  const parts = String(address ?? '').split(' ');
  return parts.length > 2 ? parts.slice(1, 3).join(' ') : String(address ?? '');
}

const ISSUE_TEXT = {
  STORE_UNAVAILABLE: '지금은 주문할 수 없는 매장이에요',
  FULFILLMENT_REQUIRED: '수령 방법을 선택해 주세요',
  CONFLICTING_FULFILLMENT: '수령 방법을 선택해 주세요',
  FULFILLMENT_UNAVAILABLE: '선택한 수령 방법을 쓸 수 없는 상품이 있어요',
  PICKUP_DATE_REQUIRED: '픽업 날짜를 선택해 주세요',
  BUSINESS_HOURS_MISSING: '매장 영업시간 정보가 없어요',
  STORE_CLOSED_ON_DATE: '선택한 날짜에는 매장이 쉬어요',
  PICKUP_POLICY_MISSING: '매장 픽업 정보가 아직 없어요',
  PICKUP_HOLD_LIMIT: '이 날짜는 아직 픽업 예약을 받지 않아요',
  PICKUP_TIME_UNAVAILABLE: '선택한 날짜에는 픽업 가능한 시간이 없어요',
  ADDRESS_REQUIRED: '배송지를 등록해 주세요',
  DELIVERY_POLICY_MISSING: '매장 배달 정보가 아직 없어요',
  DELIVERY_AREAS_MISSING: '이 매장은 배달 지역이 없어요',
  DELIVERY_AREA_NOT_MATCHED: '선택한 배송지는 배달 가능 지역이 아니에요',
  MIN_DELIVERY_ORDER_AMOUNT: '최소 주문 금액을 채워 주세요',
};

const COUPON_REASON_TEXT = {
  COUPON_QUOTE_NOT_READY: '수령 조건을 먼저 정해 주세요',
};

export function issueText(code) {
  if (ISSUE_TEXT[code]) return ISSUE_TEXT[code];
  if (COUPON_REASON_TEXT[code]) return COUPON_REASON_TEXT[code];
  if (code.startsWith('COUPON_')) return '선택한 쿠폰은 이 주문에 쓸 수 없어요';
  return '주문 조건을 확인해 주세요';
}

const STOCK_TEXT = {
  NOT_ON_SALE: '판매하지 않는 상품이에요',
  NOT_OPEN_YET: '아직 판매 시작 전이에요',
  INSUFFICIENT_STOCK: '재고가 부족해요',
  MAX_PER_ORDER: '1회 주문 가능 수량을 넘었어요',
};

export function stockIssueText(issue) {
  return `${issue.productName}: ${STOCK_TEXT[issue.reason] ?? '주문할 수 없어요'}`;
}

export const DELIVERY_REQUESTS = ['문 앞', '경비실', '직접 받기'];

// 쿠폰을 쓸 수 있는지, 얼마나 깎이는지 화면에서 미리 가늠한다. 최종 금액은 서버 계산이 기준이다.
export function estimateCoupon(item, { itemsAmount, deliveryFee, fulfillmentType }) {
  const { coupon, rule } = item;
  let reason = null;
  if (coupon.min_order_amount > itemsAmount)
    reason = `${formatWon(coupon.min_order_amount)} 이상 주문할 때 쓸 수 있어요`;
  else if (coupon.applies_to === 'PICKUP' && fulfillmentType !== 'PICKUP')
    reason = '픽업 주문에만 쓸 수 있어요';
  else if (coupon.applies_to === 'DELIVERY' && fulfillmentType !== 'DELIVERY')
    reason = '배달 주문에만 쓸 수 있어요';
  let amount;
  if (rule?.deliveryFee) amount = deliveryFee ?? 0;
  else if (coupon.discount_type === 'RATE') {
    amount = Math.floor((itemsAmount * coupon.discount_value) / 100);
    if (coupon.max_discount) amount = Math.min(amount, coupon.max_discount);
  } else amount = coupon.discount_value;
  amount = Math.min(amount, itemsAmount + (rule?.deliveryFee ? (deliveryFee ?? 0) : 0));
  return { usable: reason === null, reason, amount };
}
