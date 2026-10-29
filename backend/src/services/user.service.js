import * as userRepository from '../repositories/user.repository.js';
import * as paymentRepository from '../repositories/payment.repository.js';
import { normalizeNickname } from './auth.service.js';
import { listMyPaymentMethods } from './paymentMethod.service.js';

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function validateObject(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw failure(400, 'INVALID_INPUT', `${label} 형식을 확인해 주세요.`);
  }
  if (Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw failure(400, 'UNKNOWN_FIELDS', `${label}에 허용되지 않은 항목이 있어요.`);
  }
}

function currentTime(context) {
  const now = context.clock ? context.clock() : new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw failure(500, 'INVALID_CLOCK', '현재 시각을 확인하지 못했어요.');
  }
  return now;
}

async function requireActiveProfile(userId) {
  const profile = await userRepository.findByAuthId(userId);
  if (!profile) throw failure(404, 'PROFILE_NOT_FOUND', '회원가입을 먼저 완료해 주세요.');
  if (profile.status !== 'ACTIVE') {
    throw failure(403, 'ACCOUNT_UNAVAILABLE', '이 계정은 현재 이용할 수 없어요.');
  }
  return profile;
}

export function threeMonthsAgo(now) {
  // 국내 화면 기준의 달력 3개월. 5월 31일 → 2월 말처럼 없는 날짜를 보정한다.
  const koreaOffset = 9 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + koreaOffset);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() - 3);
  const lastDay = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)
  ).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return new Date(local.getTime() - koreaOffset);
}

function normalizePhone(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 50 || !/^[0-9\s()-]+$/.test(value)) {
    throw failure(400, 'INVALID_PHONE', '연락처 형식을 확인해 주세요.');
  }
  const phone = value.replace(/[\s()-]/g, '');
  if (!/^0\d{9,10}$/.test(phone)) {
    throw failure(400, 'INVALID_PHONE', '연락처는 0으로 시작하는 10~11자리로 입력해 주세요.');
  }
  return phone;
}

export function validateProfilePatch(input) {
  validateObject(input, ['nickname', 'phone', 'profileImageUrl'], '프로필');
  if (Object.keys(input).length === 0) {
    throw failure(400, 'EMPTY_PROFILE_PATCH', '변경할 항목을 보내 주세요.');
  }
  const patch = {};
  if (Object.hasOwn(input, 'nickname')) patch.nickname = normalizeNickname(input.nickname);
  if (Object.hasOwn(input, 'phone')) patch.phone = normalizePhone(input.phone);
  if (Object.hasOwn(input, 'profileImageUrl')) {
    const value = input.profileImageUrl;
    if (value === null) {
      patch.profile_image_url = null;
    } else {
      let url;
      if (typeof value === 'string' && value.trim().length > 0 && value.length <= 2048) {
        try {
          url = new URL(value.trim());
        } catch {
          /* 아래에서 형식을 거절한다. */
        }
      }
      if (!url || url.protocol !== 'https:' || url.username || url.password || !url.hostname) {
        throw failure(
          400,
          'INVALID_PROFILE_IMAGE',
          '프로필 사진은 HTTPS URL 또는 null로 보내 주세요.'
        );
      }
      patch.profile_image_url = url.href;
    }
  }
  return patch;
}

export function buildPickupWindow(pickupDeadline, now) {
  const deadline = new Date(pickupDeadline);
  if (!pickupDeadline || !Number.isFinite(deadline.getTime())) {
    throw failure(500, 'INVALID_PICKUP_DEADLINE', '픽업 마감 시각을 확인하지 못했어요.');
  }
  const startsAt = new Date(deadline.getTime() - 2 * 60 * 60 * 1000);
  return {
    pickupStartsAt: startsAt.toISOString(),
    canPickupNow: now >= startsAt && now <= deadline,
  };
}

export async function buildMySummary(userId, now) {
  const periodStart = threeMonthsAgo(now).toISOString();
  const timestamp = now.toISOString();
  const [counters, membership, pickup] = await Promise.all([
    userRepository.getMyCounters(userId, periodStart, timestamp),
    userRepository.findCurrentConsumerMembership(userId, timestamp),
    userRepository.findNextReadyPickup(userId, timestamp),
  ]);
  let readyPickup = null;
  if (pickup) {
    readyPickup = {
      ...pickup,
      ...buildPickupWindow(pickup.pickup_deadline, now),
    };
  }
  return {
    orderSummary: { periodStart, periodEnd: timestamp, counts: counters.orderStatusCounts },
    activity: {
      wishlistProducts: counters.wishlistProducts,
      wishlistShops: counters.wishlistShops,
      availableCoupons: counters.availableCoupons,
    },
    header: { unreadNotifications: counters.unreadNotifications, cartItems: counters.cartItems },
    membership,
    readyPickup,
  };
}

