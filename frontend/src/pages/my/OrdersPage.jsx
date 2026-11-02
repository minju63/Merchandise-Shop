import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import { ChevronIcon, SearchIcon } from './icons.jsx';
import { useRequest, useSession } from './hooks.js';
import { confirmPurchase, getReorderItems, listOrders } from './my.api.js';
import {
  FULFILLMENT_LABEL,
  formatYearMonthDay,
  formatWon,
  itemsTitle,
  statusNote,
  statusPill,
  totalQuantity,
} from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import { useDialog } from '../../components/useDialog.jsx';

const TABS = [
  ['all', '전체', undefined],
  ['pickup', '픽업', 'PICKUP'],
  ['delivery', '배달', 'DELIVERY'],
];
const CHIPS = [
  ['ONGOING', '진행 중'],
  ['COMPLETED', '수령 완료'],
];
const PAGE_SIZE = 20;
const YEAR_COUNT = 5;
// 한 번에 결제한 주문(checkout_group_id 가 같은 것)은 한 묶음이고, 같은 날이라도 결제를 나눠 했으면 묶음을 따로 둔다.
function payGroups(orders) {
  const groups = [];
  const byGroup = new Map();
  for (const order of orders) {
    const key = order.checkout_group_id;
    if (key && byGroup.has(key)) byGroup.get(key).push(order);
    else {
      const group = [order];
      groups.push(group);
      if (key) byGroup.set(key, group);
    }
  }
  return groups;
}
// 기간 선택: 기본은 최근 3개월, '전체'는 전 기간, 숫자는 그 해의 주문만
function yearOptions() {
  const thisYear = Number(formatYearMonthDay(new Date().toISOString()).slice(0, 4));
  return Array.from({ length: YEAR_COUNT }, (_, index) => String(thisYear - index));
}

function OrderCard({ order, onConfirm, onNavigate, onReorder }) {
  const pill = statusPill(order);
  const note = statusNote(order);
  const detailPath = MY_ROUTES.orderDetail(order.id);
  const thumb = order.items?.[0]?.product_image_url;
  const reviewCompleted =
    order.items?.length > 0 && order.items.every((item) => item.review_completed);

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
        {order.purchase_confirmed_at ? (
          <button
            type="button"
            className="ord-btn"
            disabled={reviewCompleted}
            onClick={() => {
              if (!reviewCompleted) onNavigate(MY_ROUTES.reviewWrite(order.id));
            }}
          >
            {reviewCompleted ? '작성 완료' : '리뷰 쓰기'}
          </button>
        ) : (
          <button type="button" className="ord-btn" onClick={() => onConfirm(order)}>
            구매확정
          </button>
        )}
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
      <button type="button" className="ord-card__status" onClick={() => onNavigate(detailPath)}>
        {pill.label} <span>· {note.text}</span>
      </button>
      <button type="button" className="ord-card__body" onClick={() => onNavigate(detailPath)}>
        <Thumb src={thumb} size={96} />
        <span className="ord-card__text">
          <span className="ord-card__store">
            {order.store?.name}
            <span className="ord-tag">{FULFILLMENT_LABEL[order.fulfillment_type]}</span>
          </span>
          <strong className="ord-card__title">{itemsTitle(order.items)}</strong>
          <span className="ord-card__sum">
            총 {totalQuantity(order.items)}개 · 최종 {formatWon(order.total_amount)}
            {order.discount_amount > 0 && <span> · 쿠폰 할인 -{formatWon(order.discount_amount)}</span>}
          </span>
        </span>
      </button>
      {actions}
    </article>
  );
}

export default function OrdersPage() {
  const { alert: showAlert, confirm, dialog } = useDialog();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { status: authStatus } = useSession();
  const signedIn = authStatus === 'in';

  const tab = TABS.find(([key]) => key === params.get('type')) ?? TABS[0];
  const statusParam = params.get('status') ?? '';
  const years = yearOptions();
  const periodParam = params.get('period') ?? '';
  const period = periodParam === 'ALL' || years.includes(periodParam) ? periodParam : '';
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pageNo, setPageNo] = useState(1);

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
    ...(statusParam ? { status: statusParam } : {}),
    ...(period && period !== 'ALL'
      ? { from: `${period}-01-01`, to: `${period}-12-31` }
      : !period && !statusParam
        ? { period: 'LAST_3_MONTHS' }
        : {}),
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
      await showAlert(error.message);
    }
  };

  const confirmOrder = async (order) => {
    const message =
      '구매를 확정할까요?\n구매확정 후에는 반품·교환이 불가능해요.\n확정하면 적립금이 지급되고 리뷰를 쓸 수 있어요.';
    if (!(await confirm(message, { confirmLabel: '구매확정' })))
      return;
    try {
      await confirmPurchase(order.id);
      orders.reload();
    } catch (error) {
      await showAlert(error.message);
    }
  };

  // 취소된 주문은 취소·반품·교환 내역에서 따로 본다.
  const items = (orders.data?.items ?? []).filter((order) => order.status !== 'CANCELED');
  // 같은 날짜(KST)에 주문한 내역은 한 날짜 아래로 묶는다. 목록은 이미 최신순이다.
  const groups = payGroups(items).map((group) => [formatYearMonthDay(group[0].created_at), group]);
  const hasMore = orders.data && items.length < orders.data.totalCount && size < 100;

  let body;
  if (orders.error) body = <ErrorNotice error={orders.error} onRetry={orders.reload} />;
  else if (orders.loading && !orders.data) body = <Loading />;
  else if (items.length === 0) body = <p className="ord-empty">주문 내역이 없어요</p>;
  else
    body = (
      <>
        {groups.map(([date, dayOrders]) => (
          <section key={dayOrders[0].id} className="ord-day">
            <button
              type="button"
              className="ord-day__head"
              onClick={() => navigate(MY_ROUTES.orderDetail(dayOrders[0].id))}
            >
              <h2 className="ord-day__date">{date}</h2>
              <ChevronIcon />
            </button>
            {dayOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onConfirm={confirmOrder}
                onNavigate={navigate}
                onReorder={reorder}
              />
            ))}
          </section>
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
        <label className="ord-period">
          <select value={period} onChange={(event) => update({ period: event.target.value })}>
            <option value="">최근 3개월</option>
            <option value="ALL">전체</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </select>
        </label>
        {CHIPS.map(([value, label]) => (
          <button
            key={label}
            type="button"
            className={statusParam === value ? 'ord-chip is-active' : 'ord-chip'}
            onClick={() => update({ status: statusParam === value ? '' : value })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ord-list">{body}</div>
      {dialog}
    </main>
  );
}
