// 담당: 연수
import { listReports } from './account.api.js';
import { formatFullDate } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import { InfoIcon } from './icons.jsx';
import './orders.css';
import './help.css';

const fetcher = () => listReports();
const TARGET = { PRODUCT: '상품', STORE: '굿즈샵', REVIEW: '리뷰' };
const REASON = {
  FAKE: '허위·과장 정보',
  ILLEGAL: '불법·유해 상품',
  ABUSE: '욕설·비방',
  SPAM: '스팸·광고',
  ETC: '기타',
};
const STATUS = {
  PENDING: ['접수됨', 'ord-pill ord-pill--plain'],
  RESOLVED: ['처리 완료', 'ord-pill ord-pill--strong'],
  DISMISSED: ['처리 완료', 'ord-pill ord-pill--strong'],
};

export default function ReportListPage() {
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const reports = useRequest(signedIn, 'my-reports', fetcher);
  const items = reports.data?.items ?? [];

  let body;
  if (reports.error) body = <ErrorNotice error={reports.error} onRetry={reports.reload} />;
  else if (!reports.data) body = <Loading />;
  else if (items.length === 0) body = <p className="ord-empty">신고 내역이 없어요</p>;
  else
    body = (
      <div className="hlp-list">
        {items.map((item) => {
          const [label, pill] = STATUS[item.status] ?? STATUS.PENDING;
          return (
            <article key={item.id} className="hlp-card">
              <div className="hlp-card__top">
                <span className="hlp-card__meta">
                  <span className="ord-tag">{TARGET[item.target_type] ?? '기타'}</span>
                  {formatFullDate(item.created_at)}
                </span>
                <span className={pill}>{label}</span>
              </div>
              <div className="hlp-reason">
                <span>신고 사유</span>
                {REASON[item.reason] ?? item.reason}
              </div>
              {item.detail ? <p className="hlp-card__text">{item.detail}</p> : null}
            </article>
          );
        })}
      </div>
    );

  return (
    <main className="ord-page">
      <PageHeader title="내 신고 내역" />
      <div className="hlp-info">
        <InfoIcon />
        <span>신고는 상품·굿즈샵 상세 화면에서 할 수 있어요</span>
      </div>
      {body}
    </main>
  );
}
