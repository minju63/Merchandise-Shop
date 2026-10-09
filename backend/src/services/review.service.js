import { randomUUID } from 'node:crypto';
import { supabase } from '../lib/supabase.js';
import { getActiveStore } from '../repositories/store.repository.js';
import * as repo from '../repositories/review.repository.js';
import { reviewError, validateReviewInput } from './reviewValidation.js';

export { reviewError, validateReviewInput } from './reviewValidation.js';

const BUCKET = 'goods-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function resolveImage(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return supabase.storage.from(BUCKET).getPublicUrl(url.replace(/^goods-images\//, '')).data
    .publicUrl;
}

export async function listStoreReviews(storeId, options) {
  const store = await getActiveStore(storeId);
  if (!store) return null;
  const [summary, rows] = await Promise.all([
    repo.getReviewSummary(storeId),
    repo.getPublicReviews(storeId, options),
  ]);
  const relations = await repo.getReviewRelations(rows);
  const users = new Map(relations.users.map((row) => [row.id, row.nickname]));
  const products = new Map(relations.products.map((row) => [row.id, row.name]));
  const images = new Map();
  for (const row of relations.images)
    images.set(row.review_id, [...(images.get(row.review_id) || []), resolveImage(row.image_url)]);
  return {
    store: { id: store.id, name: store.name },
    ...summary,
    items: rows.map((row) => ({
      id: row.id,
      nickname: users.get(row.user_id)?.trim() || '익명 구매자',
      rating: row.rating,
      createdAt: row.created_at,
      content: row.content || '',
      productName: products.get(row.product_id) || null,
      images: images.get(row.id) || [],
    })),
    page: options.page,
    size: options.size,
    totalCount: summary.reviewCount,
    totalPages: Math.ceil(summary.reviewCount / options.size),
  };
}

export async function eligibleItems(userId, storeId) {
  const store = await getActiveStore(storeId);
  if (!store) return null;
  const orders = await repo.getCompletedOrders(userId, storeId);
  const orderMap = new Map(orders.map((row) => [row.id, row]));
  const items = await repo.getOrderItems(orders.map((row) => row.id));
  const [listings, reviews] = await Promise.all([
    repo.getStoreProductsByIds([...new Set(items.map((row) => row.store_product_id))]),
    repo.getReviewedOrderItemIds(items.map((row) => row.id)),
  ]);
  const listingMap = new Map(listings.map((row) => [row.id, row]));
  const reviewed = new Set(reviews.map((row) => row.order_item_id));
  return {
    store: { id: store.id, name: store.name },
    items: items
      .filter(
        (item) =>
          listingMap.get(item.store_product_id)?.store_id === storeId && !reviewed.has(item.id)
      )
      .map((item) => ({
        orderItemId: item.id,
        productName: item.product_name,
        productImage: resolveImage(item.product_image_url),
        storeName: store.name,
        orderedAt: orderMap.get(item.order_id)?.created_at,
      })),
  };
}

export async function checkEligibility(userId, orderItemId) {
  const item = await repo.getOrderItem(orderItemId);
  if (!item) throw reviewError(404, 'ORDER_ITEM_NOT_FOUND', '주문 상품을 찾을 수 없습니다.');
  const order = await repo.getOrder(item.order_id);
  if (!order || order.user_id !== userId)
    throw reviewError(403, 'FORBIDDEN', '본인의 구매 상품만 리뷰할 수 있습니다.');
  if (await repo.getReviewByOrderItem(orderItemId))
    throw reviewError(409, 'REVIEW_EXISTS', '이미 리뷰를 작성한 구매 상품입니다.');
  if (order.status !== 'COMPLETED')
    throw reviewError(403, 'ORDER_NOT_COMPLETED', '구매 완료된 상품만 리뷰할 수 있습니다.');
  const listing = await repo.getStoreProduct(item.store_product_id);
  if (!listing || listing.store_id !== order.store_id || !listing.product_id)
    throw reviewError(403, 'INVALID_ORDER_ITEM', '주문 상품과 매장 정보가 일치하지 않습니다.');
  return {
    user_id: userId,
    order_item_id: orderItemId,
    store_id: order.store_id,
    product_id: listing.product_id,
  };
}

function imageBuffer(image) {
  if (!image || typeof image !== 'object' || typeof image.data !== 'string')
    throw reviewError(400, 'INVALID_IMAGE', '이미지 데이터가 올바르지 않습니다.');
  const formats = {
    'image/png': {
      ext: 'png',
      magic: (b) => b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
    },
    'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    'image/webp': {
      ext: 'webp',
      magic: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
    },
  };
  const format = formats[image.type];
  if (!format || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data))
    throw reviewError(400, 'INVALID_IMAGE', 'PNG, JPG, WebP 이미지만 첨부할 수 있습니다.');
  const buffer = Buffer.from(image.data, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES || !format.magic(buffer))
    throw reviewError(400, 'INVALID_IMAGE', '이미지 형식 또는 크기가 올바르지 않습니다.');
  return { buffer, type: image.type, ext: format.ext };
}

export async function createReview(userId, input) {
  const validated = validateReviewInput(input);
  const row = await checkEligibility(userId, validated.orderItemId);
  const imageFiles = validated.images.map(imageBuffer);
  const uploaded = [];
  let review;
  try {
    for (const file of imageFiles) {
      const path = `reviews/${randomUUID()}.${file.ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file.buffer, { contentType: file.type, upsert: false });
      if (error)
        throw reviewError(
          502,
          'IMAGE_UPLOAD_FAILED',
          '이미지 업로드에 실패했습니다. 다시 시도해 주세요.'
        );
      uploaded.push(path);
    }
    review = await repo.insertReview({
      ...row,
      rating: validated.rating,
      content: validated.content,
    });
    await repo.insertReviewImages(
      uploaded.map((path, display_order) => ({
        review_id: review.id,
        image_url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
        display_order,
      }))
    );
    return review;
  } catch (error) {
    if (review) {
      try {
        await repo.deleteReview(review.id);
      } catch (cleanupError) {
        console.error('리뷰 저장 취소 실패', cleanupError);
      }
    }
    if (uploaded.length) {
      const cleanup = await supabase.storage.from(BUCKET).remove(uploaded);
      if (cleanup.error) console.error('리뷰 이미지 정리 실패', cleanup.error);
    }
    if (error.code === '23505')
      throw reviewError(409, 'REVIEW_EXISTS', '이미 리뷰를 작성한 구매 상품입니다.');
    throw error;
  }
}
