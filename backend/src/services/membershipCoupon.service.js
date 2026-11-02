import * as gradeRepository from "../repositories/grade.repository.js";
import * as couponRepository from "../repositories/coupon.repository.js";
import { couponPackMonth, describeCouponPackItem } from "./grade.service.js";
import { getMyMembership } from "./membership.service.js";

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// 유료 멤버십 쿠폰팩: 이용 중인 플랜에 따라 매달 1번 받는다. 등급 쿠폰팩과는 따로 받는다.
const fixed = (value, minOrder) => ({ type: "FIXED", value, minOrder });
const rate = (value, maxDiscount) => ({ type: "RATE", value, maxDiscount, minOrder: 20000 });
const delivery = () => ({ type: "DELIVERY", value: 3000, minOrder: 0 });

export const MEMBERSHIP_COUPON_PACKS = {
  CONSUMER_BASIC: [fixed(2000, 20000)],
  CONSUMER_PLUS: [fixed(3000, 20000), rate(10, 5000), delivery()],
};

function couponName(plan, item) {
  if (item.type === "DELIVERY") return `${plan.name} 멤버십 배송비 무료 쿠폰`;
  if (item.type === "RATE") return `${plan.name} 멤버십 ${item.value}% 할인 쿠폰`;
  return `${plan.name} 멤버십 ${item.value.toLocaleString("ko-KR")}원 할인 쿠폰`;
}

// 쿠폰 코드 문법은 등급 쿠폰과 같다: 배송비 쿠폰은 DELIVERY_ 접두어가 있어야 배송비에 적용된다.
export function membershipCouponPolicies(plan, month) {
  return (MEMBERSHIP_COUPON_PACKS[plan.code] ?? []).map((item, index) => ({
    // 쿠폰 코드는 30자 이내라 플랜 코드의 CONSUMER_ 는 뺀다 (예: DELIVERY_MB_PLUS_2611_3)
    code: `${item.type === "DELIVERY" ? "DELIVERY_" : ""}MB_${plan.code.replace(/^CONSUMER_/, "")}_${month.key}_${index + 1}`,
    name: couponName(plan, item),
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

async function packClaimed(userId, policies) {
  for (const policy of policies) {
    const coupon = await couponRepository.findByCode(policy.code);
    if (!coupon) return false;
    if (!(await couponRepository.findOwnedByCouponId(userId, coupon.id))) return false;
  }
  return true;
}

async function activePlan(userId) {
  const { membership } = await getMyMembership(userId);
  return membership?.plan ?? null;
}

// 이번 달 멤버십 쿠폰팩 (멤버십이 없으면 available=false)
export async function getMyMembershipCouponPack(userId, now = new Date()) {
  const plan = await activePlan(userId);
  const month = couponPackMonth(now);
  const items = plan ? MEMBERSHIP_COUPON_PACKS[plan.code] ?? [] : [];
  return {
    available: items.length > 0,
    plan: plan ? { code: plan.code, name: plan.name } : null,
    month: month.label,
    validUntil: month.validUntil,
    items: items.map((item) => ({ type: item.type, label: describeCouponPackItem(item), minOrder: item.minOrder })),
    claimed: items.length ? await packClaimed(userId, membershipCouponPolicies(plan, month)) : false,
  };
}

// 이번 달 멤버십 쿠폰팩 받기. 이미 받은 쿠폰은 다시 주지 않는다(user_coupons UNIQUE).
export async function claimMembershipCouponPack(userId, now = new Date()) {
  const plan = await activePlan(userId);
  if (!plan || !MEMBERSHIP_COUPON_PACKS[plan.code])
    throw failure(403, "MEMBERSHIP_REQUIRED", "멤버십을 이용 중일 때 받을 수 있어요.");
  const month = couponPackMonth(now);
  const issued = [];
  for (const policy of membershipCouponPolicies(plan, month)) {
    await gradeRepository.ensureCouponPolicy(policy);
    const coupon = await couponRepository.findByCode(policy.code);
    if (!coupon)
      throw failure(503, "COUPON_POLICY_MISSING", "멤버십 쿠폰을 준비하지 못했어요.");
    const result = await couponRepository.registerCode(userId, coupon, now.toISOString());
    issued.push({ name: policy.name, alreadyOwned: result.alreadyOwned });
  }
  return {
    plan: { code: plan.code, name: plan.name },
    month: month.label,
    issuedCount: issued.filter((item) => !item.alreadyOwned).length,
    items: issued,
  };
}
