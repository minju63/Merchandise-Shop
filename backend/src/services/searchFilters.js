export function matchesSearchCategories(productId, filters, contentMatches, goodsMatches) {
  return (!filters.contentCategories?.length || contentMatches.has(productId))
    && (!filters.goodsCategories?.length || goodsMatches.has(productId));
}

export function matchesSearchFilters(item, filters) {
  const { minPrice, maxPrice, inStock, pickup, delivery, discountOnly, discountBands, includeUpcoming, ratingMin, wishlistMin } = filters;
  if (minPrice != null && (item.price == null || item.price < minPrice)) return false;
  if (maxPrice != null && (item.price == null || item.price > maxPrice)) return false;
  if (inStock && !(item.status === 'ON_SALE' && item.stock > 0)) return false;
  if (includeUpcoming === false && item.status === 'UPCOMING') return false;
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
