// 담당: 연수
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteInquiry, listInquiries } from './account.api.js';
import { formatFullDate } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import { INQUIRY_CATEGORY_LABEL } from './inquiryCategories.js';
import './orders.css';
import './help.css';

const fetcher = () => listInquiries();
const FILTERS = [
  ['ALL', '전체'],
  ['PENDING', '답변 대기'],
  ['ANSWERED', '답변 완료'],
];

// 답변 컬럼명은 백엔드 확정 전이라 여러 이름을 허용한다.
const answerText = (item) => item.answer ?? item.answer_content ?? item.reply ?? null;
const answerDate = (item) => item.answered_at ?? item.answer_at ?? null;

export default function InquiryListPage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const inquiries = useRequest(signedIn, 'my-inquiries-all', fetcher);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');

  const items = inquiries.data?.items ?? [];
  const count = (status) => items.filter((item) => item.status === status).length;
  const shown = filter === 'ALL' ? items : items.filter((item) => item.status === filter);

  const remove = async (item) => {
    if (!window.confirm('이 문의를 삭제할까요?')) return;
    setError('');
    try {
      await deleteInquiry(item.id);
      inquiries.reload();
    } catch (cause) {
      setError(cause.message);
    }
  };

  let body;
  if (inquiries.error) body = <ErrorNotice error={inquiries.error} onRetry={inquiries.reload} />;
  else if (!inquiries.data) body = <Loading />;
  else if (shown.length === 0) body = <p className="ord-empty">문의 내역이 없어요</p>;
  else
    body = (
      <div className="hlp-list">
        {shown.map((item) => {
          const pending = item.status === 'PENDING';
          const answer = answerText(item);
          return (
            <article key={item.id} className="hlp-card">
              <div className="hlp-card__top">
                <span className="hlp-card__meta">
                  <span className="ord-tag">{INQUIRY_CATEGORY_LABEL[item.category] ?? '기타'}</span>
                  {formatFullDate(item.created_at)}
                </span>
                <span
                  className={pending ? 'ord-pill ord-pill--plain' : 'ord-pill ord-pill--strong'}
                >
                  {pending ? '답변 대기' : '답변 완료'}
                </span>
              </div>
              <strong className="hlp-card__title">{item.title}</strong>
              <p className="hlp-card__text">{item.content}</p>
              {pending ? (
                <div className="ord-actions" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="ord-btn ord-btn--grow"
                    onClick={() => navigate(MY_ROUTES.inquiryNew, { state: { inquiry: item } })}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="ord-btn ord-btn--grow"
                    style={{ color: '#d23b3b' }}
                    onClick={() => remove(item)}
                  >
                    삭제
                  </button>
                </div>
              ) : answer ? (
                <div className="hlp-answer">
                  <div className="hlp-answer__head">
                    <b>굿즈픽 고객센터</b>
                    {answerDate(item) ? <span>{formatFullDate(answerDate(item))}</span> : null}
                  </div>
                  <p>{answer}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    );

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="내 문의 내역" />
      <div className="hlp-chips">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={filter === key ? 'ord-chip is-active' : 'ord-chip'}
            onClick={() => setFilter(key)}
          >
            {label} {inquiries.data ? (key === 'ALL' ? items.length : count(key)) : ''}
          </button>
        ))}
      </div>
      {error ? <p className="ord-sheet__error">{error}</p> : null}
      {body}
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          onClick={() => navigate(MY_ROUTES.inquiryNew)}
        >
          1:1 문의하기
        </button>
      </footer>
    </main>
  );
}
