const options = [['popular', '인기순'], ['newest', '최신순'], ['price_asc', '낮은 가격순'], ['price_desc', '높은 가격순']];

export default function ProductSort({ value = 'popular', onChange, compact = false }) {
  return (
    <details className="category-sort category-sort-dropdown">
      {!compact && '정렬'}
      <summary aria-label="상품 정렬">{options.find(([key]) => key === value)?.[1] || '인기순'} <span aria-hidden="true">⌄</span></summary>
      <div className="category-sort-options" aria-label="정렬 방식">
        {options.map(([key, label]) => <button type="button" key={key} aria-pressed={value === key} onClick={(event) => {
          onChange(key);
          event.currentTarget.closest('details').open = false;
        }}><span>{label}</span>{value === key && <span aria-hidden="true">✓</span>}</button>)}
      </div>
    </details>
  );
}
