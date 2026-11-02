import { useRef } from 'react';

export default function useDraggableRail() {
  const drag = useRef({ pointerId: null, moved: false });
  const finish = (event) => {
    const state = drag.current;
    if (state.pointerId !== event.pointerId) return;
    state.pointerId = null;
    const rail = event.currentTarget;
    const target = state.moved && rail.children.length ? [...rail.children].reduce((a, b) =>
      Math.abs(a.offsetLeft - rail.scrollLeft) < Math.abs(b.offsetLeft - rail.scrollLeft) ? a : b) : null;
    rail.classList.remove('is-dragging');
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    if (target) rail.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
  };
  return {
    onPointerDown(event) {
      if (event.pointerType === 'touch') { drag.current = { pointerId: null, moved: false }; return; }
      if (event.button !== 0) return;
      drag.current = { pointerId: event.pointerId, x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
    },
    onPointerMove(event) {
      const state = drag.current;
      if (state.pointerId !== event.pointerId) return;
      const delta = event.clientX - state.x;
      if (!state.moved && Math.abs(delta) < 6) return;
      if (!state.moved) {
        state.moved = true;
        event.currentTarget.classList.add('is-dragging');
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      event.currentTarget.scrollLeft = state.scroll - delta;
    },
    onPointerUp: finish, onPointerCancel: finish, onLostPointerCapture: finish,
    onPointerLeave(event) { if (!event.currentTarget.hasPointerCapture(event.pointerId)) finish(event); },
    onClickCapture(event) { if (drag.current.moved && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } },
    onDragStart(event) { event.preventDefault(); },
  };
}
