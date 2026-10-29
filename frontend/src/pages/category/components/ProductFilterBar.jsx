const QUICK_FILTERS = [
  ['inStock', '재고 있음'],
  ['pickup', '픽업 가능'],
  ['delivery', '배달 가능'],
];

import { SALE_STATUS, saleStatusLabel } from './categoryProductFilters.js';

export default function ProductFilterBar({
  filters, regions = [], onChange, onOpen, onReset,
}) {
  const chips = [];
  if (filters.minPrice || filters.maxPrice) {
    chips.push({
      key: 'price',
      label: `${Number(filters.minPrice || 0).toLocaleString('ko-KR')}원 ~ ${filters.maxPrice ? `${Number(filters.maxPrice).toLocaleString('ko-KR')}원` : '전체'}`,
      clear: { minPrice: '', maxPrice: '' },
    });
  }
  if (filters.regionId) {
    chips.push({
      key: 'regionId',
      label: regions.find((item) => item.id === filters.regionId)?.name || '선택한 지역',
      clear: { regionId: '' },
    });
  }
  for (const id of filters.regionIds.split(',').filter(Boolean)) {
    chips.push({
      key: `region:${id}`,
      label: regions.find((item) => item.id === id)?.name || '선택한 지역',
      clear: { regionIds: filters.regionIds.split(',').filter((item) => item !== id).join(','), regionId: '' },
    });
  }
  for (const name of filters.regionNames.split(',').filter(Boolean)) {
    chips.push({
      key: `regionName:${name}`,
      label: name,
      clear: { regionNames: filters.regionNames.split(',').filter((item) => item !== name).join(',') },
    });
  }
  for (const name of filters.brands.split(',').filter(Boolean)) {
    chips.push({
      key: `brand:${name}`,
      label: name,
      clear: { brands: filters.brands.split(',').filter((item) => item !== name).join(',') },
    });
  }
  if (filters.discountOnly === 'true') chips.push({ key: 'discountOnly', label: '할인 중인 굿즈만', clear: { discountOnly: '' } });
  // 판매 상태 기본값(재고 있는 상품만)과 다를 때만 표시한다.
  if (filters.inStock !== 'true') {
    chips.push({
      key: 'saleStatus',
      label: saleStatusLabel(filters),
      clear: SALE_STATUS.inStock,
    });
  }
  if (filters.ratingMin) chips.push({ key: 'ratingMin', label: `별점 ${Number(filters.ratingMin).toFixed(1)} 이상`, clear: { ratingMin: '' } });
  if (filters.wishlistMin) chips.push({ key: 'wishlistMin', label: `찜 ${filters.wishlistMin}개 이상`, clear: { wishlistMin: '' } });
  // 재고 있음은 기본값이라 필터 개수에 세지 않는다.
  const count = chips.length + QUICK_FILTERS.filter(([key]) => key !== 'inStock' && filters[key] === 'true').length;

  return (
    <div className="category-result-filters">
      <div className="category-quick-filters" aria-label="빠른 굿즈 필터">
        <button type="button" className={count ? 'has-filters' : ''} onClick={onOpen}>
          ☷ 필터{count ? ` ${count}` : ''}
        </button>
        {QUICK_FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filters[key] === 'true'}
            onClick={() => onChange(key === 'inStock'
              ? (filters.inStock === 'true' ? SALE_STATUS.all : SALE_STATUS.inStock)
              : { [key]: filters[key] === 'true' ? '' : 'true' })}
          >
            {filters[key] === 'true' ? '✓ ' : ''}{label}
          </button>
        ))}
      </div>
      {count > 0 && <div className="category-applied-filters" aria-label="적용된 필터">
        {chips.map((chip) => (
          <button key={chip.key} type="button" aria-label={`${chip.label} 필터 해제`} onClick={() => onChange(chip.clear)}>
            {chip.label} ×
          </button>
        ))}
        <button type="button" className="category-applied-clear" onClick={onReset}>전체 초기화</button>
      </div>}
    </div>
  );
}
