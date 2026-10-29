import { BRAND_GROUPS } from '../../constants/brands.js';

// 브랜드 분류(game·idol …)와 카테고리 id(상품의 interestCategoryIds)를 이어주는 표
export const BRAND_GROUP_CATEGORY_ID = {
  game: 'game',
  idol: 'idol',
  animation: 'animation',
  film: 'film_drama',
  character: 'character',
};

export const brandGroupFor = (categoryId) => BRAND_GROUPS.find(
  (group) => BRAND_GROUP_CATEGORY_ID[group.id] === categoryId
);

// 관심 카테고리에 속한 상품인지 확인한다.
// 그 카테고리에서 브랜드를 골랐다면 고른 브랜드의 상품만, 고르지 않았다면 카테고리 전체를 추천한다.
export function matchesInterests(product, categoryIds, brands) {
  return categoryIds.some((categoryId) => {
    if (!product.interestCategoryIds?.includes(categoryId)) return false;
    const group = brandGroupFor(categoryId);
    const picked = group ? group.brands.map((brand) => brand.name).filter((name) => brands.includes(name)) : [];
    return picked.length === 0 || picked.includes(product.brand);
  });
}

// 이 작품 분류에서 브랜드를 하나라도 골랐는지 (고르지 않았으면 "전체"를 고른 것과 같다)
export function hasPickedBrands(categoryId, brands) {
  const group = brandGroupFor(categoryId);
  return Boolean(group) && group.brands.some((brand) => brands.includes(brand.name));
}
