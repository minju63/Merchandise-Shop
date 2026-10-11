// 3단계: 기존 addresses만 사용한다. 주문의 배송지 스냅샷은 변경하지 않는다.
const COLUMNS =
  'id,user_id,label,recipient_name,recipient_phone,zip_code,road_address,detail_address,latitude,longitude,delivery_request,is_default,created_at,updated_at';
const EDITABLE = [
  'label',
  'recipient_name',
  'recipient_phone',
  'zip_code',
  'road_address',
  'detail_address',
  'latitude',
  'longitude',
  'delivery_request',
];

async function getDatabase() {
  const { supabase } = await import('../lib/supabase.js');
  return supabase;
}

function checkDatabaseError(error) {
  if (!error) return;
  const failure = new Error('배송지를 저장하거나 조회하지 못했어요. 잠시 후 다시 시도해 주세요.');
  failure.status = error.code === '23505' ? 409 : 503;
  failure.code = error.code === '23505' ? 'DEFAULT_ADDRESS_CONFLICT' : 'DATABASE_ERROR';
  failure.databaseCode = error.code;
  throw failure;
}

function ownedRecord(data) {
  if (data) return data;
  const error = new Error('사용할 수 있는 배송지를 찾지 못했어요.');
  error.status = 404;
  error.code = 'ADDRESS_NOT_FOUND';
  throw error;
}

function allowedFields(input) {
  return Object.fromEntries(
    EDITABLE.filter((key) => Object.hasOwn(input, key)).map((key) => [key, input[key]])
  );
}

export async function listByUserId(userId) {
  const db = await getDatabase();
  const items = [];
  // 서버 행 제한 때문에 본인 목록이 잘리지 않도록 페이지별로 읽는다.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from('addresses')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + 499);
    checkDatabaseError(error);
    if (!Array.isArray(data)) checkDatabaseError({ code: 'INVALID_DATABASE_RESPONSE' });
    items.push(...data);
    if (data.length < 500) return items;
  }
}

export async function findOwnedById(userId, addressId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('addresses')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('id', addressId)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}

export async function createOwned(userId, input) {
  const db = await getDatabase();
  // 기본값은 별도 함수에서 전환한다. 먼저 false로 저장해 UNIQUE 제약과 충돌하지 않는다.
  const { data, error } = await db
    .from('addresses')
    .insert({ ...allowedFields(input), user_id: userId, is_default: false })
    .select(COLUMNS)
    .single();
  checkDatabaseError(error);
  return ownedRecord(data);
}

export async function updateOwned(userId, addressId, patch) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('addresses')
    .update({ ...allowedFields(patch), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', addressId)
    .select(COLUMNS)
    .maybeSingle();
  checkDatabaseError(error);
  return ownedRecord(data);
}

export async function deleteOwned(userId, addressId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('addresses')
    .delete()
    .eq('user_id', userId)
    .eq('id', addressId)
    .select(COLUMNS)
    .maybeSingle();
  checkDatabaseError(error);
  return ownedRecord(data);
}

export async function setDefault(userId, addressId) {
  const target = ownedRecord(await findOwnedById(userId, addressId));
  if (target.is_default) return target;
  const db = await getDatabase();
  const updatedAt = new Date().toISOString();
  const { error: clearError } = await db
    .from('addresses')
    .update({ is_default: false, updated_at: updatedAt })
    .eq('user_id', userId)
    .eq('is_default', true)
    .neq('id', addressId);
  checkDatabaseError(clearError);
  const { data, error } = await db
    .from('addresses')
    .update({ is_default: true, updated_at: updatedAt })
    .eq('user_id', userId)
    .eq('id', addressId)
    .select(COLUMNS)
    .maybeSingle();
  checkDatabaseError(error);
  return ownedRecord(data);
}
