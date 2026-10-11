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

export async function listOwned(userId) {
  return all("inquiries", "*", [["eq", "user_id", userId]]);
}
export async function findOwnedWithImages(userId, id) {
  const db = await database();
  const row = check(
    await db
      .from("inquiries")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(),
  );
  if (!row) return null;
  return {
    ...row,
    images: await all(
      "inquiry_images",
      "*",
      [["eq", "inquiry_id", id]],
      "display_order",
    ),
  };
}
export async function createWithImages(userId, input, images) {
  const db = await database();
  const row = missing(
    check(
      await db
        .from("inquiries")
        .insert({ ...input, user_id: userId, status: "PENDING" })
        .select("id")
        .single(),
    ),
  );
  try {
    if (images.length)
      check(
        await db
          .from("inquiry_images")
          .insert(
            images.map((image_url, display_order) => ({
              inquiry_id: row.id,
              image_url,
              display_order,
            })),
          ),
      );
  } catch (error) {
    check(
      await db
        .from("inquiries")
        .delete()
        .eq("id", row.id)
        .eq("user_id", userId)
        .eq("status", "PENDING"),
    );
    throw error;
  }
  return findOwnedWithImages(userId, row.id);
}
export async function updateOwnedPending(userId, id, patch) {
  const db = await database();
  const row = check(
    await db
      .from("inquiries")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle(),
  );
  return row ? findOwnedWithImages(userId, id) : null;
}
export async function deleteOwnedPending(userId, id) {
  const db = await database();
  return check(
    await db
      .from("inquiries")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle(),
  );
}
