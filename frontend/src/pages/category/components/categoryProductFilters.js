export const PRODUCT_FILTER_KEYS = [
  'minPrice', 'maxPrice', 'regionId', 'regionIds', 'regionNames', 'discountOnly', 'ratingMin', 'wishlistMin',
  'inStock', 'pickup', 'delivery', 'includeUpcoming',
];

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
  return result;
}
