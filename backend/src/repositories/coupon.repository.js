// 4·6·7단계: 기존 coupons/user_coupons로 조회·발급·사용·취소 복원.
const POLICY_COLUMNS =
  "id,store_id,code,name,discount_type,discount_value,max_discount,min_order_amount,applies_to,total_quantity,issued_count,valid_from,valid_until,is_active,created_at";
const OWNED_COLUMNS = `id,user_id,coupon_id,status,expires_at,used_at,created_at,coupon:coupons!inner(${POLICY_COLUMNS},store:stores(id,name))`;

async function getDatabase() {
  const { supabase } = await import("../lib/supabase.js");
  return supabase;
}

function databaseError(error) {
  if (!error) return;
  const failure = Object.assign(
    new Error("쿠폰을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."),
    { status: 503, code: "DATABASE_ERROR", databaseCode: error.code },
  );
  throw failure;
}

function exactCount(result) {
  databaseError(result.error);
  if (!Number.isSafeInteger(result.count) || result.count < 0)
    databaseError({ code: "MISSING_EXACT_COUNT" });
  return result.count;
}

export async function listOwnedWithPolicy(userId) {
  const db = await getDatabase();
  const items = [];
  let offset = 0;
  for (;;) {
    const result = await db
      .from("user_coupons")
      .select(OWNED_COLUMNS, { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 499);
    const count = exactCount(result);
    if (!Array.isArray(result.data))
      databaseError({ code: "INVALID_DATABASE_RESPONSE" });
    items.push(...result.data);
    offset += result.data.length;
    if (offset >= count) return items;
    if (!result.data.length)
      databaseError({ code: "INCOMPLETE_DATABASE_RESPONSE" });
  }
}

export async function findOwnedWithPolicy(userId, userCouponId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from("user_coupons")
    .select(OWNED_COLUMNS)
    .eq("user_id", userId)
    .eq("id", userCouponId)
    .maybeSingle();
  databaseError(error);
  return data;
}

export async function findByCode(code) {
  const db = await getDatabase();
  const { data, error } = await db
    .from("coupons")
    .select(POLICY_COLUMNS)
    .eq("code", code)
    .maybeSingle();
  databaseError(error);
  return data;
}

export async function findActiveByCode(code, now) {
  const coupon = await findByCode(code);
  if (
    !coupon ||
    !coupon.is_active ||
    Date.parse(coupon.valid_from) > Date.parse(now) ||
    Date.parse(coupon.valid_until) <= Date.parse(now)
  )
    return null;
  return coupon;
}

export async function findOwnedByCouponId(userId, couponId) {
  const db = await getDatabase();
  const { data, error } = await db
    .from("user_coupons")
    .select(OWNED_COLUMNS)
    .eq("user_id", userId)
    .eq("coupon_id", couponId)
    .maybeSingle();
  databaseError(error);
  return data;
}

export async function countIssued(couponId) {
  const db = await getDatabase();
  return exactCount(
    await db
      .from("user_coupons")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", couponId),
  );
}

export async function synchronizeIssuedCount(couponId) {
  const count = await countIssued(couponId);
  const db = await getDatabase();
  const { data, error } = await db
    .from("coupons")
    .update({ issued_count: count })
    .eq("id", couponId)
    .select("id,issued_count")
    .maybeSingle();
  databaseError(error);
  if (!data) databaseError({ code: "COUPON_REMOVED" });
  return count;
}

export async function registerCode(userId, coupon, now) {
  const existing = await findOwnedByCouponId(userId, coupon.id);
  if (existing) {
    await synchronizeIssuedCount(coupon.id);
    return { userCoupon: existing, alreadyOwned: true };
  }
  const count = await countIssued(coupon.id);
  if (coupon.total_quantity !== null && count >= coupon.total_quantity)
    throw Object.assign(new Error("쿠폰 발급 수량이 모두 소진됐어요."), {
      status: 409,
      code: "COUPON_SOLD_OUT",
    });
  const db = await getDatabase();
  const { data, error } = await db
    .from("user_coupons")
    .insert({
      user_id: userId,
      coupon_id: coupon.id,
      status: "AVAILABLE",
      expires_at: coupon.valid_until,
      created_at: now,
    })
    .select("id")
    .single();
  // 실제 UNIQUE(user_id,coupon_id)로 같은 회원의 중복 요청을 처리한다.
  if (error?.code === "23505") {
    const duplicate = await findOwnedByCouponId(userId, coupon.id);
    if (duplicate) {
      await synchronizeIssuedCount(coupon.id);
      return { userCoupon: duplicate, alreadyOwned: true };
    }
  }
  databaseError(error);
  if (!data?.id) databaseError({ code: "INVALID_DATABASE_RESPONSE" });
  await synchronizeIssuedCount(coupon.id);
  const saved = await findOwnedWithPolicy(userId, data.id);
  if (!saved) databaseError({ code: "COUPON_NOT_SAVED" });
  return { userCoupon: saved, alreadyOwned: false };
}

export async function issueByCodeRule() {
  const db = await getDatabase();
  const items = [];
  let offset = 0;
  for (;;) {
    // 밑줄은 SQL LIKE 와일드카드가 아닌 실제 SIGNUP_ 접두어다.
    const result = await db
      .from("coupons")
      .select(POLICY_COLUMNS, { count: "exact" })
      .like("code", "SIGNUP\\_%")
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    const count = exactCount(result);
    if (!Array.isArray(result.data))
      databaseError({ code: "INVALID_DATABASE_RESPONSE" });
    items.push(...result.data);
    offset += result.data.length;
    if (offset >= count) return items;
    if (!result.data.length)
      databaseError({ code: "INCOMPLETE_DATABASE_RESPONSE" });
  }
}

export async function hasPreviousOrder(userId) {
  const db = await getDatabase();
  return (
    exactCount(
      await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .neq("status", "CANCELED"),
    ) > 0
  );
}

export async function markOwnedUsed(
  userId,
  userCouponId,
  now = new Date().toISOString(),
) {
  const db = await getDatabase();
  const { data, error } = await db
    .from("user_coupons")
    .update({ status: "USED", used_at: now })
    .eq("id", userCouponId)
    .eq("user_id", userId)
    .eq("status", "AVAILABLE")
    .gt("expires_at", now)
    .select("id")
    .maybeSingle();
  databaseError(error);
  if (!data)
    throw Object.assign(new Error("쿠폰 상태가 변경됐어요."), {
      status: 409,
      code: "COUPON_CHANGED",
    });
  return data;
}
export async function restoreOwnedCoupon(userId, userCouponId, status) {
  if (!["AVAILABLE", "EXPIRED"].includes(status))
    throw Object.assign(new Error("쿠폰 복원 상태를 확인해 주세요."), {
      status: 400,
      code: "INVALID_COUPON_STATUS",
    });
  const db = await getDatabase();
  const { data, error } = await db
    .from("user_coupons")
    .update({ status, used_at: null })
    .eq("id", userCouponId)
    .eq("user_id", userId)
    .eq("status", "USED")
    .select("id,status")
    .maybeSingle();
  databaseError(error);
  return data;
}
