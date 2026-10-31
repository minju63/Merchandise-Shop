import * as inquiries from "../repositories/inquiry.repository.js";
import * as notices from "../repositories/notice.repository.js";
import * as faqs from "../repositories/faq.repository.js";
import {
  findOwned as findOrder,
  findStore,
} from "../repositories/order.repository.js";

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

export function validateImageUrls(userId, values = [], options = {}) {
  const { maxCount = 3, bucket, folderPrefix = [] } = options;
  const ownerFolderIndex = 5 + folderPrefix.length;
  if (
    !Array.isArray(values) ||
    values.length > maxCount ||
    new Set(values).size !== values.length
  )
    throw failure(
      400,
      "INVALID_IMAGES",
      "사진은 서로 다른 파일 최대 3장까지 선택해 주세요.",
    );
  return values.map((value) => {
    if (typeof value !== "string" || value.length > 500)
      throw failure(400, "INVALID_IMAGE_URL", "사진 경로를 확인해 주세요.");
    let url;
    try {
      url = new URL(value);
    } catch {
      throw failure(400, "INVALID_IMAGE_URL", "사진 경로를 확인해 주세요.");
    }
    let origin;
    try {
      const storageBaseUrl = (process.env.SUPABASE_URL || process.env.API_URL)
        ?.replace(/\/(rest\/v1\/?|)$/, "");
      origin = new URL(storageBaseUrl).origin;
    } catch {
      throw failure(
        503,
        "STORAGE_NOT_CONFIGURED",
        "공용 Storage 설정이 필요해요.",
      );
    }
    let parts;
    try {
      parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    } catch {
      throw failure(400, "INVALID_IMAGE_URL", "사진 경로를 확인해 주세요.");
    }
    if (
      url.username ||
      url.password ||
      url.origin !== origin ||
      url.search ||
      url.hash ||
      parts.slice(0, 4).join("/") !== "storage/v1/object/public" ||
      (bucket && parts[4] !== bucket) ||
      !folderPrefix.every((folder, index) => parts[5 + index] === folder) ||
      parts[ownerFolderIndex] !== userId ||
      parts.length < ownerFolderIndex + 2 ||
      parts.some(
        (p) =>
          !p || p === "." || p === ".." || p.includes("/") || p.includes("\\"),
      )
    )
      throw failure(
        400,
        "IMAGE_NOT_OWNED",
        "본인 폴더의 공개 Storage 사진만 사용할 수 있어요.",
      );
    return {
      url: value,
      bucket: parts[4],
      folder: parts.slice(5, -1).join("/"),
      file: parts.at(-1),
    };
  });
}
export async function verifyOwnedImageUrls(userId, values = [], options = {}) {
  const paths = validateImageUrls(userId, values, options);
  if (!paths.length) return [];
  const { supabase } = await import("../lib/supabase.js");
  for (const path of paths) {
    const result = await supabase.storage
      .from(path.bucket)
      .list(path.folder, { search: path.file, limit: 100 });
    if (
      result.error ||
      !Array.isArray(result.data) ||
      !result.data.some((row) => row.name === path.file && row.id)
    )
      throw failure(
        400,
        "IMAGE_NOT_FOUND",
        "업로드가 완료된 본인 사진을 선택해 주세요.",
      );
  }
  return paths.map((path) => path.url);
}
export async function listNotices(input = {}) {
  const options = paging(input);
  let rows = await notices.listPublished(new Date().toISOString());
  if (options.keyword)
    rows = rows.filter((row) =>
      (row.title + " " + row.content)
        .toLocaleLowerCase()
        .includes(options.keyword.toLocaleLowerCase()),
    );
  rows.sort(
    (a, b) =>
      Number(b.is_pinned) - Number(a.is_pinned) ||
      b.published_at.localeCompare(a.published_at) ||
      a.id.localeCompare(b.id),
  );
  return page(rows, options);
}
export async function getNotice(noticeId, input = {}) {
  uuid(noticeId);
  object(input, []);
  const row = await notices.findPublishedById(
    noticeId,
    new Date().toISOString(),
  );
  if (!row)
    throw failure(404, "NOTICE_NOT_FOUND", "게시된 공지를 찾지 못했어요.");
  return row;
}
export async function listFaqs(input = {}) {
  const options = paging(input, ["category"]);
  if (input.category !== undefined) text(input.category, 50);
  let rows = await faqs.listPublished();
  if (input.category)
    rows = rows.filter((row) => row.category === input.category);
  if (options.keyword)
    rows = rows.filter((row) =>
      (row.question + " " + row.answer)
        .toLocaleLowerCase()
        .includes(options.keyword.toLocaleLowerCase()),
    );
  rows.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  return page(rows, options);
}
export async function listMyInquiries(userId, input = {}) {
  const options = paging(input, ["status"]);
  if (
    input.status !== undefined &&
    !["PENDING", "ANSWERED", "CLOSED"].includes(input.status)
  )
    throw failure(400, "INVALID_INQUIRY_STATUS", "문의 상태를 확인해 주세요.");
  await active(userId);
  let rows = await inquiries.listOwned(userId);
  if (input.status) rows = rows.filter((row) => row.status === input.status);
  if (options.keyword)
    rows = rows.filter((row) =>
      (row.title + " " + row.content).includes(options.keyword),
    );
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return page(rows, options);
}
export async function getMyInquiry(userId, id, input = {}) {
  uuid(id);
  object(input, []);
  await active(userId);
  const row = await inquiries.findOwnedWithImages(userId, id);
  if (!row)
    throw failure(404, "INQUIRY_NOT_FOUND", "본인 문의를 찾지 못했어요.");
  return row;
}
export function validateInquiryInput(input, partial = false) {
  object(
    input,
    partial
      ? ["category", "title", "content"]
      : ["category", "title", "content", "orderId", "storeId", "imageUrls"],
  );
  const patch = {};
  if (!partial || input.category !== undefined) {
    if (
      !["ORDER", "PICKUP", "DELIVERY", "PRODUCT", "ACCOUNT", "ETC"].includes(
        input.category,
      )
    )
      throw failure(
        400,
        "INVALID_INQUIRY_CATEGORY",
        "문의 유형을 선택해 주세요.",
      );
    patch.category = input.category;
  }
  if (!partial || input.title !== undefined)
    patch.title = text(input.title, 100);
  if (!partial || input.content !== undefined)
    patch.content = text(input.content, 5000);
  if (partial && !Object.keys(patch).length)
    throw failure(400, "EMPTY_PATCH", "변경할 내용을 입력해 주세요.");
  return patch;
}
export async function createInquiry(userId, input) {
  const fields = validateInquiryInput(input);
  await active(userId);
  let order = null;
  if (input.orderId !== undefined && input.orderId !== null) {
    order = await findOrder(userId, uuid(input.orderId));
    if (!order)
      throw failure(404, "ORDER_NOT_FOUND", "본인 주문을 선택해 주세요.");
  }
  let storeId = order?.store_id ?? null;
  if (input.storeId !== undefined && input.storeId !== null) {
    uuid(input.storeId);
    if (order && order.store_id !== input.storeId)
      throw failure(
        400,
        "ORDER_STORE_MISMATCH",
        "주문 매장과 문의 매장이 달라요.",
      );
    const store = await findStore(input.storeId);
    if (!store) throw failure(404, "STORE_NOT_FOUND", "매장을 찾지 못했어요.");
    storeId = store.id;
  }
  const images = await verifyOwnedImageUrls(userId, input.imageUrls);
  return inquiries.createWithImages(
    userId,
    { ...fields, order_id: order?.id ?? null, store_id: storeId },
    images,
  );
}
export async function updateInquiry(userId, id, input) {
  const patch = validateInquiryInput(input, true);
  await getMyInquiry(userId, id);
  const row = await inquiries.updateOwnedPending(userId, id, patch);
  if (!row)
    throw failure(
      409,
      "INQUIRY_NOT_PENDING",
      "답변 대기 중인 문의만 수정할 수 있어요.",
    );
  return row;
}
export async function deleteInquiry(userId, id, input) {
  object(input ?? {}, []);
  const row = await getMyInquiry(userId, id);
  const deleted = await inquiries.deleteOwnedPending(userId, id);
  if (!deleted)
    throw failure(
      409,
      "INQUIRY_NOT_PENDING",
      "답변 대기 중인 문의만 삭제할 수 있어요.",
    );
  return {
    deletedInquiryId: id,
    unlinkedImageUrls: row.images.map((image) => image.image_url),
    storageCleanupOwner: "UPLOAD_OWNER",
  };
}
