import { supabase } from '../lib/supabase.js';

export function createProductRepository(client) {
  return {
    async findById(id) {
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

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

export async function getProducts(productIds) {
  if (!productIds.length) return [];
  const rows = [];
  for (let start = 0; start < productIds.length; start += 100) {
    const ids = productIds.slice(start, start + 100);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('products').select('*').in('id', ids).range(offset, offset + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}
