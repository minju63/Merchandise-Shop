import { baseOptions } from './productSortOptions.js';

// sortOptions: 다른 화면(찜 목록 등)에서 정렬 목록을 바꿔 쓸 때 넘긴다.
export default function ProductSort({ value = 'popular', onChange, compact = false, sortOptions = baseOptions }) {
  // 입고 예정순은 홈의 입고 예정 전체보기에서 들어왔을 때만 보이고, 다른 정렬을 고르면 사라진다.
  const options = value === 'upcoming' ? [['upcoming', '입고 예정순'], ...sortOptions] : sortOptions;
  return (
    <details className="category-sort category-sort-dropdown">
      {!compact && '정렬'}
      <summary aria-label="상품 정렬">{options.find(([key]) => key === value)?.[1] || options[0][1]}<span className="sort-chevron" aria-hidden="true" /></summary>
      <div className="category-sort-options" aria-label="정렬 방식">
        {options.map(([key, label]) => <button type="button" key={key} aria-pressed={value === key} onClick={(event) => {
          onChange(key);
          event.currentTarget.closest('details').open = false;
        }}><span>{label}</span>{value === key && <span aria-hidden="true">✓</span>}</button>)}
      </div>
    </details>
  );
}
