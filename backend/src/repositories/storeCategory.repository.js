import { supabase } from '../lib/supabase.js';

export async function getStoreCategories(storeIds) {
  if (!storeIds.length) return { links: [], categories: [] };
  const { data: links, error } = await supabase
    .from('store_categories')
    .select('*')
    .in('store_id', storeIds);
  if (error) throw error;
  const ids = [...new Set((links || []).map((row) => row.category_id).filter(Boolean))];
  if (!ids.length) return { links: links || [], categories: [] };
  const { data: categories, error: categoryError } = await supabase
    .from('categories')
    .select('*')
    .in('id', ids);
  if (categoryError) throw categoryError;
  return { links: links || [], categories: categories || [] };
}
