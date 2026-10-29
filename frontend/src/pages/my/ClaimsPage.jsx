// 담당: 연수
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClaims } from './account.api.js';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { listOrders } from './my.api.js';
import { formatMonthDay, formatWon, itemsTitle, totalQuantity } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './mytab.css';

const TABS = [
  ['ALL', '전체'],
  ['CANCEL', '취소'],
  ['RETURN', '반품'],
  ['EXCHANGE', '교환'],
];
const KIND_LABEL = { CANCEL: '취소', RETURN: '반품', EXCHANGE: '교환' };
const CLAIM_STATUS = {
  REQUESTED: ['접수됨', 'soft'],
  APPROVED: ['승인됨', 'soft'],
  COLLECTING: ['회수 중', 'soft'],
  COMPLETED: ['처리 완료', 'plain'],
  REJECTED: ['거절됨', 'plain'],
};

function buildEntries(orders, claims) {
  const canceled = orders.map((order) => ({
    key: `cancel-${order.id}`,
    kind: 'CANCEL',
    date: order.canceled_at ?? order.created_at,
    orderId: order.id,
    orderNo: order.order_no,
    storeName: order.store?.name,
    title: itemsTitle(order.items),
    summary: `총 ${totalQuantity(order.items)}개 · ${formatWon(order.total_amount)}`,
    thumb: order.items?.[0]?.product_image_url,
    status: ['완료', 'plain'],
  }));
  const requested = claims.map((claim) => ({
    key: `claim-${claim.id}`,
    kind: claim.claimType,
    date: claim.createdAt,
    orderId: claim.orderId,
    orderNo: claim.orderNo,
    storeName: claim.storeName,
    title: claim.item?.productName ?? '',
    summary: claim.item
      ? `${claim.item.quantity}개 · ${formatWon(claim.item.unitPrice * claim.item.quantity)}`
      : '',
    thumb: claim.item?.imageUrl,
    status: CLAIM_STATUS[claim.status] ?? ['접수됨', 'soft'],
  }));
  return [...canceled, ...requested].sort((a, b) => b.date.localeCompare(a.date));
}

export default function ClaimsPage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const [tab, setTab] = useState('ALL');
  const orders = useRequest(signedIn, 'claims-canceled', () =>
    listOrders({ page: 1, size: 100, status: 'CANCELED' })
  );
  const claims = useRequest(signedIn, 'claims-list', listClaims);

  const error = orders.error ?? claims.error;
  const ready = orders.data && claims.data;
  const entries = ready ? buildEntries(orders.data.items, claims.data.items) : [];
  const shown = entries.filter((entry) => tab === 'ALL' || entry.kind === tab);

  let body;
  if (error)
    body = (
      <ErrorNotice
        error={error}
        onRetry={() => {
          orders.reload();
          claims.reload();
        }}
      />
    );
  else if (!ready) body = <Loading />;
  else if (shown.length === 0) body = <p className="ord-empty">내역이 없어요</p>;
  else
    body = shown.map((entry) => (
      <article key={entry.key} className="ord-card">
        <div className="ord-card__top">
          <button
            type="button"
            className="ord-card__no"
            onClick={() => navigate(MY_ROUTES.orderDetail(entry.orderId))}
          >
            {formatMonthDay(entry.date)} · {entry.orderNo}
          </button>
          <span className={`ord-pill ord-pill--${entry.status[1]}`}>
            {KIND_LABEL[entry.kind]} {entry.status[0]}
          </span>
        </div>
        <button
          type="button"
          className="ord-card__body"
          onClick={() => navigate(MY_ROUTES.orderDetail(entry.orderId))}
        >
          <Thumb src={entry.thumb} />
          <span className="ord-card__text">
            <span className="ord-card__store">{entry.storeName}</span>
            <strong className="ord-card__title">{entry.title}</strong>
            <span className="ord-card__sum">{entry.summary}</span>
          </span>
        </button>
      </article>
    ));

  return (
    <main className="ord-page">
      <PageHeader title="취소·반품·교환 내역" />
      <div className="ord-tabs ord-tabs--four" role="tablist">
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
      <p className="mt-notice">반품·교환은 수령을 완료한 주문의 상세 화면에서 신청할 수 있어요.</p>
      <div className="ord-list">{body}</div>
    </main>
  );
}
