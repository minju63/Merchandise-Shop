import { supabase } from '../lib/supabase.js';
import { createStoreRepository, normalizeStore, STORE_FIELDS } from './store.repository.js';

const SELECT = `*,product:products!inner(*),store:stores!inner(${STORE_FIELDS},region:regions(id,name))`;
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
        newest: 'product(released_at)',
        stock: 'stock',
        price_asc: 'price',
        price_desc: 'price',
      };
      if (!Object.hasOwn(sortFields, sort)) invalid('지원하지 않는 정렬 방식입니다.');
      for (const value of [inStock, pickup, delivery, discountOnly, includeUpcoming]) {
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
      if (minPrice !== undefined) query = query.gte('price', minPrice);
      if (maxPrice !== undefined) query = query.lte('price', maxPrice);
      if (discountOnly === true) query = query.gt('discount_rate', 0);
      if (includeUpcoming === false) query = query.neq('status', 'UPCOMING');
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
      const { data, count, error } = await query
        .order(sortFields[sort], { ascending: sort === 'price_asc', nullsFirst: false })
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
