import * as repository from "../repositories/membership.repository.js";
import * as payments from "../repositories/payment.repository.js";
import { resolvePaymentMethodSelection } from "./paymentMethod.service.js";
import { paymentMethodLabel } from "./checkout.service.js";

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

export function calculateMembershipPeriod(startedAt) {
  if (typeof startedAt !== "string" || !Number.isFinite(Date.parse(startedAt)))
    throw failure(
      400,
      "INVALID_MEMBERSHIP_DATE",
      "구독 시작 시각을 확인해 주세요.",
    );
  const start = new Date(startedAt);
  const kst = new Date(start.getTime() + 9 * 3600000);
  const year = kst.getUTCFullYear(),
    month = kst.getUTCMonth(),
    day = kst.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const end =
    Date.UTC(
      year,
      month + 1,
      Math.min(day, lastDay),
      kst.getUTCHours(),
      kst.getUTCMinutes(),
      kst.getUTCSeconds(),
      kst.getUTCMilliseconds(),
    ) -
    9 * 3600000;
  return {
    startedAt: start.toISOString(),
    currentPeriodEnd: new Date(end).toISOString(),
  };
}
export function getMembershipEntitlements(membership, plan, now = new Date()) {
  const valid =
    !!membership &&
    ["ACTIVE", "CANCELED"].includes(membership.status) &&
    Number.isFinite(Date.parse(membership.started_at)) &&
    Date.parse(membership.started_at) <= now.getTime() &&
    Date.parse(membership.current_period_end) > now.getTime();
  return {
    active: valid,
    preorderEnabled:
      valid && plan.target === "CONSUMER" && plan.preorder_enabled,
    alertPriorityMinutes: valid ? plan.alert_priority_minutes : 0,
    benefits: valid ? plan.benefits : null,
  };
}
export async function listConsumerPlans(input = {}) {
  object(input, []);
  return { items: await repository.listActiveConsumerPlans(), demoOnly: true };
}
export async function getMyMembership(userId, input = {}) {
  object(input, []);
  await active(userId);
  const rows = (await repository.listOwned(userId)).filter(
    (row) => row.plan.target === "CONSUMER",
  );
  rows.sort((a, b) => b.started_at.localeCompare(a.started_at));
  const items = rows.map((row) => ({
    ...row,
    entitlements: getMembershipEntitlements(row, row.plan),
  }));
  return {
    membership: items.find((row) => row.entitlements.active) ?? null,
    items,
    demoOnly: true,
    automaticChargingImplemented: false,
  };
}
export function validateMembershipInput(input) {
  object(input, ["planCode", "paymentMethodId", "autoRenew", "paymentAgreed"]);
  if (input.paymentAgreed !== true)
    throw failure(
      400,
      "PAYMENT_AGREEMENT_REQUIRED",
      "시연 구독 결제에 동의해 주세요.",
    );
  if (input.autoRenew !== undefined && typeof input.autoRenew !== "boolean")
    throw failure(400, "INVALID_AUTO_RENEW", "자동 갱신 설정을 확인해 주세요.");
  return {
    planCode: text(input.planCode, 30),
    paymentMethodId: uuid(input.paymentMethodId),
    autoRenew: input.autoRenew ?? true,
  };
}
export async function subscribeMembership(userId, input) {
  const fields = validateMembershipInput(input);
  await active(userId);
  const plan = await repository.findActivePlanByCode(fields.planCode);
  if (!plan)
    throw failure(
      404,
      "PLAN_NOT_FOUND",
      "사용 가능한 소비자 요금제를 찾지 못했어요.",
    );
  if (
    !Number.isSafeInteger(plan.monthly_price) ||
    plan.monthly_price < 0 ||
    plan.monthly_price > 2147483647 ||
    !Number.isSafeInteger(plan.alert_priority_minutes) ||
    plan.alert_priority_minutes < 0
  )
    throw failure(
      503,
      "INVALID_MEMBERSHIP_POLICY",
      "요금제 금액·혜택 설정을 확인해 주세요.",
    );
  const now = new Date().toISOString();
  await repository.expireOwnedPastPeriods(userId, now);
  if ((await getMyMembership(userId)).membership)
    throw failure(
      409,
      "MEMBERSHIP_ALREADY_ACTIVE",
      "현재 사용 중인 소비자 구독이 있어요.",
    );
  const method = await resolvePaymentMethodSelection(
    userId,
    fields.paymentMethodId,
  );
  const period = calculateMembershipPeriod(now);
  const payment = await payments.createMockPayment(userId, {
    purpose: "MEMBERSHIP",
    order_id: null,
    payment_method_id: method.id,
    method_label: paymentMethodLabel(method),
    amount: plan.monthly_price,
  });
  let membership;
  try {
    membership = await repository.subscribe(
      userId,
      plan.code,
      period.startedAt,
      period.currentPeriodEnd,
      fields.autoRenew,
    );
  } catch (error) {
    try {
      await payments.cancelMockPayment(userId, payment.id);
    } catch {
      throw failure(
        503,
        "MEMBERSHIP_RECOVERY_REQUIRED",
        "구독 저장 실패 후 시연 결제 기록 확인이 필요해요.",
      );
    }
    throw error;
  }
  return {
    membership: {
      ...membership,
      plan,
      entitlements: getMembershipEntitlements(membership, plan),
    },
    payment,
    demoOnly: true,
    automaticChargingImplemented: false,
    benefitCouponStatus: "POLICY_NOT_CONFIGURED",
  };
}
export async function scheduleMembershipCancellation(userId, input = {}) {
  object(input, []);
  const current = (await getMyMembership(userId)).membership;
  if (!current)
    throw failure(409, "NO_ACTIVE_MEMBERSHIP", "사용 중인 구독이 없어요.");
  if (!current.auto_renew)
    return { membership: current, alreadyScheduled: true };
  const row = await repository.scheduleCancellationOwned(
    userId,
    current.id,
    new Date().toISOString(),
  );
  if (!row) throw failure(409, "MEMBERSHIP_CHANGED", "구독 상태가 변경됐어요.");
  return {
    membership: {
      ...row,
      plan: current.plan,
      entitlements: getMembershipEntitlements(row, current.plan),
    },
    alreadyScheduled: false,
  };
}
