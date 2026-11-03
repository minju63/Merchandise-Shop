// 팬 응원 전광판 서비스: 응원권 구매 · 응원하기 · 순위
import * as repository from '../repositories/fan.repository.js';
import { getPaymentProvider } from '../payments/index.js';
import { resolvePaymentMethodSelection } from './paymentMethod.service.js';
import { paymentMethodLabel } from './checkout.service.js';
import { findHomeBanners } from '../repositories/home.repository.js';

const failure = (status, code, message) => Object.assign(new Error(message), { status, code });

const CHARGE_AMOUNTS = [5000, 10000, 30000, 50000];
export const FAN_PAYMENT_OPTIONS = Object.freeze({
  GOODSPICK_PAY: '굿즈픽페이',
  TOSS_PAY: '토스페이',
  NAVER_PAY: '네이버페이',
  KAKAO_PAY: '카카오페이',
  CARD: '카드 결제',
  VIRTUAL_ACCOUNT: '가상계좌',
  MOBILE: '휴대폰 결제',
});
// 응원권은 구매한 날부터 30일 안에, 안 쓴 장수만큼 1장(1,000P) 단위로 환불할 수 있다.
export const FAN_REFUND_DAYS = 30;

export function fanPaymentOptionLabel(option) {
  const label = FAN_PAYMENT_OPTIONS[option];
  if (!label && option !== 'REGISTERED_ACCOUNT') {
    throw failure(400, 'FAN_INVALID_PAYMENT_OPTION', '결제수단을 선택해 주세요.');
  }
  return label ?? null;
}

export function isPackRefundable(pack, now = Date.now()) {
  const purchasedAt = new Date(pack.created_at).getTime();
  const withinRefundPeriod = Number.isFinite(purchasedAt)
    && now >= purchasedAt
    && now - purchasedAt <= FAN_REFUND_DAYS * 86400000;
  return pack.status === 'ACTIVE'
    && pack.remaining > 0
    && withinRefundPeriod;
}

// 생일 모아보기 목업 기본 축하 수. DB 시드가 아직 적용되지 않은 개발 환경에서도
// 화면을 확인할 수 있게 하고, DB가 이미 기본값을 반환하면 중복 합산하지 않는다.
const DAY_LIKE_MOCK_COUNTS = new Map([
  ['고죠 사토루', 3284],
  ['후시구로 메구미', 1436],
  ['쿠기사키 노바라', 1092],
]);

export function applyDayLikeMocks(board) {
  const apply = (item) => {
    const base = DAY_LIKE_MOCK_COUNTS.get(item.name);
    const current = Number(item.likeCount ?? 0);
    if (!base || current >= base) return item;
    return { ...item, likeCount: base + current };
  };
  return {
    ...board,
    ranked: (board.ranked ?? []).map(apply),
    others: (board.others ?? []).map(apply),
  };
}

