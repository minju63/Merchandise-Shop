const BATCH_SIZE = 1000;

async function allRows(makeQuery) {
  const rows = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await makeQuery().range(offset, offset + BATCH_SIZE - 1);
    if (error)
      throw Object.assign(new Error('상품 분류 조회에 실패했습니다.', { cause: error }), {
        status: 500,
        code: 'PRODUCT_CATEGORY_QUERY_FAILED',
      });
    rows.push(...(data ?? []));
    if (!data || data.length < BATCH_SIZE) return rows;
  }
}

export function createProductCategoryRepository(client) {
  async function forCategory(id, type) {
    const rows = await allRows(() =>
      client
        .from('product_categories')
        .select('product_id,category:categories!inner(id,type)')
        .eq('category_id', id)
        .eq('category.type', type)
        .order('product_id')
    );
    return new Set(rows.map((row) => row.product_id));
  }

  return {
    async findProductIdsByCategories({ contentCategoryId, goodsCategoryId }) {
      // An empty result means no matching products, never an unrestricted listing query.
      const conditions = [];
      if (contentCategoryId !== undefined)
        conditions.push(forCategory(contentCategoryId, 'CONTENT'));
      if (goodsCategoryId !== undefined) conditions.push(forCategory(goodsCategoryId, 'GOODS'));
      if (conditions.length === 0) return [];
      const sets = await Promise.all(conditions);
      return [...sets[0]].filter((id) => sets.every((set) => set.has(id)));
    },
    async findByProductId(productId) {
      return allRows(() =>
        client
          .from('product_categories')
          .select('category_id,category:categories(id,name,type)')
          .eq('product_id', productId)
          .order('category_id')
      );
    },
    async findRelatedProductIds({ productId, categoryIds }) {
      if (categoryIds.length === 0) return [];
      const rows = await allRows(() =>
        client
          .from('product_categories')
          .select('product_id,category_id')
          .in('category_id', categoryIds)
          .neq('product_id', productId)
          .order('product_id')
          .order('category_id')
      );
      return [...new Set(rows.map((row) => row.product_id))];
    },
  };
}

async function repository() {
  const { supabase } = await import('../lib/supabase.js');
  return createProductCategoryRepository(supabase);
}

export async function findProductIdsByCategories(options) {
  return (await repository()).findProductIdsByCategories(options);
}
export async function findByProductId(productId) {
  return (await repository()).findByProductId(productId);
}
export async function findRelatedProductIds(options) {
  return (await repository()).findRelatedProductIds(options);
}
