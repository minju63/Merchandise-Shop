import * as repository from '../repositories/coupon.repository.js';
import { findByAuthId } from '../repositories/user.repository.js';

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
function validateObject(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw failure(400, 'INVALID_INPUT', '입력값을 확인해 주세요.');
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw failure(400, 'UNKNOWN_FIELDS', '허용되지 않은 입력 항목이 있어요.');
}
async function requireActiveProfile(userId) {
  const user = await findByAuthId(userId);
  if (!user) throw failure(404, 'PROFILE_NOT_FOUND', '회원가입을 먼저 완료해 주세요.');
  if (user.status !== 'ACTIVE')
    throw failure(403, 'ACCOUNT_UNAVAILABLE', '현재 사용할 수 없는 계정이에요.');
  return user;
}
export function validateCouponId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))
    throw failure(400, 'INVALID_COUPON_ID', '쿠폰 식별자를 확인해 주세요.');
  return value;
}
export function validateCouponCode(input) {
  validateObject(input, ['code']);
  if (typeof input.code !== 'string' || !/^[A-Z0-9_-]{1,30}$/.test(input.code.trim()))
    throw failure(
      400,
      'INVALID_COUPON_CODE',
      '쿠폰 코드는 영문 대문자·숫자·밑줄·하이픈으로 입력해 주세요.'
    );
  return input.code.trim();
}
export function parseCouponCodeRule(code) {
  const result = { signup: false, deliveryFee: false, firstOrderOnly: false };
  let remaining = typeof code === 'string' ? code : '';
  // 사업 데이터가 아니라 코드 문법이다. 할인값·대상 ID·기간은 DB에 있다.
  for (;;) {
    const prefix = [
      ['SIGNUP_', 'signup'],
      ['DELIVERY_', 'deliveryFee'],
      ['FIRST_ORDER_', 'firstOrderOnly'],
    ].find(([value]) => remaining.startsWith(value));
    if (!prefix) return result;
    if (
      result[prefix[1]] ||
      (prefix[1] === 'signup' && (result.deliveryFee || result.firstOrderOnly))
    )
      throw failure(503, 'INVALID_COUPON_POLICY', '쿠폰 코드 정책을 확인할 수 없어요.');
    result[prefix[1]] = true;
    remaining = remaining.slice(prefix[0].length);
    if (!remaining)
      throw failure(503, 'INVALID_COUPON_POLICY', '쿠폰 코드 정책을 확인할 수 없어요.');
  }
}
function currentTime(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime()))
    throw failure(400, 'INVALID_TIME', '쿠폰 기준 시각을 확인해 주세요.');
  return date;
}
export function validateCouponPolicy(coupon) {
  const integer = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
  if (
    !coupon ||
    !['FIXED', 'RATE'].includes(coupon.discount_type) ||
    !['ALL', 'PICKUP', 'DELIVERY'].includes(coupon.applies_to) ||
    !integer(coupon.discount_value) ||
    !integer(coupon.min_order_amount) ||
    !integer(coupon.issued_count) ||
    (coupon.max_discount !== null && !integer(coupon.max_discount)) ||
    (coupon.total_quantity !== null && !integer(coupon.total_quantity)) ||
    (coupon.discount_type === 'RATE' && coupon.discount_value > 100) ||
    typeof coupon.is_active !== 'boolean' ||
    !Number.isFinite(Date.parse(coupon.valid_from)) ||
    !Number.isFinite(Date.parse(coupon.valid_until)) ||
    Date.parse(coupon.valid_until) <= Date.parse(coupon.valid_from)
  ) {
    throw failure(503, 'INVALID_COUPON_POLICY', '쿠폰 할인 정책을 확인할 수 없어요.');
  }
  const rule = parseCouponCodeRule(coupon.code);
  if (rule.deliveryFee && coupon.applies_to !== 'DELIVERY')
    throw failure(503, 'INVALID_COUPON_POLICY', '배송비 쿠폰의 수령 조건을 확인할 수 없어요.');
  return rule;
}
export function getEffectiveCouponStatus(userCoupon, coupon, now = new Date()) {
  validateCouponPolicy(coupon);
  const time = currentTime(now).getTime();
  if (
    !Number.isFinite(Date.parse(userCoupon.expires_at)) ||
    !['AVAILABLE', 'USED', 'EXPIRED'].includes(userCoupon.status)
  )
    throw failure(503, 'INVALID_COUPON_POLICY', '보유 쿠폰 상태를 확인할 수 없어요.');
  if (userCoupon.status === 'USED') return 'USED';
  if (
    userCoupon.status === 'EXPIRED' ||
    Date.parse(userCoupon.expires_at) <= time ||
    Date.parse(coupon.valid_until) <= time ||
    !coupon.is_active
  )
    return 'EXPIRED';
  return 'AVAILABLE';
}
function money(value) {
  const amount = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2147483647)
    throw failure(400, 'INVALID_AMOUNT', '주문 금액은 0 이상의 정수여야 해요.');
  return amount;
}
export function validateCheckoutQuery(input) {
  validateObject(input, ['storeId', 'amount', 'deliveryFee', 'fulfillmentType']);
  validateCouponId(input.storeId);
  if (!['PICKUP', 'DELIVERY'].includes(input.fulfillmentType))
    throw failure(400, 'INVALID_FULFILLMENT_TYPE', '픽업 또는 배송을 선택해 주세요.');
  const itemsAmount = money(input.amount);
  // 배송비를 추측하지 않는다. 배송 견적에는 실제 전달된 배송비가 필요하다.
  const deliveryFee =
    input.fulfillmentType === 'PICKUP' && input.deliveryFee === undefined
      ? 0
      : money(input.deliveryFee);
  if (input.fulfillmentType === 'PICKUP' && deliveryFee !== 0)
    throw failure(400, 'INVALID_DELIVERY_FEE', '픽업 주문에는 배송비를 적용할 수 없어요.');
  return {
    storeId: input.storeId,
    itemsAmount,
    deliveryFee,
    fulfillmentType: input.fulfillmentType,
  };
}
export function calculateCouponDiscount(coupon, quote) {
  const rule = validateCouponPolicy(coupon);
  const base = money(rule.deliveryFee ? quote.deliveryFee : quote.itemsAmount);
  const raw =
    coupon.discount_type === 'FIXED'
      ? coupon.discount_value
      : Math.floor((base * coupon.discount_value) / 100);
  return Math.min(base, raw, coupon.max_discount ?? base);
}
export function evaluateCouponEligibility(userCoupon, quote, now = new Date()) {
  const coupon = userCoupon.coupon;
  const rule = validateCouponPolicy(coupon);
  const time = currentTime(now);
  let reason = null;
  if (userCoupon.user_id !== quote.userId) reason = 'NOT_OWNED';
  else if (userCoupon.status === 'USED') reason = 'USED';
  else if (!coupon.is_active) reason = 'INACTIVE';
  else if (getEffectiveCouponStatus(userCoupon, coupon, time) === 'EXPIRED') reason = 'EXPIRED';
  else if (Date.parse(coupon.valid_from) > time.getTime()) reason = 'NOT_STARTED';
  else if (coupon.store_id !== null && coupon.store_id !== quote.storeId) reason = 'STORE_MISMATCH';
  else if (coupon.applies_to !== 'ALL' && coupon.applies_to !== quote.fulfillmentType)
    reason = 'FULFILLMENT_MISMATCH';
  else if (money(quote.itemsAmount) < coupon.min_order_amount) reason = 'MIN_ORDER_AMOUNT';
  else if (rule.firstOrderOnly && quote.hasPreviousOrder !== false) reason = 'FIRST_ORDER_ONLY';
  else if (rule.deliveryFee && money(quote.deliveryFee) === 0) reason = 'NO_DELIVERY_FEE';
  return {
    usable: reason === null,
    reason,
    discountAmount: reason === null ? calculateCouponDiscount(coupon, quote) : 0,
    discountScope: rule.deliveryFee ? 'DELIVERY_FEE' : 'ITEMS',
  };
}
function describeOwned(userCoupon, now) {
  const status = getEffectiveCouponStatus(userCoupon, userCoupon.coupon, now);
  const expiresAt = new Date(
    Math.min(Date.parse(userCoupon.expires_at), Date.parse(userCoupon.coupon.valid_until))
  ).toISOString();
  return {
    ...userCoupon,
    effectiveStatus: status,
    effectiveExpiresAt: expiresAt,
    rule: parseCouponCodeRule(userCoupon.coupon.code),
  };
}
export function validateListQuery(input = {}) {
  validateObject(input, ['status']);
  if (input.status !== undefined && !['AVAILABLE', 'USED', 'EXPIRED'].includes(input.status))
    throw failure(400, 'INVALID_COUPON_STATUS', '쿠폰 상태를 확인해 주세요.');
  return input.status;
}
export async function listMyCoupons(userId, input = {}) {
  const status = validateListQuery(input);
  await requireActiveProfile(userId);
  const now = new Date();
  const all = (await repository.listOwnedWithPolicy(userId)).map((row) => describeOwned(row, now));
  const counts = Object.fromEntries(
    ['AVAILABLE', 'USED', 'EXPIRED'].map((key) => [
      key,
      all.filter((row) => row.effectiveStatus === key).length,
    ])
  );
  const items = status ? all.filter((row) => row.effectiveStatus === status) : all;
  return { items, totalCount: items.length, counts };
}
export async function getMyCouponDetail(userId, userCouponId, query = {}) {
  validateCouponId(userCouponId);
  validateObject(query, []);
  await requireActiveProfile(userId);
  const row = await repository.findOwnedWithPolicy(userId, userCouponId);
  if (!row) throw failure(404, 'COUPON_NOT_FOUND', '보유한 쿠폰을 찾지 못했어요.');
  return describeOwned(row, new Date());
}
export async function listCheckoutCoupons(userId, input) {
  const quote = validateCheckoutQuery(input);
  await requireActiveProfile(userId);
  const hasPreviousOrder = await repository.hasPreviousOrder(userId);
  const rows = await repository.listOwnedWithPolicy(userId);
  const now = new Date();
  const items = rows.map((row) => ({
    ...describeOwned(row, now),
    ...evaluateCouponEligibility(row, { ...quote, userId, hasPreviousOrder }, now),
  }));
  const best = items
    .filter((row) => row.usable && row.discountAmount > 0)
    .reduce(
      (selected, row) =>
        !selected || row.discountAmount > selected.discountAmount ? row : selected,
      null
    );
  return {
    items,
    totalCount: items.length,
    recommendedUserCouponId: best?.id ?? null,
    quote,
    serverPriceVerified: false,
  };
}
export async function registerCouponCode(userId, input) {
  const code = validateCouponCode(input);
  if (parseCouponCodeRule(code).signup)
    throw failure(403, 'COUPON_AUTO_ISSUE_ONLY', '가입 쿠폰은 회원가입 완료 시 자동으로 지급돼요.');
  await requireActiveProfile(userId);
  const now = new Date();
  const coupon = await repository.findByCode(code);
  if (!coupon) throw failure(404, 'COUPON_CODE_NOT_FOUND', '쿠폰 코드를 찾지 못했어요.');
  validateCouponPolicy(coupon);
  if (!coupon.is_active) throw failure(409, 'COUPON_INACTIVE', '현재 발급되지 않는 쿠폰이에요.');
  if (Date.parse(coupon.valid_from) > now.getTime())
    throw failure(409, 'COUPON_NOT_STARTED', '쿠폰 발급 기간이 아직 시작되지 않았어요.');
  if (Date.parse(coupon.valid_until) <= now.getTime())
    throw failure(409, 'COUPON_EXPIRED', '쿠폰 발급 기간이 끝났어요.');
  const result = await repository.registerCode(userId, coupon, now.toISOString());
  return { ...result, userCoupon: describeOwned(result.userCoupon, now) };
}
export async function issueSignupCoupons(userId, now = new Date()) {
  const time = currentTime(now);
  const user = await requireActiveProfile(userId);
  const joinedAt = Date.parse(user.created_at);
  if (!Number.isFinite(joinedAt))
    throw failure(503, 'INVALID_PROFILE_DATE', '회원가입 시각을 확인할 수 없어요.');
  const coupons = await repository.issueByCodeRule();
  const results = [];
  for (const coupon of coupons) {
    validateCouponPolicy(coupon);
    const existing = await repository.findOwnedByCouponId(userId, coupon.id);
    if (existing) {
      await repository.synchronizeIssuedCount(coupon.id);
      results.push({ couponId: coupon.id, status: 'ALREADY_OWNED', userCouponId: existing.id });
      continue;
    }
    let reason = null;
    if (!coupon.is_active) reason = 'INACTIVE';
    else if (
      Date.parse(coupon.valid_from) > time.getTime() ||
      Date.parse(coupon.valid_until) <= time.getTime()
    )
      reason = 'OUTSIDE_ISSUE_PERIOD';
    else if (joinedAt < Date.parse(coupon.valid_from) || joinedAt >= Date.parse(coupon.valid_until))
      reason = 'OUTSIDE_SIGNUP_PERIOD';
    if (reason) {
      results.push({ couponId: coupon.id, status: 'SKIPPED', reason });
      continue;
    }
    try {
      const result = await repository.registerCode(userId, coupon, time.toISOString());
      results.push({
        couponId: coupon.id,
        status: result.alreadyOwned ? 'ALREADY_OWNED' : 'ISSUED',
        userCouponId: result.userCoupon.id,
      });
    } catch (error) {
      if (error.code !== 'COUPON_SOLD_OUT') throw error;
      results.push({ couponId: coupon.id, status: 'SKIPPED', reason: 'SOLD_OUT' });
    }
  }
  return {
    status: coupons.length ? 'PROCESSED' : 'NO_SIGNUP_COUPON_CONFIGURED',
    pending: coupons.length === 0,
    results,
  };
}
export function getCancellationRestoreDecision(userCoupon, coupon, now = new Date()) {
  const time = currentTime(now);
  validateCouponPolicy(coupon);
  if (userCoupon.status !== 'USED')
    return {
      restore: false,
      status: getEffectiveCouponStatus(userCoupon, coupon, time),
      reason: 'NOT_USED',
    };
  const expired =
    !coupon.is_active ||
    Date.parse(userCoupon.expires_at) <= time.getTime() ||
    Date.parse(coupon.valid_until) <= time.getTime();
  if (!Number.isFinite(Date.parse(userCoupon.expires_at)))
    throw failure(503, 'INVALID_COUPON_POLICY', '보유 쿠폰 만료 시각을 확인할 수 없어요.');
  return {
    restore: true,
    status: expired ? 'EXPIRED' : 'AVAILABLE',
    reason: expired ? 'NO_LONGER_VALID' : 'WITHIN_VALID_PERIOD',
  };
}
