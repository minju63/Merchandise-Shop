import assert from 'node:assert/strict';
import test from 'node:test';
import { sortWishRows } from '../src/services/wishlist.service.js';

// 최근 찜한 순으로 들어온 행 (DB 순서)
const row = (name, storeProduct, product = {}) => ({ name, store_product: { ...storeProduct, product } });
const rows = [
  row('a', { price: 5000, stock: 0, sales_count: 3 }, { wish_count: 1, released_at: '2026-01-01' }),
  row('b', { price: 12000, stock: 7, sales_count: 9 }, { wish_count: 5, released_at: null }),
  row('c', { price: 1500, stock: 2, sales_count: 3 }, { wish_count: 5, released_at: '2026-06-01' }),
];
const names = (sorted) => sorted.map((item) => item.name).join('');

test('최근 찜한 순은 DB 순서를 그대로 둔다', () => {
  assert.equal(names(sortWishRows(rows, 'recent')), 'abc');
});

test('가격·재고·찜 수로 정렬하고, 같은 값은 최근 찜한 순을 유지한다', () => {
  assert.equal(names(sortWishRows(rows, 'price_asc')), 'cab');
  assert.equal(names(sortWishRows(rows, 'price_desc')), 'bac');
  assert.equal(names(sortWishRows(rows, 'stock')), 'bca');
  assert.equal(names(sortWishRows(rows, 'stock_asc')), 'acb');
  assert.equal(names(sortWishRows(rows, 'wishlist')), 'bca');
  assert.equal(names(sortWishRows(rows, 'sales')), 'bac');
});

test('출시일이 없는 상품은 최신순에서 맨 뒤로 간다', () => {
  assert.equal(names(sortWishRows(rows, 'newest')), 'cab');
});
