import * as repository from '../repositories/address.repository.js';
import { findByAuthId } from '../repositories/user.repository.js';

const FIELDS = {
  label: 'label',
  recipientName: 'recipient_name',
  recipientPhone: 'recipient_phone',
  zipCode: 'zip_code',
  roadAddress: 'road_address',
  detailAddress: 'detail_address',
  latitude: 'latitude',
  longitude: 'longitude',
  deliveryRequest: 'delivery_request',
  isDefault: 'is_default',
};

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

export function validateAddressId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) {
    throw failure(400, 'INVALID_ADDRESS_ID', '배송지 식별자를 확인해 주세요.');
  }
  return value;
}

function normalizeText(value, maxLength, nullable = false, allowEmpty = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || value.length > maxLength)
    throw failure(400, 'INVALID_ADDRESS', '배송지 입력 길이와 형식을 확인해 주세요.');
  const text = value.trim().normalize('NFC');
  if (!text && nullable) return null;
  if (!text && !allowEmpty)
    throw failure(400, 'INVALID_ADDRESS', '필수 배송지 정보를 입력해 주세요.');
  return text;
}

export function validateAddressInput(input, partial = false) {
  validateObject(input, Object.keys(FIELDS));
  if (partial && Object.keys(input).length === 0)
    throw failure(400, 'EMPTY_ADDRESS_PATCH', '변경할 배송지 정보를 입력해 주세요.');
  const result = {};
  const required = ['recipientName', 'recipientPhone', 'zipCode', 'roadAddress', 'detailAddress'];
  if (!partial && required.some((key) => !Object.hasOwn(input, key)))
    throw failure(400, 'INVALID_ADDRESS', '받는 사람·연락처·우편번호·주소를 입력해 주세요.');
  for (const [key, column] of Object.entries(FIELDS)) {
    if (!Object.hasOwn(input, key)) continue;
    const value = input[key];
    if (key === 'isDefault') {
      if (typeof value !== 'boolean')
        throw failure(400, 'INVALID_DEFAULT', '기본 배송지 여부는 참 또는 거짓이어야 해요.');
      result[column] = value;
    } else if (key === 'latitude' || key === 'longitude') {
      const bound = key === 'latitude' ? 90 : 180;
      if (
        value !== null &&
        (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > bound)
      ) {
        throw failure(400, 'INVALID_COORDINATES', '주소 좌표를 확인해 주세요.');
      }
      result[column] = value;
    } else if (key === 'recipientPhone') {
      if (typeof value !== 'string' || value.length > 50)
        throw failure(400, 'INVALID_PHONE', '받는 사람 연락처를 확인해 주세요.');
      const phone = value.replace(/[\s()-]/g, '');
      if (!/^0\d{9,10}$/.test(phone))
        throw failure(400, 'INVALID_PHONE', '받는 사람 연락처를 확인해 주세요.');
      result[column] = phone;
    } else if (key === 'zipCode') {
      if (typeof value !== 'string' || !/^\d{5}$/.test(value.trim()))
        throw failure(400, 'INVALID_ZIP_CODE', '우편번호 5자리를 입력해 주세요.');
      result[column] = value.trim();
    } else {
      const maxLength =
        key === 'recipientName' || key === 'label' ? 50 : key === 'deliveryRequest' ? 500 : 300;
      result[column] = normalizeText(
        value,
        maxLength,
        key === 'label' || key === 'deliveryRequest',
        key === 'detailAddress'
      );
    }
  }
  if (Object.hasOwn(input, 'latitude') || Object.hasOwn(input, 'longitude')) {
    if (
      !Object.hasOwn(input, 'latitude') ||
      !Object.hasOwn(input, 'longitude') ||
      (input.latitude === null) !== (input.longitude === null)
    ) {
      throw failure(400, 'INVALID_COORDINATES', '위도와 경도는 함께 입력하거나 함께 지워 주세요.');
    }
  }
  return result;
}

export async function listMyAddresses(userId, query = {}) {
  validateObject(query, []);
  await requireActiveProfile(userId);
  const items = await repository.listByUserId(userId);
  return { items, totalCount: items.length, maxAddresses: 10 };
}

export async function resolveAddressSelection(userId, addressId) {
  validateAddressId(addressId);
  await requireActiveProfile(userId);
  const address = await repository.findOwnedById(userId, addressId);
  if (!address) throw failure(404, 'ADDRESS_NOT_FOUND', '사용할 수 있는 배송지를 찾지 못했어요.');
  return address;
}

export async function createAddress(userId, input) {
  const address = validateAddressInput(input);
  await requireActiveProfile(userId);
  const items = await repository.listByUserId(userId);
  if (items.length >= 10)
    throw failure(409, 'ADDRESS_LIMIT_REACHED', '배송지는 최대 10개까지 등록할 수 있어요.');
  const created = await repository.createOwned(userId, address);
  if (address.is_default === true || !items.some((item) => item.is_default))
    return repository.setDefault(userId, created.id);
  return created;
}

export async function updateAddress(userId, addressId, input) {
  validateAddressId(addressId);
  const patch = validateAddressInput(input, true);
  const current = await resolveAddressSelection(userId, addressId);
  if (current.is_default && patch.is_default === false)
    throw failure(400, 'DEFAULT_ADDRESS_REQUIRED', '다른 배송지를 기본값으로 선택해 주세요.');
  // 주소가 바뀌었는데 새 좌표가 없으면 이전 주소 좌표를 남기지 않는다.
  if (
    (Object.hasOwn(patch, 'road_address') && patch.road_address !== current.road_address) ||
    (Object.hasOwn(patch, 'zip_code') && patch.zip_code !== current.zip_code)
  ) {
    if (!Object.hasOwn(patch, 'latitude'))
      Object.assign(patch, { latitude: null, longitude: null });
  }
  const makeDefault = patch.is_default === true;
  delete patch.is_default;
  const updated = Object.keys(patch).length
    ? await repository.updateOwned(userId, addressId, patch)
    : current;
  return makeDefault ? repository.setDefault(userId, addressId) : updated;
}

export async function deleteAddress(userId, addressId, input) {
  validateObject(input, [], true);
  await resolveAddressSelection(userId, addressId);
  const removed = await repository.deleteOwned(userId, addressId);
  const remaining = await repository.listByUserId(userId);
  let replacement = remaining.find((item) => item.is_default);
  if (!replacement && remaining.length)
    replacement = await repository.setDefault(userId, remaining[0].id);
  return { deletedAddressId: removed.id, defaultAddressId: replacement?.id ?? null };
}

export async function setDefaultAddress(userId, addressId, input) {
  validateObject(input, [], true);
  await resolveAddressSelection(userId, addressId);
  return repository.setDefault(userId, addressId);
}
