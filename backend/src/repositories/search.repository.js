import { getSupabase } from '../lib/supabase.js';

export async function createSearchLog({ userId, query, resultCount, regionId }) {
  const { data, error } = await getSupabase()
    .from('search_logs')
    .insert({
      user_id: userId ?? null,
      query,
      normalized_query: query.trim().toLocaleLowerCase('ko-KR'),
      result_count: resultCount,
      region_id: regionId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
