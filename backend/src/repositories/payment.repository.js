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
function missing(row) {
  if (!row)
    throw Object.assign(new Error("대상을 찾지 못했어요."), {
      status: 404,
      code: "RECORD_NOT_FOUND",
    });
  return row;
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

export async function createMockPayment(userId, input) {
  const db = await database();
  return missing(
    check(
      await db
        .from("payments")
        .insert({
          ...input,
          user_id: userId,
          is_mock: true,
          status: "PAID",
          approved_at: new Date().toISOString(),
        })
        .select("*")
        .single(),
    ),
  );
}
export async function listOwnedOrderPayments(userId, orderId) {
  return all("payments", "*", [
    ["eq", "user_id", userId],
    ["eq", "order_id", orderId],
  ]);
}
export async function cancelMockOrderPayments(userId, orderId) {
  const rows = await listOwnedOrderPayments(userId, orderId);
  if (rows.some((row) => !row.is_mock))
    throw Object.assign(
      new Error("실제 결제는 시연 API에서 취소할 수 없어요."),
      { status: 409, code: "REAL_PAYMENT_UNSUPPORTED" },
    );
  const db = await database();
  return check(
    await db
      .from("payments")
      .update({ status: "CANCELED", canceled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("order_id", orderId)
      .eq("is_mock", true)
      .eq("status", "PAID")
      .select("*"),
  );
}
export async function listMembershipPayments(userId) {
  return all("payments", "*", [
    ["eq", "user_id", userId],
    ["eq", "purpose", "MEMBERSHIP"],
  ]);
}
export async function cancelMockPayment(userId, paymentId) {
  const db = await database();
  return check(
    await db
      .from("payments")
      .update({ status: "CANCELED", canceled_at: new Date().toISOString() })
      .eq("id", paymentId)
      .eq("user_id", userId)
      .eq("is_mock", true)
      .eq("status", "PAID")
      .select("*")
      .maybeSingle(),
  );
}
