import * as repository from "../repositories/sellerApplication.repository.js";
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

export function validateSellerApplicationInput(input) {
  object(input, [
    "storeName",
    "businessNo",
    "ownerName",
    "address",
    "phone",
    "documentUrl",
  ]);
  const businessNo = text(input.businessNo, 20).replaceAll("-", "");
  const phone = text(input.phone, 20).replace(/[ ()-]/g, "");
  if (!/^\d{10}$/.test(businessNo))
    throw failure(
      400,
      "INVALID_BUSINESS_NO",
      "사업자번호 10자리를 입력해 주세요.",
    );
  if (!/^0\d{8,10}$/.test(phone))
    throw failure(400, "INVALID_PHONE", "매장 연락처를 확인해 주세요.");
  return {
    store_name: text(input.storeName, 100),
    business_no: businessNo,
    owner_name: text(input.ownerName, 50),
    address: text(input.address, 200),
    phone,
  };
}
export async function getMySellerApplication(userId, input = {}) {
  object(input, []);
  const profile = await active(userId);
  return {
    application: await repository.findLatestOwned(userId),
    role: profile.role,
    stores: await repository.listOwnedStores(userId),
    canEnterSellerCenter: profile.role === "SELLER" || profile.role === "ADMIN",
  };
}
export async function submitSellerApplication(userId, input) {
  const fields = validateSellerApplicationInput(input);
  const profile = await active(userId);
  if (profile.role !== "CONSUMER")
    throw failure(
      409,
      "ALREADY_SELLER",
      "판매자 계정은 새 입점 신청 대상이 아니에요.",
    );
  if (
    (await repository.listOwned(userId)).some((row) =>
      ["PENDING", "APPROVED"].includes(row.status),
    )
  )
    throw failure(
      409,
      "APPLICATION_ALREADY_EXISTS",
      "심사 대기 또는 승인된 신청이 있어요.",
    );
  const images = await verifyOwnedImageUrls(
    userId,
    input.documentUrl === undefined || input.documentUrl === null
      ? []
      : [input.documentUrl],
  );
  return repository.submitOwned(userId, {
    ...fields,
    document_url: images[0] ?? null,
  });
}
