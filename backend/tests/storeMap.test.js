import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapResult, distanceKm } from '../src/services/storeMap.service.js';
import { parseMapQuery } from '../src/controllers/storeMap.controller.js';
import { createStoreMapRepository } from '../src/repositories/storeMap.repository.js';
import { storeMapRepository } from '../src/repositories/storeMap.repository.js';
import express from 'express';
import storeRoutes from '../src/routes/store.routes.js';
import { createProductRouter } from '../src/routes/product.routes.js';

function fixture() {
  return {
    stores: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: `매장 ${id}`, status: 'ACTIVE',
      address: '서울 마포구', latitude: i === 3 ? null : 37.55 + i / 100, longitude: 126.92,
      pickup_available: true, delivery_available: true, region_id: 'seoul', view_count: i })),
    products: [{ id: 'p', name: '시크릿 키링', work_title: '먼작귀', character_name: '치이카와', status: 'ON_SALE' }],
    listings: ['a', 'b', 'c', 'd'].map((store_id, i) => ({ id: `l${i}`, store_id, product_id: 'p',
      stock: [12, 8, 5, 3][i], status: ['ON_SALE', 'SOLD_OUT', 'HIDDEN', 'ON_SALE'][i],
      pickup_available: store_id !== 'b', delivery_available: true })),
    regions: [{ id: 'seoul', name: '서울' }], hours: [],
  };
}
test('상품 마커는 판매·품절만 표시하고 SOLD_OUT의 잔여 수량은 구매 가능으로 판정하지 않는다', () => {
  const result = buildMapResult(fixture(), { productId: 'p', sort: 'stock' });
  assert.deepEqual(result.items.map((s) => s.id), ['a', 'b']);
  assert.equal(result.items[1].stock, 8);
  assert.equal(result.items[1].inStock, false);
  assert.equal(result.items[1].status, 'SOLD_OUT');
  assert.equal(result.noCoordinateCount, 1);
  assert.equal(result.inStockCount, 1);
});
test('선택한 굿즈의 이름과 대표 이미지를 결과가 없는 검색에도 제공한다', () => {
  const data = fixture();
  data.products[0].thumbnail_url = 'https://example.com/keyring.png';
  const result = buildMapResult(data, { productId: 'p', regionId: 'missing' });
  assert.equal(result.items.length, 0);
  assert.equal(result.product.name, '시크릿 키링');
  assert.equal(result.product.thumbnailUrl, 'https://example.com/keyring.png');
});
test('상품·매장 수령 조건과 재고·지역 필터를 함께 적용한다', () => {
  const data = fixture();
  assert.deepEqual(buildMapResult(data, { productId: 'p', pickup: true, inStock: true, regionId: 'seoul' }).items.map((s) => s.id), ['a']);
  data.stores[0].pickup_available = false;
  assert.equal(buildMapResult(data, { productId: 'p', pickup: true }).items.length, 0);
});
test('지역·매장·작품·캐릭터·상품명을 검색하고 판매 중지 상품은 제외한다', () => {
  for (const keyword of ['마포', '매장 a', '먼작귀', '치이카와', '시크릿키링']) {
    assert.ok(buildMapResult(fixture(), { keyword }).items.some((s) => s.id === 'a'));
  }
  const data = fixture();
  data.products[0].status = 'HIDDEN';
  assert.equal(buildMapResult(data, { productId: 'p' }).items.length, 0);
  assert.equal(buildMapResult(data, { keyword: '먼작귀' }).products.length, 0);
  assert.equal(buildMapResult(data, { keyword: '없는 검색어' }).items.length, 0);
});
test('거리·반경·지도 범위를 적용한다', () => {
  assert.equal(distanceKm({ latitude: 37, longitude: 127 }, { latitude: 37, longitude: 127 }), 0);
  assert.deepEqual(buildMapResult(fixture(), { origin: { latitude: 37.55, longitude: 126.92 }, radius: 0.1, sort: 'distance' }).items.map((s) => s.id), ['a']);
  assert.equal(buildMapResult(fixture(), { bounds: { south: 38, north: 39, west: 126, east: 128 } }).items.length, 0);
});
test('검색 범위 밖의 판매 매장도 전체 판매 매장 수에는 포함한다', () => {
  const result = buildMapResult(fixture(), {
    productId: 'p', origin: { latitude: 35.1, longitude: 129 }, radius: 20,
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.sellerCount, 3);
  assert.equal(buildMapResult(fixture(), { productId: 'missing' }).sellerCount, 0);
});
test('잘못된 입력과 위치 없는 거리 검색을 거부한다', () => {
  for (const query of [{ productId: 'bad' }, { openNow: 'yes' }, { latitude: '91', longitude: '127' }, { latitude: '37' }, { radius: '5' }, { sort: 'distance' }, { keyword: ['x'] }, { south: '38', north: '37', west: '126', east: '128' }]) {
    assert.throws(() => parseMapQuery(query), { status: 400 });
  }
  assert.equal(parseMapQuery({ pickup: 'true', inStock: 'false' }).pickup, true);
});
test('좌표 없는 매장의 원본은 유지하며 재고 0 및 모두 품절을 구분한다', () => {
  const data = fixture();
  data.listings[0].stock = 0;
  const result = buildMapResult(data, { productId: 'p' });
  assert.equal(result.items.length, 2);
  assert.equal(result.inStockCount, 0);
  assert.equal(buildMapResult(data, { productId: 'p', inStock: true }).items.length, 0);
  assert.equal(data.stores.length, 4);
});
test('저장소는 상품 ID·판매 상태를 DB에서 제한한다', async () => {
  const calls = [];
  const client = { from(table) {
    const q = { select() { return q; }, eq(...args) { calls.push([table, ...args]); return q; },
      in(...args) { calls.push([table, ...args]); return q; }, order() { return q; },
      async range() { return { data: [], error: null }; } };
    return q;
  } };
  await createStoreMapRepository(client).load('p');
  assert.ok(calls.some((c) => c[0] === 'store_products' && c[1] === 'product_id' && c[2] === 'p'));
  assert.ok(calls.some((c) => c[0] === 'stores' && c[2] === 'ACTIVE'));
});
test('지도 경로는 매장 상세보다 먼저 처리되고 두 API는 동일한 재고 응답을 반환한다', async () => {
  const original = storeMapRepository.load;
  const id = '00000000-0000-4000-8000-000000000001';
  const data = fixture();
  data.products[0].id = id;
  data.listings.forEach((l) => { l.product_id = id; });
  storeMapRepository.load = async () => data;
  const app = express();
  app.use('/api/v1/stores', storeRoutes);
  app.use('/api/v1/products', createProductRouter());
  app.use((err, req, res, next) => { res.status(err.status || 500).json({ message: err.message }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const map = await fetch(`${base}/stores/map?productId=${id}&sort=stock`);
    const product = await fetch(`${base}/products/${id}/stores?sort=stock`);
    assert.equal(map.status, 200);
    assert.equal(map.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await map.json(), await product.json());
    const bad = await fetch(`${base}/stores/map?inStock=invalid`);
    assert.equal(bad.status, 400);
  } finally {
    storeMapRepository.load = original;
    await new Promise((resolve) => server.close(resolve));
  }
});
