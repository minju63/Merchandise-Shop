import { getSupabase } from '../lib/supabase.js';

export async function createSearchLog({ userId, query, resultCount, regionId }) {
  const { data, error } = await getSupabase()
    .from('search_logs')
    .insert({
      user_id: userId ?? null,
      // 실제 search_logs 테이블 컬럼은 keyword · region_id(uuid) · result_count · created_at 이다.
      keyword: query,
      result_count: resultCount,
      region_id: regionId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