export async function getMySummary(userId, context = {}) {
  const profile = await requireActiveProfile(userId);
  const summary = await buildMySummary(userId, currentTime(context));
  return { profile, ...summary };
}

export async function updateMyProfile(userId, input, context = {}) {
  const patch = validateProfilePatch(input);
  const profile = await requireActiveProfile(userId);
  if (patch.nickname && patch.nickname !== profile.nickname) {
    const taken = await userRepository.findByNickname(patch.nickname);
    if (taken && taken.id !== userId) {
      throw failure(409, 'NICKNAME_TAKEN', '이미 사용 중인 닉네임이에요.');
    }
  }
  let updated;
  try {
    updated = await userRepository.updateProfileByUserId(
      userId,
      patch,
      currentTime(context).toISOString()
    );
  } catch (error) {
    if (error.databaseCode === '23505') {
      throw failure(409, 'NICKNAME_TAKEN', '이미 사용 중인 닉네임이에요.');
    }
    throw error;
  }
  if (!updated) {
    throw failure(409, 'PROFILE_CHANGED', '계정 상태가 변경되었어요. 다시 확인해 주세요.');
  }
  return { profile: updated };
}

export function validateAgreementsQuery(input = {}) {
  validateObject(input, ['page', 'size'], '동의 내역 조회');
  const parse = (value, fallback, min, max) => {
    if (value === undefined) return fallback;
    if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) {
      throw failure(400, 'INVALID_PAGINATION', '조회 범위를 정수로 보내 주세요.');
    }
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw failure(400, 'INVALID_PAGINATION', '조회 범위를 확인해 주세요.');
    }
    return number;
  };
  const size = parse(input.size, 50, 1, 100);
  const page = parse(input.page, 1, 1, 1_000_000);
  return { page, size, limit: size, offset: (page - 1) * size };
}

export async function getMyAgreements(userId, input = {}) {
  const pagination = validateAgreementsQuery(input);
  await requireActiveProfile(userId);
  const result = await userRepository.listAgreementsByUserId(userId, pagination);
  return {
    items: result.items,
    page: pagination.page,
    size: pagination.size,
    totalCount: result.total,
    hasMore: pagination.offset + result.items.length < result.total,
  };
}

export function validateWithdrawalInput(input = {}) {
  validateObject(input, ['reason'], '탈퇴 요청');
  if (
    Object.hasOwn(input, 'reason') &&
    (typeof input.reason !== 'string' ||
      input.reason.trim().length === 0 ||
      input.reason.length > 500)
  ) {
    throw failure(400, 'INVALID_WITHDRAWAL_REASON', '탈퇴 사유는 1~500자로 보내 주세요.');
  }
  // 기존 테이블에는 사유 칼럼이 없다. 저장된 것처럼 응답하거나 다른 칼럼에 끼워 넣지 않는다.
  return { reasonPersisted: false };
}

export async function checkWithdrawalEligibility(userId) {
  const blockers = await userRepository.getWithdrawalBlockers(userId);
  if (blockers.myOrders > 0 || blockers.storeOrders > 0) {
    throw failure(409, 'ONGOING_ORDERS', '진행 중인 주문을 완료하거나 취소한 뒤 탈퇴해 주세요.');
  }
  if (blockers.openStores > 0) {
    throw failure(409, 'STORE_CLOSURE_REQUIRED', '소유한 매장을 폐쇄한 뒤 탈퇴해 주세요.');
  }
  return { eligible: true };
}

export async function withdrawAccount(userId, input = {}, context = {}) {
  const request = validateWithdrawalInput(input);
  const profile = await userRepository.findByAuthId(userId);
  if (!profile) throw failure(404, 'PROFILE_NOT_FOUND', '회원 정보를 찾을 수 없어요.');
  if (profile.status === 'WITHDRAWN') {
    return {
      status: profile.status,
      withdrawnAt: profile.withdrawn_at,
      alreadyWithdrawn: true,
      authAccountDeleted: false,
      ...request,
    };
  }
  if (profile.status !== 'ACTIVE') {
    throw failure(403, 'ACCOUNT_UNAVAILABLE', '이 계정은 현재 이용할 수 없어요.');
  }
  await checkWithdrawalEligibility(userId);
  const saved = await userRepository.withdrawAccount(userId, currentTime(context).toISOString());
  if (!saved) {
    throw failure(409, 'PROFILE_CHANGED', '계정 상태가 변경되었어요. 다시 확인해 주세요.');
  }
  return {
    status: saved.status,
    withdrawnAt: saved.withdrawn_at,
    alreadyWithdrawn: false,
    authAccountDeleted: false,
    ...request,
  };
}

