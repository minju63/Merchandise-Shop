// 담당: 연수
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listOpenAlerts, listPreorders, listRestockAlerts } from './account.api.js';
import { formatFullDate } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './mytab.css';

const TABS = [
  ['preorder', '사전예약'],
  ['restock', '재입고 신청'],
  ['open', '오픈 알림'],
];
const PREORDER_STATUS = {
  PENDING: '대기 중',
  RESERVED: '예약 완료',
  CANCELED: '취소됨',
  EXPIRED: '만료됨',
};

function Row({ thumb, title, sub, extra, onClick }) {
  return (
    <button type="button" className="mt-row" onClick={onClick}>
      <Thumb src={thumb} size={56} />
      <span className="mt-row__main">
        <strong>{title}</strong>
        <span>{sub}</span>
      </span>
      {extra ? <span className="ord-pill ord-pill--soft">{extra}</span> : null}
    </button>
  );
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const [tab, setTab] = useState('preorder');
  const preorders = useRequest(signedIn && tab === 'preorder', 'alerts-preorder', listPreorders);
  const restocks = useRequest(signedIn && tab === 'restock', 'alerts-restock', listRestockAlerts);
  const opens = useRequest(signedIn && tab === 'open', 'alerts-open', listOpenAlerts);
  const current = { preorder: preorders, restock: restocks, open: opens }[tab];
  const items = current.data?.items ?? [];

  const rows = {
    preorder: items.map((item) => (
      <Row
        key={item.preorderId}
        thumb={item.thumbnailUrl}
        title={item.productName}
        sub={`${item.storeName} · ${item.quantity}개 · 예약금 ${formatWon(item.depositAmount)}`}
        extra={PREORDER_STATUS[item.status] ?? item.status}
        onClick={() => navigate(MY_ROUTES.product(item.storeProductId))}
      />
    )),
    restock: items.map((item) => (
      <Row
        key={item.alertId}
        thumb={item.thumbnailUrl}
        title={item.productName}
        sub={`${item.storeName} · ${formatWon(item.finalPrice)}`}
        extra={item.stock > 0 ? '재입고됨' : '재입고 대기'}
        onClick={() => navigate(MY_ROUTES.product(item.storeProductId))}
      />
    )),
    open: items.map((item) => (
      <Row
        key={item.productId}
        thumb={item.thumbnailUrl}
        title={item.name}
        sub={item.openAt ? `${formatFullDate(item.openAt)} 오픈 예정` : '오픈 일정 미정'}
        extra={item.status === 'UPCOMING' ? '오픈 예정' : '오픈됨'}
      />
    )),
  }[tab];

  let body;
  if (current.error) body = <ErrorNotice error={current.error} onRetry={current.reload} />;
  else if (!current.data) body = <Loading />;
  else if (items.length === 0) body = <p className="ord-empty">신청한 내역이 없어요</p>;
  else body = rows;

  return (
    <main className="ord-page">
      <PageHeader title="사전예약·재입고·알림 신청" />
      <div className="ord-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'ord-tab is-active' : 'ord-tab'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div>{body}</div>
    </main>
  );
}
