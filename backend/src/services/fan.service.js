// 팬 응원 전광판 서비스: 응원권 구매 · 응원하기 · 순위
import * as repository from '../repositories/fan.repository.js';
import { getPaymentProvider } from '../payments/index.js';
import { resolvePaymentMethodSelection } from './paymentMethod.service.js';
import { paymentMethodLabel } from './checkout.service.js';

const failure = (status, code, message) => Object.assign(new Error(message), { status, code });

const CHARGE_AMOUNTS = [5000, 10000, 30000, 50000];

// DB 함수가 던지는 FAN_* 오류를 화면에 보여 줄 메시지로 바꾼다.
const DB_ERRORS = {
  FAN_CHEER_CLOSED: [409, '이번 주 응원이 마감됐어요. 다음 주 월요일에 다시 응원할 수 있어요.'],
  FAN_INVALID_SLOT: [400, '응원 유형을 확인해 주세요.'],
  FAN_NOT_AGREED: [400, '동의 항목에 모두 체크해 주세요.'],
  FAN_INVALID_MESSAGE: [400, '응원 한마디는 1~30자로 입력해 주세요.'],
  FAN_INVALID_NICKNAME: [400, '표시 닉네임은 1~20자로 입력해 주세요.'],
  FAN_BANNED_WORD: [400, '사용할 수 없는 표현이 들어 있어요.'],
  FAN_INVALID_COUNT: [400, '응원 횟수를 확인해 주세요.'],
  FAN_CHARACTER_NOT_FOUND: [404, '최애를 찾을 수 없어요.'],
  FAN_ANNIVERSARY_NOT_NEXT_WEEK: [400, '다음 주에 기념일이 있는 최애만 기념일 응원을 보낼 수 있어요.'],
  FAN_DAILY_LIMIT: [409, '하루에 최대 100회까지 응원할 수 있어요. 남은 횟수를 확인해 주세요.'],
  FAN_NOT_ENOUGH_TICKETS: [409, '응원권이 부족해요. 응원권을 구매해 주세요.'],
  FAN_NOT_ENOUGH_CREDIT: [409, '적립금이 부족해요.'],
  FAN_PACK_NOT_REFUNDABLE: [409, '환불할 수 없는 응원권이에요. 사용했거나 환불 가능 기간이 지났어요.'],
  FAN_INVALID_PAYMENT: [400, '결제 정보를 확인할 수 없어요.'],
  FAN_INVALID_CHARGE_AMOUNT: [400, '충전 금액을 확인해 주세요.'],
  FAN_DESIGN_FORBIDDEN: [403, '이 전광판을 꾸밀 권한이 없어요.'],
  FAN_DESIGN_LOCKED: [409, '지금은 수정할 수 없어요. 제출 기한이 지났거나 이미 검수 중이에요.'],
  FAN_DESIGN_INVALID: [400, '디자인 값이 올바르지 않아요.'],
  FAN_DESIGN_INVALID_MESSAGE: [400, '메인 문구는 1~16자로 입력해 주세요.'],
  FAN_DESIGN_INVALID_PATH: [400, '이미지 경로가 올바르지 않아요.'],
  FAN_DESIGN_EMPTY: [400, '메인 문구를 입력한 뒤 검수를 요청해 주세요.'],
  FAN_WEEK_NOT_FOUND: [404, '주차를 찾을 수 없어요.'],
};

function translate(error) {
  const known = DB_ERRORS[error.message];
  if (!known) throw error;
  throw failure(known[0], error.message, known[1]);
}

// 로그인하지 않아도 보이는 이번 주 요약
export async function getPublicWeek() {
  const week = await repository.currentWeek();
  return {
    weekId: week.id,
    applyEndAt: week.apply_end_at,
    announceAt: week.announce_at,
    submitDeadlineAt: week.submit_deadline_at,
    open: new Date() <= new Date(week.apply_end_at),
    minPaidAmount: week.min_paid_amount,
    totalCheers: await repository.countWeekCheers(week.id),
  };
}

export const getMe = (userId) => repository.balance(userId).catch(translate);

