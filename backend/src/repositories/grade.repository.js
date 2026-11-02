// 회원 등급: 구매 확정 주문 금액 합계 조회 + 등급 쿠폰팩 정책(coupons 행) 준비.
async function getDatabase() {
  const { supabase } = await import("../lib/supabase.js");
  return supabase;
}

function databaseError(error) {
  if (!error) return;
  throw Object.assign(
    new Error("회원 등급을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."),
    { status: 503, code: "DATABASE_ERROR", databaseCode: error.code },
  );
}

// since 이후에 주문한 구매 확정(COMPLETED) 주문의 결제 금액(적립금 사용분 포함) 합계
export async function sumCompletedOrderAmount(userId, since) {
  const db = await getDatabase();
  let total = 0;
  let offset = 0;
  for (;;) {
    const { data, error } = await db
      .from("orders")
      .select("id,total_amount,points_used_amount")
      .eq("user_id", userId)
      .eq("status", "COMPLETED")
      .gte("created_at", since)
      .order("id", { ascending: true })
      .range(offset, offset + 499);
    databaseError(error);
    for (const row of data ?? [])
      total += (row.total_amount ?? 0) + (row.points_used_amount ?? 0);
    if (!data || data.length < 500) return total;
    offset += data.length;
  }
}

// 이번 달 등급 쿠폰 정책이 없으면 만든다. 같은 code 는 한 번만 만든다.
export async function ensureCouponPolicy(policy) {
  const db = await getDatabase();
  const found = await db
    .from("coupons")
    .select("id")
    .eq("code", policy.code)
    .order("created_at", { ascending: true })
    .limit(1);
  databaseError(found.error);
  if (found.data?.length) return found.data[0].id;
  const { data, error } = await db
    .from("coupons")
    .insert({ ...policy, issued_count: 0, is_active: true })
    .select("id")
    .single();
  if (error?.code === "23505") return ensureCouponPolicy(policy);
  databaseError(error);
  return data.id;
}
