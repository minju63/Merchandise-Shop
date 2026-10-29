// 담당: 동균
// 사전예약 서비스 — 비즈니스 로직, DB 접근은 repositories/ 를 통해서만
// 사전예약은 재고를 잡지 않는다. 입고 후 순번(priority)대로 배분한다.
// 예약금은 모의 결제다. 신청 시점의 단가·예약금·잔액을 고정 저장해 이후 가격이 바뀌어도 정산 기준이 흔들리지 않게 한다.
import * as preorderRepository from '../repositories/preorder.repository.js';
import * as storeProductRepository from '../repositories/storeProduct.repository.js';
import * as membershipRepository from '../repositories/membership.repository.js';

const DEPOSIT_RATE = 20;
// 사전예약 권한이 있는 소비자 요금제 (membership_plans.code)
const PREORDER_PLAN_CODE = 'CONSUMER_PLUS';

function notFound(message) {
  throw Object.assign(new Error(message), { status: 404, code: 'NOT_FOUND' });
}

function failure(status, code, message) {
  throw Object.assign(new Error(message), { status, code });
}

// 프론트가 보낸 구독 여부는 믿지 않고 user_memberships 를 직접 확인한다.
async function hasPreorderSubscription(userId) {
  const now = Date.now();
  return (await membershipRepository.listOwned(userId)).some(
    (membership) =>
      membership.status === 'ACTIVE' &&
      Date.parse(membership.current_period_end) > now &&
      membership.plan_code === PREORDER_PLAN_CODE,
  );
}

async function findPreorderable(storeProductId) {
  const storeProduct = await storeProductRepository.findById(storeProductId);
  if (!storeProduct) notFound('판매상품을 찾을 수 없습니다.');
  return storeProduct;
}

function checkPreorderable(storeProduct) {
  if (storeProduct.preorder_available !== true)
    failure(409, 'PREORDER_NOT_ALLOWED', '사전예약을 받지 않는 상품입니다.');
  if (storeProduct.status === 'ON_SALE' && storeProduct.stock > 0)
    failure(409, 'ALREADY_IN_STOCK', '지금 구매할 수 있는 상품입니다.');
}

function capQuantity(quantity, maxPerOrder) {
  if (maxPerOrder > 0 && quantity > maxPerOrder) return { quantity: maxPerOrder, capped: true };
  return { quantity, capped: false };
}

function amounts(storeProduct, quantity) {
  const price = storeProduct.price ?? 0;
  const discountRate = storeProduct.discount_rate ?? 0;
  const unitPrice = Math.round((price * (100 - discountRate)) / 100);
  const totalAmount = unitPrice * quantity;
  const depositAmount = Math.round((totalAmount * DEPOSIT_RATE) / 100);
  return { unitPrice, totalAmount, depositAmount, balanceAmount: totalAmount - depositAmount };
}

// 구독 여부와 관계없이 견적은 보여준다. 구독하지 않았으면 isSubscribed: false
export async function getPreorderQuote({ userId, storeProductId, quantity }) {
  const storeProduct = await findPreorderable(storeProductId);
  checkPreorderable(storeProduct);
  const capped = capQuantity(quantity, storeProduct.max_per_order);
  const [expectedPriority, isSubscribed, existing] = await Promise.all([
    preorderRepository.nextPriority(storeProductId),
    hasPreorderSubscription(userId),
    preorderRepository.findActive({ userId, storeProductId }),
  ]);
  return {
    storeProductId,
    productName: storeProduct.product.name,
    storeName: storeProduct.store.name,
    thumbnailUrl: storeProduct.product.thumbnail_url,
    ...amounts(storeProduct, capped.quantity),
    quantity: capped.quantity,
    maxPerOrder: storeProduct.max_per_order ?? null,
    restockExpectedAt: storeProduct.restock_expected_at,
    expectedPriority,
    isSubscribed,
    alreadyPreordered: Boolean(existing),
  };
}

export async function createPreorder({ userId, storeProductId, quantity }) {
  const storeProduct = await findPreorderable(storeProductId);
  if (!(await hasPreorderSubscription(userId)))
    failure(403, 'SUBSCRIPTION_REQUIRED', '사전예약은 굿즈 패스 플러스 회원 전용입니다.');
  checkPreorderable(storeProduct);
  if (await preorderRepository.findActive({ userId, storeProductId }))
    failure(409, 'ALREADY_PREORDERED', '이미 사전예약한 상품입니다.');

  const capped = capQuantity(quantity, storeProduct.max_per_order);
  const { unitPrice, depositAmount, balanceAmount } = amounts(storeProduct, capped.quantity);
  const saved = await preorderRepository.insert({
    userId,
    storeProductId,
    quantity: capped.quantity,
    unitPrice,
    depositRate: DEPOSIT_RATE,
    depositAmount,
    balanceAmount,
    priority: await preorderRepository.nextPriority(storeProductId),
  });
  return {
    preorderId: saved.id,
    priority: saved.priority,
    depositAmount: saved.deposit_amount,
    balanceAmount: saved.balance_amount,
    capped: capped.capped,
  };
}

export async function getPreorders({ userId, page, size }) {
  const { rows, totalCount } = await preorderRepository.findPageByUser({ userId, page, size });
  const items = rows.map((row) => ({
    preorderId: row.id,
    storeProductId: row.store_product.id,
    productName: row.store_product.product.name,
    thumbnailUrl: row.store_product.product.thumbnail_url,
    storeName: row.store_product.store.name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    depositAmount: row.deposit_amount,
    balanceAmount: row.balance_amount,
    status: row.status,
    priority: row.priority,
    restockExpectedAt: row.store_product.restock_expected_at,
    createdAt: row.created_at,
  }));
  return { items, page, size, totalCount };
}

// 멱등: 이미 취소된 예약도 성공. 예약금 환불은 모의 처리라 상태만 바꾼다.
export async function cancelPreorder({ userId, preorderId }) {
  const preorder = await preorderRepository.findById({ userId, preorderId });
  if (!preorder) notFound('사전예약을 찾을 수 없습니다.');
  if (preorder.status === 'EXPIRED')
    failure(409, 'PREORDER_NOT_CANCELABLE', '이미 만료된 사전예약입니다.');
  await preorderRepository.cancel({ userId, preorderId });
  return { preorderId, cancelled: true };
}
