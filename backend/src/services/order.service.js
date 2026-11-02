import { threeMonthsAgo, syncPointEarnings, grantPurchasePoints } from "./user.service.js";
import { applyDeliveryDiscount, getMembershipDeliveryDiscount } from "./membershipDelivery.service.js";
import { listMyPaymentMethods } from "./paymentMethod.service.js";
import * as repository from "../repositories/order.repository.js";
import * as payments from "../repositories/payment.repository.js";
import { couponRpc } from "../repositories/couponRpc.js";
import {
  getPickupWindow,
  normalizeCheckoutInput,
  resolveCheckoutItems,
  groupItemsByStore,
  validateFulfillmentOptions,
  shippingAddressSnapshot,
} from "./checkout.service.js";
import { resolveAddressSelection } from "./address.service.js";

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

export function parseOrderRequests(value) {
  if (value === null || value === undefined)
    return {
      version: 1,
      storeRequest: null,
      deliveryRequest: null,
      legacy: false,
    };
  try {
    const decoded = JSON.parse(value);
    if (
      decoded &&
      decoded.version === 1 &&
      (decoded.storeRequest === null ||
        typeof decoded.storeRequest === "string") &&
      (decoded.deliveryRequest === null ||
        typeof decoded.deliveryRequest === "string")
    )
      return { ...decoded, legacy: false };
  } catch {
    /* 기존 일반 TEXT 보존 */
  }
  return {
    version: 0,
    storeRequest: null,
    deliveryRequest: value,
    legacy: true,
  };
}
export function validateOrderFilters(input = {}) {
  const options = paging(input, [
    "fulfillmentType",
    "status",
    "period",
    "from",
    "to",
  ]);
  if (
    input.fulfillmentType !== undefined &&
    !["PICKUP", "DELIVERY"].includes(input.fulfillmentType)
  )
    throw failure(400, "INVALID_FULFILLMENT", "수령 방식을 확인해 주세요.");
  if (
    input.status !== undefined &&
    ![
      "PAID",
      "PREPARING",
      "READY_FOR_PICKUP",
      "SHIPPING",
      "COMPLETED",
      "CANCELED",
      "ONGOING",
    ].includes(input.status)
  )
    throw failure(400, "INVALID_ORDER_STATUS", "주문 상태를 확인해 주세요.");
  if (
    input.period !== undefined &&
    !["ALL", "LAST_3_MONTHS"].includes(input.period)
  )
    throw failure(400, "INVALID_PERIOD", "조회 기간을 확인해 주세요.");
  const date = (value) => {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw failure(400, "INVALID_DATE", "조회 날짜를 확인해 주세요.");
    return value;
  };
  if (input.from !== undefined) date(input.from);
  if (input.to !== undefined) date(input.to);
  if (input.from && input.to && input.from > input.to)
    throw failure(400, "INVALID_DATE_RANGE", "조회 날짜 순서를 확인해 주세요.");
  return {
    ...options,
    ...input,
    page: options.page,
    size: options.size,
    limit: options.limit,
    offset: options.offset,
    keyword: options.keyword,
  };
}
async function owned(userId, orderId) {
  uuid(orderId);
  await active(userId);
  const row = await repository.findOwned(userId, orderId);
  if (!row) throw failure(404, "ORDER_NOT_FOUND", "본인 주문을 찾지 못했어요.");
  return row;
}
export function canCancelOrder(order) {
  return order.status === "PAID";
}
export async function listMyOrders(userId, input = {}) {
  const options = validateOrderFilters(input);
  await active(userId);
  let rows = await repository.listOwned(userId);
  if (options.fulfillmentType)
    rows = rows.filter(
      (row) => row.fulfillment_type === options.fulfillmentType,
    );
  if (options.status)
    rows = rows.filter((row) =>
      options.status === "ONGOING"
        ? !["COMPLETED", "CANCELED"].includes(row.status)
        : row.status === options.status,
    );
  if (options.period === "LAST_3_MONTHS") {
    const date = threeMonthsAgo(new Date());
    rows = rows.filter((row) => Date.parse(row.created_at) >= date.getTime());
  }
  if (options.from)
    rows = rows.filter(
      (row) =>
        Date.parse(row.created_at) >=
        Date.parse(options.from + "T00:00:00+09:00"),
    );
  if (options.to)
    rows = rows.filter(
      (row) =>
        Date.parse(row.created_at) <
        Date.parse(options.to + "T00:00:00+09:00") + 86400000,
    );
  const result = [];
  for (const row of rows) {
    const items = await repository.listItems(row.id);
    if (
      options.keyword &&
      !`${row.store?.name ?? ""} ${items.map((item) => item.product_name).join(" ")}`
        .toLocaleLowerCase()
        .includes(options.keyword.toLocaleLowerCase())
    )
      continue;
    result.push({
      ...row,
      items,
      canCancel: canCancelOrder(row),
      canConfirm: canConfirmPurchase(row),
      pickupWindow: row.pickup_deadline
        ? getPickupWindow(row.pickup_deadline)
        : null,
    });
  }
  const reviewedItemIds = new Set(
    await repository.findReviewedItemIds(userId, result.flatMap((order) => order.items.map((item) => item.id))),
  );
  for (const order of result)
    order.items = order.items.map((item) => ({
      ...item,
      review_completed: reviewedItemIds.has(item.id),
    }));
  result.sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  );
  return page(result, options);
}
async function findOrderer(userId) {
  const profile = await findByAuthId(userId);
  return profile
    ? { name: profile.nickname, phone: profile.phone ?? null, email: profile.email ?? null }
    : null;
}
// 같은 결제(checkout_group_id)로 접수된 다른 매장 주문. 상세 화면에서 함께 보여준다.
async function listGroupSiblings(userId, row) {
  if (!row.checkout_group_id) return [];
  const siblings = (await repository.listOwnedGroup(userId, row.checkout_group_id))
    .filter((order) => order.id !== row.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return Promise.all(
    siblings.map(async (order) => {
      const [store, items] = await Promise.all([
        repository.findStore(order.store_id),
        repository.listItems(order.id),
      ]);
      return {
        id: order.id,
        order_no: order.order_no,
        status: order.status,
        fulfillment_type: order.fulfillment_type,
        total_amount: order.total_amount,
        store: store ? { id: store.id, name: store.name, thumbnail_url: store.thumbnail_url } : null,
        items: items.map((item) => ({
          id: item.id,
          store_product_id: item.store_product_id,
          product_name: item.product_name,
          product_image_url: item.product_image_url,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };
    }),
  );
}
export async function getMyOrderDetail(userId, orderId, query = {}) {
  object(query, []);
  const row = await owned(userId, orderId);
  const items = await repository.listItems(row.id);
  const reviewedItemIds = new Set(
    await repository.findReviewedItemIds(userId, items.map((item) => item.id)),
  );
  return {
    ...row,
    items: items.map((item) => ({
      ...item,
      review_completed: reviewedItemIds.has(item.id),
    })),
    orderer: await findOrderer(userId),
    groupOrders: await listGroupSiblings(userId, row),
    histories: await repository.listHistories(row.id),
    payments: await payments.listOwnedOrderPayments(userId, row.id),
    requests: parseOrderRequests(row.delivery_request),
    pickupWindow: row.pickup_deadline
      ? getPickupWindow(row.pickup_deadline)
      : null,
    canCancel: canCancelOrder(row),
    canConfirm: canConfirmPurchase(row),
    canChangeAddress:
      row.fulfillment_type === "DELIVERY" && row.status === "PAID",
    fulfillmentInfo: await repository.listFulfillmentInfo(
      row.store_id,
      row.fulfillment_type,
    ),
  };
}
export async function getMyPickupInfo(userId, orderId, query = {}) {
  object(query, []);
  const row = await owned(userId, orderId);
  if (row.fulfillment_type !== "PICKUP")
    throw failure(409, "NOT_PICKUP_ORDER", "픽업 주문이 아니에요.");
  const available =
    row.status === "READY_FOR_PICKUP" &&
    row.pickup_deadline !== null &&
    Date.parse(row.pickup_deadline) > Date.now();
  return {
    orderId: row.id,
    status: row.status,
    pickupWindow: row.pickup_deadline
      ? getPickupWindow(row.pickup_deadline)
      : null,
    pickupCode: available ? row.pickup_code : null,
    qrPayload: available
      ? JSON.stringify({ orderId: row.id, pickupCode: row.pickup_code })
      : null,
    available,
    store: row.store,
    guide: await repository.listFulfillmentInfo(row.store_id, "PICKUP"),
  };
}
export async function changeOrderAddress(userId, orderId, input) {
  object(input, ["addressId"]);
  uuid(input.addressId);
  const row = await owned(userId, orderId);
  if (row.status !== "PAID" || row.fulfillment_type !== "DELIVERY")
    throw failure(
      409,
      "ADDRESS_CHANGE_NOT_ALLOWED",
      "상품 준비 전 배송 주문만 주소를 바꿀 수 있어요.",
    );
  const address = await resolveAddressSelection(userId, input.addressId);
  const snapshot = await repository.listItems(row.id);
  const normalized = normalizeCheckoutInput({
    mode: "DIRECT",
    items: snapshot.map((item) => ({
      storeProductId: item.store_product_id,
      quantity: item.quantity,
    })),
    addressId: input.addressId,
    storeOptions: [{ storeId: row.store_id, fulfillmentType: "DELIVERY" }],
  });
  const items = await resolveCheckoutItems(userId, normalized);
  const groups = groupItemsByStore(items);
  groups[0].itemsAmount = row.items_amount;
  const result = (
    await validateFulfillmentOptions(userId, groups, normalized, new Date())
  )[0];
  const memberFee =
    result.deliveryFee === null
      ? null
      : result.deliveryFee - applyDeliveryDiscount(result.deliveryFee, await getMembershipDeliveryDiscount(userId));
  if (result.issues.length || (result.deliveryFee !== row.delivery_fee && memberFee !== row.delivery_fee))
    throw failure(
      409,
      "DELIVERY_REQUOTE_REQUIRED",
      "배송 불가 지역이거나 배송비가 달라 주소를 변경할 수 없어요.",
    );
  const old = parseOrderRequests(row.delivery_request);
  const saved = await repository.changeOwnedAddress(userId, row.id, {
    recipient_name: address.recipient_name,
    recipient_phone: address.recipient_phone,
    shipping_address: shippingAddressSnapshot(address),
    delivery_request: JSON.stringify({
      version: 1,
      storeRequest: old.storeRequest,
      deliveryRequest: address.delivery_request,
    }),
  });
  if (!saved) throw failure(409, "ORDER_CHANGED", "주문 상태가 변경됐어요.");
  return getMyOrderDetail(userId, row.id);
}
export async function getReorderItems(userId, orderId, input) {
  object(input ?? {}, []);
  const row = await owned(userId, orderId);
  const items = await repository.listItems(row.id);
  const available = [],
    unavailable = [];
  for (const item of items) {
    const sale = await repository.findSale(item.store_product_id);
    if (
      !sale ||
      sale.status !== "ON_SALE" ||
      sale.stock < item.quantity ||
      (sale.max_per_order !== null && item.quantity > sale.max_per_order)
    )
      unavailable.push({
        orderItemId: item.id,
        storeProductId: item.store_product_id,
        reason: "UNAVAILABLE",
      });
    else
      available.push({
        storeProductId: sale.id,
        quantity: item.quantity,
        fulfillmentType: row.fulfillment_type,
        unitPrice: sale.price,
      });
  }
  return { items: available, unavailable, persisted: false };
}
export function validateCancellationInput(input) {
  object(input, ["reason", "detail"]);
  if (
    ![
      "CHANGE_OF_MIND",
      "CHANGE_FULFILLMENT",
      "BUY_ELSEWHERE",
      "ORDER_MISTAKE",
      "ETC",
    ].includes(input.reason)
  )
    throw failure(400, "INVALID_CANCEL_REASON", "취소 사유를 선택해 주세요.");
  return {
    reason: input.reason,
    detail:
      input.detail === undefined && input.reason !== "ETC"
        ? null
        : text(input.detail, 500, input.reason === "ETC" ? 1 : 0),
  };
}
export function canConfirmPurchase(order) {
  return order.status === "COMPLETED" && !order.purchase_confirmed_at;
}
// 배송이 완료된 주문을 고객이 구매확정한다. 확정하면 적립 예정 적립금이 지급되고 리뷰를 쓸 수 있다.
export async function confirmMyPurchase(userId, orderId) {
  const row = await owned(userId, orderId);
  if (row.purchase_confirmed_at)
    return { ...(await getMyOrderDetail(userId, row.id)), alreadyConfirmed: true };
  if (!canConfirmPurchase(row))
    throw failure(409, "CONFIRM_NOT_ALLOWED", "배송이 완료된 주문만 구매확정할 수 있어요.");
  const changed = await repository.confirmOwnedPurchase(userId, row.id);
  if (!changed)
    throw failure(409, "CONFIRM_NOT_ALLOWED", "주문 상태가 바뀌었어요. 다시 확인해 주세요.");
  await syncPointEarnings(userId);
  const earned = await grantPurchasePoints(userId, changed);
  return { ...(await getMyOrderDetail(userId, row.id)), alreadyConfirmed: false, earnedPoints: earned };
}
export async function cancelMyOrder(userId, orderId, input) {
  const reason = validateCancellationInput(input);
  const row = await owned(userId, orderId);
  if (row.status === "CANCELED")
    return {
      ...(await getMyOrderDetail(userId, row.id)),
      alreadyCanceled: true,
    };
  if (!canCancelOrder(row))
    throw failure(
      409,
      "CANCEL_NOT_ALLOWED",
      "매장에서 확인하기 전 주문만 취소할 수 있어요.",
    );
  const records = await payments.listOwnedOrderPayments(userId, row.id);
  if (records.some((payment) => !payment.is_mock))
    throw failure(
      409,
      "REAL_PAYMENT_UNSUPPORTED",
      "실제 결제는 시연 API에서 취소할 수 없어요.",
    );
  const changed = await couponRpc('cancel_coupon_order', {
    p_user_id: userId, p_order_id: row.id, p_memo: JSON.stringify(reason),
  });
  return { ...(await getMyOrderDetail(userId, row.id)), alreadyCanceled: !changed };
}

// ---- 반품/교환 요청 ----
const CLAIM_REASONS = [
  "DEFECT",
  "WRONG_ITEM",
  "NOT_AS_DESCRIBED",
  "CHANGE_OF_MIND",
  "ETC",
];
export function validateClaimInput(input) {
  object(input, [
    "orderItemId",
    "claimType",
    "reason",
    "detail",
    "refundPaymentMethodId",
  ]);
  if (!["RETURN", "EXCHANGE"].includes(input.claimType))
    throw failure(400, "INVALID_CLAIM_TYPE", "반품 또는 교환을 선택해 주세요.");
  if (!CLAIM_REASONS.includes(input.reason))
    throw failure(400, "INVALID_CLAIM_REASON", "사유를 선택해 주세요.");
  return {
    orderItemId: uuid(input.orderItemId),
    claimType: input.claimType,
    reason: input.reason,
    detail:
      input.detail === undefined && input.reason !== "ETC"
        ? null
        : text(input.detail, 500, input.reason === "ETC" ? 1 : 0) || null,
    refundPaymentMethodId:
      input.refundPaymentMethodId == null
        ? null
        : uuid(input.refundPaymentMethodId),
  };
}
function serializeClaim(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNo: row.order?.order_no ?? null,
    storeName: row.order?.store?.name ?? null,
    claimType: row.claim_type,
    status: row.status,
    reason: row.reason,
    detail: row.detail,
    item: row.item
      ? {
          productName: row.item.product_name,
          imageUrl: row.item.product_image_url,
          quantity: row.item.quantity,
          unitPrice: row.item.unit_price,
        }
      : null,
    createdAt: row.created_at,
  };
}
export async function listMyClaims(userId, input = {}) {
  object(input, [], true);
  await active(userId);
  return {
    items: (await repository.listOwnedClaims(userId)).map(serializeClaim),
  };
}
export async function createMyClaim(userId, orderId, input) {
  const claim = validateClaimInput(input);
  const order = await owned(userId, orderId);
  if (order.status !== "COMPLETED")
    throw failure(
      409,
      "CLAIM_NOT_ALLOWED",
      "수령을 완료한 주문만 반품·교환을 요청할 수 있어요.",
    );
  if (order.purchase_confirmed_at)
    throw failure(
      409,
      "CLAIM_NOT_ALLOWED",
      "구매확정한 주문은 반품·교환을 요청할 수 없어요.",
    );
  const item = await repository.findOwnedItem(userId, claim.orderItemId);
  if (!item || item.order_id !== order.id)
    throw failure(404, "ORDER_ITEM_NOT_FOUND", "주문 상품을 찾지 못했어요.");
  const previous = await repository.listClaimsForItem(userId, item.id);
  if (previous.some((row) => row.status !== "REJECTED"))
    throw failure(
      409,
      "CLAIM_ALREADY_EXISTS",
      "이미 접수된 반품·교환 요청이 있어요.",
    );
  if (claim.refundPaymentMethodId) {
    const accounts = (await listMyPaymentMethods(userId)).items;
    if (
      !accounts.some(
        (row) =>
          row.id === claim.refundPaymentMethodId &&
          row.method_type === "BANK_ACCOUNT",
      )
    )
      throw failure(404, "REFUND_ACCOUNT_NOT_FOUND", "환불계좌를 찾지 못했어요.");
  }
  const saved = await repository.createClaim({
    order_id: order.id,
    order_item_id: item.id,
    user_id: userId,
    claim_type: claim.claimType,
    reason: claim.reason,
    detail: claim.detail,
    refund_payment_method_id: claim.refundPaymentMethodId,
  });
  return { claim: serializeClaim(saved) };
}
