import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRODUCT_FILTER_KEYS,
  categoryFilterContext,
  categoryProductQuery,
} from '../src/pages/category/components/categoryProductFilters.js';

test('카테고리 전체 보기에서는 기존 카테고리 필터 쿼리를 무시한다', () => {
  const params = new URLSearchParams({
    allGoods: 'true',
    filterContentCategoryId: 'content-from-filter',
    filterGoodsCategoryId: 'goods-from-filter',
    minPrice: '10000',
  });
  params.set('ratingMin', '4.5');
  params.set('wishlistMin', '50');
  assert.deepEqual(categoryProductQuery(params), { minPrice: '10000', ratingMin: '4.5', wishlistMin: '50' });
});

test('카테고리에서 고른 대분류와 소분류만 상품 쿼리에 반영한다', () => {
  const contentOnly = new URLSearchParams({
    contentCategoryId: 'fixed-content',
    filterContentCategoryId: 'stale-content',
    filterGoodsCategoryId: 'filtered-goods',
  });
  assert.deepEqual(categoryProductQuery(contentOnly), { contentCategoryId: 'fixed-content' });

  const goodsOnly = new URLSearchParams({
    goodsCategoryId: 'fixed-goods',
    filterContentCategoryId: 'filtered-content',
    filterGoodsCategoryId: 'stale-goods',
  });
  assert.deepEqual(categoryProductQuery(goodsOnly), { goodsCategoryId: 'fixed-goods' });
});

test('양쪽이 고정됐거나 아직 등록되지 않은 굿즈 유형이면 기존 필터를 무시한다', () => {
  const both = new URLSearchParams({
    contentCategoryId: 'fixed-content',
    goodsCategoryId: 'fixed-goods',
    filterContentCategoryId: 'stale-content',
    filterGoodsCategoryId: 'stale-goods',
  });
  assert.deepEqual(categoryProductQuery(both), {
    contentCategoryId: 'fixed-content',
    goodsCategoryId: 'fixed-goods',
  });

  const planned = new URLSearchParams({
    goodsType: '등록 전 유형',
    filterGoodsCategoryId: 'another-goods',
  });
  assert.equal(categoryFilterContext(planned).unavailableGoodsType, true);
  assert.deepEqual(categoryProductQuery(planned), {});
});

test('검색 필터와 같은 가격·지역·후기·판매 조건을 카테고리 상품 요청에 전달한다', () => {
  const params = new URLSearchParams({
    contentCategoryId: 'selected-content',
    minPrice: '10000',
    maxPrice: '30000',
    regionIds: 'region-one,region-two',
    discountOnly: 'true',
    ratingMin: '4.5',
    wishlistMin: '50',
    pickup: 'true',
    includeUpcoming: 'false',
  });
  assert.deepEqual(categoryProductQuery(params), {
    contentCategoryId: 'selected-content',
    minPrice: '10000',
    maxPrice: '30000',
    regionIds: 'region-one,region-two',
    discountOnly: 'true',
    ratingMin: '4.5',
    wishlistMin: '50',
    pickup: 'true',
    includeUpcoming: 'false',
  });
});

test('17개 지역명 선택은 카테고리 상품 요청에 전달되고 초기화 대상에 포함된다', () => {
  const params = new URLSearchParams({ regionNames: '충북,제주' });
  assert.deepEqual(categoryProductQuery(params), { regionNames: '충북,제주' });
  assert.ok(PRODUCT_FILTER_KEYS.includes('regionNames'));
});
