import { supabase } from '../lib/supabase.js';
import { matchesRegionName } from '../utils/regionNames.js';
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
    async findIdsByRegionNames(regionNames) {
      const ids = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.from('stores')
          .select('id,address')
          .eq('status', 'ACTIVE')
          .order('id')
          .range(offset, offset + 999);
        check(error);
        ids.push(...(data ?? []).filter((row) => matchesRegionName(row.address, regionNames)).map((row) => row.id));
        if (!data || data.length < 1000) return ids;
      }
    },
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


function unwrap(result) {
  if (result.error) throw result.error;
  return result.data || [];
}

export async function listActiveStores() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const batch = unwrap(
      await supabase
        .from('stores')
        .select('*')
        .eq('status', 'ACTIVE')
        .range(from, from + 999)
    );
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function getActiveStore(storeId) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (error) throw error;
  return data;
}
