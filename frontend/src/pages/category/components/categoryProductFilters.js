export const PRODUCT_FILTER_KEYS = [
  'minPrice', 'maxPrice', 'regionId', 'regionIds', 'regionNames', 'discountOnly', 'ratingMin', 'wishlistMin',
  'inStock', 'pickup', 'delivery', 'includeUpcoming', 'includeSoldOut', 'brands',
];

// 판매 상태 필터: 기본값은 "품절 상품 포함"·"입고 예정 상품 포함" 둘 다 OFF(재고 있는 상품만)다.
// 주소에 inStock·includeUpcoming·includeSoldOut 이 하나도 없으면 기본값으로 본다.
export const SALE_STATUS = {
  inStock: { inStock: 'true', includeUpcoming: '', includeSoldOut: '' }, // 둘 다 OFF (기본)
  withSoldOut: { inStock: '', includeUpcoming: 'false', includeSoldOut: '' }, // 품절 상품 포함
  upcoming: { inStock: '', includeUpcoming: 'true', includeSoldOut: 'false' }, // 입고 예정 상품 포함
  all: { inStock: '', includeUpcoming: 'true', includeSoldOut: '' }, // 품절 + 입고 예정 상품 포함
};

export function withSaleStatusDefault(filters) {
  return filters.inStock || filters.includeUpcoming || filters.includeSoldOut
    ? filters
    : { ...filters, inStock: 'true' };
}

// 필터 값에서 두 체크박스의 상태를 읽는다.
export function saleChecks(filters) {
  const f = withSaleStatusDefault(filters);
  return {
    soldOut: f.inStock !== 'true' && f.includeSoldOut !== 'false',
    upcoming: f.inStock !== 'true' && f.includeUpcoming !== 'false',
  };
}

// 두 체크박스 상태에 맞는 필터 값
export function saleStatusFrom(soldOut, upcoming) {
  if (soldOut && upcoming) return SALE_STATUS.all;
  if (soldOut) return SALE_STATUS.withSoldOut;
  if (upcoming) return SALE_STATUS.upcoming;
  return SALE_STATUS.inStock;
}

// 기본값(재고 있는 상품만)과 다를 때 필터 칩에 보여줄 문구
export function saleStatusLabel(filters) {
  const { soldOut, upcoming } = saleChecks(filters);
  if (soldOut && upcoming) return '품절·입고 예정 상품 포함';
  if (soldOut) return '품절 상품 포함';
  return upcoming ? '입고 예정 상품 포함' : '';
}

export function categoryFilterContext(params) {
  const fixedContentCategoryId = params.get('contentCategoryId') || '';
  const fixedGoodsCategoryId = params.get('goodsCategoryId') || '';
  const unavailableGoodsType = Boolean(params.get('goodsType') && !fixedGoodsCategoryId);
  return {
    fixedContentCategoryId,
    fixedGoodsCategoryId,
    unavailableGoodsType,
  };
}

export function categoryProductQuery(params, { includePage = true } = {}) {
  const context = categoryFilterContext(params);
  const result = {};
  const contentCategoryId = context.fixedContentCategoryId;
  const goodsCategoryId = context.fixedGoodsCategoryId;
  if (contentCategoryId) result.contentCategoryId = contentCategoryId;
  if (goodsCategoryId) result.goodsCategoryId = goodsCategoryId;
  for (const key of [...(includePage ? ['sort', 'page', 'size'] : ['sort']), ...PRODUCT_FILTER_KEYS]) {
    if (params.has(key)) result[key] = params.get(key);
  }
  return withSaleStatusDefault(result);
}
