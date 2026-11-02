import { randomUUID, createHash } from "node:crypto";
import * as orderRepository from "../repositories/order.repository.js";
import * as paymentRepository from "../repositories/payment.repository.js";
import { findByAuthId } from "../repositories/user.repository.js";
import {
  POINT_POLICY,
  getPointBalance,
} from "./user.service.js";
import { resolveAddressSelection, listMyAddresses } from "./address.service.js";
import {
  resolvePaymentMethodSelection,
  listMyPaymentMethods,
} from "./paymentMethod.service.js";
import { couponRpc } from "../repositories/couponRpc.js";
import * as couponRepository from "../repositories/coupon.repository.js";
import { evaluateCouponEligibility } from "./coupon.service.js";

const CHECKOUT_PAYMENT_OPTIONS = Object.freeze({
  GOODSPICK_PAY: "굿즈픽페이",
  TOSS_PAY: "토스페이",
  NAVER_PAY: "네이버페이",
  KAKAO_PAY: "카카오페이",
  CARD: "카드 결제",
  VIRTUAL_ACCOUNT: "가상계좌",
  MOBILE: "휴대폰 결제",
});

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
function object(input, keys) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw failure(400, "INVALID_INPUT", "주문 입력 형식을 확인해 주세요.");
  if (Object.keys(input).some((key) => !keys.includes(key)))
    throw failure(400, "UNKNOWN_FIELDS", "허용되지 않은 주문 입력이 있어요.");
}
function id(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
  )
    throw failure(400, "INVALID_CHECKOUT_ID", "주문 식별자를 확인해 주세요.");
  return value.toLowerCase();
}
function integer(value, minimum = 0, policy = false) {
  if (!Number.isSafeInteger(value) || value < minimum || value > 2147483647)
    throw failure(
      policy ? 503 : 400,
      policy ? "INVALID_CHECKOUT_POLICY" : "INVALID_QUANTITY",
      "금액·수량·매장 설정을 확인해 주세요.",
    );
  return value;
}
function requestText(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > 500)
    throw failure(
      400,
      "INVALID_ORDER_REQUEST",
      "요청사항은 500자 이내로 입력해 주세요.",
    );
  return value.trim().normalize("NFC") || null;
}
function dateOnly(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw failure(400, "INVALID_PICKUP_DATE", "픽업 날짜를 확인해 주세요.");
  return value;
}
export function validateCouponAssignments(options) {
  const seen = new Set();
  for (const option of options)
    if (option.userCouponId) {
      if (seen.has(option.userCouponId))
        throw failure(
          400,
          "DUPLICATE_COUPON_ASSIGNMENT",
          "같은 쿠폰을 여러 매장 주문에 사용할 수 없어요.",
        );
      seen.add(option.userCouponId);
    }
}
export function normalizeCheckoutInput(input) {
  object(input, [
    "mode",
    "items",
    "cartItemIds",
    "storeOptions",
    "addressId",
    "paymentMethodId",
    "paymentOption",
    "cartCouponId",
    "pointsUse",
    "useExpectedPoints",
  ]);
  if (!["DIRECT", "CART"].includes(input.mode))
    throw failure(
      400,
      "INVALID_CHECKOUT_MODE",
      "바로 구매 또는 장바구니 주문을 선택해 주세요.",
    );
  const result = {
    mode: input.mode,
    items: [],
    cartItemIds: [],
    storeOptions: [],
    addressId: input.addressId == null ? null : id(input.addressId),
    paymentMethodId:
      input.paymentMethodId == null ? null : id(input.paymentMethodId),
    paymentOption: input.paymentOption == null ? null : input.paymentOption,
    cartCouponId: input.cartCouponId == null ? null : id(input.cartCouponId),
    pointsUse: input.pointsUse == null ? 0 : integer(input.pointsUse, 0, true),
    useExpectedPoints: input.useExpectedPoints === true,
  };
  if (input.useExpectedPoints != null && typeof input.useExpectedPoints !== "boolean")
    throw failure(400, "INVALID_POINTS", "적립예정금 사용 여부를 확인해 주세요.");
  if (
    result.paymentOption !== null &&
    !Object.hasOwn(CHECKOUT_PAYMENT_OPTIONS, result.paymentOption)
  )
    throw failure(400, "INVALID_PAYMENT_OPTION", "결제수단을 다시 선택해 주세요.");
  if (input.mode === "DIRECT") {
    if (
      input.cartItemIds !== undefined ||
      !Array.isArray(input.items) ||
      !input.items.length
    )
      throw failure(
        400,
        "INVALID_CHECKOUT_ITEMS",
        "바로 구매 상품과 수량을 보내 주세요.",
      );
    const quantities = new Map();
    for (const item of input.items) {
      object(item, ["storeProductId", "quantity"]);
      const key = id(item.storeProductId);
      quantities.set(
        key,
        integer((quantities.get(key) ?? 0) + integer(item.quantity, 1), 1),
      );
    }
    result.items = Array.from(quantities, ([storeProductId, quantity]) => ({
      storeProductId,
      quantity,
    }));
  } else {
    if (
      input.items !== undefined ||
      !Array.isArray(input.cartItemIds) ||
      !input.cartItemIds.length
    )
      throw failure(
        400,
        "INVALID_CART_SELECTION",
        "주문할 장바구니 항목을 선택해 주세요.",
      );
    result.cartItemIds = Array.from(new Set(input.cartItemIds.map(id)));
  }
  if (input.storeOptions !== undefined && !Array.isArray(input.storeOptions))
    throw failure(
      400,
      "INVALID_STORE_OPTIONS",
      "매장별 수령 방법을 확인해 주세요.",
    );
  const stores = new Set();
  for (const option of input.storeOptions ?? []) {
    object(option, [
      "storeId",
      "fulfillmentType",
      "pickupDate",
      "userCouponId",
      "storeRequest",
      "deliveryRequest",
    ]);
    const storeId = id(option.storeId);
    if (stores.has(storeId))
      throw failure(
        400,
        "DUPLICATE_STORE_OPTION",
        "매장별 옵션은 한 번만 보내 주세요.",
      );
    stores.add(storeId);
    if (!["PICKUP", "DELIVERY"].includes(option.fulfillmentType))
      throw failure(
        400,
        "INVALID_FULFILLMENT_TYPE",
        "픽업 또는 배송을 선택해 주세요.",
      );
    if (option.fulfillmentType === "DELIVERY" && option.pickupDate != null)
      throw failure(
        400,
        "INVALID_PICKUP_DATE",
        "배송 주문에는 픽업 날짜를 지정할 수 없어요.",
      );
    result.storeOptions.push({
      storeId,
      fulfillmentType: option.fulfillmentType,
      pickupDate:
        option.pickupDate == null ? null : dateOnly(option.pickupDate),
      userCouponId:
        option.userCouponId == null ? null : id(option.userCouponId),
      storeRequest: requestText(option.storeRequest),
      deliveryRequest: Object.hasOwn(option, "deliveryRequest")
        ? requestText(option.deliveryRequest)
        : undefined,
    });
  }
  validateCouponAssignments([
    ...result.storeOptions,
    ...(result.cartCouponId ? [{ userCouponId: result.cartCouponId }] : []),
  ]);
  return result;
}
async function getDatabase() {
  const { supabase } = await import("../lib/supabase.js");
  return supabase;
}
function checkDatabase(result) {
  if (
    result.error ||
    !Array.isArray(result.data) ||
    !Number.isSafeInteger(result.count) ||
    result.count < 0
  )
    throw failure(
      503,
      "DATABASE_ERROR",
      "주문에 필요한 데이터를 조회하지 못했어요.",
    );
}
async function readAll(table, columns, filters = []) {
  const db = await getDatabase();
  const rows = [];
  let offset = 0;
  for (;;) {
    let query = db.from(table).select(columns, { count: "exact" });
    for (const [method, column, value] of filters)
      query = query[method](column, value);
    const result = await query
      .order(
        table === "store_pickup_infos" || table === "store_delivery_infos"
          ? "store_id"
          : "id",
        { ascending: true },
      )
      .range(offset, offset + 499);
    checkDatabase(result);
    rows.push(...result.data);
    offset += result.data.length;
    if (offset >= result.count) return rows;
    if (!result.data.length)
      throw failure(
        503,
        "DATABASE_ERROR",
        "주문 데이터 조회가 완료되지 않았어요.",
      );
  }
}
async function readByIds(table, columns, ids, filters = []) {
  const rows = [];
  // PostgREST URL 길이·페이지 크기에 따른 실제 조회 누락을 막는 조회 단위다.
  for (let offset = 0; offset < ids.length; offset += 100)
    rows.push(
      ...(await readAll(table, columns, [
        ...filters,
        ["in", "id", ids.slice(offset, offset + 100)],
      ])),
    );
  return rows;
}
export function calculateSalePrice(row) {
  const price = integer(row.price, 0, true);
  const rate = integer(row.discount_rate, 0, true);
  if (rate > 100)
    throw failure(
      503,
      "INVALID_CHECKOUT_POLICY",
      "상품 할인율을 확인할 수 없어요.",
    );
  // price를 DB 최종 판매가로 사용하며 표시용 할인율을 다시 차감하지 않는다.
  return price;
}
export async function resolveCheckoutItems(userId, input) {
  let requested = input.items.map((item) => ({
    ...item,
    cartItemIds: [],
    cartFulfillments: [],
  }));
  if (input.mode === "CART") {
    const rows = await readByIds(
      "cart_items",
      "id,user_id,store_product_id,quantity,fulfillment_type",
      input.cartItemIds,
      [["eq", "user_id", userId]],
    );
    if (rows.length !== input.cartItemIds.length)
      throw failure(
        404,
        "CART_ITEM_NOT_FOUND",
        "본인 장바구니에서 선택한 항목을 찾지 못했어요.",
      );
    const combined = new Map();
    for (const row of rows) {
      if (!["PICKUP", "DELIVERY"].includes(row.fulfillment_type))
        throw failure(
          503,
          "INVALID_CHECKOUT_POLICY",
          "장바구니 수령 방식이 잘못됐어요.",
        );
      const current = combined.get(row.store_product_id) ?? {
        storeProductId: row.store_product_id,
        quantity: 0,
        cartItemIds: [],
        cartFulfillments: [],
      };
      current.quantity = integer(
        current.quantity + integer(row.quantity, 1, true),
        1,
        true,
      );
      current.cartItemIds.push(row.id);
      current.cartFulfillments.push(row.fulfillment_type);
      combined.set(row.store_product_id, current);
    }
    requested = Array.from(combined.values());
  }
  const sales = await readByIds(
    "store_products",
    "id,store_id,product_id,price,discount_rate,stock,max_per_order,status,pickup_available,delivery_available",
    requested.map((row) => row.storeProductId),
  );
  const map = new Map(sales.map((row) => [row.id, row]));
  if (sales.length !== requested.length)
    throw failure(
      404,
      "STORE_PRODUCT_NOT_FOUND",
      "선택한 판매 상품을 찾지 못했어요.",
    );
  const products = await readByIds(
    "products",
    "id,name,work_title,character_name,thumbnail_url,status,open_at",
    Array.from(new Set(sales.map((row) => row.product_id))),
  );
  const catalog = new Map(products.map((row) => [row.id, row]));
  return requested.map((item) => {
    const sale = map.get(item.storeProductId);
    const product = catalog.get(sale.product_id);
    if (!product)
      throw failure(
        503,
        "INVALID_CHECKOUT_POLICY",
        "상품 정보를 확인할 수 없어요.",
      );
    const unitPrice = calculateSalePrice(sale);
    return {
      ...item,
      storeId: sale.store_id,
      productId: sale.product_id,
      product,
      sale,
      unitPrice,
      lineAmount: integer(unitPrice * item.quantity, 0, true),
    };
  });
}
export function groupItemsByStore(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.storeId))
      groups.set(item.storeId, {
        storeId: item.storeId,
        items: [],
        itemsAmount: 0,
      });
    const group = groups.get(item.storeId);
    group.items.push(item);
    group.itemsAmount = integer(group.itemsAmount + item.lineAmount, 0, true);
  }
  return Array.from(groups.values());
}
export function buildStockIssues(items, now = new Date()) {
  const issues = [];
  for (const item of items) {
    const stock = integer(item.sale.stock, 0, true);
    const maximum = item.sale.max_per_order;
    if (maximum !== null) integer(maximum, 1, true);
    let reason = null;
    if (
      item.product.status !== "ON_SALE" ||
      !["ON_SALE", "SOLD_OUT"].includes(item.sale.status)
    )
      reason = "NOT_ON_SALE";
    else if (
      item.product.open_at !== null &&
      (!Number.isFinite(Date.parse(item.product.open_at)) ||
        Date.parse(item.product.open_at) > now.getTime())
    )
      reason = "NOT_OPEN_YET";
    else if (item.sale.status === "SOLD_OUT" || stock < item.quantity)
      reason = "INSUFFICIENT_STOCK";
    else if (maximum !== null && item.quantity > maximum)
      reason = "MAX_PER_ORDER";
    if (reason)
      issues.push({
        storeProductId: item.storeProductId,
        productName: item.product.name,
        requestedQuantity: item.quantity,
        availableQuantity: item.sale.status === "SOLD_OUT" ? 0 : stock,
        maxPerOrder: maximum,
        reason,
      });
  }
  return issues;
}
export function getPickupWindow(deadline) {
  if (!(deadline instanceof Date) && typeof deadline !== "string")
    throw failure(
      503,
      "INVALID_CHECKOUT_POLICY",
      "픽업 마감 시각을 확인할 수 없어요.",
    );
  const end = new Date(deadline);
  if (!Number.isFinite(end.getTime()))
    throw failure(
      503,
      "INVALID_CHECKOUT_POLICY",
      "픽업 마감 시각을 확인할 수 없어요.",
    );
  return {
    startsAt: new Date(end.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    deadline: end.toISOString(),
  };
}
function timeOnDate(date, time) {
  if (
    typeof time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(time)
  )
    throw failure(
      503,
      "INVALID_CHECKOUT_POLICY",
      "매장 영업 시각을 확인할 수 없어요.",
    );
  return new Date(`${date}T${time}+09:00`);
}
const PICKUP_DATE_ISSUES = new Set([
  "PICKUP_DATE_REQUIRED",
  "BUSINESS_HOURS_MISSING",
  "STORE_CLOSED_ON_DATE",
  "PICKUP_HOLD_LIMIT",
  "PICKUP_TIME_UNAVAILABLE",
]);

export function calculatePickupAvailability(date, hours, policy, now) {
  if (!date) return { issue: "PICKUP_DATE_REQUIRED", pickup: null };
  if (!hours) return { issue: "BUSINESS_HOURS_MISSING", pickup: null };
  if (hours.is_closed) return { issue: "STORE_CLOSED_ON_DATE", pickup: null };
  if (!policy) return { issue: "PICKUP_POLICY_MISSING", pickup: null };
  const prepare = integer(policy.prepare_minutes, 0, true);
  const hold = integer(policy.hold_hours, 1, true);
  const open = timeOnDate(date, hours.open_time);
  let end = timeOnDate(date, hours.close_time);
  if (end <= open) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  const window = getPickupWindow(end);
  const start = Math.max(
    Date.parse(window.startsAt),
    open.getTime(),
    now.getTime() + prepare * 60 * 1000,
  );
  if (end.getTime() > now.getTime() + hold * 60 * 60 * 1000)
    return { issue: "PICKUP_HOLD_LIMIT", pickup: null };
  if (start >= end.getTime())
    return { issue: "PICKUP_TIME_UNAVAILABLE", pickup: null };
  const intervals = [
    { startsAt: new Date(start).toISOString(), endsAt: end.toISOString() },
  ];
  if ((hours.break_start === null) !== (hours.break_end === null))
    throw failure(
      503,
      "INVALID_CHECKOUT_POLICY",
      "휴게 시간 설정을 확인할 수 없어요.",
    );
  if (hours.break_start !== null) {
    let breakStart = timeOnDate(date, hours.break_start);
    let breakEnd = timeOnDate(date, hours.break_end);
    if (breakStart < open)
      breakStart = new Date(breakStart.getTime() + 24 * 60 * 60 * 1000);
    if (breakEnd <= breakStart)
      breakEnd = new Date(breakEnd.getTime() + 24 * 60 * 60 * 1000);
    intervals.length = 0;
    if (start < Math.min(breakStart.getTime(), end.getTime()))
      intervals.push({
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(
          Math.min(breakStart.getTime(), end.getTime()),
        ).toISOString(),
      });
    if (Math.max(start, breakEnd.getTime()) < end.getTime())
      intervals.push({
        startsAt: new Date(Math.max(start, breakEnd.getTime())).toISOString(),
        endsAt: end.toISOString(),
      });
  }
  if (!intervals.length)
    return { issue: "PICKUP_TIME_UNAVAILABLE", pickup: null };
  return {
    issue: null,
    pickup: {
      ...window,
      availableIntervals: intervals,
      prepareMinutes: prepare,
      holdHours: hold,
      guideText: policy.guide_text,
    },
  };
}
export function calculateDeliveryFee(itemsAmount, policy) {
  const fee = integer(policy.delivery_fee, 0, true);
  const minimum = integer(policy.min_order_amount, 0, true);
  if (policy.free_threshold !== null) integer(policy.free_threshold, 0, true);
  if (itemsAmount < minimum)
    return { issue: "MIN_DELIVERY_ORDER_AMOUNT", deliveryFee: null };
  const base =
    policy.free_threshold !== null && itemsAmount >= policy.free_threshold
      ? 0
      : fee;
  return {
    issue: null,
    deliveryFee: integer(base, 0, true),
  };
}
export async function validateFulfillmentOptions(userId, groups, input, now) {
  const ids = groups.map((row) => row.storeId);
  const stores = await readByIds(
    "stores",
    "id,name,address,phone,thumbnail_url,status,temporary_closed,pickup_available,delivery_available",
    ids,
  );
  const hours = await readAll(
    "store_business_hours",
    "id,store_id,day_of_week,open_time,close_time,is_closed,break_start,break_end",
    [["in", "store_id", ids]],
  );
  const pickups = await readAll(
    "store_pickup_infos",
    "store_id,prepare_minutes,hold_hours,guide_text",
    [["in", "store_id", ids]],
  );
  const deliveries = await readAll(
    "store_delivery_infos",
    "store_id,delivery_fee,free_threshold,min_order_amount,estimated_days,courier_name,guide_text",
    [["in", "store_id", ids]],
  );
  const deliveryGroups = groups.filter(
    (group) =>
      input.storeOptions.find((option) => option.storeId === group.storeId)
        ?.fulfillmentType === "DELIVERY" ||
      (!input.storeOptions.some((option) => option.storeId === group.storeId) &&
        group.items.every(
          (item) =>
            item.cartFulfillments.length &&
            item.cartFulfillments.every((type) => type === "DELIVERY"),
        )),
  );
  const address = input.addressId
    ? await resolveAddressSelection(userId, input.addressId)
    : deliveryGroups.length
      ? ((await listMyAddresses(userId)).items.find((row) => row.is_default) ??
        null)
      : null;
  for (const option of input.storeOptions)
    if (!ids.includes(option.storeId))
      throw failure(
        400,
        "STORE_OPTION_NOT_IN_CHECKOUT",
        "주문에 없는 매장의 옵션이 있어요.",
      );
  const results = [];
  for (const group of groups) {
    const store = stores.find((row) => row.id === group.storeId);
    if (!store)
      throw failure(
        503,
        "INVALID_CHECKOUT_POLICY",
        "매장 정보를 확인할 수 없어요.",
      );
    const modes = new Set(group.items.flatMap((item) => item.cartFulfillments));
    const option = input.storeOptions.find(
      (row) => row.storeId === group.storeId,
    ) ?? {
      storeId: group.storeId,
      fulfillmentType: modes.size === 1 ? Array.from(modes)[0] : null,
      pickupDate: null,
      userCouponId: null,
      storeRequest: null,
      deliveryRequest: undefined,
    };
    const issues = [];
    let deliveryFee = null;
    let pickup = null;
    let delivery = null;
    if (store.status !== "ACTIVE" || store.temporary_closed)
      issues.push("STORE_UNAVAILABLE");
    if (!option.fulfillmentType)
      issues.push(
        modes.size > 1 ? "CONFLICTING_FULFILLMENT" : "FULFILLMENT_REQUIRED",
      );
    else if (
      !store[
        option.fulfillmentType === "PICKUP"
          ? "pickup_available"
          : "delivery_available"
      ] ||
      group.items.some(
        (item) =>
          !item.sale[
            option.fulfillmentType === "PICKUP"
              ? "pickup_available"
              : "delivery_available"
          ],
      )
    )
      issues.push("FULFILLMENT_UNAVAILABLE");
    if (option.fulfillmentType === "PICKUP") {
      deliveryFee = 0;
      const weekday = option.pickupDate
        ? new Date(option.pickupDate + "T12:00:00+09:00").getUTCDay()
        : null;
      const result = calculatePickupAvailability(
        option.pickupDate,
        hours.find(
          (row) => row.store_id === store.id && row.day_of_week === weekday,
        ),
        pickups.find((row) => row.store_id === store.id),
        now,
      );
      // 픽업은 바코드 수신 후 방문하는 방식이라 날짜·영업시간 때문에 주문을 막지 않는다.
      if (result.issue && !PICKUP_DATE_ISSUES.has(result.issue)) issues.push(result.issue);
      pickup = result.pickup;
    } else if (option.fulfillmentType === "DELIVERY") {
      const policy = deliveries.find((row) => row.store_id === store.id);
      if (!address) issues.push("ADDRESS_REQUIRED");
      if (!policy) issues.push("DELIVERY_POLICY_MISSING");
      if (address && policy) {
        integer(policy.estimated_days, 0, true);
        const result = calculateDeliveryFee(group.itemsAmount, policy);
        if (result.issue) issues.push(result.issue);
        deliveryFee = result.deliveryFee;
        delivery = {
          nationwide: true,
          regionId: null,
          extraFee: 0,
          estimatedDays: policy.estimated_days,
          courierName: policy.courier_name,
          guideText: policy.guide_text,
        };
      }
    }
    results.push({
      store,
      option,
      issues,
      deliveryFee,
      pickup,
      delivery,
      address: option.fulfillmentType === "DELIVERY" ? address : null,
    });
  }
  return results;
}
export function serializeOrderRequests(storeRequest, deliveryRequest) {
  return JSON.stringify({
    version: 1,
    storeRequest: requestText(storeRequest),
    deliveryRequest: requestText(deliveryRequest),
  });
}
export function calculateStoreQuote(
  group,
  fulfillment,
  ownedCoupon,
  userId,
  hasPreviousOrder,
  now,
) {
  const unavailable = new Set(buildStockIssues(group.items, now).map((item) => item.storeProductId));
  const orderableItemsAmount = group.items.filter((item) => !unavailable.has(item.storeProductId)).reduce((sum, item) => sum + item.lineAmount, 0);
  let coupon = null;
  let discountAmount = 0;
  if (ownedCoupon) {
    const eligibility =
      fulfillment.deliveryFee === null
        ? {
            usable: false,
            reason: "QUOTE_NOT_READY",
            discountAmount: 0,
            discountScope: null,
          }
        : evaluateCouponEligibility(
            ownedCoupon,
            {
              userId,
              storeId: group.storeId,
              itemsAmount: orderableItemsAmount,
              deliveryFee: fulfillment.deliveryFee,
              fulfillmentType: fulfillment.option.fulfillmentType,
              hasPreviousOrder,
            },
            now,
          );
    coupon = {
      userCouponId: ownedCoupon.id,
      couponId: ownedCoupon.coupon_id,
      name: ownedCoupon.coupon.name,
      ...eligibility,
    };
    discountAmount = eligibility.discountAmount;
  }
  const totalAmount =
    fulfillment.deliveryFee === null
      ? null
      : integer(
          group.itemsAmount + fulfillment.deliveryFee - discountAmount,
          0,
          true,
        );
  return {
    orderableItemsAmount,
    itemsAmount: group.itemsAmount,
    deliveryFee: fulfillment.deliveryFee,
    discountAmount,
    totalAmount,
    coupon,
  };
}
export function quotePoints(balance, orders, input) {
  const payable = orders.every((row) => row.totalAmount !== null)
    ? orders.reduce((total, row) => total + row.totalAmount, 0)
    : null;
  const rate = POINT_POLICY.earnRatePercent;
  const expectedAmount = payable === null ? 0 : Math.floor((payable * rate) / 100);
  const issues = [];
  const none = {
    balance,
    minUse: POINT_POLICY.minUse,
    earnRatePercent: rate,
    expectedAmount,
    pointsUse: 0,
    expectedUse: 0,
    earnAmount: 0,
    issues,
    allocations: orders.map(() => ({ used: 0, earn: 0 })),
  };
  if (payable === null) return none;
  const expectedUse = input.useExpectedPoints ? expectedAmount : 0;
  if (input.pointsUse > 0 && balance < POINT_POLICY.minUse) issues.push("POINTS_MIN_BALANCE");
  else if (input.pointsUse > balance) issues.push("POINTS_EXCEED_BALANCE");
  if (input.pointsUse + expectedUse > payable) issues.push("POINTS_EXCEED_PAYABLE");
  if (issues.length) return { ...none, pointsUse: input.pointsUse, expectedUse };
  let remaining = input.pointsUse + expectedUse;
  const allocations = orders.map((row) => {
    const used = Math.min(remaining, row.totalAmount);
    remaining -= used;
    const earn = input.useExpectedPoints
      ? 0
      : Math.floor(((row.totalAmount - used) * rate) / 100);
    return { used, earn };
  });
  return {
    ...none,
    pointsUse: input.pointsUse,
    expectedUse,
    earnAmount: allocations.reduce((total, row) => total + row.earn, 0),
    allocations,
  };
}

export async function previewCheckout(userId, rawInput) {
  const input = normalizeCheckoutInput(rawInput);
  const profile = await findByAuthId(userId);
  if (!profile)
    throw failure(404, "PROFILE_NOT_FOUND", "회원가입을 먼저 완료해 주세요.");
  if (profile.status !== "ACTIVE")
    throw failure(
      403,
      "ACCOUNT_UNAVAILABLE",
      "현재 사용할 수 없는 계정이에요.",
    );
  const now = new Date();
  const items = await resolveCheckoutItems(userId, input);
  const groups = groupItemsByStore(items);
  const fulfillments = await validateFulfillmentOptions(
    userId,
    groups,
    input,
    now,
  );
  let paymentMethod;
  if (input.paymentOption === "GOODSPICK_PAY") {
    if (!input.paymentMethodId)
      throw failure(400, "PAYMENT_METHOD_REQUIRED", "굿즈픽페이 기본 계좌를 선택해 주세요.");
    paymentMethod = await resolvePaymentMethodSelection(userId, input.paymentMethodId);
    if (paymentMethod.method_type !== "BANK_ACCOUNT" || paymentMethod.is_default !== true)
      throw failure(400, "INVALID_PAYMENT_OPTION", "굿즈픽페이 기본 계좌를 확인해 주세요.");
    paymentMethod = {
      ...paymentMethod,
      provider_name: `굿즈픽페이 · ${paymentMethod.provider_name}`,
    };
  } else if (input.paymentOption) {
    if (input.paymentMethodId)
      throw failure(400, "INVALID_PAYMENT_OPTION", "결제수단을 다시 선택해 주세요.");
    paymentMethod = {
      id: null,
      method_type: input.paymentOption,
      provider_name: CHECKOUT_PAYMENT_OPTIONS[input.paymentOption],
      last4: null,
      is_default: false,
    };
  } else {
    paymentMethod = input.paymentMethodId
      ? await resolvePaymentMethodSelection(userId, input.paymentMethodId)
      : ((await listMyPaymentMethods(userId)).items.find((row) => row.is_default) ?? null);
  }
  const hasPreviousOrder = input.cartCouponId || input.storeOptions.some(
    (option) => option.userCouponId,
  )
    ? await couponRepository.hasPreviousOrder(userId)
    : false;
  const stockIssues = buildStockIssues(items, now);
  const orders = [];
  for (let index = 0; index < groups.length; index++) {
    const group = groups[index];
    const fulfillment = fulfillments[index];
    let coupon = null;
    if (fulfillment.option.userCouponId) {
      coupon = await couponRepository.findOwnedWithPolicy(
        userId,
        fulfillment.option.userCouponId,
      );
      if (!coupon)
        throw failure(
          404,
          "COUPON_NOT_FOUND",
          "본인 보유 쿠폰을 찾지 못했어요.",
        );
    }
    const amounts = calculateStoreQuote(
      group,
      fulfillment,
      coupon,
      userId,
      hasPreviousOrder,
      now,
    );
    const issues = [...fulfillment.issues];
    if (amounts.coupon && !amounts.coupon.usable)
      issues.push("COUPON_" + amounts.coupon.reason);
    orders.push({
      storeId: group.storeId,
      store: fulfillment.store,
      items: group.items.map((item) => ({
        storeProductId: item.storeProductId,
        productId: item.productId,
        productName: item.product.name,
        thumbnailUrl: item.product.thumbnail_url,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineAmount: item.lineAmount,
        stock: item.sale.stock,
        maxPerOrder: item.sale.max_per_order,
        cartItemIds: item.cartItemIds,
      })),
      fulfillmentType: fulfillment.option.fulfillmentType,
      pickup: fulfillment.pickup,
      delivery: fulfillment.delivery,
      address: fulfillment.address,
      orderRequests: serializeOrderRequests(
        fulfillment.option.storeRequest,
        fulfillment.option.deliveryRequest === undefined
          ? fulfillment.address?.delivery_request
          : fulfillment.option.deliveryRequest,
      ),
      issues,
      ...amounts,
    });
  }
  let cartCoupon = null;
  if (input.cartCouponId) {
    const owned = await couponRepository.findOwnedWithPolicy(userId, input.cartCouponId);
    if (!owned)
      throw failure(404, "COUPON_NOT_FOUND", "보유한 장바구니 쿠폰을 찾지 못했어요.");
    const fulfillmentTypes = new Set(orders.map((order) => order.fulfillmentType));
    const eligibility = orders.some((order) => order.totalAmount === null)
      ? { usable: false, reason: "QUOTE_NOT_READY", discountAmount: 0, discountScope: null }
      : owned.coupon.store_id !== null
        ? { usable: false, reason: "STORE_MISMATCH", discountAmount: 0, discountScope: null }
        : evaluateCouponEligibility(
          owned,
          {
            userId,
            storeId: null,
            itemsAmount: orders.reduce((sum, order) => sum + order.itemsAmount, 0),
            deliveryFee: orders.reduce((sum, order) => sum + (order.deliveryFee ?? 0), 0),
            fulfillmentType: fulfillmentTypes.size === 1 ? orders[0].fulfillmentType : "ALL",
            hasPreviousOrder,
          },
          now,
        );
    cartCoupon = {
      userCouponId: owned.id,
      couponId: owned.coupon_id,
      name: owned.coupon.name,
      ...eligibility,
    };
    if (!eligibility.usable) {
      orders[0].issues.push("CART_COUPON_" + eligibility.reason);
    } else {
      let remaining = eligibility.discountAmount;
      for (const order of orders) {
        const allocated = Math.min(remaining, order.totalAmount);
        order.cartCouponDiscountAmount = allocated;
        order.totalAmount -= allocated;
        remaining -= allocated;
      }
    }
  }
  orders.forEach((order) => {
    order.cartCouponDiscountAmount ??= 0;
  });
  const points = quotePoints((await getPointBalance(userId)).balance, orders, input);
  orders.forEach((row, index) => {
    const { used, earn } = points.allocations[index];
    row.pointsUsedAmount = used;
    row.pointsEarnAmount = earn;
    row.payAmount = row.totalAmount === null ? null : row.totalAmount - used;
  });
  const ready = orders.every(
    (row) => row.issues.length === 0 && row.totalAmount !== null,
  );
  const sum = (field) =>
    integer(
      orders.reduce((total, row) => total + row[field], 0),
      0,
      true,
    );
  const quote = {
    mode: input.mode,
    quotedAt: now.toISOString(),
    orders,
    stockIssues,
    paymentMethod,
    paymentOption: input.paymentOption,
    cartCoupon,
    issues: [...(paymentMethod ? [] : ["PAYMENT_METHOD_REQUIRED"]), ...points.issues],
    points: {
      balance: points.balance,
      minUse: points.minUse,
      earnRatePercent: points.earnRatePercent,
      expectedAmount: points.expectedAmount,
      pointsUse: points.pointsUse,
      expectedUse: points.expectedUse,
      earnAmount: points.earnAmount,
    },
    totals: {
      itemsAmount: sum("itemsAmount"),
      deliveryFee: orders.some((row) => row.deliveryFee === null)
        ? null
        : sum("deliveryFee"),
      discountAmount: sum("discountAmount") + sum("cartCouponDiscountAmount"),
      cartCouponDiscountAmount: sum("cartCouponDiscountAmount"),
      totalAmount: orders.some((row) => row.totalAmount === null)
        ? null
        : sum("totalAmount"),
      pointsUsedAmount: points.pointsUse + points.expectedUse,
      payAmount: orders.some((row) => row.payAmount === null) ? null : sum("payAmount"),
    },
    canSubmit:
      ready && stockIssues.length === 0 && paymentMethod !== null && points.issues.length === 0,
    serverPriceVerified: true,
    persisted: false,
  };
  return { ...quote, confirmationToken: checkoutQuoteToken(quote) };
}

export function checkoutQuoteToken(quote) {
  // Bind confirmation to server prices, quantities, store-specific discounts and final totals.
  return createHash('sha256').update(JSON.stringify({
    orders: quote.orders.map((order) => ({ storeId: order.storeId, fulfillmentType: order.fulfillmentType,
      items: order.items.map((item) => [item.storeProductId, item.quantity, item.unitPrice]),
      coupon: order.coupon?.userCouponId ?? null, discount: order.discountAmount,
      cartDiscount: order.cartCouponDiscountAmount, deliveryFee: order.deliveryFee, payAmount: order.payAmount })),
    totals: quote.totals,
  })).digest('hex');
}

export function validateSubmitInput(raw) {
  object(raw, [
    "mode",
    "items",
    "cartItemIds",
    "storeOptions",
    "addressId",
    "paymentMethodId",
    "paymentOption",
    "cartCouponId",
    "pointsUse",
    "useExpectedPoints",
    "paymentAgreed",
    "confirmationToken",
  ]);
  if (raw.paymentAgreed !== true)
    throw failure(
      400,
      "PAYMENT_AGREEMENT_REQUIRED",
      "주문 내용을 확인하고 시연 결제에 동의해 주세요.",
    );
  const input = { ...raw };
  delete input.paymentAgreed;
  delete input.confirmationToken;
  normalizeCheckoutInput(input);
  return input;
}
export function calculateCommission(
  itemsAmount,
  discountAmount,
  discountScope,
  rate,
) {
  integer(itemsAmount, 0, true);
  integer(discountAmount, 0, true);
  integer(rate, 0, true);
  if (rate > 100)
    throw failure(
      503,
      "INVALID_COMMISSION_POLICY",
      "수수료율을 확인해 주세요.",
    );
  const base = itemsAmount - (discountScope === "ITEMS" ? discountAmount : 0);
  if (base < 0)
    throw failure(
      503,
      "INVALID_COMMISSION_POLICY",
      "수수료 기준 금액을 확인해 주세요.",
    );
  return Math.floor((base * rate) / 100);
}
export function paymentMethodLabel(method) {
  const label =
    method.provider_name + (method.last4 ? " ****" + method.last4 : "");
  if (label.length > 50)
    throw failure(
      400,
      "PAYMENT_LABEL_TOO_LONG",
      "결제수단 표시명이 너무 길어요.",
    );
  return label;
}
export function shippingAddressSnapshot(address) {
  return [
    address.zip_code ? "(" + address.zip_code + ")" : null,
    address.road_address,
    address.detail_address,
  ]
    .filter(Boolean)
    .join(" ");
}
export async function submitCheckout(userId, raw, requestId = randomUUID()) {
  id(requestId);
  const input = validateSubmitInput(raw);
  const requestHash = createHash('sha256').update(JSON.stringify({ ...normalizeCheckoutInput(input), confirmationToken: raw.confirmationToken ?? null })).digest('hex');
  const db = await getDatabase();
  const prior = await db.from('orders').select('checkout_group_id,checkout_request_hash')
    .eq('user_id', userId).eq('checkout_request_id', requestId).limit(1).maybeSingle();
  if (prior.error) throw failure(503, 'DATABASE_ERROR', '주문 요청을 확인하지 못했어요.');
  if (prior.data) {
    if (prior.data.checkout_request_hash !== requestHash)
      throw failure(409, 'CHECKOUT_REQUEST_CHANGED', '같은 결제 요청의 내용이 변경됐어요.');
    return getCheckoutResult(userId, prior.data.checkout_group_id);
  }
  // 브라우저에서 보낸 금액·재고를 받지 않고 매번 실제 DB에서 다시 읽는다.
  let quote;
  try { quote = await previewCheckout(userId, input); }
  catch (error) {
    const replay = await findCheckoutRequest(userId, requestId);
    if (replay.status === 'COMPLETED') return replay.result;
    throw error;
  }
  const invalid = [...quote.orders.map((order) => order.coupon), quote.cartCoupon].find((coupon) => coupon && !coupon.usable && coupon.reason !== 'QUOTE_NOT_READY');
  if (invalid) {
    const messages = {
      EXPIRED: '선택한 쿠폰의 사용 기간이 종료되었습니다. 주문금액을 다시 확인해 주세요.',
      USED: '이미 사용한 쿠폰입니다. 주문금액을 다시 확인해 주세요.',
      MIN_ORDER_AMOUNT: '주문금액이 변경되어 쿠폰 적용 조건을 충족하지 않습니다.',
    };
    const error = failure(409, `COUPON_${invalid.reason}`, messages[invalid.reason] ?? '쿠폰 사용 조건이 변경되었습니다. 주문금액을 다시 확인해 주세요.');
    error.details = { userCouponId: invalid.userCouponId };
    const replay = await findCheckoutRequest(userId, requestId);
    if (replay.status === 'COMPLETED') return replay.result;
    throw error;
  }
  if (!raw.confirmationToken || raw.confirmationToken !== quote.confirmationToken)
    throw failure(409, 'CHECKOUT_QUOTE_CHANGED', '주문금액이 변경되었습니다. 주문금액을 다시 확인해 주세요.');
  if (!quote.canSubmit)
    throw failure(
      409,
      "CHECKOUT_NOT_READY",
      "재고·수령 조건·쿠폰·결제수단을 다시 확인해 주세요.",
    );
  const now = new Date().toISOString();
  const policies = [];
  for (const order of quote.orders) {
    const policy = await orderRepository.findCommissionPlan(order.storeId, now);
    if (!policy || !Number.isInteger(policy.commission_rate))
      throw failure(
        409,
        "COMMISSION_POLICY_MISSING",
        "매장 수수료 요금제 설정이 필요해요.",
      );
    policies.push({
      rate: policy.commission_rate,
      amount: calculateCommission(
        order.itemsAmount,
        order.discountAmount,
        order.coupon?.discountScope,
        policy.commission_rate,
      ),
    });
  }
  let groupId;
  try { groupId = await couponRpc('commit_coupon_checkout', {
    p_user_id: userId,
    p_request_id: requestId,
    p_hash: requestHash,
    p_group_id: randomUUID(),
    p_orders: quote.orders.map((order, index) => ({
      ...order,
      commissionRate: policies[index].rate,
      commissionAmount: policies[index].amount,
      shippingAddress: order.address ? shippingAddressSnapshot(order.address) : null,
    })),
    p_cart_coupon: quote.cartCoupon,
    p_method: { id: quote.paymentMethod.id ?? null, label: paymentMethodLabel(quote.paymentMethod) },
    p_cart_ids: normalizeCheckoutInput(input).cartItemIds,
    p_balance_use: normalizeCheckoutInput(input).pointsUse,
  }); } catch (error) {
    // A transport error can arrive after commit; never restore a coupon here.
    const replay = await findCheckoutRequest(userId, requestId);
    if (replay.status === 'COMPLETED') return replay.result;
    throw error;
  }
  return { ...(await getCheckoutResult(userId, groupId)), cartCleanupPending: false };
}

export async function findCheckoutRequest(userId, requestId) {
  id(requestId);
  const profile = await findByAuthId(userId);
  if (!profile || profile.status !== 'ACTIVE') throw failure(403, 'ACCOUNT_UNAVAILABLE', '현재 사용할 수 없는 계정이에요.');
  const db = await getDatabase();
  const { data, error } = await db.from('orders').select('checkout_group_id')
    .eq('user_id', userId).eq('checkout_request_id', requestId).limit(1).maybeSingle();
  if (error) throw failure(503, 'DATABASE_ERROR', '주문 처리 결과를 확인하지 못했습니다.');
  // No visible order is not proof that an earlier HTTP request failed.
  return data ? { status: 'COMPLETED', result: await getCheckoutResult(userId, data.checkout_group_id) } : { status: 'UNKNOWN' };
}

export async function getCheckoutResult(userId, checkoutGroupId) {
  id(checkoutGroupId);
  const profile = await findByAuthId(userId);
  if (!profile || profile.status !== "ACTIVE")
    throw failure(
      403,
      "ACCOUNT_UNAVAILABLE",
      "현재 사용할 수 없는 계정이에요.",
    );
  const rows = await orderRepository.listOwnedGroup(userId, checkoutGroupId);
  if (!rows.length)
    throw failure(404, "CHECKOUT_NOT_FOUND", "본인 주문 묶음을 찾지 못했어요.");
  const orders = [];
  for (const row of rows) {
    const payments = await paymentRepository.listOwnedOrderPayments(
      userId,
      row.id,
    );
    orders.push({
      ...row,
      storeName: (await orderRepository.findStore(row.store_id))?.name ?? null,
      items: await orderRepository.listItems(row.id),
      payments,
      processingComplete:
        row.status === "CANCELED" ||
        row.total_amount === 0 ||
        payments.some(
          (payment) =>
            payment.status === "PAID" &&
            payment.is_mock &&
            payment.amount === row.total_amount,
        ),
    });
  }
  return {
    checkoutGroupId,
    orders,
    totalAmount: orders.reduce((sum, row) => sum + row.total_amount, 0),
    paidAmount: orders.reduce(
      (sum, row) =>
        sum +
        row.payments
          .filter((payment) => payment.status === "PAID")
          .reduce((a, b) => a + b.amount, 0),
      0,
    ),
    persisted: true,
    demoOnly: true,
  };
}
