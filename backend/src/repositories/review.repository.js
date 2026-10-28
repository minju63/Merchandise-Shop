import { supabase } from '../lib/supabase.js'; // 여경 함수용
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

// ───── 여경 — 굿즈샵 리뷰 (develop 901aa29 에서 원문 그대로 가져옴) ─────

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
// (아래 내부 헬퍼는 위 함수들 전용)

function unwrap({ data, error }) {
  if (error) throw error;
  return data || [];
}

const publicReviews = (storeId) =>
  supabase
    .from('reviews')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_hidden', false)
    .is('deleted_at', null);

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getReviewSummaries(storeIds) {
  const totals = new Map(storeIds.map((id) => [id, { count: 0, sum: 0 }]));
  if (!storeIds.length) return new Map();
  for (let from = 0; ; from += 1000) {
    const batch = unwrap(
      await supabase
        .from('reviews')
        .select('store_id,rating')
        .in('store_id', storeIds)
        .eq('is_hidden', false)
        .is('deleted_at', null)
        .range(from, from + 999)
    );
    for (const row of batch) {
      const total = totals.get(row.store_id);
      total.count += 1;
      total.sum += Number(row.rating);
    }
    if (batch.length < 1000) break;
  }
  return new Map(
    [...totals].map(([id, { count, sum }]) => [
      id,
      { reviewCount: count, rating: count ? sum / count : null },
    ])
  );
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getReviewSummary(storeId) {
  return (await getReviewSummaries([storeId])).get(storeId);
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getPublicReviews(storeId, { sort, page, size }) {
  const column = sort === 'latest' ? 'created_at' : 'rating';
  const ascending = sort === 'low';
  let query = publicReviews(storeId).order(column, { ascending });
  if (column !== 'created_at') query = query.order('created_at', { ascending: false });
  const { data, error } = await query.order('id', { ascending: false }).range((page - 1) * size, page * size - 1);
  if (error) throw error;
  return data || [];
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getReviewRelations(rows) {
  const ids = rows.map((row) => row.id);
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))];
  const [users, products, images] = await Promise.all([
    userIds.length ? supabase.from('users').select('id,nickname').in('id', userIds) : { data: [] },
    productIds.length
      ? supabase.from('products').select('id,name').in('id', productIds)
      : { data: [] },
    ids.length
      ? supabase
          .from('review_images')
          .select('review_id,image_url,display_order')
          .in('review_id', ids)
          .order('display_order', { ascending: true })
      : { data: [] },
  ]);
  return { users: unwrap(users), products: unwrap(products), images: unwrap(images) };
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getCompletedOrders(userId, storeId) {
  return unwrap(
    await supabase
      .from('orders')
      .select('id,store_id,created_at')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
  );
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getOrderItems(orderIds) {
  if (!orderIds.length) return [];
  return unwrap(
    await supabase
      .from('order_items')
      .select('id,order_id,store_product_id,product_name,product_image_url')
      .in('order_id', orderIds)
  );
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getStoreProductsByIds(ids) {
  if (!ids.length) return [];
  return unwrap(
    await supabase.from('store_products').select('id,store_id,product_id').in('id', ids)
  );
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getReviewedOrderItemIds(ids) {
  if (!ids.length) return [];
  return unwrap(await supabase.from('reviews').select('order_item_id').in('order_item_id', ids));
}
