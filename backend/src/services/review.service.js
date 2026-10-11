import * as repository from "../repositories/review.repository.js";
import { findOwnedItem, findSale } from "../repositories/order.repository.js";
import { verifyOwnedImageUrls } from "./support.service.js";

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
      ? ["rating", "content", "imageUrls"]
      : ["orderItemId", "rating", "content", "imageUrls"],
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
  const { item, sale, existing } = await checkReviewEligibility(
    userId,
    input.orderItemId,
  );
  const images = await verifyOwnedImageUrls(userId, input.imageUrls);
  return finishReview(
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
  const images =
    input.imageUrls === undefined
      ? undefined
      : await verifyOwnedImageUrls(userId, input.imageUrls);
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
