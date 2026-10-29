export function matchesSearchCategories(productId, filters, contentMatches, goodsMatches) {
  return (!filters.contentCategories?.length || contentMatches.has(productId))
    && (!filters.goodsCategories?.length || goodsMatches.has(productId));
}

export function matchesSearchFilters(item, filters) {
  const { minPrice, maxPrice, inStock, pickup, delivery, discountOnly, discountBands, includeUpcoming, includeSoldOut, ratingMin, wishlistMin } = filters;
  if (minPrice != null && (item.price == null || item.price < minPrice)) return false;
  if (maxPrice != null && (item.price == null || item.price > maxPrice)) return false;
  if (inStock && !(item.status === 'ON_SALE' && item.stock > 0)) return false;
  // 품절 상품 제외: 품절이어도 재입고일이 남은 상품은 입고 예정으로 보고 includeUpcoming 기준을 따른다.
  const soldOut = item.status === 'SOLD_OUT' || (item.status === 'ON_SALE' && item.stock <= 0);
  const restockSoon = Boolean(item.restockExpectedAt) && new Date(item.restockExpectedAt) > new Date();
  if (includeSoldOut === false && soldOut && !restockSoon) return false;
  if (includeUpcoming === false && (item.status === 'UPCOMING' || (soldOut && restockSoon))) return false;
  if (pickup && !item.pickupAvailable) return false;
  if (delivery && !item.deliveryAvailable) return false;
  if (discountOnly && !(item.discountRate > 0)) return false;
  if (ratingMin !== undefined && !(item.ratingAverage >= ratingMin)) return false;
  if (wishlistMin !== undefined && !(item.wishlistCount >= wishlistMin)) return false;
  if (discountBands?.length) {
    const rate = item.discountRate;
    if (!(rate > 0 && discountBands.some((band) =>
      (band === 'under10' && rate <= 10)
      || (band === '10to30' && rate > 10 && rate < 30)
      || (band === 'over30' && rate >= 30)))) return false;
  }
  return true;
}
