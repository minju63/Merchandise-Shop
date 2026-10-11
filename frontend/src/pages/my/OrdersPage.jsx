import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CancelSheet from './CancelSheet.jsx';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import { CheckIcon, ClockIcon, SearchIcon, TruckIcon } from './icons.jsx';
import { useRequest, useSession } from './hooks.js';
import { getReorderItems, listOrders } from './my.api.js';
import {
  FULFILLMENT_LABEL,
  formatMonthDay,
  formatWon,
  itemsTitle,
  statusNote,
  statusPill,
  totalQuantity,
} from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';

const TABS = [
  ['all', '전체', undefined],
  ['pickup', '픽업', 'PICKUP'],
  ['delivery', '배달', 'DELIVERY'],
];
const CHIPS = [
  ['', '최근 3개월'],
  ['ONGOING', '진행 중'],
  ['COMPLETED', '수령 완료'],
  ['CANCELED', '취소'],
];
const PAGE_SIZE = 20;
const NOTE_ICONS = { clock: ClockIcon, truck: TruckIcon, check: CheckIcon };

function OrderCard({ order, onCancel, onNavigate, onReorder }) {
  const pill = statusPill(order);
  const note = statusNote(order);
  const NoteIcon = NOTE_ICONS[note.icon];
  const detailPath = MY_ROUTES.orderDetail(order.id);
  const thumb = order.items?.[0]?.product_image_url;

  let actions;
  if (order.status === 'READY_FOR_PICKUP') {
    actions = (
      <button
        type="button"
        className="ord-btn ord-btn--primary ord-btn--block"
        onClick={() => onNavigate(MY_ROUTES.pickupQr(order.id))}
      >
        픽업 QR 보기
      </button>
    );
  } else if (order.status === 'SHIPPING') {
    actions = (
      <button
        type="button"
        className="ord-btn ord-btn--block"
        onClick={() => onNavigate(detailPath)}
      >
        배달 상태 보기
      </button>
    );
  } else if (order.status === 'COMPLETED') {
    actions = (
      <div className="ord-actions">
        <button type="button" className="ord-btn ord-btn--soft" onClick={() => onReorder(order)}>
          재구매
        </button>
        <button
          type="button"
          className="ord-btn"
          onClick={() => onNavigate(MY_ROUTES.reviewWrite(order.id))}
        >
          리뷰 쓰기
        </button>
      </div>
    );
  } else if (order.canCancel) {
    actions = (
      <div className="ord-actions">
        <button type="button" className="ord-btn ord-btn--grow" onClick={() => onCancel(order)}>
          주문 취소
        </button>
        <button
          type="button"
          className="ord-btn ord-btn--grow"
          onClick={() => onNavigate(detailPath)}
        >
          주문 상세
        </button>
      </div>
    );
  } else {
    actions = (
      <button
        type="button"
        className="ord-btn ord-btn--block"
        onClick={() => onNavigate(detailPath)}
      >
        주문 상세
      </button>
    );
  }

  return (
    <article className="ord-card">
      <div className="ord-card__top">
        <button type="button" className="ord-card__no" onClick={() => onNavigate(detailPath)}>
          {formatMonthDay(order.created_at)} · {order.order_no}
        </button>
        <span className={`ord-pill ord-pill--${pill.tone}`}>{pill.label}</span>
      </div>
      <button type="button" className="ord-card__body" onClick={() => onNavigate(detailPath)}>
        <Thumb src={thumb} />
        <span className="ord-card__text">
          <span className="ord-card__store">
            {order.store?.name}
            <span className="ord-tag">{FULFILLMENT_LABEL[order.fulfillment_type]}</span>
          </span>
          <strong className="ord-card__title">{itemsTitle(order.items)}</strong>
          <span className="ord-card__sum">
            총 {totalQuantity(order.items)}개 · {formatWon(order.total_amount)}
          </span>
        </span>
      </button>
      <p className="ord-card__note">
        <NoteIcon /> {note.text}
      </p>
      {actions}
    </article>
  );
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { status: authStatus } = useSession();
  const signedIn = authStatus === 'in';

  const tab = TABS.find(([key]) => key === params.get('type')) ?? TABS[0];
  const statusParam = params.get('status') ?? '';
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    if (authStatus === 'out') navigate(MY_ROUTES.login, { replace: true });
  }, [authStatus, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(input.trim());
      setPageNo(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const size = Math.min(100, pageNo * PAGE_SIZE);
  const query = {
    page: 1,
    size,
    ...(tab[2] ? { fulfillmentType: tab[2] } : {}),
    ...(statusParam ? { status: statusParam } : { period: 'LAST_3_MONTHS' }),
    ...(keyword ? { keyword } : {}),
  };
  const orders = useRequest(signedIn, JSON.stringify(query), () => listOrders(query));

  const update = (next) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
    setPageNo(1);
  };

  const reorder = async (order) => {
    try {
      const result = await getReorderItems(order.id);
      navigate(MY_ROUTES.reorder, { state: { reorder: result } });
    } catch (error) {
      window.alert(error.message);
    }
  };

  const items = orders.data?.items ?? [];
  const hasMore = orders.data && items.length < orders.data.totalCount && size < 100;

  let body;
  if (orders.error) body = <ErrorNotice error={orders.error} onRetry={orders.reload} />;
  else if (orders.loading && !orders.data) body = <Loading />;
  else if (items.length === 0) body = <p className="ord-empty">주문 내역이 없어요</p>;
  else
    body = (
      <>
        {items.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onCancel={setCancelTarget}
            onNavigate={navigate}
            onReorder={reorder}
          />
        ))}
        {hasMore ? (
          <button
            type="button"
            className="ord-btn ord-btn--block"
            onClick={() => setPageNo((value) => value + 1)}
          >
            더보기
          </button>
        ) : null}
      </>
    );

  return (
    <main className="ord-page">
      <PageHeader title="주문 내역" />
      <div className="ord-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab[0] === key}
            className={tab[0] === key ? 'ord-tab is-active' : 'ord-tab'}
            onClick={() => update({ type: key === 'all' ? '' : key })}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="ord-search">
        <SearchIcon />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="상품명 또는 매장명 검색"
        />
      </label>
      <div className="ord-chips">
        {CHIPS.map(([value, label]) => (
          <button
            key={label}
            type="button"
            className={statusParam === value ? 'ord-chip is-active' : 'ord-chip'}
            onClick={() => update({ status: value })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ord-list">{body}</div>
      {cancelTarget ? (
        <CancelSheet
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={() => {
            setCancelTarget(null);
            orders.reload();
          }}
        />
      ) : null}
    </main>
  );
}
