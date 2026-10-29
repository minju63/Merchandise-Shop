import { supabase } from '../lib/supabase.js';
import { createStoreRepository, normalizeStore, STORE_FIELDS } from './store.repository.js';

const SELECT = `*,product:products!inner(*,product_categories(category:categories(id,name,type))),store:stores!inner(${STORE_FIELDS},region:regions(id,name))`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400, code: 'INVALID_REQUEST' });
}
function check(error) {
  if (error)
    throw Object.assign(new Error('판매상품 조회에 실패했습니다.', { cause: error }), {
      status: 500,
      code: 'STORE_PRODUCT_QUERY_FAILED',
    });
}
function normalize(row) {
  return row ? { ...row, store: normalizeStore(row.store) } : null;
}

const UPCOMING_SORT_LIMIT = 1000;

// 입고 예정순: 앞으로 오픈·재입고될 상품을 시각이 가까운 순으로 먼저, 나머지는 인기순으로 보여준다.
// 시각이 상품(open_at)과 판매 상품(restock_expected_at)에 나뉘어 있어 DB 정렬 대신 여기서 계산한다.
async function findUpcomingFirst(query, offset, size) {
  const { data, count, error } = await query
    .order('id', { ascending: true })
    .range(0, UPCOMING_SORT_LIMIT - 1);
  check(error);

  const now = Date.now();
  const openTime = (row) => {
    const at = row.status === 'UPCOMING' ? row.product?.open_at
      : row.status === 'SOLD_OUT' ? row.restock_expected_at : null;
    const time = at ? Date.parse(at) : NaN;
    return time > now ? time : null;
  };
  const popularity = (row) => Number(row.product?.popularity_score) || 0;
  const rows = (data ?? []).map(normalize).sort((a, b) => {
    const [timeA, timeB] = [openTime(a), openTime(b)];
    if (timeA !== null && timeB !== null) return timeA - timeB;
    if (timeA !== null) return -1;
    if (timeB !== null) return 1;
    return popularity(b) - popularity(a);
  });
  return { items: rows.slice(offset, offset + size), totalCount: count ?? rows.length };
}

export function createStoreProductRepository(client) {
  const stores = createStoreRepository(client);
  return {
    async findById(id) {
      const { data, error } = await client
        .from('store_products')
        .select(SELECT)
        .eq('id', id)
        .maybeSingle();
      check(error);
      return normalize(data);
    },
    async findPage({
      page = 1,
      size = 20,
      sort = 'popular',
      productIds,
      relatedProductIds,
      excludeStoreProductId,
      regionId,
      regionIds,
      regionNames,
      minPrice,
      maxPrice,
      inStock,
      pickup,
      delivery,
      discountOnly,
      includeUpcoming,
      includeSoldOut,
      brands,
    } = {}) {
      const offset = (page - 1) * size;
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(size) ||
        size < 1 ||
        size > 100 ||
        !Number.isSafeInteger(offset + size)
      )
        invalid('페이지 범위를 확인해 주세요.');
      const sortFields = {
        popular: 'product(popularity_score)',
        sales: 'sales_count',
        wishlist: 'product(wish_count)', // 찜 많은 순
        newest: 'product(released_at)',
        stock: 'stock',
        stock_asc: 'stock', // 재고 적은 순
        price_asc: 'price',
        price_desc: 'price',
        upcoming: null, // 아래에서 직접 계산해 정렬한다
      };
      if (!Object.hasOwn(sortFields, sort)) invalid('지원하지 않는 정렬 방식입니다.');
      for (const value of [inStock, pickup, delivery, discountOnly, includeUpcoming, includeSoldOut]) {
        if (value !== undefined && typeof value !== 'boolean')
          invalid('필터는 boolean이어야 합니다.');
      }
      for (const value of [minPrice, maxPrice]) {
        if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
          invalid('가격은 0 이상의 정수여야 합니다.');
      }
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
        invalid('가격 범위를 확인해 주세요.');
      let query = client
        .from('store_products')
        .select(SELECT, { count: 'exact' })
        .not('status', 'in', '(HIDDEN,DELETED)');
      for (const ids of [productIds, relatedProductIds]) {
        if (ids === undefined) continue;
        if (!Array.isArray(ids) || ids.some((id) => !UUID.test(id)))
          invalid('상품 ID 조건을 확인해 주세요.');
        if (ids.length === 0) return { items: [], totalCount: 0 };
        query = query.in('product_id', ids);
      }
      if (excludeStoreProductId !== undefined) query = query.neq('id', excludeStoreProductId);
      if (regionId !== undefined) query = query.eq('store.region_id', regionId);
      if (regionIds !== undefined) {
        if (!Array.isArray(regionIds) || regionIds.length === 0 || regionIds.some((id) => !UUID.test(id)))
          invalid('지역 ID 조건을 확인해 주세요.');
        query = query.in('store.region_id', regionIds);
      }
      if (regionNames !== undefined) {
        const ids = await stores.findIdsByRegionNames(regionNames);
        if (!ids.length) return { items: [], totalCount: 0 };
        query = query.in('store_id', ids);
      }
      if (brands !== undefined) {
        if (!Array.isArray(brands) || brands.length === 0) invalid('브랜드 조건을 확인해 주세요.');
        query = query.in('product.brand', brands);
      }
      if (minPrice !== undefined) query = query.gte('price', minPrice);
      if (maxPrice !== undefined) query = query.lte('price', maxPrice);
      if (discountOnly === true) query = query.gt('discount_rate', 0);
      if (includeUpcoming === false) query = query.neq('status', 'UPCOMING');
      // 품절 상품 제외: 재고 있는 판매 중 상품, 입고 예정 상품, 재입고일이 남은 품절 상품만 남긴다.
      if (includeSoldOut === false) {
        query = query.or(
          `and(status.eq.ON_SALE,stock.gt.0),status.eq.UPCOMING,and(status.eq.SOLD_OUT,restock_expected_at.gt.${new Date().toISOString()})`
        );
      }
      if (inStock === true) query = query.eq('status', 'ON_SALE').gt('stock', 0);
      if (inStock === false) query = query.or('status.neq.ON_SALE,stock.lte.0');
      for (const [value, field] of [
        [pickup, 'pickup_available'],
        [delivery, 'delivery_available'],
      ]) {
        if (value === undefined) continue;
        const ids = await stores.findAvailableIds(field);
        if (value) {
          if (ids.length === 0) return { items: [], totalCount: 0 };
          query = query.eq(field, true).in('store_id', ids);
        } else if (ids.length > 0) {
          query = query.or(`${field}.eq.false,${field}.is.null,store_id.not.in.(${ids.join(',')})`);
        }
      }
      if (sort === 'upcoming') return findUpcomingFirst(query, offset, size);
      const { data, count, error } = await query
        .order(sortFields[sort], { ascending: ['price_asc', 'stock_asc'].includes(sort), nullsFirst: false })
        .order('id', { ascending: true })
        .range(offset, offset + size - 1);
      check(error);
      return { items: (data ?? []).map(normalize), totalCount: count ?? 0 };
    },
  };
}

async function repository() {
  const { supabase } = await import('../lib/supabase.js');
  return createStoreProductRepository(supabase);
}
export async function findById(id) {
  return (await repository()).findById(id);
}
export async function findPage(filters) {
  return (await repository()).findPage(filters);
}


export async function getStoreProducts(storeIds) {
  if (!storeIds.length) return [];
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('store_products')
      .select('*')
      .in('store_id', storeIds)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) return rows;
  }
}
