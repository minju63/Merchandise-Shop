import {
  activateOpenedProducts,
  createOpenAlert,
  deleteOpenAlert,
  findProductOpenState,
  findUpcomingProducts,
} from '../repositories/upcoming.repository.js';

const UPCOMING_WINDOW_DAYS = 14;
const HOME_UPCOMING_LIMIT = 10;

export async function getHomeUpcomingProducts() {
  const now = new Date();
  const endAt = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  return findUpcomingProducts({
    now: now.toISOString(),
    endAt: endAt.toISOString(),
    limit: HOME_UPCOMING_LIMIT,
  });
}

export async function registerOpenAlert(userId, productId) {
  const product = await findProductOpenState(productId);
  if (!product) {
    const error = new Error('상품을 찾을 수 없습니다.');
    error.status = 404;
    throw error;
  }

  if (product.status !== 'UPCOMING' || new Date(product.open_at) <= new Date()) {
    const error = new Error('입고 예정 상품에만 알림을 신청할 수 있습니다.');
    error.status = 409;
    throw error;
  }

  return createOpenAlert(userId, productId);
}

export async function unregisterOpenAlert(userId, productId) {
  await deleteOpenAlert(userId, productId);
}

export async function openDueProducts() {
  return activateOpenedProducts(new Date().toISOString());
}
