import { supabase } from '../lib/supabase.js'; // 여경 함수용
import { getActiveStore } from '../repositories/store.repository.js'; // 여경 함수용
import * as repo from '../repositories/review.repository.js'; // 여경 함수용
export { reviewError } from './reviewValidation.js'; // 여경 컨트롤러용 (validateReviewInput 은 연수 것과 이름이 겹쳐 제외)
import * as repository from "../repositories/review.repository.js";
import { findOwnedItem, findSale } from "../repositories/order.repository.js";
import { verifyOwnedImageUrls } from "./support.service.js";
import { grantReviewReward } from "./user.service.js";

import { findByAuthId } from "../repositories/user.repository.js";
function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
function object(input, keys, optional = false) {
  if (optional && input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw failure(400, "INVALID_INPUT", "입력 형식을 확인해 주세요.");
  if (Object.keys(input).some((key) => !keys.includes(key)))
    throw failure(400, "UNKNOWN_FIELDS", "허용되지 않은 입력 항목이 있어요.");
  return input;
}
function uuid(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
  )
    throw failure(400, "INVALID_ID", "식별자를 확인해 주세요.");
  return value.toLowerCase();
}
function text(value, max, min = 1) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    throw failure(400, "INVALID_TEXT", "입력 길이를 확인해 주세요.");
  return value.trim().normalize("NFC");
}
async function active(userId) {
  const profile = await findByAuthId(userId);
  if (!profile || profile.status !== "ACTIVE")
    throw failure(403, "ACCOUNT_UNAVAILABLE", "사용할 수 없는 계정이에요.");
  return profile;
}
function paging(input, keys = []) {
  object(input, ["page", "size", "keyword", ...keys]);
  const pageNo = input.page === undefined ? 1 : Number(input.page),
    size = input.size === undefined ? 20 : Number(input.size);
  if (
    !Number.isSafeInteger(pageNo) ||
    pageNo < 1 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100 ||
    !Number.isSafeInteger((pageNo - 1) * size) ||
    (input.page !== undefined && !/^\d+$/.test(String(input.page))) ||
    (input.size !== undefined && !/^\d+$/.test(String(input.size)))
  )
    throw failure(400, "INVALID_PAGE", "페이지 범위를 확인해 주세요.");
  return {
    page: pageNo,
    size,
    limit: size,
    offset: (pageNo - 1) * size,
    keyword: input.keyword === undefined ? "" : text(input.keyword, 100, 0),
  };
}
function page(rows, options) {
  return {
    items: rows.slice(options.offset, options.offset + options.limit),
    page: options.page,
    size: options.size,
    totalCount: rows.length,
  };
}

