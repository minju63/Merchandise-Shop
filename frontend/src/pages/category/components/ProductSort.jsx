const baseOptions = [
  ['popular', '인기순'],
  ['sales', '판매순'],
  ['newest', '최신순'],
  ['wishlist', '찜 많은 순'],
  ['stock', '재고 많은 순'],
  ['stock_asc', '재고 적은 순'],
  ['price_asc', '낮은 가격 순'],
  ['price_desc', '높은 가격 순'],
];

export default function ProductSort({ value = 'popular', onChange, compact = false }) {
  // 입고 예정순은 홈의 입고 예정 전체보기에서 들어왔을 때만 보이고, 다른 정렬을 고르면 사라진다.
  const options = value === 'upcoming' ? [['upcoming', '입고 예정순'], ...baseOptions] : baseOptions;
  return (
    <details className="category-sort category-sort-dropdown">
      {!compact && '정렬'}
      <summary aria-label="상품 정렬">{options.find(([key]) => key === value)?.[1] || '인기순'} <span aria-hidden="true">⌄</span></summary>
      <div className="category-sort-options" aria-label="정렬 방식">
        {options.map(([key, label]) => <button type="button" key={key} aria-pressed={value === key} disabled={key === 'wishlist'} onClick={(event) => {
          onChange(key);
          event.currentTarget.closest('details').open = false;
        }}><span>{label}</span>{value === key && <span aria-hidden="true">✓</span>}</button>)}
      </div>
    </details>
  );
}
