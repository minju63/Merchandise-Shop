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
  const { data, error } = await supabase.from('products').select('*').in('id', productIds);
  if (error) throw error;
  return data || [];
}
