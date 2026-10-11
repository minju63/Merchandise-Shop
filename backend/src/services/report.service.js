import * as repository from "../repositories/report.repository.js";

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

export function validateReportInput(input) {
  object(input, ["targetType", "targetId", "reason", "detail"]);
  if (!["PRODUCT", "STORE", "REVIEW"].includes(input.targetType))
    throw failure(
      400,
      "INVALID_REPORT_TARGET",
      "신고 대상 종류를 확인해 주세요.",
    );
  if (!["FAKE", "ILLEGAL", "ABUSE", "SPAM", "ETC"].includes(input.reason))
    throw failure(400, "INVALID_REPORT_REASON", "신고 사유를 선택해 주세요.");
  return {
    target_type: input.targetType,
    target_id: uuid(input.targetId),
    reason: input.reason,
    detail:
      input.detail === undefined && input.reason !== "ETC"
        ? null
        : text(input.detail, 1000, input.reason === "ETC" ? 1 : 0),
  };
}
export async function validateReportTarget(type, id) {
  const target = await repository.findTarget(type, id);
  if (!target)
    throw failure(
      404,
      "REPORT_TARGET_NOT_FOUND",
      "신고할 대상을 찾지 못했어요.",
    );
  return target;
}
export async function createReport(userId, input) {
  const fields = validateReportInput(input);
  await active(userId);
  const target = await validateReportTarget(
    fields.target_type,
    fields.target_id,
  );
  if (fields.target_type === "REVIEW" && target.user_id === userId)
    throw failure(
      400,
      "OWN_REVIEW_REPORT",
      "본인 리뷰는 수정 또는 삭제해 주세요.",
    );
  return repository.createOwned(userId, fields);
}
export async function listMyReports(userId, input = {}) {
  const options = paging(input, ["status"]);
  if (
    input.status !== undefined &&
    !["PENDING", "RESOLVED", "DISMISSED"].includes(input.status)
  )
    throw failure(400, "INVALID_REPORT_STATUS", "신고 상태를 확인해 주세요.");
  await active(userId);
  let rows = await repository.listOwned(userId);
  if (input.status) rows = rows.filter((row) => row.status === input.status);
  if (options.keyword)
    rows = rows.filter((row) =>
      `${row.reason} ${row.detail ?? ""}`.includes(options.keyword),
    );
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return page(rows, options);
}
