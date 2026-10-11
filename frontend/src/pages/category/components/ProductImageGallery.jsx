import { useState } from 'react';

function GalleryImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div className="category-image-placeholder" role="img" aria-label={alt}>
        이미지 준비 중
      </div>
    );
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

export default function ProductImageGallery({
  images = [],
  thumbnailUrl,
  productName,
  soldOut = false,
}) {
  const urls = [
    ...new Set(
      [thumbnailUrl, ...images.map((image) => image.image_url || image.url)].filter(Boolean)
    ),
  ];
  const [selected, setSelected] = useState(0);
  const current = urls[selected] || urls[0];
  return (
    <section className="category-gallery" aria-label="상품 이미지">
      <div className="category-main-image">
        <GalleryImage key={current || 'empty'} src={current} alt={productName} />
        {soldOut && <div className="category-soldout-overlay">SOLD OUT</div>}
        {urls.length > 0 && (
          <span className="category-gallery-count">
            {Math.max(1, urls.indexOf(current) + 1)}/{urls.length}
          </span>
        )}
      </div>
      {urls.length > 1 && (
        <div className="category-image-thumbnails">
          {urls.map((url, index) => (
            <button
              type="button"
              key={url}
              aria-pressed={current === url}
              aria-label={`상품 이미지 ${index + 1}`}
              onClick={() => setSelected(index)}
            >
              <GalleryImage src={url} alt="" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
