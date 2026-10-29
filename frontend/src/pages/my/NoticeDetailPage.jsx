// 담당: 연수
import { useNavigate, useParams } from 'react-router-dom';
import { getNotice } from './account.api.js';
import { formatFullDate } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './help.css';

export default function NoticeDetailPage() {
  const navigate = useNavigate();
  const { noticeId } = useParams();
  const notice = useRequest(true, `notice-${noticeId}`, () => getNotice(noticeId));
  const item = notice.data;

  let body;
  if (notice.error) body = <ErrorNotice error={notice.error} onRetry={notice.reload} />;
  else if (!item) body = <Loading />;
  else
    body = (
      <>
        <div className="hlp-article">
          {item.is_pinned ? <b className="hlp-pin">중요</b> : null}
          <h2>{item.title}</h2>
          <small>{formatFullDate(item.published_at)}</small>
        </div>
        <div className="hlp-body">{item.content}</div>
      </>
    );

  return (
    <main className="ord-page">
      <PageHeader title="공지사항" />
      {body}
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--block"
          onClick={() => navigate(MY_ROUTES.notices)}
        >
          목록으로
        </button>
      </footer>
    </main>
  );
}
