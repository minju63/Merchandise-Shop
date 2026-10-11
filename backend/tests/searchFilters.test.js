import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesSearchCategories, matchesSearchFilters } from '../src/services/searchFilters.js';

const item = { price: 20000, stock: 2, status: 'ON_SALE', pickupAvailable: true, deliveryAvailable: false, discountRate: 10 };

test('카테고리 그룹 내부는 OR, 서로 다른 그룹은 AND로 결합한다', () => {
  const filters = { contentCategories: ['idol', 'game'], goodsCategories: ['card', 'keyring'] };
  assert.equal(matchesSearchCategories('product-1', filters, new Set(['product-1']), new Set(['product-1'])), true);
  assert.equal(matchesSearchCategories('product-1', filters, new Set(['product-1']), new Set()), false);
  assert.equal(matchesSearchCategories('product-1', { ...filters, goodsCategories: [] }, new Set(['product-1']), new Set()), true);
});

test('가격, 재고, 수령 방법은 같은 판매상품에 모두 적용한다', () => {
  assert.equal(matchesSearchFilters(item, { minPrice: 10000, maxPrice: 30000, inStock: true, pickup: true }), true);
  assert.equal(matchesSearchFilters(item, { maxPrice: 10000 }), false);
  assert.equal(matchesSearchFilters(item, { delivery: true }), false);
  assert.equal(matchesSearchFilters({ ...item, status: 'SOLD_OUT' }, { inStock: true }), false);
  assert.equal(matchesSearchFilters({ ...item, status: 'UPCOMING' }, { includeUpcoming: false }), false);
});

test('할인율 경계는 한 구간에만 포함하고 실제 할인율만 사용한다', () => {
  assert.equal(matchesSearchFilters(item, { discountBands: ['under10'] }), true);
  assert.equal(matchesSearchFilters(item, { discountBands: ['10to30'] }), false);
  assert.equal(matchesSearchFilters({ ...item, discountRate: 30 }, { discountBands: ['over30'] }), true);
  assert.equal(matchesSearchFilters({ ...item, discountRate: null }, { discountOnly: true }), false);
});

test('후기 평균과 찜 개수는 모두 실제 집계값이 있어야 통과한다', () => {
  assert.equal(matchesSearchFilters({ ...item, ratingAverage: 4.25, wishlistCount: 50 }, { ratingMin: 4, wishlistMin: 50 }), true);
  assert.equal(matchesSearchFilters({ ...item, ratingAverage: null, wishlistCount: 50 }, { ratingMin: 4 }), false);
  assert.equal(matchesSearchFilters({ ...item, ratingAverage: 4.25, wishlistCount: 49 }, { ratingMin: 4, wishlistMin: 50 }), false);
});
