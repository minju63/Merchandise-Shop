// 담당: 연수
import { useNavigate } from 'react-router-dom';
import { getMyAgreements } from './account.api.js';
import { formatFullDate } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { ChevronIcon } from './icons.jsx';
import { MY_ROUTES } from './routes.js';
import { TERMS_DOCS } from './termsContent.js';
import './orders.css';
import './help.css';

const fetcher = () => getMyAgreements({ size: 100 });
const AGREE_ROWS = [
  ['SERVICE', '서비스 이용약관', true],
  ['PRIVACY', '개인정보 수집 · 이용', true],
  ['LOCATION', '위치기반서비스 이용약관', false],
  ['MARKETING', '마케팅 정보 수신', false],
  ['NIGHT_PUSH', '야간 알림 수신 (21시 – 08시)', false],
];

export default function TermsPage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const agreements = useRequest(signedIn, 'my-agreements', fetcher);

  // 같은 약관의 기록이 여러 개면 가장 최근(서버가 최신순으로 내려줌) 것만 쓴다.
  const latest = new Map();
  for (const row of agreements.data?.items ?? []) {
    if (!latest.has(row.terms_type)) latest.set(row.terms_type, row);
  }

  let status;
  if (agreements.error)
    status = <ErrorNotice error={agreements.error} onRetry={agreements.reload} />;
  else if (!agreements.data) status = <Loading />;
  else
    status = (
      <div className="hlp-box">
        {AGREE_ROWS.map(([type, name, required]) => {
          const row = latest.get(type);
          const agreed = row?.agreed === true;
          return (
            <div key={type} className="hlp-agree">
              <div>
                <b>{name}</b>{' '}
                <small style={{ display: 'inline' }}>{required ? '필수' : '선택'}</small>
                <small>{agreed ? `${formatFullDate(row.created_at)} 동의` : '동의하지 않음'}</small>
              </div>
              <span className={agreed ? 'ord-pill ord-pill--soft' : 'ord-pill ord-pill--plain'}>
                {agreed ? '동의' : '미동의'}
              </span>
            </div>
          );
        })}
      </div>
    );

  return (
    <main className="ord-page">
      <PageHeader title="약관 및 정책" />
      <h2 className="hlp-h">약관 · 방침</h2>
      {Object.entries(TERMS_DOCS).map(([key, doc]) => (
        <button
          key={key}
          type="button"
          className="hlp-row"
          onClick={() => navigate(MY_ROUTES.termsBody(key))}
        >
          <span>{doc.name}</span>
          <ChevronIcon />
        </button>
      ))}
      <h2 className="hlp-h" style={{ marginTop: 28 }}>
        내 동의 현황
      </h2>
      <p className="hlp-sub">마케팅·야간 알림 수신은 알림 설정에서 바꿀 수 있어요.</p>
      {status}
    </main>
  );
}
