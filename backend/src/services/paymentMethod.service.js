import * as repository from '../repositories/paymentMethod.repository.js';
import { findByAuthId } from '../repositories/user.repository.js';

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function validateObject(input, allowed, optional = false) {
  if (optional && input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw failure(400, 'INVALID_INPUT', '입력값을 확인해 주세요.');
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw failure(400, 'UNKNOWN_FIELDS', '허용되지 않은 입력 항목이 있어요.');
  return input;
}

async function requireActiveProfile(userId) {
  const profile = await findByAuthId(userId);
  if (!profile) throw failure(404, 'PROFILE_NOT_FOUND', '회원가입을 먼저 완료해 주세요.');
  if (profile.status !== 'ACTIVE')
    throw failure(403, 'ACCOUNT_UNAVAILABLE', '현재 사용할 수 없는 계정이에요.');
}

export function validatePaymentMethodId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
    throw failure(400, 'INVALID_PAYMENT_METHOD_ID', '결제수단 식별자를 확인해 주세요.');
  }
  return value;
}

export function validateDemoPaymentMethod(input) {
  validateObject(input, ['methodType', 'providerName', 'last4', 'alias', 'isDefault']);
  // 실제 DB CHECK와 같은 종류만 허용한다. 은행명/카드사/별칭은 입력에서 받는다.
  if (!['CARD', 'BANK_ACCOUNT', 'EASY_PAY'].includes(input.methodType))
    throw failure(400, 'INVALID_METHOD_TYPE', '결제수단 종류를 확인해 주세요.');
  if (
    typeof input.providerName !== 'string' ||
    !input.providerName.trim() ||
    input.providerName.length > 50
  ) {
    throw failure(400, 'INVALID_PROVIDER_NAME', '카드사·은행·간편결제 이름을 입력해 주세요.');
  }
  const last4 =
    input.last4 === undefined || input.last4 === null || input.last4 === '' ? null : input.last4;
  if (
    (input.methodType !== 'EASY_PAY' && last4 === null) ||
    (last4 !== null && (typeof last4 !== 'string' || !/^\d{4}$/.test(last4)))
  ) {
    throw failure(400, 'INVALID_LAST4', '표시용 뒷자리 4자리만 입력해 주세요.');
  }
  let alias = null;
  if (Object.hasOwn(input, 'alias')) {
    if (input.alias !== null && (typeof input.alias !== 'string' || input.alias.length > 50))
      throw failure(400, 'INVALID_ALIAS', '별칭은 50자 이내로 입력해 주세요.');
    alias = input.alias === null ? null : input.alias.trim().normalize('NFC') || null;
  }
  if (Object.hasOwn(input, 'isDefault') && typeof input.isDefault !== 'boolean')
    throw failure(400, 'INVALID_DEFAULT', '기본 결제수단 여부는 참 또는 거짓이어야 해요.');
  return {
    method_type: input.methodType,
    provider_name: input.providerName.trim().normalize('NFC'),
    last4,
    alias,
    is_default: input.isDefault === true,
  };
}

export async function listMyPaymentMethods(userId, query = {}) {
  validateObject(query, []);
  await requireActiveProfile(userId);
  const items = await repository.listActiveByUserId(userId);
  return { items, totalCount: items.length, demoOnly: true };
}

export async function resolvePaymentMethodSelection(userId, methodId) {
  validatePaymentMethodId(methodId);
  await requireActiveProfile(userId);
  const method = await repository.findActiveOwnedById(userId, methodId);
  if (!method)
    throw failure(404, 'PAYMENT_METHOD_NOT_FOUND', '사용할 수 있는 결제수단을 찾지 못했어요.');
  return method;
}

export async function createPaymentMethod(userId, input) {
  const method = validateDemoPaymentMethod(input);
  await requireActiveProfile(userId);
  const items = await repository.listActiveByUserId(userId);
  const created = await repository.createOwned(userId, method);
  const saved =
    method.is_default || !items.some((item) => item.is_default)
      ? await repository.setDefault(userId, created.id)
      : created;
  return { paymentMethod: saved, demoOnly: true };
}

export async function deletePaymentMethod(userId, methodId, input) {
  validateObject(input, [], true);
  await resolvePaymentMethodSelection(userId, methodId);
  const removed = await repository.softDeleteOwned(userId, methodId);
  const remaining = await repository.listActiveByUserId(userId);
  let replacement = remaining.find((item) => item.is_default);
  if (!replacement && remaining.length)
    replacement = await repository.setDefault(userId, remaining[0].id);
  return {
    deletedPaymentMethodId: removed.id,
    defaultPaymentMethodId: replacement?.id ?? null,
    demoOnly: true,
  };
}

export async function setDefaultPaymentMethod(userId, methodId, input) {
  validateObject(input, [], true);
  await resolvePaymentMethodSelection(userId, methodId);
  return { paymentMethod: await repository.setDefault(userId, methodId), demoOnly: true };
}
