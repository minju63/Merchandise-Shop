import * as repository from "../repositories/grade.repository.js";
import * as couponRepository from "../repositories/coupon.repository.js";
import { findByAuthId } from "../repositories/user.repository.js";

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// 최근 6개월 구매 확정 금액으로 등급을 정한다. 할인율·적립율은 %, 쿠폰팩은 매달 1번 받는다.
export const GRADE_PERIOD_MONTHS = 6;

const fixed = (value, minOrder) => ({ type: "FIXED", value, minOrder });
const rate = (value, maxDiscount) => ({ type: "RATE", value, maxDiscount, minOrder: 20000 });
const delivery = () => ({ type: "DELIVERY", value: 3000, minOrder: 0 });

export const GRADES = [
  { code: "WELCOME", name: "웰컴", minAmount: 0, discountRate: 0, earnRate: 1, couponPack: [fixed(1000, 10000)] },
  { code: "FRIENDS", name: "프렌즈", minAmount: 50000, discountRate: 1, earnRate: 1, couponPack: [fixed(2000, 20000)] },
  { code: "FAMILY", name: "패밀리", minAmount: 150000, discountRate: 1, earnRate: 2, couponPack: [fixed(2000, 20000), fixed(2000, 20000)] },
  { code: "BRONZE", name: "브론즈", minAmount: 300000, discountRate: 2, earnRate: 2, couponPack: [rate(5, 5000), delivery()] },
  { code: "SILVER", name: "실버", minAmount: 500000, discountRate: 3, earnRate: 3, couponPack: [rate(5, 5000), rate(5, 5000), delivery()] },
  { code: "GOLD", name: "골드", minAmount: 1000000, discountRate: 4, earnRate: 4, couponPack: [rate(10, 10000), rate(5, 5000), rate(5, 5000), delivery(), delivery()] },
  { code: "PLATINUM", name: "플래티넘", minAmount: 2000000, discountRate: 5, earnRate: 5, couponPack: [rate(10, 10000), rate(10, 10000), rate(5, 5000), rate(5, 5000), delivery(), delivery()] },
];

export function resolveGrade(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw failure(503, "INVALID_GRADE_AMOUNT", "등급 기준 금액을 확인할 수 없어요.");
  const index = GRADES.findLastIndex((grade) => amount >= grade.minAmount);
  const next = GRADES[index + 1] ?? null;
  return {
    grade: GRADES[index],
    nextGrade: next,
    amount,
    remainingToNext: next ? next.minAmount - amount : 0,
  };
}

// 등급 할인은 상품 금액 기준이고, 쿠폰 할인 뒤 남은 결제 금액을 넘지 않는다.
export function calculateGradeDiscount(itemsAmount, discountRate, payableBefore = itemsAmount) {
  const amount = Math.floor((itemsAmount * discountRate) / 100);
  return Math.max(0, Math.min(amount, payableBefore));
}

export function gradePeriodStart(now = new Date()) {
  const start = new Date(now);
  start.setMonth(start.getMonth() - GRADE_PERIOD_MONTHS);
  return start.toISOString();
}

export async function getUserGrade(userId, now = new Date()) {
  return resolveGrade(await repository.sumCompletedOrderAmount(userId, gradePeriodStart(now)));
}

// 한국 시간 기준 이번 달 (쿠폰 유효기간 = 이번 달 말일까지)
export function couponPackMonth(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth();
  return {
    key: `${String(year).slice(2)}${String(month + 1).padStart(2, "0")}`,
    label: `${year}년 ${month + 1}월`,
    validFrom: new Date(Date.UTC(year, month, 1) - 9 * 3600000).toISOString(),
    validUntil: new Date(Date.UTC(year, month + 1, 1) - 9 * 3600000 - 1000).toISOString(),
  };
}

function couponName(grade, item) {
  if (item.type === "DELIVERY") return `${grade.name} 등급 배송비 무료 쿠폰`;
  if (item.type === "RATE") return `${grade.name} 등급 ${item.value}% 할인 쿠폰`;
  return `${grade.name} 등급 ${item.value.toLocaleString("ko-KR")}원 할인 쿠폰`;
}

