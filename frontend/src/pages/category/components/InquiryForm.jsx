import { useEffect, useRef, useState } from 'react';

export default function InquiryForm({ user, onSubmit, onLogin, contentLabel = '상품 문의', placeholder = '판매 매장에 궁금한 점을 남겨 주세요.', maxContentLength, initialValues, onDraftChange, onPendingChange, submitLabel = '문의 등록', locked = false }) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [content, setContent] = useState(initialValues?.content ?? '');
  const submitting = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (submitting.current || locked) return;
    if (!title.trim() || !content.trim() || Array.from(title.trim()).length > 100 || (maxContentLength && Array.from(content.trim()).length > maxContentLength)) {
      setMessage(maxContentLength ? `문의 제목(100자 이내)과 내용(${maxContentLength}자 이내)을 입력해 주세요.` : '문의 제목(100자 이내)과 내용을 입력해 주세요.');
      return;
    }
    setPending(true);
    submitting.current = true;
    onPendingChange?.(true);
    setMessage('');
    try {
      await onSubmit({ title: title.trim(), content: content.trim() });
      if (!mounted.current) return;
      setTitle('');
      setContent('');
      setMessage('문의가 등록되었습니다.');
    } catch (error) {
      if (!mounted.current) return;
      const unauthorized = (error.status ?? error.response?.status) === 401;
      if (unauthorized) onLogin?.();
      setMessage(
        unauthorized
          ? '로그인이 필요합니다.'
          : (maxContentLength ? error.message : '문의를 등록하지 못했습니다. 다시 시도해 주세요.')
      );
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setPending(false);
        onPendingChange?.(false);
      }
    }
  }
  if (!user)
    return (
      <div className="category-inquiry-login">
        <p>로그인 후 문의를 작성할 수 있습니다.</p>
        {onLogin && (
          <button type="button" onClick={onLogin}>
            로그인
          </button>
        )}
      </div>
    );
  return (
    <form onSubmit={submit} className="category-inquiry-form">
      <label>
        문의 제목
        <input
          type="text"
          maxLength={100}
          value={title}
          onChange={(event) => { setTitle(event.target.value); onDraftChange?.({ title: event.target.value, content }); }}
          required
          disabled={pending || locked}
        />
      </label>
      <label>
        {contentLabel}
        <textarea
          value={content}
          onChange={(event) => { setContent(event.target.value); onDraftChange?.({ title, content: event.target.value }); }}
          rows={4}
          required
          disabled={pending || locked}
          placeholder={placeholder}
          maxLength={maxContentLength}
        />
      </label>
      {maxContentLength && <small>내용 {Array.from(content).length.toLocaleString()} / {maxContentLength.toLocaleString()}자</small>}
      <button type="submit" disabled={pending || locked || !title.trim() || !content.trim()}>
        {pending ? (submitLabel === '문의 등록' ? '등록 중…' : '저장 중…') : submitLabel}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
