// 담당: 동균
// 장바구니 서비스 — 비즈니스 로직, DB 접근은 repositories/ 를 통해서만
// 장바구니는 재고를 잡지 않는다. 재고 차감은 결제(checkout)에서만 일어난다.
import * as cartItemRepository from '../repositories/cartItem.repository.js';
import * as storeProductRepository from '../repositories/storeProduct.repository.js';
import * as storeDeliveryInfoRepository from '../repositories/storeDeliveryInfo.repository.js';
import { calculateStockLabel } from './wishlist.service.js';

const CLOSED_STORE_STATUSES = ['CLOSED', 'SUSPENDED', 'DELETED'];

function notFound(message) {
  throw Object.assign(new Error(message), { status: 404, code: 'NOT_FOUND' });
}

function conflict(code, message) {
  throw Object.assign(new Error(message), { status: 409, code });
}

const reasonMessages = {
  STORE_CLOSED: '운영하지 않는 굿즈샵의 상품입니다.',
  FULFILLMENT_OFF: '선택한 수령 방법을 지원하지 않는 상품입니다.',
  UPCOMING: '아직 입고 전인 상품입니다.',
  NOT_ON_SALE: '판매 중인 상품이 아닙니다.',
  OUT_OF_STOCK: '품절된 상품입니다.',
};

function supportsFulfillment(storeProduct, store, fulfillmentType) {
  return fulfillmentType === 'PICKUP'
    ? storeProduct.pickup_available === true && store.pickup_available === true
    : storeProduct.delivery_available === true && store.delivery_available === true;
}

// 담기 가능 여부. 불가면 사유 코드, 가능하면 null
// 판정 순서가 곧 우선순위다. 입고 예정 상품은 재고가 0이어도 UPCOMING 으로 안내해야
// 프론트가 재입고 알림 대신 사전예약을 띄울 수 있다.
export function validateAddable(storeProduct, store, fulfillmentType) {
  if (CLOSED_STORE_STATUSES.includes(store.status)) return 'STORE_CLOSED';
  if (!supportsFulfillment(storeProduct, store, fulfillmentType)) return 'FULFILLMENT_OFF';
  if (storeProduct.status === 'UPCOMING') return 'UPCOMING';
  if (storeProduct.status !== 'ON_SALE') return 'NOT_ON_SALE';
  if (!(storeProduct.stock > 0)) return 'OUT_OF_STOCK';
  return null;
}

// 장바구니에 담긴 수량까지 포함한 주문 가능 여부
function unavailableReason(storeProduct, store, fulfillmentType, quantity) {
  return (
    validateAddable(storeProduct, store, fulfillmentType) ??
    (storeProduct.stock < quantity ? 'NOT_ENOUGH_STOCK' : null)
  );
}

function capQuantity(quantity, maxPerOrder) {
  if (maxPerOrder > 0 && quantity > maxPerOrder) return { quantity: maxPerOrder, capped: true };
  return { quantity, capped: false };
}

function toCartItem(row, fulfillmentType) {
  const storeProduct = row.store_product;
  const { product, store } = storeProduct;
  const price = storeProduct.price ?? 0;
  const discountRate = storeProduct.discount_rate ?? 0;
  const reason = unavailableReason(storeProduct, store, fulfillmentType, row.quantity);
  return {
    cartItemId: row.id,
    storeProductId: storeProduct.id,
    productId: product.id,
    productName: product.name,
    workTitle: product.work_title,
    thumbnailUrl: product.thumbnail_url,
    price,
    discountRate,
    finalPrice: Math.round((price * (100 - discountRate)) / 100),
    quantity: row.quantity,
    isSelected: row.is_selected === true && !reason,
    stock: storeProduct.stock,
    stockLabel: calculateStockLabel(storeProduct),
    maxPerOrder: storeProduct.max_per_order ?? null,
    available: !reason,
    unavailableReason: reason,
  };
}

const NO_DELIVERY = {
  baseDeliveryFee: null,
  deliveryFee: null,
  freeThreshold: null,
  amountToFreeShipping: null,
  estimatedDays: null,
};

// baseDeliveryFee 는 매장 기본 배송비, deliveryFee 는 실제로 붙는 배송비다.
// 선택 상품이 없거나 무료배송 기준을 넘으면 deliveryFee 는 0.
function deliveryAmounts(info, itemsTotal) {
  if (!info) return NO_DELIVERY;
  const baseDeliveryFee = info.delivery_fee ?? null;
  const freeThreshold = info.free_threshold ?? null;
  const amountToFreeShipping =
    freeThreshold === null ? null : Math.max(freeThreshold - itemsTotal, 0);
  const deliveryFee = itemsTotal === 0 || amountToFreeShipping === 0 ? 0 : (baseDeliveryFee ?? 0);
  return {
    baseDeliveryFee,
    deliveryFee,
    freeThreshold,
    amountToFreeShipping,
    estimatedDays: info.estimated_days ?? null,
  };
}

