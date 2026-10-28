import { createProductCategoryRepository } from './productCategory.repository.js';
function check({ data, error }) {
  if (error) {
    throw Object.assign(new Error('카테고리 조회에 실패했습니다.', { cause: error }), {
      status: 500,
      code: 'CATEGORY_QUERY_FAILED',
    });
  }
  return data ?? [];
}

export function createCategoryRepository(client) {
  return {
    async findAll({ type, contentCategoryId } = {}) {
      if (contentCategoryId !== undefined) {
        const productIds = await createProductCategoryRepository(client).findProductIdsByCategories(
          { contentCategoryId }
        );
        const categories = new Map();
        for (let start = 0; start < productIds.length; start += 100) {
          const ids = productIds.slice(start, start + 100);
          for (let offset = 0; ; offset += 1000) {
            const rows = check(
              await client
                .from('product_categories')
                .select('product_id,category_id,category:categories!inner(id,name,type)')
                .in('product_id', ids)
                .eq('category.type', 'GOODS')
                .order('product_id')
                .order('category_id')
                .range(offset, offset + 999)
            );
            for (const row of rows) if (row.category) categories.set(row.category.id, row.category);
            if (rows.length < 1000) break;
          }
        }
        return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      }
let query = client
  .from('categories')
  .select('id,name,type')
  .eq('is_active', true);

      if (type !== undefined) query = query.eq('type', type);
      return check(await query.order('name').order('id'));
    },
    async findByIds(ids) {
      if (ids.length === 0) return [];
      return check(await client.from('categories').select('id,name,type').in('id', ids));
    },
  };
}

async function repository() {
  const { supabase } = await import('../lib/supabase.js');
  return createCategoryRepository(supabase);
}

export async function findAll(options) {
  return (await repository()).findAll(options);
}

export async function findByIds(ids) {
  return (await repository()).findByIds(ids);
}

