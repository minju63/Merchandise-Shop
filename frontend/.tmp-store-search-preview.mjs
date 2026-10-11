import { createServer } from 'node:http';

const storeId = '00000000-0000-4000-8000-000000000050';
const categories = [
  { id: '00000000-0000-4000-8000-000000000010', name: '게임', type: 'CONTENT' },
  { id: '00000000-0000-4000-8000-000000000011', name: '아이돌', type: 'CONTENT' },
  { id: '00000000-0000-4000-8000-000000000020', name: '키링', type: 'GOODS' },
];
const products = [
  { storeProductId: 'item-1', storeId, storeName: '서울 굿즈마켓', name: '게임 카드', price: 12000, stock: 5, status: 'ON_SALE', pickupAvailable: true, deliveryAvailable: true, image: null },
  { storeProductId: 'item-2', storeId, storeName: '서울 굿즈마켓', name: '아이돌 카드', price: 18000, stock: 3, status: 'ON_SALE', pickupAvailable: true, deliveryAvailable: false, image: null },
  { storeProductId: 'item-3', storeId, storeName: '서울 굿즈마켓', name: '카드 키링', price: 9000, stock: 0, status: 'SOLD_OUT', pickupAvailable: true, deliveryAvailable: true, image: null },
];

createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  let data;
  if (url.pathname === `/api/v1/stores/${storeId}`) {
    data = { id: storeId, name: '서울 굿즈마켓' };
  } else if (url.pathname === '/api/v1/categories') {
    data = categories.filter((item) => item.type === url.searchParams.get('type'));
  } else if (url.pathname === '/api/v1/search/products') {
    let items = products;
    if (url.searchParams.has('contentCategories')) {
      items = items.filter((item) => item.name.includes('게임'));
    }
    if (url.searchParams.get('inStock') === 'true') {
      items = items.filter((item) => item.stock > 0);
    }
    data = {
      items,
      totalCount: items.length,
      page: 1,
      size: 20,
      priceDistribution: { min: 9000, max: 18000, bins: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
    };
  } else {
    response.statusCode = 404;
    data = null;
  }
  response.end(JSON.stringify({ success: response.statusCode !== 404, data, message: null }));
}).listen(4180, '127.0.0.1', () => process.stdout.write('preview API ready\n'));
