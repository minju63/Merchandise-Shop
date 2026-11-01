import ShowcaseImage from './ShowcaseImage.jsx';
import { useRef } from 'react';

export default function ShowcaseBoard({ showcase, items = showcase.items ?? [], selectedId, onSelect, onMove, onPinch, onItemClick }) {
  const pointers = useRef(new Map()).current;
  const background = showcase.background_id || 'pastel';
  return (
    <div className={`showcase-board showcase-board--${background}`} aria-label="2D 굿즈 진열장">
      <div className="showcase-board__shelf shelf-one" />
      <div className="showcase-board__shelf shelf-two" />
      <div className="showcase-board__shelf shelf-three" />
      {[...items].sort((a, b) => a.layer_order - b.layer_order).map((item) => {
        const Element = onMove || onItemClick ? 'button' : 'span';
        return <Element key={item.id} {...(Element === 'button' ? { type: 'button' } : {})}
          className={`showcase-board__item ${selectedId === item.id ? 'is-selected' : ''}`}
          style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`,
            width: `${26 * item.scale}%`, zIndex: item.layer_order + 1,
            transform: `translate(-50%, -50%) rotate(${item.rotation}deg)` }}
          onClick={() => onItemClick?.(item)}
          onPointerDown={(event) => {
            if (!onMove) return;
            event.preventDefault();
            onSelect?.(item.id);
            event.currentTarget.setPointerCapture(event.pointerId);
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            event.currentTarget.dataset.startX = String(event.clientX);
            event.currentTarget.dataset.startY = String(event.clientY);
            event.currentTarget.dataset.itemX = String(item.x);
            event.currentTarget.dataset.itemY = String(item.y);
          }}
          onPointerMove={(event) => {
            if (!onMove || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const bounds = event.currentTarget.parentElement.getBoundingClientRect();
            onMove(item.id,
              Math.max(0, Math.min(1, Number(event.currentTarget.dataset.itemX) + (event.clientX - Number(event.currentTarget.dataset.startX)) / bounds.width)),
              Math.max(0, Math.min(1, Number(event.currentTarget.dataset.itemY) + (event.clientY - Number(event.currentTarget.dataset.startY)) / bounds.height)));
            if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.size === 2 && onPinch) {
              const [a, b] = [...pointers.values()];
              const distance = Math.hypot(a.x - b.x, a.y - b.y);
              const before = Number(event.currentTarget.dataset.pinchDistance || distance);
              if (before > 0) onPinch(item.id, distance / before);
              event.currentTarget.dataset.pinchDistance = String(distance);
            }
          }}
          onPointerUp={(event) => { pointers.delete(event.pointerId); delete event.currentTarget.dataset.pinchDistance; }}
          onPointerCancel={(event) => { pointers.delete(event.pointerId); delete event.currentTarget.dataset.pinchDistance; }}
          aria-label={item.goods_name || item.product?.name || '굿즈'}>
          <ShowcaseImage src={item.imageUrl || item.product?.imageUrl} alt="" draggable={false} />
        </Element>;
      })}
    </div>
  );
}