// ---- 적립금 · 최근 본 상품 · 알림 신청 · 응원배너 신청 (마이탭 신규) ----

export const POINT_POLICY = { earnRatePercent: 1, minUse: 1000 };
const RECENT_PRODUCT_DAYS = 14;
const FAN_BID_UNIT = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function koreaDate(date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validDate(value, label) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw failure(400, 'INVALID_DATE', `${label} 날짜를 확인해 주세요.`);
  }
  return value;
}

export function sumConfirmedPoints(rows) {
  return rows
    .filter((row) => row.status === 'CONFIRMED')
    .reduce((total, row) => total + row.amount, 0);
}

// 적립 예정분은 주문이 구매 확정(COMPLETED)되면 확정하고, 취소(CANCELED)되면 소멸시킨다.
export async function syncPointEarnings(userId) {
  const pending = await userRepository.listPendingPointEarnings(userId);
  for (const row of pending) {
    const status = row.order?.status;
    if (status === 'COMPLETED') await userRepository.setPointTransactionStatus(row.id, 'CONFIRMED');
    if (status === 'CANCELED') await userRepository.setPointTransactionStatus(row.id, 'CANCELED');
  }
}

export async function getPointBalance(userId) {
  await syncPointEarnings(userId);
  const rows = await userRepository.listPointTransactions(userId);
  return {
    balance: sumConfirmedPoints(rows),
    pending: rows
      .filter((row) => row.type === 'EARN' && row.status === 'PENDING')
      .reduce((total, row) => total + row.amount, 0),
    rows,
  };
}

export async function getMyPoints(userId, input = {}) {
  validateObject(input, [], '적립금 조회');
  await requireActiveProfile(userId);
  const { balance, pending, rows } = await getPointBalance(userId);
  return {
    balance,
    pendingAmount: pending,
    policy: POINT_POLICY,
    items: rows
      .filter((row) => row.status !== 'CANCELED')
      .slice(0, 100)
      .map((row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        amount: row.amount,
        memo: row.memo,
        orderId: row.order_id,
        createdAt: row.created_at,
      })),
  };
}

export async function recordProductView(userId, input, context = {}) {
  validateObject(input, ['storeProductId'], '최근 본 상품');
  if (typeof input.storeProductId !== 'string' || !UUID_PATTERN.test(input.storeProductId)) {
    throw failure(400, 'INVALID_PRODUCT_ID', '상품 식별자를 확인해 주세요.');
  }
  await requireActiveProfile(userId);
  const listing = await userRepository.findStoreProduct(input.storeProductId);
  if (!listing) throw failure(404, 'PRODUCT_NOT_FOUND', '상품을 찾지 못했어요.');
  await userRepository.upsertProductView(
    userId,
    listing.product_id,
    currentTime(context).toISOString()
  );
  return { recorded: true };
}

export async function getRecentProducts(userId, input = {}, context = {}) {
  validateObject(input, [], '최근 본 상품');
  await requireActiveProfile(userId);
  const now = currentTime(context);
  const since = new Date(now.getTime() - RECENT_PRODUCT_DAYS * 24 * 60 * 60 * 1000);
  const rows = (
    await userRepository.listRecentProductViews(userId, since.toISOString(), 50)
  ).filter((row) => row.product && !['HIDDEN', 'DELETED'].includes(row.product.status));
  const cheapest = new Map();
  for (const sale of await userRepository.listLowestSalePrices(rows.map((row) => row.product.id))) {
    const current = cheapest.get(sale.product_id);
    if (!current || sale.price < current.price) cheapest.set(sale.product_id, sale);
  }
  return {
    days: RECENT_PRODUCT_DAYS,
    items: rows.map((row) => ({
      productId: row.product.id,
      name: row.product.name,
      thumbnailUrl: row.product.thumbnail_url,
      characterName: row.product.character_name,
      workTitle: row.product.work_title,
      status: row.product.status,
      storeProductId: cheapest.get(row.product.id)?.id ?? null,
      lowestPrice: cheapest.get(row.product.id)?.price ?? null,
      viewedAt: row.viewed_at,
    })),
  };
}

