import * as repository from '../repositories/notificationSetting.repository.js';
import { findByAuthId } from '../repositories/user.repository.js';

const FIELDS = {
  pushEnabled: 'push_enabled',
  orderStatus: 'order_status',
  restock: 'restock',
  likedStoreNews: 'liked_store_news',
  couponExpiry: 'coupon_expiry',
  inquiryAnswer: 'inquiry_answer',
  marketing: 'marketing',
  nightPush: 'night_push',
};

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
  const profile = await findByAuthId(userId);
  if (!profile) throw failure(404, 'PROFILE_NOT_FOUND', '회원가입을 먼저 완료해 주세요.');
  if (profile.status !== 'ACTIVE')
    throw failure(403, 'ACCOUNT_UNAVAILABLE', '현재 사용할 수 없는 계정이에요.');
}

export function validateNotificationInput(input) {
  validateObject(input, Object.keys(FIELDS));
  if (!Object.keys(input).length)
    throw failure(400, 'EMPTY_NOTIFICATION_PATCH', '변경할 알림 설정을 선택해 주세요.');
  if (Object.values(input).some((value) => typeof value !== 'boolean'))
    throw failure(400, 'INVALID_NOTIFICATION_VALUE', '알림 설정은 참 또는 거짓이어야 해요.');
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [FIELDS[key], value]));
}

export function normalizeNotificationPatch(current, patch) {
  const next = validateNotificationInput(patch);
  const marketing = Object.hasOwn(next, 'marketing') ? next.marketing : current.marketing;
  if (next.night_push === true && !marketing)
    throw failure(
      400,
      'NIGHT_PUSH_REQUIRES_MARKETING',
      '마케팅 수신에 동의한 뒤 야간 알림을 켤 수 있어요.'
    );
  // 마케팅 철회는 야간 수신도 해제한다. 전체 푸시 해제는 개별 선택을 유지한다.
  if (next.marketing === false) next.night_push = false;
  return next;
}

export function buildConsentChanges(current, next, now, latestConsents = []) {
  const time = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(time.getTime()))
    throw failure(400, 'INVALID_TIME', '동의 변경 시각을 확인해 주세요.');
  const records = [];
  for (const [field, termsType] of [
    ['marketing', 'MARKETING'],
    ['night_push', 'NIGHT_PUSH'],
  ]) {
    if (!Object.hasOwn(next, field)) continue;
    const latest = latestConsents.find((row) => row?.terms_type === termsType);
    // 앞 요청에서 동의만 저장됐어도 동일 이력을 중복 추가하지 않고 설정 저장을 재시도한다.
    if (latest?.agreed === next[field]) continue;
    if (!latest && current[field] === next[field]) continue;
    records.push({
      terms_type: termsType,
      terms_version: latest?.terms_version ?? null,
      agreed: next[field],
      created_at: time.toISOString(),
    });
  }
  return records;
}

function requireSettings(settings) {
  if (!settings)
    throw failure(
      409,
      'NOTIFICATION_SETTINGS_MISSING',
      '알림 설정이 없어요. 가입 정보를 다시 저장해 주세요.'
    );
  return settings;
}

export async function getMyNotificationSettings(userId, query = {}) {
  validateObject(query, []);
  await requireActiveProfile(userId);
  // 가입 누락은 1단계 가입 복구로 돌린다. DB에 없는 기본 설정을 성공 응답으로 만들지 않는다.
  return requireSettings(await repository.findByUserId(userId));
}

export async function updateMyNotificationSettings(userId, input) {
  validateNotificationInput(input);
  await requireActiveProfile(userId);
  const current = requireSettings(await repository.findByUserId(userId));
  const next = normalizeNotificationPatch(current, input);
  const latest = await repository.findLatestConsents(userId);
  const changes = buildConsentChanges(current, next, new Date(), latest);
  return repository.updateSettingsWithConsents(userId, next, changes);
}
