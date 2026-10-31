import { useCallback, useRef } from 'react';

const round = (value) => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// 미리보기 배너 안의 글자 줄을 포인터(마우스·터치)로 줄마다 따로 옮긴다.
// 옮긴 거리는 줄마다 배너 너비·높이 대비 % 이고, 줄이 배너 밖으로 나가지 못하게 제한한다.
// 이동 중에는 onMove 로 미리보기만 바꾸고, 손을 떼면 onCommit 으로 한 번만 알린다(저장은 그때 한다).
export default function useBoardDrag({ offsets, onMove, onCommit, disabled }) {
  const state = useRef(null);

  const onPointerDown = useCallback((event) => {
    if (disabled) return;
    const line = event.target.closest('[data-fan-line]');
    if (!line) return;
    const board = event.currentTarget;
    const start = offsets?.[line.dataset.fanLine] ?? { x: 0, y: 0 };
    state.current = {
      pointerId: event.pointerId,
      key: line.dataset.fanLine,
      startX: event.clientX,
      startY: event.clientY,
      start: { ...start },
      boardRect: board.getBoundingClientRect(),
      lineRect: line.getBoundingClientRect(),
      last: { ...start },
    };
    board.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [disabled, offsets]);

  const onPointerMove = useCallback((event) => {
    const drag = state.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { boardRect, lineRect } = drag;
    // 줄의 네 변이 배너 안에 머물도록 이동량(px)을 제한한다
    const dx = clamp(event.clientX - drag.startX, boardRect.left - lineRect.left, boardRect.right - lineRect.right);
    const dy = clamp(event.clientY - drag.startY, boardRect.top - lineRect.top, boardRect.bottom - lineRect.bottom);
    const next = {
      x: round(drag.start.x + (dx / boardRect.width) * 100),
      y: round(drag.start.y + (dy / boardRect.height) * 100),
    };
    drag.last = next;
    onMove(drag.key, next);
  }, [onMove]);

  const finish = useCallback((event) => {
    const drag = state.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    state.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // 움직이지 않고 손만 뗀 경우에는 저장하지 않는다
    if (drag.last.x !== drag.start.x || drag.last.y !== drag.start.y) onCommit(drag.key, drag.last);
  }, [onCommit]);

  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish };
}
