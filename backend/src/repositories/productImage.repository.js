import { supabase } from '../lib/supabase.js';
// Confirm additional image ordering/URL fields against the integrated schema before adding them.
export function createProductImageRepository(client) {
  return {
    async findByProductId(productId) {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client
          .from('product_images')
          .select('*')
          .eq('product_id', productId)
          .order('id')
          .range(offset, offset + 999);
        if (error)
          throw Object.assign(new Error('상품 이미지 조회에 실패했습니다.', { cause: error }), {
            status: 500,
            code: 'PRODUCT_IMAGE_QUERY_FAILED',
          });
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) return rows;
      }
    },
  };
}

export async function findByProductId(productId) {
  const { supabase } = await import('../lib/supabase.js');
  return createProductImageRepository(supabase).findByProductId(productId);
}


export async function getProductImages(productIds) {
  if (!productIds.length) return [];
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .in('product_id', productIds);
  if (error) throw error;
  return data || [];
}
