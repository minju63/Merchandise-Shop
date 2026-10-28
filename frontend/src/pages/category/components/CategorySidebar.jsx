export default function CategorySidebar({ categories = [], selectedId, onSelect }) {
  return (
    <nav className="category-sidebar" aria-label="콘텐츠 카테고리">
      <button type="button" aria-pressed={!selectedId} onClick={() => onSelect('')}>
        전체
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          aria-pressed={selectedId === category.id}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </button>
      ))}
    </nav>
  );
}
