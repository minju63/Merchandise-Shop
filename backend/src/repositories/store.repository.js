export const STORE_FIELDS =
  'id,name,status,temporary_closed,region_id,pickup_available,delivery_available,address,thumbnail_url';

export function normalizeStore(row) {
  if (!row) return null;
  return { ...row, is_operating: row.status === 'ACTIVE' && row.temporary_closed === false };
}

function check(error) {
  if (error)
    throw Object.assign(new Error('매장 조회에 실패했습니다.', { cause: error }), {
      status: 500,
      code: 'STORE_QUERY_FAILED',
    });
}

export function createStoreRepository(client) {
  return {
    async findById(id) {
      const { data, error } = await client
        .from('stores')
        .select(`${STORE_FIELDS},region:regions(id,name)`)
        .eq('id', id)
        .maybeSingle();
      check(error);
      return normalizeStore(data);
    },
    // Used before listing pagination to filter effective pickup/delivery, including false.
    async findAvailableIds(field) {
      if (!['pickup_available', 'delivery_available'].includes(field)) {
        throw Object.assign(new Error('지원하지 않는 매장 조건입니다.'), {
          status: 400,
          code: 'INVALID_REQUEST',
        });
      }
      const ids = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client
          .from('stores')
          .select('id')
          .eq('status', 'ACTIVE')
          .eq('temporary_closed', false)
          .eq(field, true)
          .order('id')
          .range(offset, offset + 999);
        check(error);
        ids.push(...(data ?? []).map((row) => row.id));
        if (!data || data.length < 1000) return ids;
      }
    },
  };
}

export async function findById(id) {
  const { supabase } = await import('../lib/supabase.js');
  return createStoreRepository(supabase).findById(id);
}
