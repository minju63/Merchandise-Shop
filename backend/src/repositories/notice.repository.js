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

export async function listPublished(now) {
  return all("notices", "*", [["lte", "published_at", now]]);
}
export async function findPublishedById(id, now) {
  const db = await database();
  return check(
    await db
      .from("notices")
      .select("*")
      .eq("id", id)
      .lte("published_at", now)
      .maybeSingle(),
  );
}
