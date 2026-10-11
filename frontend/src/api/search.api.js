import client from './client.js';

export const searchApi = {
  products: (params) => client.get('/search/products', { params }),
  stores: async () => {
    const stores = [];
    for (let page = 1; ; page += 1) {
      const response = await client.get('/stores', { params: { sort: 'popular', page, size: 100 } });
      stores.push(...response.data.items);
      if (!response.data.items.length || stores.length >= response.data.totalCount) return stores;
    }
  },
};
