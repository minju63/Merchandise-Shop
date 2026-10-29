export const EMPTY_FILTERS = {
  contentCategories: [],
  goodsCategories: [],
  regions: [],
  minPrice: '',
  maxPrice: '',
  pricePreset: '',
  inStock: false,
  pickup: false,
  delivery: false,
  includeSoldOut: false,
  includeUpcoming: false,
  discountOnly: false,
  discountBands: [],
  ratingMin: '',
  wishlistMin: '',
};

export { REGIONS } from '../../constants/regions.js';

export const PRICE_PRESETS = [
  { id: '', label: '전체', min: '', max: '' },
  { id: 'under10', label: '1만원 이하', min: '', max: '10000' },
  { id: '10to30', label: '1만원~3만원', min: '10000', max: '30000' },
  { id: '30to50', label: '3만원~5만원', min: '30000', max: '50000' },
  { id: '50to100', label: '5만원~10만원', min: '50000', max: '100000' },
  { id: 'over100', label: '10만원 이상', min: '100000', max: '' },
];

export function filterParams(filters) {
  if (!filters) return {};
  return {
    contentCategories: filters.contentCategories.join(',') || undefined,
    goodsCategories: filters.goodsCategories.join(',') || undefined,
    regions: filters.regions.join(',') || undefined,
    minPrice: filters.minPrice || undefined,
    maxPrice: filters.maxPrice || undefined,
    inStock: filters.inStock || undefined,
    pickup: filters.pickup || undefined,
    delivery: filters.delivery || undefined,
    // 품절·입고 예정 상품은 기본으로 제외하고, 포함을 켰을 때만 조건을 보내지 않는다.
    includeSoldOut: filters.includeSoldOut || filters.inStock ? undefined : false,
    includeUpcoming: filters.includeUpcoming || filters.inStock ? undefined : false,
    discountOnly: filters.discountOnly || undefined,
    discountBands: filters.discountBands.join(',') || undefined,
    ratingMin: filters.ratingMin || undefined,
    wishlistMin: filters.wishlistMin || undefined,
  };
}

export function toggleArray(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function chipsFor(filters, categories = []) {
  const labels = new Map(categories.map((category) => [category.id, category.name]));
  const chips = [];
  for (const field of ['contentCategories', 'goodsCategories', 'regions']) {
    for (const value of filters[field])
      chips.push({
        key: `${field}:${value}`,
        label: labels.get(value) || value,
        remove: (current) => ({
          ...current,
          [field]: current[field].filter((item) => item !== value),
        }),
      });
  }
  if (filters.minPrice || filters.maxPrice) {
    const preset = PRICE_PRESETS.find((item) => item.id === filters.pricePreset);
    chips.push({
      key: 'price',
      label:
        preset?.label ||
        `${filters.minPrice ? Number(filters.minPrice).toLocaleString() : '0'}원~${filters.maxPrice ? `${Number(filters.maxPrice).toLocaleString()}원` : ''}`,
      remove: (current) => ({ ...current, minPrice: '', maxPrice: '', pricePreset: '' }),
    });
  }
  for (const [key, label] of [
    ['inStock', '재고 있음'],
    ['pickup', '픽업 가능'],
    ['delivery', '배달 가능'],
    ['discountOnly', '할인 중'],
  ]) {
    if (filters[key])
      chips.push({
        key,
        label,
        remove: (current) => ({
          ...current,
          [key]: false,
        }),
      });
  }
  if (filters.includeSoldOut)
    chips.push({
      key: 'includeSoldOut',
      label: '품절 상품 포함',
      remove: (current) => ({ ...current, includeSoldOut: false }),
    });
  if (filters.includeUpcoming)
    chips.push({
      key: 'includeUpcoming',
      label: '입고 예정 상품 포함',
      remove: (current) => ({ ...current, includeUpcoming: false }),
    });
  for (const band of filters.discountBands) {
    const label = {
      under10: '할인율 10% 이하',
      '10to30': '할인율 10~30%',
      over30: '할인율 30% 이상',
    }[band];
    chips.push({
      key: `discount:${band}`,
      label,
      remove: (current) => ({
        ...current,
        discountBands: current.discountBands.filter((item) => item !== band),
      }),
    });
  }
  if (filters.ratingMin)
    chips.push({
      key: 'rating',
      label: `별점 ${Number(filters.ratingMin).toFixed(1)} 이상`,
      remove: (current) => ({ ...current, ratingMin: '' }),
    });
  if (filters.wishlistMin)
    chips.push({
      key: 'wishlist',
      label: `찜 ${filters.wishlistMin}개 이상`,
      remove: (current) => ({ ...current, wishlistMin: '' }),
    });
  return chips;
}
