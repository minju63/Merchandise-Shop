import GoodsTypeIcon from './GoodsTypeIcon.jsx';
import { useState } from 'react';

function GoodsArtwork({ category }) {
  const [failedUrl, setFailedUrl] = useState(null);
  return category.imageUrl && category.imageUrl !== failedUrl
    ? <img src={category.imageUrl} alt="" loading="lazy" onError={() => setFailedUrl(category.imageUrl)} />
    : <GoodsTypeIcon name={category.name} />;
}

export default function GoodsTypeGrid({ categories = [], onSelect, onSelectAll }) {
  return (
    <div className="category-goods-grid" aria-label="굿즈 유형">
      {onSelectAll && <button type="button" onClick={onSelectAll}>
        <span className="category-goods-art" aria-hidden="true"><GoodsTypeIcon name="모두 보기" /></span>
        <span className="category-goods-label">모두 보기</span>
      </button>}
      {categories.map((category) => (
        <button
          key={category.name}
          type="button"
          onClick={() => onSelect(category.id, category.name)}
        >
          <span className="category-goods-art" aria-hidden="true">
            <GoodsArtwork category={category} />
          </span>
          <span className="category-goods-label">{category.name}</span>
        </button>
      ))}
    </div>
  );
}
