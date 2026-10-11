export default function GoodsTypeGrid({ categories = [], onSelect }) {
  return (
    <div className="category-goods-grid" aria-label="굿즈 유형">
      {categories.map((category) => (
        <button
          key={category.name}
          type="button"
          onClick={() => onSelect(category.id, category.name)}
        >
          <span className="category-goods-art" aria-hidden="true">
            {category.imageUrl ? <img src={category.imageUrl} alt="" /> : <span>◇</span>}
          </span>
          <span className="category-goods-label">{category.name}</span>
        </button>
      ))}
    </div>
  );
}
