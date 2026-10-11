import * as userRepository from '../repositories/user.repository.js';
import { normalizeNickname } from './auth.service.js';

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
