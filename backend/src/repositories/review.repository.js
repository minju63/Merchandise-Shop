import { supabase } from '../lib/supabase.js';

function unwrap({ data, error }) {
  if (error) throw error;
  return data || [];
}

const publicReviews = (storeId) =>
  supabase
    .from('reviews')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_hidden', false)
    .is('deleted_at', null);

export async function getReviewSummaries(storeIds) {
  const totals = new Map(storeIds.map((id) => [id, { count: 0, sum: 0 }]));
  if (!storeIds.length) return new Map();
  for (let from = 0; ; from += 1000) {
    const batch = unwrap(
      await supabase
        .from('reviews')
        .select('store_id,rating')
        .in('store_id', storeIds)
        .eq('is_hidden', false)
        .is('deleted_at', null)
        .range(from, from + 999)
    );
    for (const row of batch) {
      const total = totals.get(row.store_id);
      total.count += 1;
      total.sum += Number(row.rating);
    }
    if (batch.length < 1000) break;
  }
  return new Map(
    [...totals].map(([id, { count, sum }]) => [
      id,
      { reviewCount: count, rating: count ? sum / count : null },
    ])
  );
}

export async function getReviewSummary(storeId) {
  return (await getReviewSummaries([storeId])).get(storeId);
}

export async function getPublicReviews(storeId, { sort, page, size }) {
  const column = sort === 'latest' ? 'created_at' : 'rating';
  const ascending = sort === 'low';
  let query = publicReviews(storeId).order(column, { ascending });
  if (column !== 'created_at') query = query.order('created_at', { ascending: false });
  const { data, error } = await query.order('id', { ascending: false }).range((page - 1) * size, page * size - 1);
  if (error) throw error;
  return data || [];
}

export async function getReviewRelations(rows) {
  const ids = rows.map((row) => row.id);
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))];
  const [users, products, images] = await Promise.all([
    userIds.length ? supabase.from('users').select('id,nickname').in('id', userIds) : { data: [] },
    productIds.length
      ? supabase.from('products').select('id,name').in('id', productIds)
      : { data: [] },
    ids.length
      ? supabase
          .from('review_images')
          .select('review_id,image_url,display_order')
          .in('review_id', ids)
          .order('display_order', { ascending: true })
      : { data: [] },
  ]);
  return { users: unwrap(users), products: unwrap(products), images: unwrap(images) };
}

export async function getCompletedOrders(userId, storeId) {
  return unwrap(
    await supabase
      .from('orders')
      .select('id,store_id,created_at')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
  );
}

export async function getOrderItems(orderIds) {
  if (!orderIds.length) return [];
  return unwrap(
    await supabase
      .from('order_items')
      .select('id,order_id,store_product_id,product_name,product_image_url')
      .in('order_id', orderIds)
  );
}

export async function getStoreProductsByIds(ids) {
  if (!ids.length) return [];
  return unwrap(
    await supabase.from('store_products').select('id,store_id,product_id').in('id', ids)
  );
}

export async function getReviewedOrderItemIds(ids) {
  if (!ids.length) return [];
  return unwrap(await supabase.from('reviews').select('order_item_id').in('order_item_id', ids));
}

export async function getOrderItem(id) {
  const { data, error } = await supabase
    .from('order_items')
    .select('id,order_id,store_product_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOrder(id) {
  const { data, error } = await supabase
    .from('orders')
    .select('id,user_id,store_id,status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStoreProduct(id) {
  const { data, error } = await supabase
    .from('store_products')
    .select('id,store_id,product_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getReviewByOrderItem(id) {
  const { data, error } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_item_id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertReview(row) {
  const { data, error } = await supabase.from('reviews').insert(row).select('id,store_id').single();
  if (error) throw error;
  return data;
}

export async function insertReviewImages(rows) {
  if (!rows.length) return;
  const { error } = await supabase.from('review_images').insert(rows);
  if (error) throw error;
}

export async function deleteReview(id) {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw error;
}
