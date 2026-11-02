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
export async function findOwnedStoreReview(userId, storeId) {
  const db = await database();
  return check(
    await db
      .from("store_reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .maybeSingle(),
  );
}
export async function findOwnedStoreReviewById(userId, id) {
  const db = await database();
  return check(
    await db
      .from("store_reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  );
}
export async function createOwnedStoreReview(userId, storeId, fields, existing = null) {
  const db = await database();
  const row = existing
    ? check(
        await db
          .from("store_reviews")
          .update({
            ...fields,
            deleted_at: null,
            is_hidden: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("user_id", userId)
          .not("deleted_at", "is", null)
          .select("*")
          .maybeSingle(),
      )
    : check(
        await db
          .from("store_reviews")
          .insert({ ...fields, user_id: userId, store_id: storeId })
          .select("*")
          .single(),
      );
  return missing(row);
}
export async function updateOwnedStoreReview(userId, id, fields) {
  const db = await database();
  return check(
    await db
      .from("store_reviews")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("is_hidden", false)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle(),
  );
}
export async function softDeleteOwnedStoreReview(userId, id) {
  const db = await database();
  return check(
    await db
      .from("store_reviews")
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
export async function listCompletedItems(userId) {
  const orders = await all("orders", "id,purchase_confirmed_at", [
    ["eq", "user_id", userId],
    ["eq", "status", "COMPLETED"],
  ]);
  const result = [];
  // 구매확정 전 주문도 함께 돌려주고, 화면에서 '구매 확정' 버튼으로 먼저 확정하게 한다.
  for (const order of orders) {
    const rows = await all("order_items", "*,sale:store_products(product_id)", [
      ["eq", "order_id", order.id],
    ]);
    result.push(...rows.map((row) => ({ ...row, purchase_confirmed_at: order.purchase_confirmed_at })));
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
  const storeRows = await all("store_reviews", "id,rating", [
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

export async function synchronizeStoreRating(storeId) {
  const db = await database();
  const rows = await all("store_reviews", "id,rating", [
    ["eq", "store_id", storeId],
    ["is", "deleted_at", null],
    ["eq", "is_hidden", false],
  ]);
  const store = aggregateRating(rows);
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
  return store;
}

export async function getPublicProductReviews(productId, { sort, page, size }) {
  const column = sort === "latest" ? "created_at" : sort === "high" ? "rating" : sort === "low" ? "rating" : "like_count";
  const ascending = sort === "low";
  let query = (await database())
    .from("reviews")
    .select("id,user_id,rating,content,created_at,like_count,images:review_images(image_url,display_order)", {
      count: "exact",
    })
    .eq("product_id", productId)
    .eq("is_hidden", false)
    .is("deleted_at", null)
    .order(column, { ascending });
  if (column !== "created_at") query = query.order("created_at", { ascending: false });
  const result = await query
    .order("id", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  check(result);
  return { rows: result.data ?? [], totalCount: result.count ?? 0 };
}

export async function getProductReviewLikeIds(reviewIds, userId) {
  if (!reviewIds.length || !userId) return new Set();
  const result = await (await database())
    .from("product_review_likes")
    .select("review_id")
    .eq("user_id", userId)
    .in("review_id", reviewIds);
  check(result);
  return new Set((result.data ?? []).map((row) => row.review_id));
}

export async function setProductReviewLike(reviewId, userId, liked) {
  const db = await database();
  const reviewResult = await db.from("reviews")
    .select("id,user_id,like_count")
    .eq("id", reviewId)
    .eq("is_hidden", false)
    .is("deleted_at", null)
    .maybeSingle();
  check(reviewResult);
  if (!reviewResult.data) {
    throw Object.assign(new Error("Review not found."), { status: 404, code: "REVIEW_NOT_FOUND" });
  }
  if (reviewResult.data.user_id === userId) {
    throw Object.assign(new Error("You cannot like your own review."), { status: 403, code: "LIKE_OWN_REVIEW" });
  }
  const result = liked
    ? await db.from("product_review_likes").upsert(
      { review_id: reviewId, user_id: userId },
      { onConflict: "review_id,user_id", ignoreDuplicates: true },
    )
    : await db.from("product_review_likes").delete().eq("review_id", reviewId).eq("user_id", userId);
  check(result);
  const countResult = await db.from("reviews").select("like_count").eq("id", reviewId).single();
  check(countResult);
  return { liked, likeCount: countResult.data.like_count ?? 0 };
}

export function summarizeProductReviews(rows) {
  const count = rows.length;
  return {
    reviewCount: count,
    averageRating: count ? Math.round(rows.reduce((sum, row) => sum + Number(row.rating), 0) / count * 10) / 10 : null,
    satisfactionPercent: count ? Math.round(rows.filter((row) => Number(row.rating) >= 4).length / count * 100) : null,
  };
}

export async function getPublicProductReviewSummary(productId) {
  return summarizeProductReviews(await all('reviews', 'id,rating', [
    ['eq', 'product_id', productId], ['eq', 'is_hidden', false], ['is', 'deleted_at', null],
  ]));
}

// ───── 여경 — 굿즈샵 리뷰 (develop 901aa29 에서 원문 그대로 가져옴) ─────

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
// (아래 내부 헬퍼는 위 함수들 전용)

function unwrap({ data, error }) {
  if (error) throw error;
  return data || [];
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getReviewSummaries(storeIds) {
  const totals = new Map(storeIds.map((id) => [id, { count: 0, sum: 0 }]));
  if (!storeIds.length) return new Map();
  for (let from = 0; ; from += 1000) {
    const batch = unwrap(
      await supabase
        .from('store_reviews')
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

export async function getStoreReviewSummary(storeId) {
  const rows = await all("store_reviews", "id,rating", [
    ["eq", "store_id", storeId],
    ["eq", "is_hidden", false],
    ["is", "deleted_at", null],
  ]);
  const aggregate = aggregateRating(rows);
  return { reviewCount: aggregate.review_count, rating: aggregate.rating_avg };
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function getStoreReviewLikeIds(reviewIds, userId) {
  if (!reviewIds.length || !userId) return new Set();
  const { data, error } = await supabase
    .from('store_review_likes')
    .select('review_id')
    .eq('user_id', userId)
    .in('review_id', reviewIds);
  if (error) throw error;
  return new Set((data || []).map((row) => row.review_id));
}

export async function setStoreReviewLike(reviewId, userId, liked) {
  const reviewResult = await supabase
    .from('store_reviews')
    .select('id,user_id,like_count')
    .eq('id', reviewId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .maybeSingle();
  if (reviewResult.error) throw reviewResult.error;
  if (!reviewResult.data)
    throw Object.assign(new Error('Review not found.'), { status: 404, code: 'REVIEW_NOT_FOUND' });
  if (reviewResult.data.user_id === userId)
    throw Object.assign(new Error('You cannot like your own review.'), { status: 403, code: 'LIKE_OWN_REVIEW' });
  const result = liked
    ? await supabase.from('store_review_likes').upsert(
      { review_id: reviewId, user_id: userId },
      { onConflict: 'review_id,user_id', ignoreDuplicates: true },
    )
    : await supabase.from('store_review_likes').delete().eq('review_id', reviewId).eq('user_id', userId);
  if (result.error) throw result.error;
  const countResult = await supabase.from('store_reviews').select('like_count').eq('id', reviewId).single();
  if (countResult.error) throw countResult.error;
  return { liked, likeCount: countResult.data.like_count ?? 0 };
}

export async function getPublicStoreReviews(storeId, { sort, page, size, userId = null }) {
  const column = sort === 'latest' ? 'created_at' : sort === 'high' || sort === 'low' ? 'rating' : 'like_count';
  const ascending = sort === 'low';
  let query = supabase
    .from('store_reviews')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_hidden', false)
    .is('deleted_at', null);
  if (userId) query = query.eq('user_id', userId);
  query = query.order(column, { ascending });
  if (column !== 'created_at') query = query.order('created_at', { ascending: false });
  const { data, error } = await query
    .order('id', { ascending: false })
    .range((page - 1) * size, page * size - 1);
  if (error) throw error;
  return data || [];
}

export async function getPublicStoreReviewCount(storeId, userId = null) {
  let query = supabase
    .from('store_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('is_hidden', false)
    .is('deleted_at', null);
  if (userId) query = query.eq('user_id', userId);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function getStoreReviewRelations(rows) {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const itemIds = [...new Set(rows.flatMap((row) => row.selected_order_item_ids || []))];
  const [users, items] = await Promise.all([
    userIds.length ? supabase.from('users').select('id,nickname').in('id', userIds) : { data: [] },
    itemIds.length ? supabase.from('order_items').select('id,product_name').in('id', itemIds) : { data: [] },
  ]);
  return { users: unwrap(users), items: unwrap(items) };
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
      .not('purchase_confirmed_at', 'is', null)
      .is('canceled_at', null)
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

export async function getOrderItemsByIds(ids) {
  if (!ids.length) return [];
  return unwrap(
    await supabase
      .from('order_items')
      .select('id,order_id,store_product_id,product_name,product_image_url')
      .in('id', ids),
  );
}

export async function getOrdersByIds(userId, storeId, ids) {
  if (!ids.length) return [];
  return unwrap(
    await supabase
      .from('orders')
      .select('id,store_id,created_at,status,canceled_at')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .in('id', ids),
  );
}

export async function getReviewBlockedOrderItems(orderIds) {
  if (!orderIds.length) return [];
  return unwrap(
    await supabase
      .from('order_claims')
      .select('order_id,order_item_id')
      .in('order_id', orderIds)
      .eq('claim_type', 'RETURN')
      .in('status', ['REQUESTED', 'APPROVED', 'COLLECTING', 'COMPLETED']),
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
