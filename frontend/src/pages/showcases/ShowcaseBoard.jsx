import ShowcaseImage from './ShowcaseImage.jsx';
import { useRef } from 'react';

export default function ShowcaseBoard({ showcase, items = showcase.items ?? [], selectedId, onSelect, onMove, onPinch, onResize, onRotate, onRemove, onItemClick, onBackgroundMove, backgroundControls, cacheMedia = false }) {
  const pointers = useRef(new Map()).current;
  const gesture = useRef(null);
  const backgroundGesture = useRef(null);
  const background = showcase.background_id || 'pastel';
  const customBackground = Boolean(showcase.background_path && showcase.backgroundUrl);
  const selectedItem = onMove && items.find((item) => item.id === selectedId);
  const startTransform = (event, type) => {
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.parentElement.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    gesture.current = {
      type, pointerId: event.pointerId, itemId: selectedItem.id,
      centerX, centerY, scale: selectedItem.scale, rotation: selectedItem.rotation,
      distance: Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
      angle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveTransform = (event) => {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.centerX;
    const dy = event.clientY - start.centerY;
    if (start.type === 'resize') onResize?.(start.itemId, Math.round(start.scale * Math.hypot(dx, dy) / start.distance * 100) / 100);
    else onRotate?.(start.itemId, Math.round(start.rotation + (Math.atan2(dy, dx) - start.angle) * 180 / Math.PI));
  };
  const endTransform = (event) => {
    if (gesture.current?.pointerId === event.pointerId) gesture.current = null;
  };
  const startBackgroundMove = (event) => {
    if (event.button !== 0
      || event.target.closest('.showcase-board__item, .showcase-board__selection, .showcase-board__background-actions')) return;
    onSelect?.(null);
    if (!customBackground || !onBackgroundMove) return;
    const board = event.currentTarget;
    const photo = board.querySelector('.showcase-board__photo img');
    if (!photo?.naturalWidth || !photo.naturalHeight) return;
    const width = board.clientWidth;
    const height = board.clientHeight;
    const scale = Math.max(width / photo.naturalWidth, height / photo.naturalHeight);
    backgroundGesture.current = {
      pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      x: showcase.background_x ?? 0.5, y: showcase.background_y ?? 0.5,
      overflowX: photo.naturalWidth * scale - width,
      overflowY: photo.naturalHeight * scale - height,
    };
    board.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveBackground = (event) => {
    const start = backgroundGesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const clamp = (value) => Math.max(0, Math.min(1, value));
    onBackgroundMove(
      start.overflowX > 1 ? clamp(start.x - (event.clientX - start.clientX) / start.overflowX) : start.x,
      start.overflowY > 1 ? clamp(start.y - (event.clientY - start.clientY) / start.overflowY) : start.y,
    );
  };
  const endBackgroundMove = (event) => {
    if (backgroundGesture.current?.pointerId === event.pointerId) backgroundGesture.current = null;
  };
  return (
    <div className={`showcase-board showcase-board--${customBackground ? 'custom' : background} ${customBackground && onBackgroundMove ? 'showcase-board--movable-background' : ''}`}
      aria-label="2D 굿즈 진열장" onPointerDown={startBackgroundMove} onPointerMove={moveBackground}
      onPointerUp={endBackgroundMove} onPointerCancel={endBackgroundMove}>
      {customBackground && <><div className="showcase-board__photo"><ShowcaseImage src={showcase.backgroundUrl} alt="" cacheMedia={cacheMedia}
        style={{ objectPosition: `${(showcase.background_x ?? 0.5) * 100}% ${(showcase.background_y ?? 0.5) * 100}%` }} /></div><div className="showcase-board__wash" /></>}
      <div className="showcase-board__shelf shelf-one" />
      <div className="showcase-board__shelf shelf-two" />
      <div className="showcase-board__shelf shelf-three" />
      {backgroundControls && <div className="showcase-board__background-actions">{backgroundControls}</div>}
      {[...items].sort((a, b) => a.layer_order - b.layer_order).map((item) => {
        const Element = onMove || onItemClick ? 'button' : 'span';
        const isSoldOut = showcase.type === 'SHOP' && item.isSoldOut;
        return <Element key={item.id} {...(Element === 'button' ? { type: 'button' } : {})}
          className={`showcase-board__item ${selectedId === item.id && !onResize ? 'is-selected' : ''} ${isSoldOut ? 'is-sold-out' : ''}`}
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
          aria-label={`${item.goods_name || item.product?.name || '굿즈'}${isSoldOut ? ', 품절' : ''}`}>
          <ShowcaseImage src={item.imageUrl || item.product?.imageUrl} alt="" draggable={false} cacheMedia={cacheMedia} />
          {isSoldOut && <span className="showcase-board__sold-out" aria-hidden="true">품절</span>}
        </Element>;
      })}
      {selectedItem && <div className="showcase-board__selection"
        style={{ left: `${selectedItem.x * 100}%`, top: `${selectedItem.y * 100}%`,
          width: `${26 * selectedItem.scale}%`, transform: `translate(-50%, -50%) rotate(${selectedItem.rotation}deg)` }}>
        <button type="button" className="showcase-board__handle showcase-board__handle--remove" aria-label="선택한 사진 삭제"
          onPointerDown={(event) => event.stopPropagation()} onClick={() => onRemove?.(selectedItem.id)}>×</button>
        <button type="button" className="showcase-board__handle showcase-board__handle--rotate" aria-label="사진 회전"
          onPointerDown={(event) => startTransform(event, 'rotate')} onPointerMove={moveTransform}
          onPointerUp={endTransform} onPointerCancel={endTransform}>↻</button>
        <button type="button" className="showcase-board__handle showcase-board__handle--resize" aria-label="사진 크기 조절"
          onPointerDown={(event) => startTransform(event, 'resize')} onPointerMove={moveTransform}
          onPointerUp={endTransform} onPointerCancel={endTransform}>↘</button>
      </div>}
    </div>
  );
}
