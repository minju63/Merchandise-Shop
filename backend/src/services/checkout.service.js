import { randomUUID, randomInt } from "node:crypto";
import * as orderRepository from "../repositories/order.repository.js";
import * as paymentRepository from "../repositories/payment.repository.js";
import { getCancellationRestoreDecision } from "./coupon.service.js";
import { findByAuthId } from "../repositories/user.repository.js";
import { resolveAddressSelection, listMyAddresses } from "./address.service.js";
import {
  resolvePaymentMethodSelection,
  listMyPaymentMethods,
} from "./paymentMethod.service.js";
import * as couponRepository from "../repositories/coupon.repository.js";
import { evaluateCouponEligibility } from "./coupon.service.js";

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
  };
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
  validateCouponAssignments(result.storeOptions);
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
function regionChain(regionId, map) {
  const chain = [];
  const seen = new Set();
  let current = regionId;
  while (current) {
    const region = map.get(current);
    if (!region || seen.has(current))
      throw failure(
        503,
        "INVALID_DELIVERY_POLICY",
        "배송지역 연결 설정을 확인할 수 없어요.",
      );
    seen.add(current);
    chain.unshift(region);
    current = region.parent_id;
  }
  return chain;
}
export function matchDeliveryArea(address, areas, regions) {
  if (!areas.length) return { issue: "DELIVERY_AREAS_MISSING", area: null };
  const map = new Map(regions.map((row) => [row.id, row]));
  const road = address.road_address.trim().normalize("NFC");
  const matches = [];
  for (const area of areas) {
    const chain = regionChain(area.region_id, map);
    if (chain.some((row) => !row.is_active)) continue;
    let rest = road;
    let matched = true;
    for (const region of chain) {
      const names = [region.name, ...(region.aliases ?? [])];
      if (names.some((name) => typeof name !== "string" || !name.trim()))
        throw failure(
          503,
          "INVALID_DELIVERY_POLICY",
          "배송지역 이름을 확인할 수 없어요.",
        );
      const prefix = names
        .map((name) => name.trim().normalize("NFC"))
        .filter((name) => rest === name || rest.startsWith(name + " "))
        .sort((a, b) => b.length - a.length)[0];
      if (!prefix) {
        matched = false;
        break;
      }
      rest = rest.slice(prefix.length).trim();
    }
    if (matched)
      matches.push({
        ...area,
        depth: chain.length,
        extra_fee: integer(area.extra_fee, 0, true),
      });
  }
  if (!matches.length)
    return { issue: "DELIVERY_AREA_NOT_MATCHED", area: null };
  matches.sort((a, b) => b.depth - a.depth);
  if (
    matches[1]?.depth === matches[0].depth &&
    matches[1].extra_fee !== matches[0].extra_fee
  )
    throw failure(
      503,
      "AMBIGUOUS_DELIVERY_AREA",
      "배송지역 추가 요금을 확정할 수 없어요.",
    );
  return { issue: null, area: matches[0] };
}
export function calculateDeliveryFee(itemsAmount, policy, area) {
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
    deliveryFee: integer(base + integer(area.extra_fee, 0, true), 0, true),
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
  const areas = deliveryGroups.length
    ? await readAll("store_delivery_areas", "id,store_id,region_id,extra_fee", [
        ["in", "store_id", deliveryGroups.map((row) => row.storeId)],
      ])
    : [];
  const regions =
    deliveryGroups.length && areas.length
      ? await readAll("regions", "id,parent_id,name,aliases,is_active")
      : [];
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
      if (result.issue) issues.push(result.issue);
      pickup = result.pickup;
    } else if (option.fulfillmentType === "DELIVERY") {
      const policy = deliveries.find((row) => row.store_id === store.id);
      if (!address) issues.push("ADDRESS_REQUIRED");
      if (!policy) issues.push("DELIVERY_POLICY_MISSING");
      if (address && policy) {
        integer(policy.estimated_days, 0, true);
        const area = matchDeliveryArea(
          address,
          areas.filter((row) => row.store_id === store.id),
          regions,
        );
        if (area.issue) issues.push(area.issue);
        else {
          const result = calculateDeliveryFee(
            group.itemsAmount,
            policy,
            area.area,
          );
          if (result.issue) issues.push(result.issue);
          deliveryFee = result.deliveryFee;
          delivery = {
            regionId: area.area.region_id,
            extraFee: area.area.extra_fee,
            estimatedDays: policy.estimated_days,
            courierName: policy.courier_name,
            guideText: policy.guide_text,
          };
        }
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
              itemsAmount: group.itemsAmount,
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
    itemsAmount: group.itemsAmount,
    deliveryFee: fulfillment.deliveryFee,
    discountAmount,
    totalAmount,
    coupon,
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
  const paymentMethod = input.paymentMethodId
    ? await resolvePaymentMethodSelection(userId, input.paymentMethodId)
    : ((await listMyPaymentMethods(userId)).items.find(
        (row) => row.is_default,
      ) ?? null);
  const hasPreviousOrder = input.storeOptions.some(
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
  const ready = orders.every(
    (row) => row.issues.length === 0 && row.totalAmount !== null,
  );
  const sum = (field) =>
    integer(
      orders.reduce((total, row) => total + row[field], 0),
      0,
      true,
    );
  return {
    mode: input.mode,
    quotedAt: now.toISOString(),
    orders,
    stockIssues,
    paymentMethod,
    issues: paymentMethod ? [] : ["PAYMENT_METHOD_REQUIRED"],
    totals: {
      itemsAmount: sum("itemsAmount"),
      deliveryFee: orders.some((row) => row.deliveryFee === null)
        ? null
        : sum("deliveryFee"),
      discountAmount: sum("discountAmount"),
      totalAmount: orders.some((row) => row.totalAmount === null)
        ? null
        : sum("totalAmount"),
    },
    canSubmit: ready && stockIssues.length === 0 && paymentMethod !== null,
    serverPriceVerified: true,
    persisted: false,
  };
}

export function validateSubmitInput(raw) {
  object(raw, [
    "mode",
    "items",
    "cartItemIds",
    "storeOptions",
    "addressId",
    "paymentMethodId",
    "paymentAgreed",
  ]);
  if (raw.paymentAgreed !== true)
    throw failure(
      400,
      "PAYMENT_AGREEMENT_REQUIRED",
      "주문 내용을 확인하고 시연 결제에 동의해 주세요.",
    );
  const input = { ...raw };
  delete input.paymentAgreed;
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
export async function submitCheckout(userId, raw) {
  const input = validateSubmitInput(raw);
  // 브라우저에서 보낸 금액·재고를 받지 않고 매번 실제 DB에서 다시 읽는다.
  const quote = await previewCheckout(userId, input);
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
  const methodLabel = paymentMethodLabel(quote.paymentMethod);
  const groupId = randomUUID();
  const saved = [];
  const consumed = [];
  const stockChanges = [];
  try {
    for (let index = 0; index < quote.orders.length; index++) {
      const order = quote.orders[index];
      const policy = policies[index];
      const row = await orderRepository.createOrder(userId, {
        order_no:
          now.slice(0, 10).replaceAll("-", "") +
          "-" +
          randomUUID().replaceAll("-", "").slice(0, 20),
        store_id: order.storeId,
        checkout_group_id: groupId,
        fulfillment_type: order.fulfillmentType,
        status: "PAID",
        items_amount: order.itemsAmount,
        delivery_fee: order.deliveryFee,
        discount_amount: order.discountAmount,
        total_amount: order.totalAmount,
        commission_rate: policy.rate,
        commission_amount: policy.amount,
        used_coupon_id: order.coupon?.userCouponId ?? null,
        recipient_name: order.address?.recipient_name ?? null,
        recipient_phone: order.address?.recipient_phone ?? null,
        shipping_address: order.address
          ? shippingAddressSnapshot(order.address)
          : null,
        delivery_request: order.orderRequests,
        pickup_code:
          order.fulfillmentType === "PICKUP"
            ? String(randomInt(100000, 1000000))
            : null,
        pickup_deadline: order.pickup?.deadline ?? null,
      });
      saved.push(row);
      const snapshots = [];
      for (const item of order.items) {
        const sale = await orderRepository.findSale(item.storeProductId);
        if (
          !sale ||
          sale.price !== item.unitPrice ||
          sale.store_id !== row.store_id ||
          sale.status !== "ON_SALE"
        )
          throw failure(409, "SALE_CHANGED", "상품 판매 조건이 변경됐어요.");
        snapshots.push({
          store_product_id: item.storeProductId,
          product_name: item.productName,
          product_image_url: item.thumbnailUrl,
          condition_grade: sale.condition_grade,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.lineAmount,
        });
      }
      await orderRepository.createItems(row.id, snapshots);
      await orderRepository.appendStatusHistory(
        row.id,
        null,
        "PAID",
        userId,
        "시연 결제",
      );
      for (const item of order.items) {
        await orderRepository.adjustStock(
          userId,
          row.id,
          item.storeProductId,
          -item.quantity,
          "ORDER",
        );
        stockChanges.push({ orderId: row.id, item });
      }
      if (order.coupon) {
        await couponRepository.markOwnedUsed(userId, order.coupon.userCouponId);
        consumed.push(order.coupon.userCouponId);
      }
      await paymentRepository.createMockPayment(userId, {
        purpose: "ORDER",
        order_id: row.id,
        payment_method_id: quote.paymentMethod.id,
        method_label: methodLabel,
        amount: row.total_amount,
      });
    }
  } catch (error) {
    const recovery = [];
    for (const change of stockChanges.reverse())
      try {
        await orderRepository.adjustStock(
          userId,
          change.orderId,
          change.item.storeProductId,
          change.item.quantity,
          "ORDER_CANCEL",
        );
      } catch {
        recovery.push("STOCK");
      }
    for (const couponId of consumed)
      try {
        const owned = await couponRepository.findOwnedWithPolicy(
          userId,
          couponId,
        );
        const decision = getCancellationRestoreDecision(owned, owned.coupon);
        await couponRepository.restoreOwnedCoupon(
          userId,
          couponId,
          decision.status,
        );
      } catch {
        recovery.push("COUPON");
      }
    for (const row of saved) {
      try {
        await paymentRepository.cancelMockOrderPayments(userId, row.id);
        await orderRepository.cancelOwnedPaid(
          userId,
          row.id,
          "시연 결제 처리 실패",
        );
      } catch {
        recovery.push("ORDER");
      }
    }
    if (recovery.length)
      throw failure(
        503,
        "CHECKOUT_RECOVERY_REQUIRED",
        "주문 처리 실패 후 일부 DB 기록의 복구 확인이 필요해요.",
      );
    throw error;
  }
  // 저장 완료 후에만 선택한 장바구니 항목을 정리한다. 실패해도 결제를 다시 만들지 않는다.
  let cartCleanupPending = false;
  if (input.mode === "CART")
    try {
      await orderRepository.removeSelectedCart(
        userId,
        normalizeCheckoutInput(input).cartItemIds,
      );
    } catch {
      cartCleanupPending = true;
    }
  return { ...(await getCheckoutResult(userId, groupId)), cartCleanupPending };
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