export function validateReviewInput(input, partial = false) {
  object(
    input,
    partial
      ? ["rating", "content", "imageUrls", "storeId"]
      : ["orderItemId", "rating", "content", "imageUrls", "storeId"],
  );
  const fields = {};
  if (!partial || input.rating !== undefined) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
      throw failure(400, "INVALID_RATING", "별점 1~5를 선택해 주세요.");
    fields.rating = input.rating;
  }
  if (!partial || input.content !== undefined)
    fields.content = text(input.content, 500, 10);
  if (!partial) uuid(input.orderItemId);
  if (partial && !Object.keys(fields).length && input.imageUrls === undefined)
    throw failure(400, "EMPTY_PATCH", "변경할 리뷰 내용을 입력해 주세요.");
  return fields;
}
export async function checkReviewEligibility(userId, orderItemId) {
  uuid(orderItemId);
  await active(userId);
  const item = await findOwnedItem(userId, orderItemId);
  if (!item || item.order.status !== "COMPLETED")
    throw failure(
      409,
      "REVIEW_NOT_ELIGIBLE",
      "수령 완료한 본인 주문 상품만 리뷰를 쓸 수 있어요.",
    );
  const existing = await repository.findByOrderItem(userId, orderItemId);
  if (existing?.is_hidden)
    throw failure(
      409,
      "REVIEW_HIDDEN",
      "운영자가 숨긴 리뷰는 다시 작성할 수 없어요.",
    );
  if (existing && !existing.deleted_at)
    throw failure(
      409,
      "REVIEW_ALREADY_EXISTS",
      "이미 리뷰를 작성한 상품이에요.",
    );
  const sale = await findSale(item.store_product_id);
  if (!sale || sale.store_id !== item.order.store_id)
    throw failure(
      503,
      "REVIEW_PRODUCT_MISSING",
      "주문 상품 정보를 확인할 수 없어요.",
    );
  return { item, sale, existing };
}
export async function listMyReviewItems(userId, input = {}) {
  const options = paging(input, ["tab"]);
  if (input.tab !== undefined && !["WRITABLE", "WRITTEN"].includes(input.tab))
    throw failure(400, "INVALID_REVIEW_TAB", "리뷰 목록 종류를 확인해 주세요.");
  await active(userId);
  let rows;
  if (input.tab === "WRITTEN") rows = await repository.listOwnedReviews(userId);
  else {
    rows = [];
    for (const item of await repository.listCompletedItems(userId)) {
      const existing = await repository.findByOrderItem(userId, item.id);
      if (!existing || existing.deleted_at) rows.push(item);
    }
  }
  if (options.keyword)
    rows = rows.filter((row) =>
      `${row.product_name ?? ""} ${row.content ?? ""}`.includes(
        options.keyword,
      ),
    );
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return page(rows, options);
}

async function finishReview(review) {
  let ratingAggregation = null,
    ratingAggregationPending = false;
  try {
    ratingAggregation = await repository.synchronizeRatings(
      review.product_id,
      review.store_id,
    );
  } catch {
    ratingAggregationPending = true;
  }
  return { review, ratingAggregation, ratingAggregationPending };
}
export async function createReview(userId, input) {
  const fields = validateReviewInput(input);
  const requestedStoreId = input.storeId === undefined ? null : uuid(input.storeId);
  const { item, sale, existing } = await checkReviewEligibility(
    userId,
    input.orderItemId,
  );
  if (requestedStoreId && requestedStoreId !== item.order.store_id)
    throw failure(400, "STORE_MISMATCH", "구매한 굿즈샵과 리뷰 굿즈샵이 일치하지 않습니다.");
  const images = await verifyOwnedImageUrls(
    userId,
    input.imageUrls,
    requestedStoreId
      ? {
          bucket: "review",
          folderPrefix: ["shop", item.order.store_id],
          maxCount: 5,
        }
      : undefined,
  );
  const created = await finishReview(
    await repository.createOwnedWithImages(
      userId,
      {
        ...fields,
        order_item_id: item.id,
        store_id: item.order.store_id,
        product_id: sale.product_id,
      },
      images,
      existing,
    ),
  );
  // 적립금 지급이 실패해도 리뷰 작성 자체는 성공으로 둔다.
  const pointReward = await grantReviewReward(userId, {
    orderId: item.order_id,
    orderItemId: item.id,
  }).catch(() => ({ granted: false, amount: 0, reason: "REWARD_PENDING" }));
  return { ...created, pointReward };
}
export async function updateReview(userId, id, input) {
  uuid(id);
  const fields = validateReviewInput(input, true);
  await active(userId);
  const existing = await repository.findOwnedReview(userId, id);
  if (!existing)
    throw failure(404, "REVIEW_NOT_FOUND", "본인 리뷰를 찾지 못했어요.");
  if (existing.is_hidden)
    throw failure(
      409,
      "REVIEW_HIDDEN",
      "운영자가 숨긴 리뷰는 수정할 수 없어요.",
    );
  if (input.storeId !== undefined && uuid(input.storeId) !== existing.store_id)
    throw failure(400, "STORE_MISMATCH", "리뷰 굿즈샵이 일치하지 않습니다.");
  const images =
    input.imageUrls === undefined
      ? undefined
      : await verifyOwnedImageUrls(userId, input.imageUrls, {
          bucket: "review",
          folderPrefix: ["shop", existing.store_id],
          maxCount: 5,
        });
  const row = await repository.updateOwnedWithImages(
    userId,
    id,
    fields,
    images,
  );
  if (!row) throw failure(409, "REVIEW_CHANGED", "리뷰 상태가 변경됐어요.");
  return finishReview(row);
}
export async function deleteReview(userId, id, input) {
  uuid(id);
  object(input ?? {}, []);
  await active(userId);
  const existing = await repository.findOwnedReview(userId, id);
  if (!existing)
    throw failure(404, "REVIEW_NOT_FOUND", "본인 리뷰를 찾지 못했어요.");
  const deleted = await repository.softDeleteOwned(userId, id);
  if (!deleted) throw failure(409, "REVIEW_CHANGED", "리뷰 상태가 변경됐어요.");
  const aggregation = await finishReview(deleted);
  return {
    deletedReviewId: id,
    productId: deleted.product_id,
    storeId: deleted.store_id,
    ratingAggregation: aggregation.ratingAggregation,
    ratingAggregationPending: aggregation.ratingAggregationPending,
    unlinkedImageUrls: existing.images.map((image) => image.image_url),
  };
}