// 쿠폰 코드 문법: 배송비 쿠폰은 DELIVERY_ 접두어가 있어야 배송비에 적용된다.
export function couponPackPolicies(grade, month) {
  return grade.couponPack.map((item, index) => ({
    code: `${item.type === "DELIVERY" ? "DELIVERY_" : ""}GR_${grade.code}_${month.key}_${index + 1}`,
    name: couponName(grade, item),
    discount_type: item.type === "RATE" ? "RATE" : "FIXED",
    discount_value: item.value,
    max_discount: item.type === "RATE" ? item.maxDiscount : null,
    min_order_amount: item.minOrder,
    applies_to: item.type === "DELIVERY" ? "DELIVERY" : "ALL",
    store_id: null,
    total_quantity: null,
    valid_from: month.validFrom,
    valid_until: month.validUntil,
  }));
}

export function describeCouponPackItem(item) {
  if (item.type === "DELIVERY") return "배송비 무료 (최대 3,000원)";
  if (item.type === "RATE")
    return `${item.value}% 할인 (최대 ${item.maxDiscount.toLocaleString("ko-KR")}원)`;
  return `${item.value.toLocaleString("ko-KR")}원 할인`;
}

function describeGrade(grade) {
  return {
    code: grade.code,
    name: grade.name,
    minAmount: grade.minAmount,
    discountRate: grade.discountRate,
    earnRate: grade.earnRate,
    couponPack: grade.couponPack.map((item) => ({
      type: item.type,
      label: describeCouponPackItem(item),
      minOrder: item.minOrder,
    })),
  };
}

async function requireActiveProfile(userId) {
  const profile = await findByAuthId(userId);
  if (!profile || profile.status !== "ACTIVE")
    throw failure(403, "ACCOUNT_UNAVAILABLE", "사용할 수 없는 계정이에요.");
  return profile;
}

async function packClaimed(userId, policies) {
  for (const policy of policies) {
    const coupon = await couponRepository.findByCode(policy.code);
    if (!coupon) return false;
    if (!(await couponRepository.findOwnedByCouponId(userId, coupon.id))) return false;
  }
  return true;
}

export async function getMyGrade(userId, now = new Date()) {
  await requireActiveProfile(userId);
  const current = await getUserGrade(userId, now);
  const month = couponPackMonth(now);
  return {
    grade: describeGrade(current.grade),
    nextGrade: current.nextGrade ? describeGrade(current.nextGrade) : null,
    amount: current.amount,
    remainingToNext: current.remainingToNext,
    periodMonths: GRADE_PERIOD_MONTHS,
    couponPack: {
      month: month.label,
      validUntil: month.validUntil,
      claimed: await packClaimed(userId, couponPackPolicies(current.grade, month)),
    },
    grades: GRADES.map(describeGrade),
  };
}

// 이번 달 등급 쿠폰팩 받기. 이미 받은 쿠폰은 다시 주지 않는다(user_coupons UNIQUE).
export async function claimCouponPack(userId, now = new Date()) {
  await requireActiveProfile(userId);
  const { grade } = await getUserGrade(userId, now);
  const month = couponPackMonth(now);
  const issued = [];
  for (const policy of couponPackPolicies(grade, month)) {
    await repository.ensureCouponPolicy(policy);
    const coupon = await couponRepository.findByCode(policy.code);
    if (!coupon)
      throw failure(503, "COUPON_POLICY_MISSING", "등급 쿠폰을 준비하지 못했어요.");
    const result = await couponRepository.registerCode(userId, coupon, now.toISOString());
    issued.push({ name: policy.name, alreadyOwned: result.alreadyOwned });
  }
  return {
    grade: { code: grade.code, name: grade.name },
    month: month.label,
    issuedCount: issued.filter((item) => !item.alreadyOwned).length,
    items: issued,
  };
}
