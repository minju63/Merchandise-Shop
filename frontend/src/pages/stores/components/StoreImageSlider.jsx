import { useState } from 'react';
import Icon from './Icon.jsx';
import { ImageWithFallback } from './StoreShell.jsx';

export default function StoreImageSlider({ images, name }) {
  const [index, setIndex] = useState(0);
  const current = Math.max(0, Math.min(index, images.length - 1));
  return (
    <div className="store-slider">
      <ImageWithFallback
        src={images[current]}
        alt={`${name} 매장 사진 ${current + 1}`}
        className="slider-image"
      />
      {images.length > 1 && (
        <>
          <button
            className="slider-arrow left"
            onClick={() => setIndex((current + images.length - 1) % images.length)}
            aria-label="이전 사진"
          >
            <Icon name="back" />
          </button>
          <button
            className="slider-arrow right"
            onClick={() => setIndex((current + 1) % images.length)}
            aria-label="다음 사진"
          >
            <Icon name="back" />
          </button>
          <span className="slide-count">
            {current + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
}
