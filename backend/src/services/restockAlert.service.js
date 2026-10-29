// 담당: 동균
// 재입고 알림 서비스 — 비즈니스 로직, DB 접근은 repositories/ 를 통해서만
// 알림은 매장 단위(store_product_id)다. 상품 단위 오픈 알림(upcoming.routes.js)과는 다른 기능이다.
import * as restockAlertRepository from '../repositories/restockAlert.repository.js';
import * as storeProductRepository from '../repositories/storeProduct.repository.js';
import { calculateStockLabel } from './wishlist.service.js';

const CLOSED_STORE_STATUSES = ['CLOSED', 'SUSPENDED', 'DELETED'];
const HIDDEN_PRODUCT_STATUSES = ['HIDDEN', 'DELETED'];

function notFound(message) {
  throw Object.assign(new Error(message), { status: 404, code: 'NOT_FOUND' });
}

function conflict(code, message) {
  throw Object.assign(new Error(message), { status: 409, code });
}

function toRestockAlert(row) {
  const storeProduct = row.store_product;
  const { product, store } = storeProduct;
  const price = storeProduct.price ?? 0;
  const discountRate = storeProduct.discount_rate ?? 0;
  return {
    alertId: row.id,
    storeProductId: storeProduct.id,
    productId: product.id,
    productName: product.name,
    workTitle: product.work_title,
    thumbnailUrl: product.thumbnail_url,
    storeId: store.id,
    storeName: store.name,
    price,
    discountRate,
    finalPrice: Math.round((price * (100 - discountRate)) / 100),
    stock: storeProduct.stock,
    stockLabel: calculateStockLabel(storeProduct),
    restockExpectedAt: storeProduct.restock_expected_at,
    isActive: row.is_active,
    notifiedAt: row.notified_at,
    createdAt: row.created_at,
  };
}

export async function getRestockAlerts({ userId, page, size }) {
  const { rows, totalCount } = await restockAlertRepository.findPageByUser({ userId, page, size });
  return { items: rows.map(toRestockAlert), page, size, totalCount };
}

// 멱등: 이미 활성이면 그대로 성공, 비활성 행이 있으면 되살린다.
export async function createRestockAlert({ userId, storeProductId }) {
  const storeProduct = await storeProductRepository.findById(storeProductId);
  if (!storeProduct) notFound('판매상품을 찾을 수 없습니다.');
  if (storeProduct.status === 'ON_SALE' && storeProduct.stock > 0)
    conflict('ALREADY_IN_STOCK', '지금 구매할 수 있는 상품입니다.');
  if (CLOSED_STORE_STATUSES.includes(storeProduct.store.status))
    conflict('STORE_CLOSED', '운영하지 않는 굿즈샵의 상품입니다.');
  if (HIDDEN_PRODUCT_STATUSES.includes(storeProduct.status))
    conflict('NOT_ON_SALE', '판매 중인 상품이 아닙니다.');
  await restockAlertRepository.activate({ userId, storeProductId });
  return { alertEnabled: true };
}

// 멱등: 활성 알림이 없어도 성공
export async function deleteRestockAlert({ userId, storeProductId }) {
  await restockAlertRepository.deactivate({ userId, storeProductId });
  return { alertEnabled: false };
}