// 가장 최근에 정산된 주차의 내 결과
export const getResults = (userId) => repository.resultFor(userId).catch(translate);

// 내 응원권 묶음과 적립금 내역
export async function getTickets(userId) {
  const [packs, credit] = await Promise.all([repository.findTicketPacks(userId), repository.findCreditLedger(userId)]);
  const refundDays = 7;
  return {
    packs: packs.map((pack) => ({
      id: pack.id,
      source: pack.source,
      quantity: pack.quantity,
      remaining: pack.remaining,
      unitPrice: pack.unit_price,
      status: pack.status,
      expiresAt: pack.expires_at,
      createdAt: pack.created_at,
      refundable: pack.status === 'ACTIVE' && pack.remaining > 0
        && (pack.source === 'CREDIT'
          || (pack.remaining === pack.quantity && Date.now() - new Date(pack.created_at).getTime() < refundDays * 86400000)),
    })),
    credit: credit.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
  };
}

// 현금 구매: 결제 모듈(모의) 승인 → payments 행 → 응원권 묶음
export async function buyWithCash(userId, body = {}) {
  const amount = Number(body.amount);
  if (!CHARGE_AMOUNTS.includes(amount)) {
    throw failure(400, 'FAN_INVALID_CHARGE_AMOUNT', DB_ERRORS.FAN_INVALID_CHARGE_AMOUNT[1]);
  }
  if (body.paymentAgreed !== true) {
    throw failure(400, 'FAN_PAYMENT_NOT_AGREED', '결제에 동의해 주세요.');
  }
  // 멤버십 구독과 같이 내가 등록한 결제수단만 쓸 수 있다
  const method = await resolvePaymentMethodSelection(userId, body.paymentMethodId);
  const approval = await getPaymentProvider().charge({ userId, amount });
  const paymentId = await repository.insertChargePayment(userId, {
    amount,
    ...approval,
    methodLabel: paymentMethodLabel(method),
    paymentMethodId: method.id,
  });
  return repository.buyWithCash(userId, paymentId).catch(translate);
}

// 적립금 구매: 적립금 1,000원 = 응원권 1장
export async function buyWithCredit(userId, body = {}) {
  return repository.buyWithCredit(userId, Number(body.quantity)).catch(translate);
}

// 미사용 응원권 환불: 적립금 구매분은 적립금으로 복원, 현금 구매분은 결제 취소(모의)
export async function refundPack(userId, packId) {
  let result;
  try {
    result = await repository.refundPack(userId, packId);
  } catch (error) {
    if (error.code === '22P02') throw failure(404, 'FAN_PACK_NOT_REFUNDABLE', DB_ERRORS.FAN_PACK_NOT_REFUNDABLE[1]);
    return translate(error);
  }
  if (result.source === 'CASH') {
    const payment = await repository.findPayment(result.paymentId);
    await getPaymentProvider().cancel({ transactionId: payment.pg_transaction_id });
    await repository.markPaymentCanceled(result.paymentId);
  }
  return { source: result.source, amount: result.amount };
}

// 기념일 날짜 탭: 다음 주 게시 기간에 기념일이 있는 날짜와 그날의 최애들
export async function listAnniversaryDates() {
  const week = await repository.currentWeek();
  const rows = await repository.findAnniversaries({ from: week.publish_start, to: week.publish_end });
  const byDate = new Map();
  rows.forEach((row) => {
    if (!row.characters) return;
    const list = byDate.get(row.event_date) ?? [];
    list.push({ anniversaryId: row.id, kind: row.kind, label: row.label, characterId: row.characters.id, name: row.characters.name });
    byDate.set(row.event_date, list);
  });
  return { dates: [...byDate.entries()].map(([date, items]) => ({ date, items })) };
}