function validateStoreReviewInput(input, partial = false) {
  object(input, ["rating", "content", "imageUrls", "storeId"]);
  const fields = {};
  if (!partial || input.rating !== undefined) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
      throw failure(400, "INVALID_RATING", "별점 1~5를 선택해 주세요.");
    fields.rating = input.rating;
  }
  if (!partial || input.content !== undefined)
    fields.content = text(input.content ?? "", 500, 10);
  if (input.storeId !== undefined) fields.store_id = uuid(input.storeId);
  if (partial && !Object.keys(fields).length && input.imageUrls === undefined)
    throw failure(400, "EMPTY_PATCH", "변경할 리뷰 내용을 입력해 주세요.");
  return fields;
}

async function finishStoreReview(review) {
  let ratingAggregation = null;
  let ratingAggregationPending = false;
  try {
    ratingAggregation = await repository.synchronizeStoreRating(review.store_id);
  } catch {
    ratingAggregationPending = true;
  }
  return { review, ratingAggregation, ratingAggregationPending };
}

export async function createStoreReview(userId, storeId, input) {
  const fields = validateStoreReviewInput(input);
  uuid(storeId);
  if (fields.store_id && fields.store_id !== storeId)
    throw failure(400, "STORE_MISMATCH", "리뷰 굿즈샵이 일치하지 않습니다.");
  delete fields.store_id;
  await active(userId);
  const eligible = await eligibleItems(userId, storeId);
  if (!eligible || eligible.items.length === 0)
    throw failure(409, "REVIEW_NOT_ELIGIBLE", "구매 완료한 굿즈샵만 리뷰를 쓸 수 있어요.");
  if (!eligible.canWriteReview)
    throw failure(409, "REVIEW_ALREADY_EXISTS", "이미 이 굿즈샵 리뷰를 작성했어요.");
  const existing = await repository.findOwnedStoreReview(userId, storeId);
  if (existing && !existing.deleted_at)
    throw failure(409, "REVIEW_ALREADY_EXISTS", "이미 이 굿즈샵 리뷰를 작성했어요.");
  const imageUrls = await verifyOwnedImageUrls(userId, input.imageUrls, {
    bucket: "review",
    folderPrefix: ["shop", storeId],
    maxCount: 5,
  });
  let review;
  try {
    review = await repository.createOwnedStoreReview(
      userId,
      storeId,
      { ...fields, image_urls: imageUrls },
      existing,
    );
  } catch (error) {
    if (error.code === "23505")
      throw failure(409, "REVIEW_ALREADY_EXISTS", "이미 이 굿즈샵 리뷰를 작성했어요.");
    throw error;
  }
  return finishStoreReview(review);
}

