// 1단계 가입 처리 · 2단계 마이 요약/프로필/탈퇴. 기존 공용 클라이언트를 사용한다.
const PROFILE_COLUMNS =
  'id,email,nickname,phone,profile_image_url,role,status,created_at,updated_at,withdrawn_at';

async function getDatabase() {
  // 환경 설정은 기존 공용 클라이언트에서만 읽는다. 대체 데이터는 사용하지 않는다.
  const { supabase } = await import('../lib/supabase.js');
  return supabase;
}

function checkDatabaseError(error) {
  if (!error) return;
  const failure = new Error('회원 정보를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
  failure.status = 503;
  failure.code = 'DATABASE_ERROR';
  failure.databaseCode = error.code;
  throw failure;
}

export async function findByAuthId(userId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('users')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}

export async function existsByAuthId(userId) {
  const user = await findByAuthId(userId);
  return user !== null;
}

export async function findByEmail(email) {
  const db = await getDatabase();
  const { data, error } = await db.from('users').select('id').ilike('email', email).maybeSingle();
  checkDatabaseError(error);
  return data;
}

export async function findByNickname(normalizedNickname) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('users')
    .select('id,nickname')
    .eq('nickname', normalizedNickname)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}

export async function findAgreementsByUserId(userId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('terms_agreements')
    .select('id,terms_type,terms_version,agreed,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  checkDatabaseError(error);
  return data;
}

async function findNotificationSettings(userId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('notification_settings')
    .select(
      'user_id,push_enabled,order_status,restock,liked_store_news,coupon_expiry,inquiry_answer,marketing,night_push,updated_at'
    )
    .eq('user_id', userId)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}

export async function getRegistrationSnapshot(userId) {
  const user = await findByAuthId(userId);
  if (!user) return { user: null, agreements: [], notificationSettings: null };
  const [agreements, notificationSettings] = await Promise.all([
    findAgreementsByUserId(userId),
    findNotificationSettings(userId),
  ]);
  return { user, agreements, notificationSettings };
}

export async function completeSignup(userId, input) {
  const db = await getDatabase();
  // PK 충돌은 기존 프로필을 보존한다. 닉네임 UNIQUE 충돌은 service에서 409로 처리한다.
  const { error: userError } = await db.from('users').upsert(
    {
      id: userId,
      email: input.email,
      nickname: input.nickname,
      phone: input.phone,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  checkDatabaseError(userError);

  const existing = await findAgreementsByUserId(userId);
  const latest = new Map();
  for (const row of existing) {
    if (!latest.has(row.terms_type)) latest.set(row.terms_type, row);
  }
  const missing = input.agreements.filter((row) => {
    const saved = latest.get(row.terms_type);
    return !saved || saved.agreed !== row.agreed || saved.terms_version !== row.terms_version;
  });
  if (missing.length > 0) {
    const { error } = await db
      .from('terms_agreements')
      .insert(missing.map((row) => ({ ...row, user_id: userId })));
    checkDatabaseError(error);
  }

  // 이미 가입을 마친 계정은 service에서 반환하므로, 이 갱신은 미완료 가입 복구에만 사용한다.
  const settings = await findNotificationSettings(userId);
  const query = settings
    ? db
        .from('notification_settings')
        .update({ ...input.notificationSettings, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    : db.from('notification_settings').insert({ user_id: userId, ...input.notificationSettings });
  const { error: settingsError } = await query;
  checkDatabaseError(settingsError);
  return getRegistrationSnapshot(userId);
}

export async function updateProfileByUserId(userId, patch, updatedAt) {
  const db = await getDatabase();
  // service뿐 아니라 DB 쓰기에서도 허용 필드를 제한한다.
  const values = Object.fromEntries(
    Object.entries(patch).filter(([key]) =>
      ['nickname', 'phone', 'profile_image_url'].includes(key)
    )
  );
  const { data, error } = await db
    .from('users')
    .update({ ...values, updated_at: updatedAt })
    .eq('id', userId)
    .eq('status', 'ACTIVE')
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}

async function exactCount(query) {
  const { count, error } = await query;
  checkDatabaseError(error);
  // DB 실패/미응답을 0건으로 바꾸지 않는다.
  if (!Number.isSafeInteger(count) || count < 0) {
    checkDatabaseError({ code: 'MISSING_EXACT_COUNT' });
  }
  return count;
}

export async function getMyCounters(userId, periodStart, now) {
  const db = await getDatabase();
  const statuses = ['PAID', 'PREPARING', 'READY_FOR_PICKUP', 'SHIPPING', 'COMPLETED', 'CANCELED'];
  const orderCounts = Promise.all(
    statuses.map((status) =>
      exactCount(
        db
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', status)
          .gte('created_at', periodStart)
          .lte('created_at', now)
      )
    )
  );
  const countOwned = (table) =>
    db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId);
  const [
    orders,
    wishlistProducts,
    wishlistShops,
    availableCoupons,
    unreadNotifications,
    cartItems,
  ] = await Promise.all([
    orderCounts,
    exactCount(countOwned('wishlist_products')),
    exactCount(countOwned('wishlist_shops')),
    exactCount(
      db
        .from('user_coupons')
        .select('id,coupons!inner(id)', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'AVAILABLE')
        .gt('expires_at', now)
        .eq('coupons.is_active', true)
        .lte('coupons.valid_from', now)
        .gt('coupons.valid_until', now)
    ),
    exactCount(countOwned('notifications').eq('is_read', false)),
    exactCount(countOwned('cart_items')),
  ]);
  return {
    orderStatusCounts: Object.fromEntries(statuses.map((status, index) => [status, orders[index]])),
    wishlistProducts,
    wishlistShops,
    availableCoupons,
    unreadNotifications,
    cartItems,
  };
}

export async function findCurrentConsumerMembership(userId, now) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('user_memberships')
    .select(
      'id,plan_code,status,started_at,current_period_end,auto_renew,canceled_at,membership_plans!inner(code,target,name,monthly_price,preorder_enabled,alert_priority_minutes,benefits)'
    )
    .eq('user_id', userId)
    .is('store_id', null)
    .eq('membership_plans.target', 'CONSUMER')
    .in('status', ['ACTIVE', 'CANCELED'])
    .lte('started_at', now)
    .gt('current_period_end', now)
    .order('current_period_end', { ascending: false })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}

export async function findNextReadyPickup(userId, now) {
  const db = await getDatabase();
  const { data, error } = await db
    .from('orders')
    .select('id,order_no,store_id,pickup_deadline,stores(id,name,address)')
    .eq('user_id', userId)
    .eq('fulfillment_type', 'PICKUP')
    .eq('status', 'READY_FOR_PICKUP')
    .gte('pickup_deadline', now)
    .order('pickup_deadline', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}

export async function listAgreementsByUserId(userId, { limit, offset }) {
  const db = await getDatabase();
  const { data, count, error } = await db
    .from('terms_agreements')
    .select('id,terms_type,terms_version,agreed,created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);
  checkDatabaseError(error);
  if (!Array.isArray(data) || !Number.isSafeInteger(count) || count < 0) {
    checkDatabaseError({ code: 'MISSING_AGREEMENT_RESULT' });
  }
  return { items: data, total: count };
}

export async function getWithdrawalBlockers(userId) {
  const db = await getDatabase();
  const ongoing = ['PAID', 'PREPARING', 'READY_FOR_PICKUP', 'SHIPPING'];
  const [myOrders, storeOrders, openStores] = await Promise.all([
    exactCount(
      db
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ongoing)
    ),
    exactCount(
      db
        .from('orders')
        .select('id,stores!inner(owner_id)', { count: 'exact', head: true })
        .eq('stores.owner_id', userId)
        .in('status', ongoing)
    ),
    exactCount(
      db
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .neq('status', 'CLOSED')
    ),
  ]);
  return { myOrders, storeOrders, openStores };
}

export async function withdrawAccount(userId, withdrawnAt) {
  const db = await getDatabase();
  // 실 PG 갱신은 없지만 DB에 남은 구독의 자동 갱신 의사는 해제한다.
  const { error: membershipError } = await db
    .from('user_memberships')
    .update({ auto_renew: false })
    .eq('user_id', userId)
    .eq('auto_renew', true);
  checkDatabaseError(membershipError);
  // Auth/users의 실제 삭제는 FK와 주문 이력에 영향을 주므로 상태만 변경한다.
  const { data, error } = await db
    .from('users')
    .update({
      status: 'WITHDRAWN',
      withdrawn_at: withdrawnAt,
      updated_at: withdrawnAt,
      push_token: null,
    })
    .eq('id', userId)
    .eq('status', 'ACTIVE')
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  checkDatabaseError(error);
  return data;
}
