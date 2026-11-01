import { supabase } from '../lib/supabase.js';

export function createStoreMapRepository(client) {
  async function read(table, fields, configure = (q) => q) {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await configure(client.from(table).select(fields))
        .order('id').range(offset, offset + 999);
      if (error) throw Object.assign(new Error('지도 정보를 불러오지 못했습니다.', { cause: error }), { status: 500 });
      rows.push(...(data || []));
      if (!data || data.length < 1000) return rows;
    }
  }
  return {
    async load(productId) {
      const [stores, listings, products, regions, hours] = await Promise.all([
        read('stores', 'id,name,address,latitude,longitude,thumbnail_url,region_id,pickup_available,delivery_available,status,temporary_closed,view_count,created_at', (q) => q.eq('status', 'ACTIVE')),
        read('store_products', 'id,store_id,product_id,stock,status,pickup_available,delivery_available', (q) => {
          q = q.in('status', ['ON_SALE', 'SOLD_OUT']);
          return productId ? q.eq('product_id', productId) : q;
        }),
        read('products', 'id,name,work_title,character_name,thumbnail_url,status', (q) => {
          q = q.in('status', ['ON_SALE', 'SOLD_OUT']);
          return productId ? q.eq('id', productId) : q;
        }),
        read('regions', 'id,name'),
        read('store_business_hours', '*'),
      ]);
      return { stores, listings, products, regions, hours };
    },
  };
}
export const storeMapRepository = createStoreMapRepository(supabase);