export async function updateStoreReview(userId, id, input) {
  uuid(id);
  const fields = validateStoreReviewInput(input, true);
  await active(userId);
  const existing = await repository.findOwnedStoreReviewById(userId, id);
  if (!existing)
    throw failure(404, "REVIEW_NOT_FOUND", "본인 굿즈샵 리뷰를 찾지 못했어요.");
  if (existing.is_hidden)
    throw failure(409, "REVIEW_HIDDEN", "운영자가 숨긴 리뷰는 수정할 수 없어요.");
  if (fields.store_id && fields.store_id !== existing.store_id)
    throw failure(400, "STORE_MISMATCH", "리뷰 굿즈샵이 일치하지 않습니다.");
  delete fields.store_id;
  if (input.imageUrls !== undefined)
    fields.image_urls = await verifyOwnedImageUrls(userId, input.imageUrls, {
      bucket: "review",
      folderPrefix: ["shop", existing.store_id],
      maxCount: 5,
    });
  const review = await repository.updateOwnedStoreReview(userId, id, fields);
  if (!review) throw failure(409, "REVIEW_CHANGED", "리뷰 상태가 변경됐어요.");
  return finishStoreReview(review);
}

export async function deleteStoreReview(userId, id, input) {
  uuid(id);
  object(input ?? {}, []);
  await active(userId);
  const existing = await repository.findOwnedStoreReviewById(userId, id);
  if (!existing)
    throw failure(404, "REVIEW_NOT_FOUND", "본인 굿즈샵 리뷰를 찾지 못했어요.");
  const deleted = await repository.softDeleteOwnedStoreReview(userId, id);
  if (!deleted) throw failure(409, "REVIEW_CHANGED", "리뷰 상태가 변경됐어요.");
  const aggregation = await finishStoreReview(deleted);
  return {
    deletedReviewId: id,
    storeId: deleted.store_id,
    ratingAggregation: aggregation.ratingAggregation,
    ratingAggregationPending: aggregation.ratingAggregationPending,
    unlinkedImageUrls: existing.image_urls || [],
  };
}

// ───── 여경 — 굿즈샵 리뷰 (develop 901aa29 에서 원문 그대로 가져옴) ─────

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
// (아래 내부 헬퍼는 위 함수들 전용)

const BUCKET = 'goods-images';

