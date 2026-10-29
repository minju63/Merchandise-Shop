// 담당: 연수
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createInquiry, updateInquiry } from './account.api.js';
import { PageHeader } from './common.jsx';
import { useRequireLogin } from './hooks.js';
import { INQUIRY_CATEGORY_LABEL } from './inquiryCategories.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './help.css';

const MAX_CONTENT = 1000;

export default function InquiryFormPage() {
  const navigate = useNavigate();
  const editing = useLocation().state?.inquiry ?? null;
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const [category, setCategory] = useState(editing?.category ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [content, setContent] = useState(editing?.content ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const valid = category && title.trim() && content.trim();

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const body = { category, title: title.trim(), content: content.trim() };
      if (editing) await updateInquiry(editing.id, body);
      else await createInquiry(body);
      navigate(MY_ROUTES.inquiries, { replace: true });
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  };

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="1:1 문의하기" />
      <h2 className="hlp-h">
        문의 유형 <em>*</em>
      </h2>
      <div className="hlp-types">
        {Object.entries(INQUIRY_CATEGORY_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={category === key ? 'ord-chip is-active' : 'ord-chip'}
            onClick={() => setCategory(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <h2 className="hlp-h">
        제목 <em>*</em>
      </h2>
      <input
        className="hlp-input"
        value={title}
        maxLength={100}
        placeholder="제목을 입력해 주세요"
        onChange={(event) => setTitle(event.target.value)}
      />
      <h2 className="hlp-h">
        문의 내용 <em>*</em>
      </h2>
      <textarea
        className="hlp-input"
        value={content}
        maxLength={MAX_CONTENT}
        placeholder={
          '문의하실 내용을 자세히 적어 주세요.\n주문번호나 상품명을 함께 알려 주시면 더 빠르게 확인할 수 있어요.'
        }
        onChange={(event) => setContent(event.target.value)}
      />
      <p className="hlp-count">
        {content.length} / {MAX_CONTENT}
      </p>
      {error ? <p className="ord-sheet__error">{error}</p> : null}
      <p className="hlp-note">
        답변이 등록되면 알림으로 알려드려요. 문의 내역은 마이 &gt; 고객센터 &gt; 내 문의에서 볼 수
        있어요.
      </p>
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          disabled={!signedIn || !valid || busy}
          onClick={submit}
        >
          {editing ? '수정 완료' : '문의 등록'}
        </button>
      </footer>
    </main>
  );
}
