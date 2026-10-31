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

export async function createOrder(userId, fields) {
  const db = await database();
  return missing(
    check(
      await db
        .from("orders")
        .insert({ ...fields, user_id: userId })
        .select("*")
        .single(),
    ),
  );
}
export async function createItems(orderId, items) {
  const db = await database();
  return check(
    await db
      .from("order_items")
      .insert(items.map((item) => ({ ...item, order_id: orderId })))
      .select("*"),
  );
}
export async function appendStatusHistory(
  orderId,
  fromStatus,
  toStatus,
  actorId,
  memo = null,
) {
  const db = await database();
  return check(
    await db
      .from("order_status_histories")
      .insert({
        order_id: orderId,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: actorId,
        memo,
      })
      .select("*")
      .single(),
  );
}
export async function findOwned(userId, orderId) {
  const db = await database();
  return check(
    await db
      .from("orders")
      .select("*,store:stores(id,name,address,phone,thumbnail_url)")
      .eq("user_id", userId)
      .eq("id", orderId)
      .maybeSingle(),
  );
}
export async function listOwned(userId) {
  return all("orders", "*,store:stores(id,name,address,phone,thumbnail_url)", [
    ["eq", "user_id", userId],
  ]);
}
export async function listOwnedGroup(userId, groupId) {
  return all("orders", "*", [
    ["eq", "user_id", userId],
    ["eq", "checkout_group_id", groupId],
  ]);
}
export async function listItems(orderId) {
  return all("order_items", "*", [["eq", "order_id", orderId]]);
}
export async function listHistories(orderId) {
  return all(
    "order_status_histories",
    "*",
    [["eq", "order_id", orderId]],
    "created_at",
  );
}
export async function findSale(saleId) {
  const db = await database();
  return check(
    await db.from("store_products").select("*").eq("id", saleId).maybeSingle(),
  );
}
export async function findStore(storeId) {
  const db = await database();
  return check(
    await db.from("stores").select("*").eq("id", storeId).maybeSingle(),
  );
}
export async function findCommissionPlan(storeId, now) {
  const store = missing(await findStore(storeId));
  const active = await all(
    "user_memberships",
    "*,plan:membership_plans!inner(*)",
    [
      ["eq", "store_id", storeId],
      ["eq", "user_id", store.owner_id],
      ["eq", "status", "ACTIVE"],
      ["gt", "current_period_end", now],
    ],
  );
  const plans = active.filter(
    (row) => row.plan.target === "STORE" && row.plan.is_active,
  );
  if (plans.length > 1)
    throw Object.assign(new Error("매장 구독 정책이 중복됐어요."), {
      status: 503,
      code: "COMMISSION_POLICY_AMBIGUOUS",
    });
  if (plans.length) return plans[0].plan;
  const db = await database();
  return check(
    await db
      .from("membership_plans")
      .select("*")
      .eq("code", "STORE_" + store.membership_plan)
      .eq("target", "STORE")
      .eq("is_active", true)
      .maybeSingle(),
  );
}
export async function adjustStock(
  userId,
  orderId,
  saleId,
  quantityDelta,
  changeType,
) {
  const current = missing(await findSale(saleId));
  const after = current.stock + quantityDelta;
  if (!Number.isSafeInteger(after) || after < 0 || after > 2147483647)
    throw Object.assign(new Error("재고가 부족하거나 설정이 잘못됐어요."), {
      status: 409,
      code: "STOCK_CHANGED",
    });
  const db = await database();
  const patch = { stock: after, updated_at: new Date().toISOString() };
  if (quantityDelta < 0 && after === 0) patch.status = "SOLD_OUT";
  if (quantityDelta > 0 && current.status === "SOLD_OUT")
    patch.status = "ON_SALE";
  const changed = check(
    await db
      .from("store_products")
      .update(patch)
      .eq("id", saleId)
      .eq("stock", current.stock)
      .eq("status", current.status)
      .select("id")
      .maybeSingle(),
  );
  if (!changed)
    throw Object.assign(new Error("재고가 변경됐어요. 다시 확인해 주세요."), {
      status: 409,
      code: "STOCK_CHANGED",
    });
  try {
    check(
      await db.from("inventory_logs").insert({
        store_product_id: saleId,
        change_type: changeType,
        quantity_delta: quantityDelta,
        stock_before: current.stock,
        stock_after: after,
        order_id: orderId,
        changed_by: userId,
      }),
    );
  } catch (error) {
    // 이 요청이 바꾼 값이 그대로인 경우에만 되돌린다.
    const restore = await db
      .from("store_products")
      .update({ stock: current.stock, status: current.status })
      .eq("id", saleId)
      .eq("stock", after)
      .select("id")
      .maybeSingle();
    if (restore.error || !restore.data)
      throw Object.assign(
        new Error("재고 이력 저장 실패 후 복구 확인이 필요해요."),
        { status: 503, code: "STOCK_RECOVERY_REQUIRED" },
      );
    throw error;
  }
  return {
    storeProductId: saleId,
    stockBefore: current.stock,
    stockAfter: after,
  };
}
export async function cancelOwnedPaid(userId, orderId, memo) {
  const db = await database();
  const row = check(
    await db
      .from("orders")
      .update({
        status: "CANCELED",
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("user_id", userId)
      .eq("status", "PAID")
      .select("*")
      .maybeSingle(),
  );
  if (row) await appendStatusHistory(orderId, "PAID", "CANCELED", userId, memo);
  return row;
}
export async function changeOwnedAddress(userId, orderId, patch) {
  const db = await database();
  return check(
    await db
      .from("orders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("user_id", userId)
      .eq("status", "PAID")
      .eq("fulfillment_type", "DELIVERY")
      .select("*")
      .maybeSingle(),
  );
}
export async function removeSelectedCart(userId, itemIds) {
  if (!itemIds.length) return [];
  const db = await database();
  return check(
    await db
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .in("id", itemIds)
      .select("id"),
  );
}
export async function listFulfillmentInfo(storeId, type) {
  const db = await database();
  return check(
    await db
      .from(type === "PICKUP" ? "store_pickup_infos" : "store_delivery_infos")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle(),
  );
}
export async function hasCouponUsedByOtherOrder(userId, couponId, orderId) {
  const rows = await all("orders", "id", [
    ["eq", "user_id", userId],
    ["eq", "used_coupon_id", couponId],
    ["neq", "id", orderId],
    ["neq", "status", "CANCELED"],
  ]);
  return rows.length > 0;
}
export async function findOwnedItem(userId, itemId) {
  const db = await database();
  const item = check(
    await db.from("order_items").select("*").eq("id", itemId).maybeSingle(),
  );
  if (!item) return null;
  const order = await findOwned(userId, item.order_id);
  return order ? { ...item, order } : null;
}

// ---- 반품/교환 요청 ----
const CLAIM_SELECT =
  "*,order:orders(order_no,store:stores(name)),item:order_items(product_name,product_image_url,quantity,unit_price)";
export async function listOwnedClaims(userId) {
  const db = await database();
  const rows = check(
    await db
      .from("order_claims")
      .select(CLAIM_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  );
  return rows ?? [];
}
export async function listClaimsForItem(userId, itemId) {
  const db = await database();
  return (
    check(
      await db
        .from("order_claims")
        .select("id,status")
        .eq("user_id", userId)
        .eq("order_item_id", itemId),
    ) ?? []
  );
}
export async function createClaim(row) {
  const db = await database();
  return check(
    await db.from("order_claims").insert(row).select(CLAIM_SELECT).single(),
  );
}