// DB 함수가 던지는 FAN_* 오류를 화면에 보여 줄 메시지로 바꾼다.
const DB_ERRORS = {
  FAN_CHEER_CLOSED: [409, '이번 주 응원이 마감됐어요. 다음 주 월요일에 다시 응원할 수 있어요.'],
  FAN_INVALID_SLOT: [400, '응원 유형을 확인해 주세요.'],
  FAN_NOT_AGREED: [400, '동의 항목에 모두 체크해 주세요.'],
  FAN_INVALID_MESSAGE: [400, '응원 한마디는 1~30자로 입력해 주세요.'],
  FAN_INVALID_NICKNAME: [400, '표시 닉네임은 1~20자로 입력해 주세요.'],
  FAN_BANNED_WORD: [400, '사용할 수 없는 표현이 들어 있어요.'],
  FAN_INVALID_COUNT: [400, '보낼 응원포인트를 확인해 주세요.'],
  FAN_CHARACTER_NOT_FOUND: [404, '최애를 찾을 수 없어요.'],
  FAN_ANNIVERSARY_NOT_NEXT_WEEK: [400, '다음 주에 기념일이 있는 최애만 기념일 응원을 보낼 수 있어요.'],
  FAN_DAILY_LIMIT: [409, '하루에 최대 응원포인트 100,000점까지 보낼 수 있어요. 남은 포인트를 확인해 주세요.'],
  FAN_NOT_ENOUGH_TICKETS: [409, '응원권이 부족해요. 응원권을 구매해 주세요.'],
  FAN_NOT_ENOUGH_CREDIT: [409, '적립금이 부족해요.'],
  FAN_PACK_NOT_REFUNDABLE: [409, '환불할 수 없는 응원권이에요. 사용했거나 환불 가능 기간이 지났어요.'],
  FAN_INVALID_PAYMENT: [400, '결제 정보를 확인할 수 없어요.'],
  FAN_INVALID_CHARGE_AMOUNT: [400, '충전 금액을 확인해 주세요.'],
  FAN_DESIGN_FORBIDDEN: [403, '이 전광판을 꾸밀 권한이 없어요.'],
  FAN_DESIGN_LOCKED: [409, '지금은 수정할 수 없어요. 제출 기한이 지났거나 이미 검수 중이에요.'],
  FAN_DESIGN_INVALID: [400, '디자인 값이 올바르지 않아요.'],
  FAN_DESIGN_INVALID_MESSAGE: [400, '메인 문구는 1~16자로 입력해 주세요.'],
  FAN_DESIGN_INVALID_TEXT: [400, '날짜 줄과 from. 닉네임은 20자 이내로 입력해 주세요.'],
  FAN_DESIGN_INCOMPLETE: [400, '날짜 줄과 from. 닉네임을 모두 입력한 뒤 검수를 요청해 주세요.'],
  FAN_DESIGN_INVALID_PATH: [400, '이미지 경로가 올바르지 않아요.'],
  FAN_DESIGN_EMPTY: [400, '메인 문구를 입력한 뒤 검수를 요청해 주세요.'],
  FAN_WEEK_NOT_FOUND: [404, '주차를 찾을 수 없어요.'],
  FAN_DAY_CHARACTER_NOT_FOUND: [404, '그날 기념일인 최애가 아니에요.'],
  FAN_DAY_INVALID_MESSAGE: [400, '축하 한마디는 1~50자로 입력해 주세요.'],
  FAN_DAY_CONGRATS_LIMIT: [409, '축하 한마디는 하루에 최대 5개까지 남길 수 있어요.'],
  FAN_BILLBOARD_INVALID_DATES: [400, '게시할 날짜를 1~31일 사이로 골라 주세요.'],
  FAN_BILLBOARD_PAST_DATE: [400, '게시 7일 전까지 꾸며야 해서, 오늘부터 8일 뒤 날짜부터 신청할 수 있어요.'],
  FAN_BILLBOARD_ANNIVERSARY_DATE: [409, '기념일이 있는 날은 자유 응원 전광판을 신청할 수 없어요.'],
  FAN_BILLBOARD_DATE_TAKEN: [409, '이미 다른 분이 신청한 날짜가 있어요. 날짜를 다시 확인해 주세요.'],
  FAN_DAY_CONGRATS_NOT_FOUND: [404, '수정하거나 삭제할 축하 한마디를 찾을 수 없어요.'],
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
  const now = Date.now();
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
      refundable: isPackRefundable(pack, now),
      paymentLabel: pack.payment?.method_label ?? null,
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
// 결제수단을 확인하고 결제(모의)를 승인한 뒤 payments 행을 만든다.
async function chargeFan(userId, body, amount, purpose) {
  if (body.paymentAgreed !== true) {
    throw failure(400, 'FAN_PAYMENT_NOT_AGREED', '결제에 동의해 주세요.');
  }
  const optionLabel = fanPaymentOptionLabel(body.paymentOption);
  let method = null;
  let methodLabel = optionLabel;
  // 굿즈픽페이는 요청한 기본 계좌가 실제로 내 활성 은행 계좌인지 확인한다.
  if (['GOODSPICK_PAY', 'REGISTERED_ACCOUNT'].includes(body.paymentOption)) {
    method = await resolvePaymentMethodSelection(userId, body.paymentMethodId);
    if (method.method_type !== 'BANK_ACCOUNT') {
      throw failure(400, 'FAN_INVALID_PAYMENT_OPTION', '등록된 은행 계좌를 선택해 주세요.');
    }
    if (body.paymentOption === 'GOODSPICK_PAY' && method.is_default !== true) {
      throw failure(400, 'FAN_INVALID_PAYMENT_OPTION', '굿즈픽페이 기본 계좌를 확인해 주세요.');
    }
    methodLabel = body.paymentOption === 'GOODSPICK_PAY'
      ? `굿즈픽페이 · ${paymentMethodLabel(method)}`
      : `등록 계좌 · ${paymentMethodLabel(method)}`;
  }
  const approval = await getPaymentProvider().charge({ userId, amount, methodLabel });
  const paymentId = await repository.insertChargePayment(userId, {
    amount,
    ...approval,
    methodLabel,
    paymentMethodId: method?.id ?? null,
    purpose,
  });
  return { paymentId, transactionId: approval.transactionId };
}

export async function buyWithCash(userId, body = {}) {
  const amount = Number(body.amount);
  if (!CHARGE_AMOUNTS.includes(amount)) {
    throw failure(400, 'FAN_INVALID_CHARGE_AMOUNT', DB_ERRORS.FAN_INVALID_CHARGE_AMOUNT[1]);
  }
  const { paymentId } = await chargeFan(userId, body, amount, 'CHEER_CHARGE');
  return repository.buyWithCash(userId, paymentId).catch(translate);
}

// 적립금 구매: 적립금 1,000원 = 응원권 1장
export async function buyWithCredit(userId, body = {}) {
  return repository.buyWithCredit(userId, Number(body.quantity)).catch(translate);
}

// 미사용 응원권 환불: 적립금 구매분은 적립금으로 복원, 현금 구매분은 결제 취소(모의)
export async function refundPack(userId, packId, body = {}) {
  // 환불할 장수: 안 쓴 응원권 중 1장 단위. 보내지 않으면 남은 장수 전부.
  const quantity = body.quantity === undefined ? null : Number(body.quantity);
  if (quantity !== null && !Number.isInteger(quantity)) {
    throw failure(400, 'FAN_INVALID_COUNT', DB_ERRORS.FAN_INVALID_COUNT[1]);
  }
  let result;
  try {
    result = await repository.refundPack(userId, packId, quantity);
  } catch (error) {
    if (error.code === '22P02') throw failure(404, 'FAN_PACK_NOT_REFUNDABLE', DB_ERRORS.FAN_PACK_NOT_REFUNDABLE[1]);
    return translate(error);
  }
  // 현금 구매분은 결제했던 수단 그대로 해당 금액만큼 결제를 취소해 환불하고, 적립금 구매분은 적립금으로 돌려준다.
  if (result.source === 'CASH') {
    const payment = await repository.findPayment(result.paymentId);
    await getPaymentProvider().cancel({ transactionId: payment.pg_transaction_id, amount: result.amount });
    if (result.fullyRefunded) await repository.markPaymentCanceled(result.paymentId);
    return { source: 'CASH', amount: result.amount, quantity: result.quantity, refundedTo: payment.method_label ?? '결제하신 수단', processingDays: '2~3일' };
  }
  return { source: result.source, amount: result.amount, quantity: result.quantity, refundedTo: '적립금', processingDays: null };
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

// 홈 4·5번 배너: 오늘 게시 중인 승인된 디자인.
// 기념일 전광판에는 "그날 기념일인 최애 n명" 칩에 쓸 정보(day)를 함께 붙인다.
export async function getHomeBoards() {
  const views = (await repository.homeBoards()) ?? [];
  const boards = await Promise.all(views.map(withImageUrls));
  return Promise.all(boards.map(async (board) => {
    if (board.slotType !== 'ANNIV' || !board.publishDate) return board;
    return { ...board, day: await describeDay(board.publishDate) };
  }));
}

// 홈 배너 칩에 쓰는 정보: 그날 기념일인 최애 수와 전부 생일인지 여부
export async function describeDay(date) {
  const kinds = await repository.findDayAnniversaryKinds(date).catch(() => []);
  return { date, count: kinds.length, birthdayOnly: kinds.every((kind) => kind === 'BIRTHDAY') };
}

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) && !Number.isNaN(Date.parse(value));

// 오늘 기념일인 최애 모아보기 (로그인하지 않아도 볼 수 있고, 로그인하면 내 축하하기 표시가 함께 온다)
export async function getDayBoard(date, userId) {
  if (!isDate(date)) throw failure(400, 'FAN_INVALID_DATE', '날짜를 확인해 주세요.');
  const [board, banners] = await Promise.all([
    repository.dayBoard(date, userId).catch(translate),
    // 하단 "굿즈 보러 가기" 버튼이 열 기획전 배너
    findHomeBanners(new Date().toISOString()).catch(() => []),
  ]);
  const exhibition = banners.find((banner) => banner.banner_type === 'EXHIBITION');
  return applyDayLikeMocks({ ...board, exhibitionBannerId: exhibition?.id ?? null });
}

function dayInput(date, characterId) {
  if (!isDate(date)) throw failure(400, 'FAN_INVALID_DATE', '날짜를 확인해 주세요.');
  if (!characterId) throw failure(404, 'FAN_DAY_CHARACTER_NOT_FOUND', DB_ERRORS.FAN_DAY_CHARACTER_NOT_FOUND[1]);
}

const badCharacterId = (error) => (error.code === '22P02'
  ? failure(404, 'FAN_DAY_CHARACTER_NOT_FOUND', DB_ERRORS.FAN_DAY_CHARACTER_NOT_FOUND[1])
  : null);

export async function toggleDayLike(userId, date, body = {}) {
  dayInput(date, body.characterId);
  try {
    return await repository.dayLikeToggle(userId, date, body.characterId);
  } catch (error) {
    const bad = badCharacterId(error);
    if (bad) throw bad;
    return translate(error);
  }
}

export async function addDayCongrats(userId, date, body = {}) {
  dayInput(date, body.characterId);
  try {
    return await repository.dayCongratsAdd(userId, date, body.characterId, String(body.message ?? ''));
  } catch (error) {
    const bad = badCharacterId(error);
    if (bad) throw bad;
    return translate(error);
  }
}

function congratsInput(date, congratsId) {
  if (!isDate(date)) throw failure(400, 'FAN_INVALID_DATE', '날짜를 확인해 주세요.');
  if (!congratsId) throw failure(404, 'FAN_DAY_CONGRATS_NOT_FOUND', DB_ERRORS.FAN_DAY_CONGRATS_NOT_FOUND[1]);
}

const badCongratsId = (error) => (error.code === '22P02'
  ? failure(404, 'FAN_DAY_CONGRATS_NOT_FOUND', DB_ERRORS.FAN_DAY_CONGRATS_NOT_FOUND[1])
  : null);

export async function updateDayCongrats(userId, date, congratsId, body = {}) {
  congratsInput(date, congratsId);
  try {
    return await repository.dayCongratsUpdate(userId, date, congratsId, String(body.message ?? ''));
  } catch (error) {
    const bad = badCongratsId(error);
    if (bad) throw bad;
    return translate(error);
  }
}

export async function deleteDayCongrats(userId, date, congratsId) {
  congratsInput(date, congratsId);
  try {
    return await repository.dayCongratsDelete(userId, date, congratsId);
  } catch (error) {
    const bad = badCongratsId(error);
    if (bad) throw bad;
    return translate(error);
  }
}

// ── 유료 전광판 게시: 하루 100,000원, 연속·분할 선택 가능
export const BILLBOARD_PRICE_PER_DAY = 100000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = (date) => date.toISOString().slice(0, 10);

// 기간 안에서 살 수 없는 날짜와 이유
export async function getBillboardAvailability({ from, to }) {
  if (!DATE_PATTERN.test(String(from)) || !DATE_PATTERN.test(String(to)) || from > to) {
    throw failure(400, 'FAN_INVALID_DATE', '날짜를 확인해 주세요.');
  }
  const { anniversaries, sold, slots } = await repository.findBillboardBlocked({ from, to });
  const blocked = {};
  anniversaries.forEach((row) => { blocked[row.event_date] = { reason: 'ANNIVERSARY', label: row.label }; });
  sold.forEach((row) => { blocked[row.day] ??= { reason: 'BOOKED' }; });
  slots.forEach((slot) => {
    for (let i = 0; i < slot.publish_days; i += 1) {
      const day = isoDate(new Date(Date.parse(slot.publish_date) + i * 86400000));
      if (day >= from && day <= to) blocked[day] ??= { reason: 'BOOKED' };
    }
  });
  return { pricePerDay: BILLBOARD_PRICE_PER_DAY, blocked };
}

export async function bookBillboard(userId, body = {}) {
  const dates = [...new Set(Array.isArray(body.dates) ? body.dates : [])];
  if (!dates.length || dates.length > 31 || !dates.every((date) => DATE_PATTERN.test(String(date)))) {
    throw failure(400, 'FAN_BILLBOARD_INVALID_DATES', DB_ERRORS.FAN_BILLBOARD_INVALID_DATES[1]);
  }
  if (!body.characterId) throw failure(404, 'FAN_CHARACTER_NOT_FOUND', DB_ERRORS.FAN_CHARACTER_NOT_FOUND[1]);
  const amount = BILLBOARD_PRICE_PER_DAY * dates.length;
  const { paymentId, transactionId } = await chargeFan(userId, body, amount, 'FAN_BANNER');
  try {
    return await repository.billboardBook(userId, body.characterId, dates, paymentId, BILLBOARD_PRICE_PER_DAY);
  } catch (error) {
    // 날짜 확정에 실패하면 방금 한 결제는 바로 취소한다.
    await getPaymentProvider().cancel({ transactionId }).catch(() => {});
    await repository.markPaymentCanceled(paymentId).catch(() => {});
    if (error.code === '22P02') throw failure(400, 'FAN_BILLBOARD_INVALID_DATES', DB_ERRORS.FAN_BILLBOARD_INVALID_DATES[1]);
    return translate(error);
  }
}

export async function listMyBillboards(userId) {
  const rows = await repository.findMyBillboards(userId);
  return rows
    .map((row) => ({
      designId: row.id,
      reviewStatus: row.review_status,
      dueAt: row.due_at,
      startDate: row.slot.publish_date,
      days: row.slot.publish_days,
      characterName: row.slot.character?.name ?? null,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
