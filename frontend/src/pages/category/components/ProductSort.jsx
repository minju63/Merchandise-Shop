export default function ProductSort({ value = 'popular', onChange, compact = false }) {
  return (
    <label className="category-sort">
      {!compact && '정렬'}
      <select
        aria-label="상품 정렬"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="popular">인기순</option>
        <option value="newest">최신순</option>
        <option value="price_asc">낮은 가격순</option>
        <option value="price_desc">높은 가격순</option>
      </select>
    </label>
  );
}
