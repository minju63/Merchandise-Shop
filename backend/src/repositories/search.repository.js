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

// 기간(since ~ until) 안에 검색 결과가 있었던 검색 기록을 가져온다. 인기 검색어 집계용.
export async function findSearchLogs({ since, until }) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await getSupabase()
      .from('search_logs')
      .select('keyword, created_at')
      .gt('result_count', 0)
      .gte('created_at', since)
      .lt('created_at', until)
      .order('created_at', { ascending: false })
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000 || rows.length >= 20000) return rows;
  }
}
