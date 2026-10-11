const KST = 'Asia/Seoul';

function parts(iso, options) {
  const out = new Intl.DateTimeFormat('en-GB', {
    timeZone: KST,
    hourCycle: 'h23',
    ...options,
  }).formatToParts(new Date(iso));
  return Object.fromEntries(out.map((part) => [part.type, part.value]));
}

export function formatWon(amount) {
  return `${Number(amount ?? 0).toLocaleString('ko-KR')}원`;
}

// "09.30"
export function formatMonthDay(iso) {
  const p = parts(iso, { month: '2-digit', day: '2-digit' });
  return `${p.month}.${p.day}`;
}

// "14:12"
export function formatClock(iso) {
  const p = parts(iso, { hour: '2-digit', minute: '2-digit' });
  return `${p.hour}:${p.minute}`;
}

// "2026.09.30 14:12"
export function formatDateTime(iso) {
  const p = parts(iso, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}

// 마감까지 "4시간 58분 남음"
export function formatRemaining(deadlineIso, now = new Date()) {
  const minutes = Math.floor((new Date(deadlineIso).getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return '픽업 시간이 지났어요';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}시간 ${rest}분 남음` : `${rest}분 남음`;
}

// "010-1234-5678" → "010-****-5678"
export function maskPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return phone;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function totalQuantity(items) {
  return (items ?? []).reduce((sum, item) => sum + item.quantity, 0);
}

export function itemsTitle(items) {
  if (!items?.length) return '';
  return items.length > 1
    ? `${items[0].product_name} 외 ${items.length - 1}건`
    : items[0].product_name;
}

export const FULFILLMENT_LABEL = { PICKUP: '픽업', DELIVERY: '배달' };

// 목록 카드의 상태 알약
export function statusPill(order) {
  switch (order.status) {
    case 'READY_FOR_PICKUP':
      return { label: '픽업 준비 완료', tone: 'strong' };
    case 'SHIPPING':
      return { label: '배달 중', tone: 'soft' };
    case 'PREPARING':
      return { label: '준비 중', tone: 'soft' };
    case 'COMPLETED':
      return {
        label: order.fulfillment_type === 'PICKUP' ? '수령 완료' : '배달 완료',
        tone: 'plain',
      };
    case 'CANCELED':
      return { label: '취소', tone: 'plain' };
    default:
      return { label: '주문 완료', tone: 'plain' };
  }
}

// 목록 카드의 안내 한 줄 { icon, text }
export function statusNote(order) {
  switch (order.status) {
    case 'READY_FOR_PICKUP':
      return { icon: 'clock', text: `${formatPickupDeadlineShort(order.pickup_deadline)} 픽업` };
    case 'SHIPPING':
      return { icon: 'truck', text: '배달이 시작됐어요' };
    case 'PREPARING':
      return { icon: 'clock', text: '상품을 준비하고 있어요' };
    case 'COMPLETED':
      return {
        icon: 'check',
        text: `${formatMonthDay(order.updated_at)} ${order.fulfillment_type === 'PICKUP' ? '수령' : '배달'} 완료`,
      };
    case 'CANCELED':
      return {
        icon: 'check',
        text: `${formatMonthDay(order.canceled_at ?? order.updated_at)} 취소됨`,
      };
    default:
      return { icon: 'clock', text: '매장에서 주문을 확인하고 있어요' };
  }
}

export function formatPickupDeadlineShort(iso) {
  if (!iso) return '';
  const today = parts(new Date(), { month: '2-digit', day: '2-digit' });
  const target = parts(iso, { month: '2-digit', day: '2-digit' });
  const clock = formatClock(iso);
  return today.month === target.month && today.day === target.day
    ? `오늘 ${clock}까지`
    : `${target.month}.${target.day} ${clock}까지`;
}

// 상세 화면 상단 문구
export function detailHeadline(order) {
  const pickup = order.fulfillment_type === 'PICKUP';
  switch (order.status) {
    case 'PREPARING':
      return { title: '상품을 준비하고 있어요', sub: '준비가 끝나면 알려드릴게요' };
    case 'READY_FOR_PICKUP':
      return { title: '픽업 준비가 완료됐어요', sub: '매장에서 QR 또는 픽업 번호를 보여주세요' };
    case 'SHIPPING':
      return { title: '배달 중이에요', sub: '매장에서 직접 배달하고 있어요' };
    case 'COMPLETED':
      return {
        title: pickup ? '수령이 완료됐어요' : '배달이 완료됐어요',
        sub: '이용해 주셔서 감사해요',
      };
    case 'CANCELED':
      return { title: '주문이 취소됐어요', sub: '결제 금액은 환불 처리돼요' };
    default:
      return { title: '주문이 접수됐어요', sub: '매장에서 주문을 확인하고 있어요' };
  }
}

// 진행 단계. 주문 상태가 4단계(PAID→PREPARING→READY/SHIPPING→COMPLETED)라 4칸으로 그린다.
export function timelineSteps(order) {
  const pickup = order.fulfillment_type === 'PICKUP';
  const defs = [
    ['PAID', '주문 완료'],
    ['PREPARING', '상품 준비'],
    [pickup ? 'READY_FOR_PICKUP' : 'SHIPPING', pickup ? '픽업 준비' : '배달 시작'],
    ['COMPLETED', pickup ? '픽업 완료' : '배달 완료'],
  ];
  const histories = order.histories ?? [];
  const reached = defs.findIndex(([status]) => status === order.status);
  return defs.map(([status, label], index) => {
    const history = histories.find((item) => item.to_status === status);
    const at = status === 'PAID' ? (history?.created_at ?? order.created_at) : history?.created_at;
    return {
      status,
      label,
      at: at ? formatClock(at) : '',
      done: reached >= 0 && index <= reached,
      current: index === reached,
    };
  });
}
