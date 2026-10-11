import { useState } from 'react';

export default function InquiryForm({ user, onSubmit, onLogin }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    if (!title.trim() || !content.trim() || Array.from(title.trim()).length > 100) {
      setMessage('문의 제목(100자 이내)과 내용을 입력해 주세요.');
      return;
    }
    setPending(true);
    setMessage('');
    try {
      await onSubmit({ title: title.trim(), content: content.trim() });
      setTitle('');
      setContent('');
      setMessage('문의가 등록되었습니다.');
    } catch (error) {
      if (error.response?.status === 401) onLogin?.();
      setMessage(
        error.response?.status === 401
          ? '로그인이 필요합니다.'
          : '문의를 등록하지 못했습니다. 다시 시도해 주세요.'
      );
    } finally {
      setPending(false);
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
          onChange={(event) => setTitle(event.target.value)}
          required
          disabled={pending}
        />
      </label>
      <label>
        상품 문의
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={4}
          required
          disabled={pending}
          placeholder="판매 매장에 궁금한 점을 남겨 주세요."
        />
      </label>
      <button type="submit" disabled={pending || !title.trim() || !content.trim()}>
        {pending ? '등록 중…' : '문의 등록'}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
