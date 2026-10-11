export default function ProductFilterBar({ filters, regions = [], onOpen, onReset, children }) {
  const labels = [];
  if (filters.minPrice || filters.maxPrice)
    labels.push(`${filters.minPrice || '0'}원 ~ ${filters.maxPrice || '제한 없음'}`);
  if (filters.regionId)
    labels.push(regions.find((region) => region.id === filters.regionId)?.name || '지역 선택');
  if (filters.inStock === 'true') labels.push('구매 가능');
  if (filters.pickup === 'true') labels.push('픽업');
  if (filters.delivery === 'true') labels.push('배송');
  return (
    <div className="category-filter-bar">
      {children}
      <button type="button" onClick={() => onOpen('price')}>
        가격⌄
      </button>
      <button type="button" onClick={() => onOpen('status')}>
        상태⌄
      </button>
      <button type="button" onClick={() => onOpen('region')}>
        지역⌄
      </button>
      <button type="button" onClick={() => onOpen('all')}>
        필터{labels.length ? ` (${labels.length})` : ''}
      </button>
      {labels.map((label) => (
        <span className="category-chip" key={label}>
          {label}
        </span>
      ))}
      {labels.length > 0 && (
        <button type="button" onClick={onReset}>
          필터 초기화
        </button>
      )}
    </div>
  );
}
