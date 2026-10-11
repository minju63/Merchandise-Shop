import { createSearchLog } from '../repositories/search.repository.js';
import { getActiveStore, listActiveStores } from '../repositories/store.repository.js';
import { getStoreProducts } from '../repositories/storeProduct.repository.js';
import { getProducts } from '../repositories/product.repository.js';
import { supabase } from '../lib/supabase.js';

const HIDDEN_STATUSES = new Set(['HIDDEN', 'INACTIVE', 'DELETED']);
const HIDDEN_PRODUCT_STATUSES = new Set([...HIDDEN_STATUSES, 'DISCONTINUED']);

function publicImage(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return supabase.storage.from('goods-images').getPublicUrl(value.replace(/^goods-images\//, '')).data.publicUrl;
}

function compareNumbers(a, b) {
  return Number(b || 0) - Number(a || 0);
}

export async function searchProducts({ storeId, query, region = '', sort, page, size }) {
  const allStores = storeId
    ? [await getActiveStore(storeId)].filter(Boolean)
    : await listActiveStores();
  if (storeId && !allStores.length) {
    const error = new Error('굿즈샵을 찾을 수 없습니다.');
    error.status = 404;
    error.code = 'STORE_NOT_FOUND';
    throw error;
  }

  const stores = region
    ? allStores.filter((store) => String(store.address || '').toLocaleLowerCase('ko-KR')
      .includes(region.toLocaleLowerCase('ko-KR')))
    : allStores;

  const storeMap = new Map(stores.map((store) => [store.id, store]));
  const listings = (await getStoreProducts(stores.map((store) => store.id)))
    .filter((listing) => !HIDDEN_STATUSES.has(listing.status));
  const products = await getProducts([...new Set(listings.map((listing) => listing.product_id).filter(Boolean))]);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const tokens = query.toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);

  const items = listings.flatMap((listing) => {
    const product = productMap.get(listing.product_id);
    const store = storeMap.get(listing.store_id);
    if (!product || !store || HIDDEN_PRODUCT_STATUSES.has(product.status)) return [];
    const searchableText = [product.name, product.work_title, product.character_name, product.brand, store.name]
      .filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
    if (!tokens.every((token) => searchableText.includes(token))) return [];

    return [{
      storeProductId: listing.id,
      productId: product.id,
      storeId: store.id,
      storeName: store.name,
      name: product.name,
      workTitle: product.work_title ?? null,
      characterName: product.character_name ?? null,
      image: publicImage(product.thumbnail_url),
      price: listing.price == null ? null : Number(listing.price),
      stock: listing.stock == null ? null : Number(listing.stock),
      status: listing.status,
      pickupAvailable: Boolean(store.pickup_available && listing.pickup_available),
      deliveryAvailable: Boolean(store.delivery_available && listing.delivery_available),
      popularityScore: Number(product.popularity_score || 0),
      salesCount: Number(listing.sales_count || 0),
      createdAt: listing.created_at,
    }];
  });

  items.sort((a, b) => (
    (sort === 'sales' ? compareNumbers(a.salesCount, b.salesCount)
      : sort === 'newest' ? String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        : sort === 'stock' ? compareNumbers(a.stock, b.stock)
          : compareNumbers(a.popularityScore, b.popularityScore))
    || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    || a.storeProductId.localeCompare(b.storeProductId)
  ));

  return {
    items: items.slice((page - 1) * size, page * size),
    page,
    size,
    totalCount: items.length,
  };
}

export async function logSearch({ userId, query, resultCount, regionId }) {
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  if (!normalizedQuery || normalizedQuery.length > 200) {
    const error = new Error('검색어는 1자 이상 200자 이하여야 합니다.');
    error.status = 400;
    throw error;
  }

  if (!Number.isInteger(resultCount) || resultCount < 0) {
    const error = new Error('검색 결과 수가 올바르지 않습니다.');
    error.status = 400;
    throw error;
  }

  return createSearchLog({
    userId,
    query: normalizedQuery,
    resultCount,
    regionId,
  });
}
