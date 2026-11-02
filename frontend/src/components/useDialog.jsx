import { useCallback, useRef, useState } from 'react';
import Dialog from './Dialog.jsx';

// window.alert / window.confirm 처럼 await 로 쓰는 상자.
//   const { confirm, alert, dialog } = useDialog();
//   if (!(await confirm('삭제할까요?', { confirmLabel: '삭제', danger: true }))) return;
// 화면 어딘가에 {dialog} 를 한 번 렌더해야 보인다.
export function useDialog() {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const open = useCallback(
    (next) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOptions(next);
      }),
    []
  );
  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  const confirm = useCallback(
    (message, extra = {}) => open({ message, cancelLabel: '취소', ...extra }),
    [open]
  );
  const alert = useCallback(
    (message, extra = {}) => open({ message, ...extra }).then(() => undefined),
    [open]
  );
  const dialog = (
    <Dialog
      open={Boolean(options)}
      {...options}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
  return { confirm, alert, dialog };
}