function resolveImage(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return supabase.storage.from(BUCKET).getPublicUrl(url.replace(/^goods-images\//, '')).data
    .publicUrl;
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function listStoreReviews(storeId, options, viewerUserId = null) {
  const store = await getActiveStore(storeId);
  if (!store) return null;
  if (options.mineOnly && !viewerUserId)
    throw failure(401, "AUTH_REQUIRED", "내 리뷰만 보려면 로그인이 필요합니다.");
  const [summary, rows, mineCount] = await Promise.all([
    repo.getStoreReviewSummary(storeId),
    repo.getPublicStoreReviews(storeId, {
      ...options,
      userId: options.mineOnly ? viewerUserId : null,
    }),
    options.mineOnly
      ? repo.getPublicStoreReviewCount(storeId, viewerUserId)
      : Promise.resolve(null),
  ]);
  const resultCount = options.mineOnly ? mineCount : summary.reviewCount;
  const relations = await repo.getStoreReviewRelations(rows);
  const users = new Map(relations.users.map((row) => [row.id, row.nickname]));
  const products = new Map(relations.items.map((row) => [row.id, row.product_name]));
  return {
    store: { id: store.id, name: store.name },
    ...summary,
    items: rows.map((row) => ({
      id: row.id,
      isMine: Boolean(viewerUserId && row.user_id === viewerUserId),
      nickname: users.get(row.user_id)?.trim() || '익명 구매자',
      rating: row.rating,
      createdAt: row.created_at,
      content: row.content || '',
      images: row.image_urls || [],
      products: (row.selected_order_item_ids || []).map((id) => products.get(id)).filter(Boolean),
    })),
    page: options.page,
    size: options.size,
    resultCount,
    totalCount: resultCount,
    totalPages: Math.ceil(resultCount / options.size),
  };
}

// 여경 — 굿즈샵 상세에서 사용 (store.service.js / store.routes.js)
// 연수님 리뷰 작성 로직과는 독립. 읽기 전용.
export async function eligibleItems(userId, storeId) {
  const store = await getActiveStore(storeId);
  if (!store) return null;
  const orders = await repo.getCompletedOrders(userId, storeId);
  const orderMap = new Map(orders.map((row) => [row.id, row]));
  const items = await repo.getOrderItems(orders.map((row) => row.id));
  const claims = await repo.getReviewBlockedOrderItems(orders.map((row) => row.id));
  const blockedOrders = new Set(claims.filter((claim) => !claim.order_item_id).map((claim) => claim.order_id));
  const blockedItems = new Set(claims.map((claim) => claim.order_item_id).filter(Boolean));
  const [listings, review] = await Promise.all([
    repo.getStoreProductsByIds([...new Set(items.map((row) => row.store_product_id))]),
    repo.findOwnedStoreReview(userId, storeId),
  ]);
  const listingMap = new Map(listings.map((row) => [row.id, row]));
  const validItems = items
    .filter((item) => orderMap.has(item.order_id) && !blockedOrders.has(item.order_id) && !blockedItems.has(item.id) && listingMap.get(item.store_product_id)?.store_id === storeId)
    .sort((a, b) => new Date(orderMap.get(b.order_id).created_at) - new Date(orderMap.get(a.order_id).created_at));
  const selectedIds = review && !review.deleted_at ? review.selected_order_item_ids || [] : [];
  const oldItems = await repo.getOrderItemsByIds(selectedIds);
  const oldOrders = await repo.getOrdersByIds(userId, storeId, [...new Set(oldItems.map((item) => item.order_id))]);
  const oldOrderMap = new Map(oldOrders.map((row) => [row.id, row]));
  const merged = new Map();
  for (const item of [...validItems, ...oldItems.filter((item) => oldOrderMap.has(item.order_id))]) {
    const listing = listingMap.get(item.store_product_id) || (await repo.getStoreProductsByIds([item.store_product_id]))[0];
    if (!listing || listing.store_id !== storeId) continue;
    const key = listing.product_id;
    const eligible = validItems.some((valid) => valid.id === item.id);
    const current = merged.get(key);
    const purchaseOrder = orderMap.get(item.order_id) || oldOrderMap.get(item.order_id);
    if (!current || (selectedIds.includes(item.id) && !current.selectedOrderItemIds.includes(item.id))) {
      merged.set(key, {
        orderItemId: selectedIds.includes(item.id) ? item.id : current?.orderItemId || item.id,
        selectedOrderItemIds: [...new Set([...(current?.selectedOrderItemIds || []), ...(selectedIds.includes(item.id) ? [item.id] : [])])],
        productId: listing.product_id,
        productName: item.product_name,
        productImage: resolveImage(item.product_image_url),
        storeName: store.name,
        orderedAt: purchaseOrder?.created_at,
        eligible: Boolean(current?.eligible || eligible),
      });
    } else {
      current.selectedOrderItemIds = [...new Set([...current.selectedOrderItemIds, ...(selectedIds.includes(item.id) ? [item.id] : [])])];
      current.eligible = Boolean(current.eligible || eligible);
    }
  }
  return {
    store: { id: store.id, name: store.name },
    canWriteReview: !review || Boolean(review.deleted_at),
    review: review && !review.deleted_at ? {
      id: review.id,
      rating: review.rating,
      content: review.content || '',
      images: review.image_urls || [],
      selectedOrderItemIds: selectedIds,
      createdAt: review.created_at,
    } : null,
    items: [...merged.values()].sort((a, b) => new Date(b.orderedAt || 0) - new Date(a.orderedAt || 0)),
  };
}
