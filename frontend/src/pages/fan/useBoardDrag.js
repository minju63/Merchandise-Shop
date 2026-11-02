import { useCallback, useRef } from 'react';
import { LINE_SCALE_MAX, LINE_SCALE_MIN, PHOTO_MIN } from './fanBoardPresets.js';

const round = (value) => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// 미리보기 배너 안에서 포인터(마우스·터치)로 글자 줄과 최애 사진을 PPT처럼 다룬다.
//  - 글자 줄을 끌면 그 줄만 옮겨진다. 선택된 줄의 네모 점(모서리)을 끌면 줄 크기가 바뀐다.
//  - 사진을 끌면 틀이 옮겨지고, 선택된 사진의 네모 점(모서리·가장자리)을 끌면 틀의 가로·세로 크기가 바뀐다.
//  - 빈 곳을 누르면 선택이 풀린다.
// 값은 모두 배너 너비·높이 대비 % 이고, 이동 중에는 onXxx 로 미리보기만 바꾸다가
// 손을 떼면 onXxxCommit 으로 한 번만 알린다(저장은 그때 한다).
export default function useBoardDrag({
  offsets, scales, photoBox, disabled,
  onMove, onCommit, onScale, onScaleCommit, onPhotoMove, onPhotoCommit, onSelect,
}) {
  const state = useRef(null);

  const onPointerDown = useCallback((event) => {
    if (disabled) return;
    const board = event.currentTarget;
    const handle = event.target.closest('[data-fan-handle]');
    const line = event.target.closest('[data-fan-line]');
    const photoEl = event.target.closest('[data-fan-photo]');
    const base = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, boardRect: board.getBoundingClientRect() };

    if (handle && line) {
      const key = line.dataset.fanLine;
      const rect = line.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const startScale = scales?.[key] ?? 1;
      onSelect?.(key);
      state.current = {
        ...base, kind: 'scale', key, center, startScale, last: startScale,
        startDistance: Math.max(1, Math.hypot(event.clientX - center.x, event.clientY - center.y)),
      };
    } else if (handle && photoEl && photoBox) {
      onSelect?.('photo');
      state.current = { ...base, kind: 'resize', which: handle.dataset.fanHandle, start: { ...photoBox }, last: { ...photoBox } };
    } else if (line) {
      const key = line.dataset.fanLine;
      const start = offsets?.[key] ?? { x: 0, y: 0 };
      onSelect?.(key);
      state.current = { ...base, kind: 'line', key, start: { ...start }, lineRect: line.getBoundingClientRect(), last: { ...start } };
    } else if (photoEl && photoBox) {
      onSelect?.('photo');
      state.current = { ...base, kind: 'photo', start: { ...photoBox }, last: { ...photoBox } };
    } else {
      onSelect?.(null);
      return;
    }
    board.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [disabled, offsets, scales, photoBox, onSelect]);

  const onPointerMove = useCallback((event) => {
    const drag = state.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { boardRect } = drag;
    const dxPct = ((event.clientX - drag.startX) / boardRect.width) * 100;
    const dyPct = ((event.clientY - drag.startY) / boardRect.height) * 100;

    if (drag.kind === 'scale') {
      const distance = Math.hypot(event.clientX - drag.center.x, event.clientY - drag.center.y);
      const next = Math.round(clamp(drag.startScale * (distance / drag.startDistance), LINE_SCALE_MIN, LINE_SCALE_MAX) * 100) / 100;
      drag.last = next;
      onScale?.(drag.key, next);
    } else if (drag.kind === 'photo') {
      const { w, h } = drag.start;
      const next = { ...drag.start, x: round(clamp(drag.start.x + dxPct, 0, 100 - w)), y: round(clamp(drag.start.y + dyPct, 0, 100 - h)) };
      drag.last = next;
      onPhotoMove?.(next);
    } else if (drag.kind === 'resize') {
      let left = drag.start.x;
      let top = drag.start.y;
      let right = drag.start.x + drag.start.w;
      let bottom = drag.start.y + drag.start.h;
      if (drag.which.includes('w')) left = clamp(left + dxPct, 0, right - PHOTO_MIN.w);
      if (drag.which.includes('e')) right = clamp(right + dxPct, left + PHOTO_MIN.w, 100);
      if (drag.which.includes('n')) top = clamp(top + dyPct, 0, bottom - PHOTO_MIN.h);
      if (drag.which.includes('s')) bottom = clamp(bottom + dyPct, top + PHOTO_MIN.h, 100);
      const next = { x: round(left), y: round(top), w: round(right - left), h: round(bottom - top) };
      drag.last = next;
      onPhotoMove?.(next);
    } else {
      // 글자 줄: 네 변이 배너 안에 머물도록 이동량(px)을 제한한다
      const { lineRect } = drag;
      const dx = clamp(event.clientX - drag.startX, boardRect.left - lineRect.left, boardRect.right - lineRect.right);
      const dy = clamp(event.clientY - drag.startY, boardRect.top - lineRect.top, boardRect.bottom - lineRect.bottom);
      const next = {
        x: round(drag.start.x + (dx / boardRect.width) * 100),
        y: round(drag.start.y + (dy / boardRect.height) * 100),
      };
      drag.last = next;
      onMove?.(drag.key, next);
    }
  }, [onMove, onScale, onPhotoMove]);

  const finish = useCallback((event) => {
    const drag = state.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    state.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // 움직이지 않고 손만 뗀 경우에는 저장하지 않는다
    if (drag.kind === 'scale') {
      if (drag.last !== drag.startScale) onScaleCommit?.(drag.key, drag.last);
    } else if (drag.kind === 'photo' || drag.kind === 'resize') {
      if (JSON.stringify(drag.last) !== JSON.stringify(drag.start)) onPhotoCommit?.(drag.last);
    } else if (drag.last.x !== drag.start.x || drag.last.y !== drag.start.y) {
      onCommit?.(drag.key, drag.last);
    }
  }, [onCommit, onScaleCommit, onPhotoCommit]);

  return { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish };
}
