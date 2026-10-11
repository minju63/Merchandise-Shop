import { supabase } from '../lib/supabase.js';

async function rowsFor(table, idColumn, ids, fields, filter = (query) => query) {
  const rows = [];
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await filter(supabase.from(table).select(fields).in(idColumn, batch))
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}

export async function findRatingAverages(productIds) {
  const rows = await rowsFor(
    'reviews', 'product_id', [...new Set(productIds)], 'product_id,rating',
    (query) => query.eq('is_hidden', false).is('deleted_at', null)
  );
  const totals = new Map();
  for (const row of rows) {
    const entry = totals.get(row.product_id) ?? { sum: 0, count: 0 };
    entry.sum += Number(row.rating);
    entry.count += 1;
    totals.set(row.product_id, entry);
  }
  return new Map([...totals].map(([id, entry]) => [id, entry.sum / entry.count]));
}

export async function findWishlistCounts(storeProductIds) {
  const rows = await rowsFor(
    'wishlist_products', 'store_product_id', storeProductIds, 'store_product_id'
  );
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.store_product_id, (counts.get(row.store_product_id) ?? 0) + 1);
  }
  return counts;
}
