// 담당: 연수
import { useNavigate } from 'react-router-dom';
import { listNotices } from './account.api.js';
import { formatFullDate } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { ChevronIcon } from './icons.jsx';
import { useRequest } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './help.css';

const fetchNotices = () => listNotices({ size: 100 });

export default function NoticeListPage() {
  const navigate = useNavigate();
  const notices = useRequest(true, 'notices', fetchNotices);
  const items = notices.data?.items ?? [];

  let body;
  if (notices.error) body = <ErrorNotice error={notices.error} onRetry={notices.reload} />;
  else if (!notices.data) body = <Loading />;
  else if (items.length === 0) body = <p className="ord-empty">등록된 공지사항이 없어요</p>;
  else
    body = items.map((item) => (
      <button
        key={item.id}
        type="button"
        className="hlp-row"
        onClick={() => navigate(MY_ROUTES.noticeDetail(item.id))}
      >
        <span>
          {item.is_pinned ? <b className="hlp-pin">중요</b> : null} {item.title}
          <small>{formatFullDate(item.published_at)}</small>
        </span>
        <ChevronIcon />
      </button>
    ));

  return (
    <main className="ord-page">
      <PageHeader title="공지사항" />
      {body}
    </main>
  );
}