export async function listMyOpenAlerts(userId, input = {}) {
  validateObject(input, [], '오픈 알림');
  await requireActiveProfile(userId);
  const rows = (await userRepository.listOpenAlertProducts(userId)).filter((row) => row.product);
  return {
    items: rows.map((row) => ({
      productId: row.product.id,
      name: row.product.name,
      thumbnailUrl: row.product.thumbnail_url,
      characterName: row.product.character_name,
      status: row.product.status,
      openAt: row.product.open_at,
      alertedAt: row.created_at,
    })),
  };
}

function maskNickname(nickname) {
  if (!nickname) return '익명';
  return `${Array.from(nickname)[0]}${'*'.repeat(Math.min(Array.from(nickname).length - 1, 3))}`;
}

function currentWeekRange(now) {
  const today = new Date(`${koreaDate(now)}T00:00:00Z`);
  const offset = (today.getUTCDay() + 6) % 7;
  const from = new Date(today.getTime() - offset * 86400000);
  const until = new Date(from.getTime() + 6 * 86400000);
  return { from: from.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}

export async function getFanBannerBoard(userId, input = {}, context = {}) {
  validateObject(input, ['from', 'until'], '응원배너 순위');
  await requireActiveProfile(userId);
  const week = currentWeekRange(currentTime(context));
  const from = input.from === undefined ? week.from : validDate(input.from, '시작');
  const until = input.until === undefined ? week.until : validDate(input.until, '종료');
  if (from > until) throw failure(400, 'INVALID_DATE_RANGE', '날짜 순서를 확인해 주세요.');
  const rows = await userRepository.listFanBannerBoard(from, until);
  return {
    period: { from, until },
    bidUnit: FAN_BID_UNIT,
    entries: rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      title: row.title,
      characterName: row.character_name,
      workTitle: row.work_title,
      amount: row.amount,
      status: row.status,
      requestedFrom: row.requested_from,
      requestedUntil: row.requested_until,
      nickname: maskNickname(row.user?.nickname),
      isMine: row.user_id === userId,
    })),
  };
}

function serializeFanEntry(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    imageUrl: row.image_url,
    workTitle: row.work_title,
    characterName: row.character_name,
    requestedFrom: row.requested_from,
    requestedUntil: row.requested_until,
    amount: row.amount,
    status: row.status,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
  };
}

export async function listMyFanBannerEntries(userId, input = {}) {
  validateObject(input, [], '응원배너 신청');
  await requireActiveProfile(userId);
  return { items: (await userRepository.listFanBannerEntries(userId)).map(serializeFanEntry) };
}

function optionalText(value, max, label) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw failure(400, 'INVALID_INPUT', `${label}은 ${max}자 이내로 입력해 주세요.`);
  }
  return value.trim().normalize('NFC');
}

export function validateFanBannerEntry(input, today) {
  validateObject(
    input,
    [
      'title',
      'message',
      'characterName',
      'workTitle',
      'imageUrl',
      'requestedFrom',
      'requestedUntil',
      'amount',
      'payWith',
    ],
    '응원배너 신청'
  );
  const title = optionalText(input.title, 50, '배너 제목');
  if (!title) throw failure(400, 'INVALID_TITLE', '배너 제목을 입력해 주세요.');
  const requestedFrom = validDate(input.requestedFrom, '시작');
  const requestedUntil = validDate(input.requestedUntil, '종료');
  if (requestedFrom < today) {
    throw failure(400, 'INVALID_DATE_RANGE', '오늘 이후 날짜부터 신청할 수 있어요.');
  }
  if (requestedFrom > requestedUntil) {
    throw failure(400, 'INVALID_DATE_RANGE', '종료일은 시작일 이후여야 해요.');
  }
  if (
    !Number.isInteger(input.amount) ||
    input.amount < FAN_BID_UNIT ||
    input.amount > 10000000 ||
    input.amount % FAN_BID_UNIT !== 0
  ) {
    throw failure(400, 'INVALID_AMOUNT', '신청 금액은 1,000원 단위로 입력해 주세요.');
  }
  if (!['MOCK', 'POINT'].includes(input.payWith)) {
    throw failure(400, 'INVALID_PAY_WITH', '결제 방식을 선택해 주세요.');
  }
  let imageUrl = null;
  if (input.imageUrl !== undefined && input.imageUrl !== null && input.imageUrl !== '') {
    try {
      const url = new URL(input.imageUrl);
      if (!['http:', 'https:'].includes(url.protocol) || input.imageUrl.length > 2048)
        throw new Error();
      imageUrl = url.toString();
    } catch {
      throw failure(400, 'INVALID_IMAGE_URL', '이미지 주소를 확인해 주세요.');
    }
  }
  return {
    entry: {
      title,
      message: optionalText(input.message, 200, '응원 문구'),
      character_name: optionalText(input.characterName, 50, '캐릭터명'),
      work_title: optionalText(input.workTitle, 100, '작품명'),
      image_url: imageUrl,
      requested_from: requestedFrom,
      requested_until: requestedUntil,
      amount: input.amount,
    },
    payWith: input.payWith,
  };
}

