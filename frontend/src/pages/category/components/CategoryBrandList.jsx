// 고른 분류(게임·아이돌 …)의 브랜드를 왼쪽에 세로로 보여준다. 기존 사이드바와 같은 모양이다.
export default function CategoryBrandList({ label, brands = [], selected, onSelect }) {
  return (
    <nav className="category-sidebar category-brand-list" aria-label={`${label} 브랜드`}>
      <button type="button" aria-pressed={!selected} onClick={() => onSelect('')}>
        전체
      </button>
      {brands.map((brand) => (
        <button
          key={brand.name}
          type="button"
          aria-pressed={selected === brand.name}
          onClick={() => onSelect(brand.name)}
        >
          {brand.name}
        </button>
      ))}
    </nav>
  );
}
