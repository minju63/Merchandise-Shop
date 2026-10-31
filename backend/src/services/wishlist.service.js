// 담당: 동균
// 찜 서비스 — 비즈니스 로직, DB 접근은 repositories/ 를 통해서만
import * as wishlistProductRepository from '../repositories/wishlistProduct.repository.js';
import * as wishlistShopRepository from '../repositories/wishlistShop.repository.js';
import * as restockAlertRepository from '../repositories/restockAlert.repository.js';
import * as storeProductRepository from '../repositories/storeProduct.repository.js';
import * as storeRepository from '../repositories/store.repository.js';

function notFound(message) {
  throw Object.assign(new Error(message), { status: 404, code: 'NOT_FOUND' });
}

// 재고 라벨은 DB에 저장하지 않고 조회할 때마다 계산한다.
export function calculateStockLabel({ status, stock, restock_expected_at }) {
  if (status === 'UPCOMING') return 'INCOMING';
  if (status !== 'ON_SALE') return 'SOLD_OUT';
  if (stock > 3) return 'IN_STOCK';
  if (stock > 0) return 'LOW_STOCK';
  return restock_expected_at ? 'INCOMING' : 'SOLD_OUT';
}

function toWishProduct(row, alertIds) {
  const storeProduct = row.store_product;
  const { product, store } = storeProduct;
  const price = storeProduct.price ?? 0;
  const discountRate = storeProduct.discount_rate ?? 0;
  const stockLabel = calculateStockLabel(storeProduct);
  return {
    wishlistId: row.id,
    storeProductId: storeProduct.id,
    productId: product.id,
    productName: product.name,
    workTitle: product.work_title,
    characterName: product.character_name,
    thumbnailUrl: product.thumbnail_url,
    storeId: store.id,
    storeName: store.name,
    price,
    discountRate,
    finalPrice: Math.round((price * (100 - discountRate)) / 100),
    stock: storeProduct.stock,
    status: storeProduct.status,
    stockLabel,
    restockExpectedAt: storeProduct.restock_expected_at,
    pickupAvailable: storeProduct.pickup_available === true && store.pickup_available === true,
    deliveryAvailable: storeProduct.delivery_available === true && store.delivery_available === true,
    preorderAvailable: stockLabel === 'INCOMING' && storeProduct.preorder_available === true,
    restockAlertEnabled: alertIds.has(storeProduct.id),
    addable: stockLabel === 'IN_STOCK' || stockLabel === 'LOW_STOCK',
    createdAt: row.created_at,
  };
}

// 찜 목록 정렬 — 카테고리 상품 정렬(storeProduct.repository.js)과 같은 키·기준을 쓴다.
// recent(최근 찜한 순)는 DB 순서 그대로라 따로 정렬하지 않는다.
const descending = (pick) => (a, b) => (pick(b) ?? -Infinity) - (pick(a) ?? -Infinity);
const ascending = (pick) => (a, b) => (pick(a) ?? Infinity) - (pick(b) ?? Infinity);
const releasedAt = (row) => {
  const time = Date.parse(row.store_product.product.released_at);
  return Number.isNaN(time) ? null : time;
};
export const WISH_SORTS = {
  recent: null,
  popular: descending((row) => row.store_product.product.popularity_score),
  sales: descending((row) => row.store_product.sales_count),
  newest: descending(releasedAt),
  wishlist: descending((row) => row.store_product.product.wish_count),
  stock: descending((row) => row.store_product.stock),
  stock_asc: ascending((row) => row.store_product.stock),
  price_asc: ascending((row) => row.store_product.price),
  price_desc: descending((row) => row.store_product.price),
};

// 값이 같으면 원래 순서(최근 찜한 순)를 유지한다. Array.prototype.sort 는 안정 정렬이다.
export function sortWishRows(rows, sort) {
  const compare = WISH_SORTS[sort];
  return compare ? [...rows].sort(compare) : rows;
}

export async function getWishProducts({ userId, page, size, sort = 'recent' }) {
  let rows;
  let totalCount;
  if (WISH_SORTS[sort]) {
    const all = sortWishRows(await wishlistProductRepository.findAllByUser(userId), sort);
    rows = all.slice((page - 1) * size, page * size);
    totalCount = all.length;
  } else {
    ({ rows, totalCount } = await wishlistProductRepository.findPageByUser({ userId, page, size }));
  }
  const alertIds = new Set(
    await restockAlertRepository.findActiveStoreProductIds({
      userId,
      storeProductIds: rows.map((row) => row.store_product.id),
    }),
  );
  return { items: rows.map((row) => toWishProduct(row, alertIds)), page, size, totalCount };
}

export async function getWishShops({ userId, page, size }) {
  const { rows, totalCount } = await wishlistShopRepository.findPageByUser({ userId, page, size });
  const storeIds = rows.map((row) => row.store.id);
  const inStockCounts = new Map();
  for (const storeProduct of await storeProductRepository.getStoreProducts(storeIds)) {
    if (storeProduct.status !== 'ON_SALE' || !(storeProduct.stock > 0)) continue;
    inStockCounts.set(storeProduct.store_id, (inStockCounts.get(storeProduct.store_id) ?? 0) + 1);
  }
  const items = rows.map(({ id, created_at, store }) => ({
    wishlistId: id,
    storeId: store.id,
    storeName: store.name,
    address: store.address,
    thumbnailUrl: store.thumbnail_url,
    temporaryClosed: store.temporary_closed === true,
    pickupAvailable: store.pickup_available === true,
    deliveryAvailable: store.delivery_available === true,
    inStockProductCount: inStockCounts.get(store.id) ?? 0,
    createdAt: created_at,
  }));
  return { items, page, size, totalCount };
}

export async function getWishCounts(userId) {
  const [products, shops] = await Promise.all([
    wishlistProductRepository.countByUser(userId),
    wishlistShopRepository.countByUser(userId),
  ]);
  return { products, shops };
}

// 멱등: 이미 찜했으면 그대로 성공, 새로 등록된 경우에만 wish_count +1
export async function addWishProduct({ userId, storeProductId }) {
  const storeProduct = await storeProductRepository.findById(storeProductId);
  if (!storeProduct) notFound('판매상품을 찾을 수 없습니다.');
  const inserted = await wishlistProductRepository.insertIfAbsent({ userId, storeProductId });
  if (inserted)
    await wishlistProductRepository.changeWishCount({ productId: storeProduct.product_id, delta: 1 });
  return { wishlisted: true };
}

// 멱등: 찜이 없었어도 성공. 실제로 지워진 경우에만 wish_count -1, 재입고 알림은 항상 취소
export async function removeWishProduct({ userId, storeProductId }) {
  const removed = await wishlistProductRepository.remove({ userId, storeProductId });
  if (removed) {
    const storeProduct = await storeProductRepository.findById(storeProductId);
    if (storeProduct)
      await wishlistProductRepository.changeWishCount({ productId: storeProduct.product_id, delta: -1 });
  }
  await restockAlertRepository.deactivate({ userId, storeProductId });
  return { wishlisted: false };
}

export async function addWishShop({ userId, storeId }) {
  const store = await storeRepository.findById(storeId);
  if (!store) notFound('굿즈샵을 찾을 수 없습니다.');
  await wishlistShopRepository.insertIfAbsent({ userId, storeId });
  return { wishlisted: true };
}

export async function removeWishShop({ userId, storeId }) {
  await wishlistShopRepository.remove({ userId, storeId });
  return { wishlisted: false };
}
