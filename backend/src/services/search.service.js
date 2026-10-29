import { createSearchLog } from '../repositories/search.repository.js';
import { getActiveStore, listActiveStores } from '../repositories/store.repository.js';
import { getStoreProducts } from '../repositories/storeProduct.repository.js';
import { getProducts } from '../repositories/product.repository.js';
import { supabase } from '../lib/supabase.js';
import { getSimilarScope } from './product.service.js';
import { matchesSearchCategories, matchesSearchFilters } from './searchFilters.js';

const HIDDEN_STATUSES = new Set(['HIDDEN', 'INACTIVE', 'DELETED']);
const HIDDEN_PRODUCT_STATUSES = new Set([...HIDDEN_STATUSES, 'DISCONTINUED']);
import { matchesRegionName } from '../utils/regionNames.js';

function publicImage(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return supabase.storage.from('goods-images').getPublicUrl(value.replace(/^goods-images\//, '')).data.publicUrl;
}

function compareNumbers(a, b) {
  return Number(b || 0) - Number(a || 0);
}

async function categoryMatches(productIds, categoryIds) {
  if (!categoryIds.length || !productIds.length) return new Set();
  const matches = new Set();
  for (let start = 0; start < productIds.length; start += 100) {
    const ids = productIds.slice(start, start + 100);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('product_categories')
        .select('product_id,category_id')
        .in('product_id', ids)
        .in('category_id', categoryIds)
        .range(offset, offset + 999);
      if (error) throw error;
      for (const row of data ?? []) matches.add(row.product_id);
      if (!data || data.length < 1000) break;
    }
  }
  return matches;
}

async function aggregateRows(table, idColumn, ids, fields, where = (query) => query) {
  const rows = [];
  for (let start = 0; start < ids.length; start += 100) {
    const batchIds = ids.slice(start, start + 100);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await where(supabase.from(table).select(fields).in(idColumn, batchIds))
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}

export async function searchProducts({ storeId, query, region = '', sort, page, size, filters = {}, similarTo }) {
  // similarTo: 상품 상세의 비슷한 상품 기준으로 결과를 좁힌다(검색어 대신).
  const similar = similarTo ? await getSimilarScope(similarTo) : null;
  const similarIds = similar ? new Set(similar.productIds) : null;
  const allStores = storeId
    ? [await getActiveStore(storeId)].filter(Boolean)
    : await listActiveStores();
  if (storeId && !allStores.length) {
    const error = new Error('굿즈샵을 찾을 수 없습니다.');
    error.status = 404;
    error.code = 'STORE_NOT_FOUND';
    throw error;
  }

  const stores = allStores.filter((store) => {
    const address = String(store.address || '').trim().toLocaleLowerCase('ko-KR');
    if (region && !address.includes(region.toLocaleLowerCase('ko-KR'))) return false;
    return !filters.regions?.length || matchesRegionName(address, filters.regions);
  });

  const storeMap = new Map(stores.map((store) => [store.id, store]));
  const listings = (await getStoreProducts(stores.map((store) => store.id)))
    .filter((listing) => !HIDDEN_STATUSES.has(listing.status));
  const products = await getProducts([...new Set(listings.map((listing) => listing.product_id).filter(Boolean))]);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const productIds = [...productMap.keys()];
  const [contentMatches, goodsMatches] = await Promise.all([
    categoryMatches(productIds, filters.contentCategories ?? []),
    categoryMatches(productIds, filters.goodsCategories ?? []),
  ]);
  const tokens = query.toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);

  const items = listings.flatMap((listing) => {
    const product = productMap.get(listing.product_id);
    const store = storeMap.get(listing.store_id);
    if (!product || !store || HIDDEN_PRODUCT_STATUSES.has(product.status)) return [];
    if (similarIds && !similarIds.has(product.id)) return [];
    const searchableText = [product.name, product.work_title, product.character_name, product.brand, ...(!storeId ? [store.name] : [])]
      .filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
    if (!tokens.every((token) => searchableText.includes(token))) return [];

    if (!matchesSearchCategories(product.id, filters, contentMatches, goodsMatches)) return [];

    return [{
      isCurrentStore: similar ? store.id === similar.currentStoreId : undefined,
      storeProductId: listing.id,
      productId: product.id,
      storeId: store.id,
      storeName: store.name,
      name: product.name,
      workTitle: product.work_title ?? null,
      characterName: product.character_name ?? null,
      image: publicImage(product.thumbnail_url),
      price: listing.price == null ? null : Number(listing.price),
      discountRate: listing.discount_rate == null ? null : Number(listing.discount_rate),
      stock: listing.stock == null ? null : Number(listing.stock),
      status: listing.status,
      pickupAvailable: Boolean((storeId || store.temporary_closed === false) && store.pickup_available && listing.pickup_available),
      deliveryAvailable: Boolean((storeId || store.temporary_closed === false) && store.delivery_available && listing.delivery_available),
      popularityScore: Number(product.popularity_score || 0),
      salesCount: Number(listing.sales_count || 0),
      createdAt: listing.created_at,
    }];
  });

  if (filters.ratingMin !== undefined) {
    const reviewRows = await aggregateRows('reviews', 'product_id', [...new Set(items.map((item) => item.productId))], 'product_id,rating', (query) => query.eq('is_hidden', false).is('deleted_at', null));
    const ratings = new Map();
    for (const row of reviewRows) {
      const current = ratings.get(row.product_id) ?? { sum: 0, count: 0 };
      current.sum += Number(row.rating);
      current.count += 1;
      ratings.set(row.product_id, current);
    }
    for (const item of items) {
      const rating = ratings.get(item.productId);
      item.ratingAverage = rating ? rating.sum / rating.count : null;
    }
  }
  if (filters.wishlistMin !== undefined || sort === 'wishlist') {
    const wishlistRows = await aggregateRows('wishlist_products', 'store_product_id', items.map((item) => item.storeProductId), 'store_product_id');
    const counts = new Map();
    for (const row of wishlistRows) counts.set(row.store_product_id, (counts.get(row.store_product_id) ?? 0) + 1);
    for (const item of items) item.wishlistCount = counts.get(item.storeProductId) ?? 0;
  }

  const prices = items.map((item) => item.price).filter((price) => Number.isFinite(price) && price >= 0);
  const priceMin = prices.length ? prices.reduce((min, price) => Math.min(min, price), Infinity) : 0;
  const priceMax = prices.length ? prices.reduce((max, price) => Math.max(max, price), 0) : 0;
  const priceBins = Array(16).fill(0);
  for (const price of prices) {
    const index = priceMax === priceMin ? 0 : Math.min(15, Math.floor((price - priceMin) / (priceMax - priceMin) * 16));
    priceBins[index] += 1;
  }
  const priceDistribution = { min: priceMin, max: priceMax, bins: priceBins };
  const filtered = items.filter((item) => matchesSearchFilters(item, filters));

  filtered.sort((a, b) => (
    (sort === 'sales' ? compareNumbers(a.salesCount, b.salesCount)
      : sort === 'wishlist' ? compareNumbers(a.wishlistCount, b.wishlistCount)
        : sort === 'newest' ? String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          : sort === 'priceLow' ? (a.price == null) - (b.price == null) || Number(a.price) - Number(b.price)
            : sort === 'priceHigh' ? (a.price == null) - (b.price == null) || Number(b.price) - Number(a.price)
              : sort === 'stock' ? compareNumbers(a.stock, b.stock)
                : compareNumbers(a.popularityScore, b.popularityScore))
    || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    || a.storeProductId.localeCompare(b.storeProductId)
  ));

  return {
    items: filtered.slice((page - 1) * size, page * size),
    page,
    size,
    totalCount: filtered.length,
    priceDistribution,
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
