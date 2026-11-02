import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import InquiryForm from '../../category/components/InquiryForm.jsx';

export default function StoreInquirySheet({
  user,
  draftKey,
  onSubmit,
  onClose,
  onLogin,
  inquiry,
  locked = false,
}) {
  const panel = useRef(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [pending, setPending] = useState(false);
  const [draft] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(draftKey)) || inquiry || {};
    } catch {
      return inquiry || {};
    }
  });
  const requestId = useRef(draft.requestId || crypto.randomUUID());
  const [storageError, setStorageError] = useState('');
  function saveDraft(input) {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ ...input, requestId: requestId.current }));
    } catch {
      setStorageError('임시 저장을 사용할 수 없습니다. 화면을 떠나기 전에 내용을 복사해 주세요.');
    }
  }
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pending) onClose();
      }
      if (event.key === 'Tab') {
        const buttons = [
          ...panel.current.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'
          ),
        ];
        if (!buttons.length) {
          event.preventDefault();
          return;
        }
        const first = buttons[0];
        const last = buttons.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === panel.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const viewport = window.visualViewport;
    const resize = () => {
      if (!panel.current || !viewport) return;
      panel.current.style.maxHeight = `${viewport.height * 0.9}px`;
      panel.current.parentElement.style.bottom = `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`;
    };
    resize();
    viewport?.addEventListener('resize', resize);
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      viewport?.removeEventListener('resize', resize);
      previous?.focus();
    };
  }, [onClose, pending]);

  async function submit(input) {
    saveDraft(input);
    try {
      await onSubmit({ ...input, requestId: requestId.current });
    } catch (error) {
      if (error.code === 'REQUEST_ALREADY_USED') {
        requestId.current = crypto.randomUUID();
        saveDraft(input);
        throw new Error(
          '이전 요청은 이미 등록되었습니다. 목록을 확인해 주세요. 현재 내용은 새 문의로 다시 등록할 수 있습니다.',
          { cause: error }
        );
      }
      throw error;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey));
      // A reopened sheet may already contain a newer draft while this request finishes.
      if (
        saved?.requestId === requestId.current &&
        saved.title?.trim() === input.title &&
        saved.content?.trim() === input.content
      ) {
        sessionStorage.removeItem(draftKey);
      }
    } catch {
      /* Storage may be unavailable. */
    }
    if (mounted.current) onClose();
  }
  return createPortal(
    <div
      className="guide-overlay si-overlay"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <section
        ref={panel}
        tabIndex={-1}
        className="guide-sheet si-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-inquiry-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-title">
          <h2 id="store-inquiry-title">{inquiry ? '굿즈샵 문의 수정' : '굿즈샵 문의하기'}</h2>
          <button type="button" aria-label="닫기" disabled={pending} onClick={onClose}>
            ×
          </button>
        </div>
        <p className="si-note">문의는 공개됩니다. 연락처, 주소 등 개인정보는 입력하지 마세요.</p>
        <InquiryForm
          user={user}
          onLogin={onLogin}
          onSubmit={submit}
          contentLabel="굿즈샵 문의"
          placeholder="매장 이용, 배송 및 픽업 등에 대해 문의해 주세요."
          maxContentLength={5000}
          initialValues={draft}
          onDraftChange={saveDraft}
          onPendingChange={setPending}
          submitLabel={inquiry ? '수정 저장' : '문의 등록'}
          locked={locked}
        />
        {locked && <p role="alert">답변이 등록되어 문의를 수정할 수 없습니다.</p>}
        <p className="si-note">닫거나 뒤로 가도 이 탭에 작성 내용이 임시 저장됩니다.</p>
        {storageError && <p role="alert">{storageError}</p>}
      </section>
    </div>,
    document.body
  );
}