export async function createFanBannerEntry(userId, input, context = {}) {
  const { entry, payWith } = validateFanBannerEntry(input, koreaDate(currentTime(context)));
  await requireActiveProfile(userId);
  let paymentId = null;
  let pointUseId = null;
  if (payWith === 'POINT') {
    const { balance } = await getPointBalance(userId);
    if (balance < entry.amount) {
      throw failure(409, 'INSUFFICIENT_POINTS', '적립금이 부족해요.');
    }
    pointUseId = (
      await userRepository.insertPointTransaction({
        user_id: userId,
        type: 'FAN_BANNER_USE',
        status: 'CONFIRMED',
        amount: -entry.amount,
        memo: '응원배너 신청',
      })
    ).id;
  } else {
    const method = (await listMyPaymentMethods(userId)).items.find((row) => row.is_default);
    if (!method)
      throw failure(409, 'PAYMENT_METHOD_REQUIRED', '기본 결제수단을 먼저 등록해 주세요.');
    const payment = await paymentRepository.createMockPayment(userId, {
      purpose: 'FAN_BANNER',
      payment_method_id: method.id,
      method_label: method.provider_name + (method.last4 ? ` ****${method.last4}` : ''),
      amount: entry.amount,
    });
    paymentId = payment.id;
  }
  try {
    const saved = await userRepository.insertFanBannerEntry({
      ...entry,
      user_id: userId,
      status: 'PENDING',
      payment_id: paymentId,
    });
    return { entry: serializeFanEntry(saved) };
  } catch (error) {
    if (paymentId) await paymentRepository.cancelMockPayment(userId, paymentId).catch(() => {});
    if (pointUseId) {
      await userRepository
        .insertPointTransaction({
          user_id: userId,
          type: 'USE_CANCEL',
          status: 'CONFIRMED',
          amount: entry.amount,
          memo: '응원배너 신청 실패 복구',
        })
        .catch(() => {});
    }
    throw error;
  }
}

// 주문 취소·결제 실패 시 사용한 적립금을 돌려주고 적립 예정분을 소멸시킨다. 여러 번 불러도 한 번만 복구한다.
export async function restoreOrderPoints(userId, orderId) {
  const rows = await userRepository.listOrderPointTransactions(userId, orderId);
  const used = rows
    .filter((row) => row.type === 'USE' && row.status === 'CONFIRMED')
    .reduce((total, row) => total - row.amount, 0);
  const restored = rows
    .filter((row) => row.type === 'USE_CANCEL' && row.status === 'CONFIRMED')
    .reduce((total, row) => total + row.amount, 0);
  if (used - restored > 0) {
    await userRepository.insertPointTransaction({
      user_id: userId,
      order_id: orderId,
      type: 'USE_CANCEL',
      status: 'CONFIRMED',
      amount: used - restored,
      memo: '주문 취소로 적립금 복구',
    });
  }
  for (const row of rows) {
    if (row.type === 'EARN' && row.status === 'PENDING') {
      await userRepository.setPointTransactionStatus(row.id, 'CANCELED');
    }
  }
}

export async function recordOrderPoints(userId, orderId, { used, earn }) {
  if (used > 0) {
    await userRepository.insertPointTransaction({
      user_id: userId,
      order_id: orderId,
      type: 'USE',
      status: 'CONFIRMED',
      amount: -used,
      memo: '주문 결제에 적립금 사용',
    });
  }
  if (earn > 0) {
    await userRepository.insertPointTransaction({
      user_id: userId,
      order_id: orderId,
      type: 'EARN',
      status: 'PENDING',
      amount: earn,
      memo: '구매 확정 시 적립',
    });
  }
}
