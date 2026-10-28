const COLUMNS =
  'user_id,push_enabled,order_status,restock,liked_store_news,coupon_expiry,inquiry_answer,marketing,night_push,updated_at';
const EDITABLE = [
  'push_enabled',
  'order_status',
  'restock',
  'liked_store_news',
  'coupon_expiry',
  'inquiry_answer',
  'marketing',
  'night_push',
];

async function getDatabase() {
  const { supabase } = await import('../lib/supabase.js');
  return supabase;
}

function checkDatabaseError(error) {
  if (!error) return;
  const failure = new Error('알림 설정을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
  failure.status = 503;
  failure.code = 'DATABASE_ERROR';
  failure.databaseCode = error.code;
  throw failure;
}

export async function findByUserId(userId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('notification_settings')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}

export async function findLatestConsents(userId) {
  const db = await getDatabase();
  // 유형별 한 건씩 읽어 행 제한 및 동일 시각 정렬의 영향을 줄인다.
  return Promise.all(
    ['MARKETING', 'NIGHT_PUSH'].map(async (termsType) => {
      const { data, error } = await db
        .from('terms_agreements')
        .select('id,terms_type,terms_version,agreed,created_at')
        .eq('user_id', userId)
        .eq('terms_type', termsType)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      checkDatabaseError(error);
      return data;
    })
  );
}

export async function updateSettingsWithConsents(userId, settings, changes) {
  const db = await getDatabase();
  // 동의 이력을 먼저 기록한다. 뒤 설정 저장 실패 시 같은 요청이 최신 이력을 확인해 복구한다.
  if (changes.length) {
    const records = changes.map((change) => ({
      user_id: userId,
      terms_type: change.terms_type,
      terms_version: change.terms_version,
      agreed: change.agreed,
      created_at: change.created_at,
    }));
    const { error } = await db.from('terms_agreements').insert(records);
    checkDatabaseError(error);
  }
  const patch = Object.fromEntries(
    EDITABLE.filter((key) => Object.hasOwn(settings, key)).map((key) => [key, settings[key]])
  );
  const { data, error } = await db
    .from('notification_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select(COLUMNS)
    .maybeSingle();
  checkDatabaseError(error);
  if (!data) {
    const failure = new Error('알림 설정이 없어요. 가입 정보를 다시 저장해 주세요.');
    failure.status = 409;
    failure.code = 'NOTIFICATION_SETTINGS_MISSING';
    throw failure;
  }
  return data;
}
