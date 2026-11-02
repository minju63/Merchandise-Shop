import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { ImageWithFallback } from './StoreShell.jsx';

export default function StoreImageSlider({ images, name }) {
  const [index, setIndex] = useState(0);
  const swipe = useRef(null);
  const current = Math.max(0, Math.min(index, images.length - 1));
  const move = (direction) => {
    if (images.length < 2) return;
    setIndex((value) => (value + direction + images.length) % images.length);
  };
  const startSwipe = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest('button')) return;
    swipe.current = { pointerId: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const finishSwipe = (event) => {
    if (!swipe.current || swipe.current.pointerId !== event.pointerId) return;
    const distance = event.clientX - swipe.current.x;
    swipe.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (Math.abs(distance) >= 40) move(distance < 0 ? 1 : -1);
  };
  const cancelSwipe = (event) => {
    swipe.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  return (
    <div
      className="store-slider"
      onPointerDown={startSwipe}
      onPointerUp={finishSwipe}
      onPointerCancel={cancelSwipe}
    >
      <ImageWithFallback
        src={images[current]}
        alt={`${name} 매장 사진 ${current + 1}`}
        className="slider-image"
      />
      {images.length > 1 && (
        <>
          <button
            className="slider-arrow left"
            type="button"
            onClick={() => move(-1)}
            aria-label="이전 사진"
          >
            <Icon name="back" />
          </button>
          <button
            className="slider-arrow right"
            type="button"
            onClick={() => move(1)}
            aria-label="다음 사진"
          >
            <Icon name="back" />
          </button>
          <div className="slider-dots" aria-label={`${name} 매장 사진 선택`}>
            {images.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                className={`slider-dot${dotIndex === current ? ' is-active' : ''}`}
                aria-label={`${dotIndex + 1}번째 사진`}
                aria-current={dotIndex === current ? 'true' : undefined}
                onClick={() => setIndex(dotIndex)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