// slot=ANNIV 이면 다음 주에 기념일이 있는 최애만, FREE 이면 전체에서 검색한다.
export async function listCharacters({ slot, q }) {
  const query = String(q ?? '').trim().replace(/[%,()]/g, ' ').slice(0, 30);

  if (slot === 'ANNIV') {
    const week = await repository.currentWeek();
    const rows = await repository.findAnniversaries({ from: week.publish_start, to: week.publish_end });
    const byCharacter = new Map();
    rows.forEach((row) => {
      if (!row.characters) return;
      if (query && !`${row.characters.name} ${row.characters.work_title}`.includes(query)) return;
      const entry = byCharacter.get(row.characters.id) ?? {
        id: row.characters.id,
        name: row.characters.name,
        workTitle: row.characters.work_title,
        imageUrl: row.characters.profile_image_url,
        anniversaries: [],
      };
      entry.anniversaries.push({ id: row.id, kind: row.kind, eventDate: row.event_date, label: row.label });
      byCharacter.set(row.characters.id, entry);
    });
    return { slot, characters: [...byCharacter.values()] };
  }

  const rows = await repository.searchCharacters(query);
  return {
    slot: 'FREE',
    characters: rows.map((row) => ({
      id: row.id,
      name: row.name,
      workTitle: row.work_title,
      imageUrl: row.profile_image_url,
      anniversaries: [],
    })),
  };
}

export async function sendCheers(userId, body = {}) {
  if (!body.characterId) throw failure(404, 'FAN_CHARACTER_NOT_FOUND', DB_ERRORS.FAN_CHARACTER_NOT_FOUND[1]);
  try {
    return await repository.send(userId, {
      slotType: body.slotType,
      characterId: body.characterId,
      anniversaryId: body.anniversaryId,
      message: body.message,
      nickname: body.nickname,
      count: Number(body.count),
      agreedRules: body.agreedRules,
      agreedImageRights: body.agreedImageRights,
    });
  } catch (error) {
    // 잘못된 uuid 형식이 들어온 경우
    if (error.code === '22P02') throw failure(400, 'FAN_CHARACTER_NOT_FOUND', DB_ERRORS.FAN_CHARACTER_NOT_FOUND[1]);
    return translate(error);
  }
}

export async function getRanking({ slot, date }, userId) {
  const slotType = slot === 'ANNIV' ? 'ANNIV' : 'FREE';
  if (slotType === 'ANNIV' && !/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ''))) {
    throw failure(400, 'FAN_INVALID_SLOT', '기념일 날짜를 확인해 주세요.');
  }
  return repository.ranking({ slot: slotType, date: slotType === 'ANNIV' ? date : null, userId }).catch(translate);
}

// 저장된 이미지 경로를 화면에 쓸 서명 URL로 바꾼다 (비공개 버킷, 1시간).
async function withImageUrls(view) {
  const [backgroundUrl, photoUrl] = await Promise.all([
    repository.signedUrl(view.backgroundPath),
    repository.signedUrl(view.photoPath),
  ]);
  const design = { ...view.design };
  if (backgroundUrl && design.bg) design.bg = { ...design.bg, kind: 'image', url: backgroundUrl };
  if (photoUrl) design.photoUrl = photoUrl;
  return { ...view, design, backgroundUrl, photoUrl };
}

export async function getDesign(userId, designId) {
  try {
    return await withImageUrls(await repository.designView(userId, designId));
  } catch (error) {
    if (error.code === '22P02') throw failure(404, 'FAN_DESIGN_FORBIDDEN', DB_ERRORS.FAN_DESIGN_FORBIDDEN[1]);
    return translate(error);
  }
}

export async function saveDesign(userId, designId, body = {}) {
  try {
    return await repository.saveDesign(userId, designId, body.design, body.backgroundPath, body.photoPath);
  } catch (error) {
    if (error.code === '22P02' || error.code === '22023') throw failure(400, 'FAN_DESIGN_INVALID', DB_ERRORS.FAN_DESIGN_INVALID[1]);
    return translate(error);
  }
}

export async function submitDesign(userId, designId) {
  return repository.submitDesign(userId, designId).catch(translate);
}

// 홈 4·5번 배너: 오늘 게시 중인 승인된 디자인
export async function getHomeBoards() {
  const views = (await repository.homeBoards()) ?? [];
  return Promise.all(views.map(withImageUrls));
}