export async function getCart({ userId, type }) {
  const rows = await cartItemRepository.findByUser({ userId, fulfillmentType: type });

  // 주문할 수 없게 된 줄은 선택을 풀고 DB에도 반영한다. 줄 자체는 남긴다.
  const items = rows.map((row) => ({ row, item: toCartItem(row, type) }));
  await cartItemRepository.unselect({
    userId,
    cartItemIds: items
      .filter(({ row, item }) => row.is_selected === true && !item.available)
      .map(({ item }) => item.cartItemId),
  });

  const groups = new Map();
  for (const { row, item } of items) {
    const { store } = row.store_product;
    if (!groups.has(store.id)) groups.set(store.id, { store, items: [] });
    groups.get(store.id).items.push(item);
  }

  const deliveryInfos =
    type === 'DELIVERY'
      ? new Map(
          (await storeDeliveryInfoRepository.getStoreDeliveryInfos([...groups.keys()])).map((info) => [
            info.store_id,
            info,
          ]),
        )
      : new Map();

  const stores = [...groups.values()].map(({ store, items: storeItems }) => {
    const itemsTotal = storeItems
      .filter((item) => item.isSelected)
      .reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
    const delivery =
      type === 'DELIVERY' ? deliveryAmounts(deliveryInfos.get(store.id), itemsTotal) : NO_DELIVERY;
    return {
      storeId: store.id,
      storeName: store.name,
      thumbnailUrl: store.thumbnail_url,
      address: store.address,
      temporaryClosed: store.temporary_closed === true,
      items: storeItems,
      itemsTotal,
      ...delivery,
      storeTotal: itemsTotal + (delivery.deliveryFee ?? 0),
    };
  });

  const itemsTotal = stores.reduce((sum, store) => sum + store.itemsTotal, 0);
  const deliveryFeeTotal = stores.reduce((sum, store) => sum + (store.deliveryFee ?? 0), 0);
  return {
    type,
    stores,
    totalCount: items.length,
    selectedCount: items.filter(({ item }) => item.isSelected).length,
    itemsTotal,
    deliveryFeeTotal,
    grandTotal: itemsTotal + deliveryFeeTotal,
  };
}

export async function getCartCounts(userId) {
  const [pickup, delivery] = await Promise.all([
    cartItemRepository.countByUser({ userId, fulfillmentType: 'PICKUP' }),
    cartItemRepository.countByUser({ userId, fulfillmentType: 'DELIVERY' }),
  ]);
  return { total: pickup + delivery, pickup, delivery };
}

// 같은 (상품, 수령 방법)이 이미 있으면 수량을 합산한다. max_per_order 를 넘으면 잘라낸다.
export async function addCartItem({ userId, storeProductId, quantity, fulfillmentType }) {
  const storeProduct = await storeProductRepository.findById(storeProductId);
  if (!storeProduct) notFound('판매상품을 찾을 수 없습니다.');
  const reason = validateAddable(storeProduct, storeProduct.store, fulfillmentType);
  if (reason) conflict(reason, reasonMessages[reason]);

  const key = { userId, storeProductId, fulfillmentType };
  // insert 가 UNIQUE 충돌이면 그사이 다른 요청이 담은 것이므로 한 번 더 합산을 시도한다.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await cartItemRepository.findByKey(key);
    const capped = capQuantity((existing?.quantity ?? 0) + quantity, storeProduct.max_per_order);
    const saved = existing
      ? await cartItemRepository.update({ userId, cartItemId: existing.id, quantity: capped.quantity })
      : await cartItemRepository.insert({ ...key, quantity: capped.quantity });
    if (saved) return { cartItemId: saved.id, quantity: saved.quantity, capped: capped.capped };
  }
  conflict('CART_ITEM_CONFLICT', '장바구니 담기가 동시에 요청되었습니다. 다시 시도해 주세요.');
}

export async function updateCartItem({ userId, cartItemId, quantity, isSelected }) {
  const current = await cartItemRepository.findById({ userId, cartItemId });
  if (!current) notFound('장바구니 상품을 찾을 수 없습니다.');
  const capped =
    quantity === undefined
      ? { quantity: undefined, capped: false }
      : capQuantity(quantity, current.store_product.max_per_order);
  const saved = await cartItemRepository.update({
    userId,
    cartItemId,
    quantity: capped.quantity,
    isSelected,
  });
  if (!saved) notFound('장바구니 상품을 찾을 수 없습니다.');
  return {
    cartItemId: saved.id,
    quantity: saved.quantity,
    isSelected: saved.is_selected,
    capped: capped.capped,
  };
}

export async function deleteCartItems({ userId, cartItemIds }) {
  return { deletedCount: await cartItemRepository.removeByIds({ userId, cartItemIds }) };
}
