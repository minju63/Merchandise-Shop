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

export async function listOwnedReviews(userId) {
  return all("reviews", "*,images:review_images(*)", [
    ["eq", "user_id", userId],
    ["is", "deleted_at", null],
  ]);
}
export async function findOwnedReview(userId, id) {
  const db = await database();
  return check(
    await db
      .from("reviews")
      .select("*,images:review_images(*)")
      .eq("user_id", userId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  );
}
export async function findByOrderItem(userId, itemId) {
  const db = await database();
  return check(
    await db
      .from("reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("order_item_id", itemId)
      .maybeSingle(),
  );
}
export async function listCompletedItems(userId) {
  const orders = await all("orders", "id", [
    ["eq", "user_id", userId],
    ["eq", "status", "COMPLETED"],
  ]);
  const result = [];
  for (const order of orders) {
    const rows = await all("order_items", "*,sale:store_products(product_id)", [
      ["eq", "order_id", order.id],
    ]);
    result.push(...rows);
  }
  return result;
}
async function replaceImages(id, urls) {
  const db = await database();
  check(await db.from("review_images").delete().eq("review_id", id));
  if (urls.length)
    check(
      await db.from("review_images").insert(
        urls.map((image_url, display_order) => ({
          review_id: id,
          image_url,
          display_order,
        })),
      ),
    );
}
export async function createOwnedWithImages(
  userId,
  fields,
  urls,
  deletedReview = null,
) {
  const db = await database();
  const row = deletedReview
    ? check(
        await db
          .from("reviews")
          .update({
            rating: fields.rating,
            content: fields.content,
            deleted_at: null,
            is_hidden: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deletedReview.id)
          .eq("user_id", userId)
          .not("deleted_at", "is", null)
          .select("*")
          .maybeSingle(),
      )
    : check(
        await db
          .from("reviews")
          .insert({ ...fields, user_id: userId })
          .select("*")
          .single(),
      );
  missing(row);
  try {
    await replaceImages(row.id, urls);
  } catch (error) {
    check(
      await db
        .from("reviews")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", userId),
    );
    throw error;
  }
  return findOwnedReview(userId, row.id);
}
export async function updateOwnedWithImages(userId, id, fields, urls) {
  const db = await database();
  const old = missing(await findOwnedReview(userId, id));
  const row = check(
    await db
      .from("reviews")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("is_hidden", false)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle(),
  );
  if (!row) return null;
  if (urls !== undefined)
    try {
      await replaceImages(id, urls);
    } catch (error) {
      await replaceImages(
        id,
        old.images.map((image) => image.image_url),
      );
      check(
        await db
          .from("reviews")
          .update({ rating: old.rating, content: old.content })
          .eq("id", id)
          .eq("user_id", userId),
      );
      throw error;
    }
  return findOwnedReview(userId, id);
}
export async function softDeleteOwned(userId, id) {
  const db = await database();
  return check(
    await db
      .from("reviews")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle(),
  );
}

export function aggregateRating(rows) {
  return {
    review_count: rows.length,
    rating_avg: rows.length
      ? Math.round(
          (rows.reduce((sum, row) => sum + row.rating, 0) / rows.length) * 100,
        ) / 100
      : null,
  };
}
export async function synchronizeRatings(productId, storeId) {
  const db = await database();
  const productRows = await all("reviews", "id,rating", [
    ["eq", "product_id", productId],
    ["is", "deleted_at", null],
    ["eq", "is_hidden", false],
  ]);
  const storeRows = await all("reviews", "id,rating", [
    ["eq", "store_id", storeId],
    ["is", "deleted_at", null],
    ["eq", "is_hidden", false],
  ]);
  const product = aggregateRating(productRows),
    store = aggregateRating(storeRows);
  missing(
    check(
      await db
        .from("products")
        .update({ ...product, updated_at: new Date().toISOString() })
        .eq("id", productId)
        .select("id")
        .maybeSingle(),
    ),
  );
  missing(
    check(
      await db
        .from("stores")
        .update({ ...store, updated_at: new Date().toISOString() })
        .eq("id", storeId)
        .select("id")
        .maybeSingle(),
    ),
  );
  return { product, store };
}
