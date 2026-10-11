async function database() {
  const { supabase } = await import("../lib/supabase.js");
  return supabase;
}
function check(result) {
  if (result.error)
    throw Object.assign(new Error("DB 요청을 처리하지 못했어요."), {
      status: result.error.code === "23505" ? 409 : 503,
      code:
        result.error.code === "23505" ? "DUPLICATE_RECORD" : "DATABASE_ERROR",
      databaseCode: result.error.code,
    });
  return result.data;
}
async function all(table, columns, filters = [], order = "id") {
  const db = await database();
  const rows = [];
  let offset = 0;
  for (;;) {
    let query = db.from(table).select(columns, { count: "exact" });
    for (const [method, column, value] of filters)
      query = query[method](column, value);
    const result = await query
      .order(order, { ascending: true })
      .range(offset, offset + 499);
    const data = check(result);
    if (!Array.isArray(data) || !Number.isSafeInteger(result.count))
      throw Object.assign(new Error("DB 조회 결과를 확인할 수 없어요."), {
        status: 503,
        code: "DATABASE_ERROR",
      });
    rows.push(...data);
    offset += data.length;
    if (offset >= result.count) return rows;
    if (!data.length)
      throw Object.assign(new Error("DB 조회가 일부 누락됐어요."), {
        status: 503,
        code: "DATABASE_ERROR",
      });
  }
}

export async function listActiveConsumerPlans() {
  return all(
    "membership_plans",
    "*",
    [
      ["eq", "target", "CONSUMER"],
      ["eq", "is_active", true],
    ],
    "code",
  );
}
export async function findActivePlanByCode(code) {
  const db = await database();
  return check(
    await db
      .from("membership_plans")
      .select("*")
      .eq("code", code)
      .eq("target", "CONSUMER")
      .eq("is_active", true)
      .maybeSingle(),
  );
}
export async function listOwned(userId) {
  return all("user_memberships", "*,plan:membership_plans!inner(*)", [
    ["eq", "user_id", userId],
  ]);
}
export async function expireOwnedPastPeriods(userId, now) {
  const db = await database();
  const rows = await listOwned(userId);
  const ids = rows
    .filter(
      (row) =>
        row.plan.target === "CONSUMER" &&
        row.status === "ACTIVE" &&
        Date.parse(row.current_period_end) <= Date.parse(now),
    )
    .map((row) => row.id);
  if (!ids.length) return [];
  return check(
    await db
      .from("user_memberships")
      .update({ status: "EXPIRED", auto_renew: false })
      .eq("user_id", userId)
      .in("id", ids)
      .eq("status", "ACTIVE")
      .lte("current_period_end", now)
      .select("id"),
  );
}
export async function subscribe(
  userId,
  planCode,
  startedAt,
  periodEnd,
  autoRenew,
) {
  const db = await database();
  return check(
    await db
      .from("user_memberships")
      .insert({
        user_id: userId,
        store_id: null,
        plan_code: planCode,
        status: "ACTIVE",
        started_at: startedAt,
        current_period_end: periodEnd,
        auto_renew: autoRenew,
      })
      .select("*")
      .single(),
  );
}
export async function scheduleCancellationOwned(userId, id, now) {
  const db = await database();
  return check(
    await db
      .from("user_memberships")
      .update({ auto_renew: false, canceled_at: now })
      .eq("user_id", userId)
      .eq("id", id)
      .eq("status", "ACTIVE")
      .gt("current_period_end", now)
      .select("*")
      .maybeSingle(),
  );
}
