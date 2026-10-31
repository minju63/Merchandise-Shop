// 응원 안내 화면 데이터. 순위·응원 현황은 3단계(응원 API)가 연결되기 전까지 목업이다.
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 운영 설정값의 기본 표시용 (실제 값은 2단계 fan_settings 에서 온다)
// 현금 구매 금액 4종 (1장 = 1,000원)
export const CHARGE_AMOUNTS = [5000, 10000, 30000, 50000];

// 적립금으로 한 번에 살 수 있는 장수 빠른 선택
export const CREDIT_BUY_QUANTITIES = [1, 5, 10];

// 응원 횟수를 무료 → 적립금 구매 → 현금 구매 응원권 순서로 나눈다. short 는 부족한 장수.
export function splitTickets(count, { free = 0, credit = 0, cash = 0 }) {
  const useFree = Math.min(free, count);
  const useCredit = Math.min(credit, count - useFree);
  const useCash = Math.min(cash, count - useFree - useCredit);
  return { free: useFree, credit: useCredit, cash: useCash, short: count - useFree - useCredit - useCash };
}

export const CHEER_PRICE = 1000;
export const DAILY_CHEER_LIMIT = 100;
export const MIN_PAID_AMOUNT = 30000;
export const CREDIT_RETURN_RATE = 105;

// 이번 주 응원 마감(목 23:59 KST)까지 남은 일수. 마감 후면 다음 주 목요일 기준.
export function thisWeekDeadline(now = new Date()) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const dayStart = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  const ahead = (4 - kst.getUTCDay() + 7) % 7;
  let deadline = dayStart + ahead * DAY_MS + (24 * 60 - 1) * 60 * 1000;
  if (deadline < kst.getTime()) deadline += 7 * DAY_MS;
  const days = Math.floor((deadline - dayStart) / DAY_MS);
  return { days, label: days === 0 ? 'D-DAY' : `D-${days}` };
}

export const CHEER_STEPS = [
  { title: '응원권 구매', desc: `응원권 1장 = 응원 1회 = ${CHEER_PRICE.toLocaleString('ko-KR')}원이에요. 5장부터 살 수 있어요.` },
  { title: '내 최애에게 응원', desc: `한 사람이 하루 최대 ${DAILY_CHEER_LIMIT}회까지 응원할 수 있어요.` },
  { title: '1위 최애가 배너 자리', desc: '응원 수가 가장 많은 최애가 홈 배너에 올라가요. 동점이면 먼저 그 수에 도달한 최애가 이겨요.' },
];

export const FREE_TICKET_RULES = [
  { reason: '매주 기본', amount: '1장', limit: '주 1장' },
  { reason: '매장 픽업 완료', amount: '건당 +1장', limit: '일 최대 5장' },
  { reason: '구매한 굿즈 리뷰', amount: '건당 +1장', limit: '일 최대 5장' },
  { reason: '굿즈 패스 회원', amount: '+1장', limit: '주 1장' },
];

// 현재 단계(index)는 요일로 정한다: 월~목 응원, 금 결과 발표, 토 꾸미기 제출, 일 게시 준비
export const SCHEDULE = [
  { key: 'cheer', day: '월 ~ 목 23:59', title: '응원', desc: '최애에게 응원을 보내요. 무료 응원권은 목요일 마감 후 소멸돼요.' },
  { key: 'result', day: '금', title: '결과 발표', desc: '진 최애에 쓴 유료 응원은 적립금으로 바로 돌려드려요.' },
  { key: 'design', day: '토 23:59까지', title: '전광판 꾸미기', desc: '1위 최애를 가장 많이 응원한 팬이 전광판을 꾸미고 검수를 요청해요.' },
  { key: 'publish', day: '다음 주', title: '검수 후 게시', desc: '승인된 디자인이 게시 날짜에 홈 배너로 나와요.' },
];

export function currentScheduleIndex(now = new Date()) {
  const day = new Date(now.getTime() + KST_OFFSET_MS).getUTCDay();
  if (day === 5) return 1;
  if (day === 6) return 2;
  if (day === 0) return 3;
  return 0;
}

// 실시간 순위 미리보기 (3단계에서 실제 응원 수로 바뀐다)
export const MOCK_RANKING = [
  { rank: 1, name: '미키마우스', count: 128 },
  { rank: 2, name: '헬로키티', count: 97 },
  { rank: 3, name: '미니마우스', count: 64 },
];

export const RETURN_RULES = [
  { title: '현금으로 산 응원권 → 적립금 105%', desc: '굿즈 구매나 응원권 구매에 쓸 수 있고 유효기간은 1년이에요.' },
  { title: '적립금으로 산 응원권 → 적립금 100%', desc: '적립금이 불어나지 않도록 쓴 만큼만 돌려드려요.' },
];

export const GUIDE_NOTICES = [
  '이긴 최애에 쓴 유료 응원은 배너 자리 비용으로 확정돼 반환되지 않아요.',
  `이긴 최애의 현금 구매 응원권 합계가 ${MIN_PAID_AMOUNT.toLocaleString('ko-KR')}원보다 적으면 배너를 게시하지 않고 전액 반환해요.`,
  '무료 응원권으로 한 응원은 반환되지 않아요.',
  '현금으로 산 응원권은 한 장도 쓰지 않았다면 구매 후 7일 안에 환불할 수 있어요.',
  '비방·광고·홍보성·응원과 무관한 내용의 전광판은 검수에서 반려될 수 있어요.',
  '주문을 취소·환불하면 그 주문으로 받은 무료 응원권은 회수돼요.',
];

