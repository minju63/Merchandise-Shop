import { supabase } from '../lib/supabase.js';

function normalizeProductIds(productIds = []) {
  if (!Array.isArray(productIds)) return [];
  return [...new Set(productIds.filter((id) => id !== null && id !== undefined && id !== ''))];
}

export function createProductRepository(client) {
  return {
    async findById(id) {
      if (id === null || id === undefined || id === '') return null;

      const { data, error } = await client.from('products').select('*').eq('id', id).maybeSingle();

      if (error) {
        throw Object.assign(
          new Error('상품 정보 조회에 실패했습니다.', {
            cause: error,
          }),
          {
            status: 500,
            code: 'PRODUCT_QUERY_FAILED',
          }
        );
      }

      return data;
    },
  };
}

const repository = createProductRepository(supabase);

export const findById = repository.findById;

export async function findSimilarityCandidates() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,brand,work_title,character_name')
      .order('id')
      .range(offset, offset + 999);

    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export async function getProducts(productIds = []) {
  const ids = normalizeProductIds(productIds);
  if (ids.length === 0) return [];

  const rows = [];
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);

    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', batch)
        .range(offset, offset + 999);

      if (error) throw error;

      const page = data ?? [];
      rows.push(...page);
      if (page.length < 1000) break;
    }
  }

  return rows;
}
