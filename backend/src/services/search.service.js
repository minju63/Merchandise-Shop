import { createSearchLog, findSearchLogs } from '../repositories/search.repository.js';
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
      brand: product.brand ?? null,
      workTitle: product.work_title ?? null,
      characterName: product.character_name ?? null,
      image: publicImage(product.thumbnail_url),
      price: listing.price == null ? null : Number(listing.price),
      discountRate: listing.discount_rate == null ? null : Number(listing.discount_rate),
      stock: listing.stock == null ? null : Number(listing.stock),
      status: listing.status,
      restockExpectedAt: listing.restock_expected_at ?? null,
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
                // 재고 적은 순: 재고가 남아 있는 상품을 적은 순으로 먼저, 품절·재고 미확인은 뒤로 보낸다.
                : sort === 'stockAsc' ? (!(a.stock > 0)) - (!(b.stock > 0)) || Number(a.stock) - Number(b.stock)
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

// 인기 검색어: 최근 5분 검색 횟수 순위. 직전 5분 순위와 비교해 등락(trend)을 계산한다.
// 검색이 적어 목록이 비면 집계 기간을 1시간 → 24시간 → 7일로 넓힌다.
const POPULAR_WINDOWS = [
  { ms: 5 * 60 * 1000, label: "최근 5분" },
  { ms: 60 * 60 * 1000, label: "최근 1시간" },
  { ms: 24 * 60 * 60 * 1000, label: "최근 24시간" },
  { ms: 7 * 24 * 60 * 60 * 1000, label: "최근 7일" },
];
const POPULAR_SIZE = 10;
const POPULAR_MIN_KEYWORDS = 5;
const POPULAR_CACHE_MS = 10 * 1000;
let popularCache = null;

function rankKeywords(rows) {
  const counts = new Map();
  for (const row of rows) {
    const keyword = String(row.keyword ?? "").trim();
    if (!keyword) continue;
    const key = keyword.toLocaleLowerCase("ko-KR");
    // rows는 최신순이라 처음 만난 표기를 대표 표기로 쓴다.
    const entry = counts.get(key) ?? { keyword, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].keyword.localeCompare(b[1].keyword, "ko"))
    .map(([key, entry], index) => ({ key, keyword: entry.keyword, rank: index + 1 }));
}

async function rankWindow(now, windowMs) {
  const current = new Date(now.getTime() - windowMs).toISOString();
  const previous = new Date(now.getTime() - windowMs * 2).toISOString();
  const [currentRows, previousRows] = await Promise.all([
    findSearchLogs({ since: current, until: now.toISOString() }),
    findSearchLogs({ since: previous, until: current }),
  ]);
  const previousRanks = new Map(rankKeywords(previousRows).map((item) => [item.key, item.rank]));
  return rankKeywords(currentRows).slice(0, POPULAR_SIZE).map(({ key, keyword, rank }) => {
    const before = previousRanks.get(key);
    if (before === undefined) return { rank, keyword, trend: "new" };
    if (before === rank) return { rank, keyword, trend: "same" };
    return { rank, keyword, trend: before > rank ? "up" : "down", change: Math.abs(before - rank) };
  });
}

export async function getPopularKeywords(now = new Date()) {
  if (popularCache && now.getTime() - popularCache.at < POPULAR_CACHE_MS) return popularCache.value;
  let keywords = [];
  let label = POPULAR_WINDOWS[0].label;
  for (const window of POPULAR_WINDOWS) {
    keywords = await rankWindow(now, window.ms);
    label = window.label;
    if (keywords.length >= POPULAR_MIN_KEYWORDS) break;
  }
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  const value = {
    updatedAt: `${parts.month}.${parts.day} ${parts.hour}:${parts.minute} 기준 · ${label}`,
    keywords,
  };
  popularCache = { at: now.getTime(), value };
  return value;
}
