import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_FILTERS,
  chipsFor,
  filterParams,
  toggleArray,
} from '../src/pages/search/searchFilters.js';

test('빠른 필터와 시트는 같은 API 조건으로 직렬화된다', () => {
  const filters = {
    ...EMPTY_FILTERS,
    contentCategories: ['idol'],
    goodsCategories: ['card'],
    regions: ['부산'],
    inStock: true,
    pickup: true,
    includeUpcoming: false,
  };
  assert.deepEqual(filterParams(filters), {
    contentCategories: 'idol',
    goodsCategories: 'card',
    regions: '부산',
    minPrice: undefined,
    maxPrice: undefined,
    inStock: true,
    pickup: true,
    delivery: undefined,
    includeUpcoming: undefined,
    discountOnly: undefined,
    discountBands: undefined,
    ratingMin: undefined,
    wishlistMin: undefined,
  });
  assert.equal(chipsFor(filters).length, 5);
  const stockChip = chipsFor(filters).find((chip) => chip.key === 'inStock');
  assert.equal(stockChip.remove(filters).includeUpcoming, true);
});

test('조건 칩 제거와 전체 초기화는 다른 조건을 보존한다', () => {
  const filters = { ...EMPTY_FILTERS, regions: ['서울', '부산'], goodsCategories: ['card'] };
  const regionChip = chipsFor(filters).find((chip) => chip.key === 'regions:부산');
  assert.deepEqual(regionChip.remove(filters).regions, ['서울']);
  assert.deepEqual(regionChip.remove(filters).goodsCategories, ['card']);
  assert.deepEqual(toggleArray(['서울'], '서울'), []);
  assert.deepEqual(filterParams({ ...EMPTY_FILTERS }).regions, undefined);
});
