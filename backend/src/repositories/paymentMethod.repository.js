// 3단계: 표시용 메타데이터만 저장한다. 결제 승인·카드정보 등록은 수행하지 않는다.
const COLUMNS = 'id,user_id,method_type,provider_name,last4,alias,is_default,created_at,deleted_at';

async function getDatabase() {
  const { supabase } = await import('../lib/supabase.js');
  return supabase;
}

function checkDatabaseError(error) {
  if (!error) return;
  const failure = new Error('결제수단을 저장하거나 조회하지 못했어요. 잠시 후 다시 시도해 주세요.');
  failure.status = error.code === '23505' ? 409 : 503;
  failure.code = error.code === '23505' ? 'DEFAULT_PAYMENT_METHOD_CONFLICT' : 'DATABASE_ERROR';
  failure.databaseCode = error.code;
  throw failure;
}

function ownedRecord(data) {
  if (data) return data;
  const error = new Error('사용할 수 있는 결제수단을 찾지 못했어요.');
  error.status = 404;
  error.code = 'PAYMENT_METHOD_NOT_FOUND';
  throw error;
}

export async function listActiveByUserId(userId) {
  const db = await getDatabase();
  const items = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from('payment_methods')
      .select(COLUMNS)
      .eq('user_id', userId)
      .is('deleted_at', null)
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

export async function findActiveOwnedById(userId, methodId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('payment_methods')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('id', methodId)
    .is('deleted_at', null)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}

export async function createOwned(userId, input) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('payment_methods')
    .insert({
      user_id: userId,
      method_type: input.method_type,
      provider_name: input.provider_name,
      last4: input.last4,
      alias: input.alias,
      is_default: false,
    })
    .select(COLUMNS)
    .single();
  checkDatabaseError(error);
  return ownedRecord(data);
}

export async function softDeleteOwned(userId, methodId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('payment_methods')
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq('user_id', userId)
    .eq('id', methodId)
    .is('deleted_at', null)
    .select(COLUMNS)
    .maybeSingle();
  checkDatabaseError(error);
  return ownedRecord(data);
}

export async function setDefault(userId, methodId) {
  const target = ownedRecord(await findActiveOwnedById(userId, methodId));
  if (target.is_default) return target;
  const db = await getDatabase();
  const { error: clearError } = await db
    .from('payment_methods')
    .update({ is_default: false })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('is_default', true)
    .neq('id', methodId);
  checkDatabaseError(clearError);
  const { data, error } = await db
    .from('payment_methods')
    .update({ is_default: true })
    .eq('user_id', userId)
    .eq('id', methodId)
    .is('deleted_at', null)
    .select(COLUMNS)
    .maybeSingle();
  checkDatabaseError(error);
  return ownedRecord(data);
}
