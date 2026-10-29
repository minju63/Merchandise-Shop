import client from './client.js';

export const searchApi = {
  products: (params) => client.get('/search/products', { params }),
  // 최근 24시간 검색 기록으로 집계한 인기 검색어
  popular: () => client.get('/search/popular').then((response) => response.data),
  categories: (type) => client.get('/categories', { params: { type } }).then((response) => response.data),
  stores: async () => {
    const stores = [];
    for (let page = 1; ; page += 1) {
      const response = await client.get('/stores', { params: { sort: 'popular', page, size: 100 } });
      stores.push(...response.data.items);
      if (!response.data.items.length || stores.length >= response.data.totalCount) return stores;
    }
  },
};
