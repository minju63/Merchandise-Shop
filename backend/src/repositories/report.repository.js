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

export async function createOwned(userId, input) {
  const db = await database();
  return check(
    await db
      .from("reports")
      .insert({ ...input, reporter_id: userId, status: "PENDING" })
      .select("*")
      .single(),
  );
}
export async function listOwned(userId) {
  return all("reports", "*", [["eq", "reporter_id", userId]]);
}
export async function findTarget(type, id) {
  const table = { PRODUCT: "products", STORE: "stores", REVIEW: "reviews" }[
    type
  ];
  const db = await database();
  let query = db
    .from(table)
    .select(type === "REVIEW" ? "id,user_id,is_hidden,deleted_at" : "id")
    .eq("id", id);
  if (type === "REVIEW")
    query = query.is("deleted_at", null).eq("is_hidden", false);
  return check(await query.maybeSingle());
}
