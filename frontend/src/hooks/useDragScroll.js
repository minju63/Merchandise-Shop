import { useEffect } from 'react';

// 가로로 넘치는 목록(필터 탭 등)을 마우스로 끌어서 좌우로 스크롤한다. 터치는 기본 스크롤을 그대로 쓴다.
export default function useDragScroll(ref, enabled = true) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return undefined;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let moved = false;

    const onDown = (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startScroll = element.scrollLeft;
    };
    const onMove = (event) => {
      if (!dragging) return;
      const distance = event.clientX - startX;
      if (Math.abs(distance) > 4) moved = true;
      if (moved) {
        event.preventDefault();
        element.classList.add('is-dragging');
        element.scrollLeft = startScroll - distance;
      }
    };
    const stop = () => {
      dragging = false;
      element.classList.remove('is-dragging');
    };
    const preventNativeDrag = (event) => event.preventDefault();
    // 끌고 난 뒤에는 버튼 클릭(탭 선택)이 실행되지 않게 막는다.
    const onClick = (event) => {
      if (!moved) return;
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('dragstart', preventNativeDrag);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    element.addEventListener('click', onClick, true);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('dragstart', preventNativeDrag);
      element.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      element.removeEventListener('click', onClick, true);
    };
  }, [ref, enabled]);
}
