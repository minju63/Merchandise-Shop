import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CancelSheet from './CancelSheet.jsx';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import {
  ChatIcon,
  ChevronIcon,
  ClockIcon,
  CopyIcon,
  PhoneIcon,
  PinIcon,
  TruckIcon,
} from './icons.jsx';
import { useRequest, useSession } from './hooks.js';
import { useDialog } from '../../components/useDialog.jsx';
import { confirmPurchase, getOrder, getPickupInfo } from './my.api.js';
import {
  FULFILLMENT_LABEL,
  detailHeadline,
  formatDateTime,
  formatPickupDeadlineShort,
  formatRemaining,
  formatWon,
  maskPhone,
  statusPill,
  timelineSteps,
} from './orderFormat.js';
import { formatPhone } from './accountFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';

function copy(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function Timeline({ order }) {
  const steps = timelineSteps(order);
  return (
    <ol className="ord-timeline">
      {steps.map((step) => (
        <li key={step.status} className={step.done ? 'is-done' : ''}>
          <span className={step.current ? 'ord-timeline__dot is-current' : 'ord-timeline__dot'} />
          <span className="ord-timeline__label">{step.label}</span>
          <span className="ord-timeline__time">{step.at}</span>
        </li>
      ))}
    </ol>
  );
}

function PickupCode({ order }) {
  const pickup = useRequest(true, `pickup:${order.id}`, () => getPickupInfo(order.id));
  const [dataUrl, setDataUrl] = useState('');
  const payload = pickup.data?.qrPayload;

  useEffect(() => {
    if (!payload) return undefined;
    let active = true;
    QRCode.toDataURL(payload, { margin: 1, width: 360 }).then((url) => active && setDataUrl(url));
    return () => {
      active = false;
    };
  }, [payload]);

  if (pickup.loading) return <Loading />;
  if (pickup.error) return <ErrorNotice error={pickup.error} onRetry={pickup.reload} />;
  if (!pickup.data?.available) return null;
  return (
    <section className="ord-qr">
      <div className="ord-qr__box">{dataUrl ? <img src={dataUrl} alt="픽업 QR 코드" /> : null}</div>
      <p className="ord-qr__label">픽업 번호</p>
      <p className="ord-qr__code">{pickup.data.pickupCode.split('').join(' ')}</p>
      {order.pickup_deadline ? (
        <p className="ord-qr__remain">
          <ClockIcon /> {formatPickupDeadlineShort(order.pickup_deadline)} ·{' '}
          {formatRemaining(order.pickup_deadline)}
        </p>
      ) : null}
    </section>
  );
}

function StoreBlock({ order, guide, guideLabel, courierName }) {
  const [open, setOpen] = useState(false);
  const store = order.store;
  if (!store) return null;
  const pickupOrder = order.fulfillment_type === 'PICKUP';
  // 배달이 시작되면 안내 대신 택배 송장번호를 보여준다.
  const shipped = !pickupOrder && ['SHIPPING', 'COMPLETED'].includes(order.status);
  const mapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(store.address ?? store.name)}`;
  return (
    <section className="ord-block">
      <h2 className="ord-block__title">매장 정보</h2>
      <Link className="ord-store" to={MY_ROUTES.store(store.id)} state={{ orderReturnTo: MY_ROUTES.orderDetail(order.id) }}>
        <Thumb src={store.thumbnail_url} size={44} />
        <span className="ord-store__text">
          <strong>{store.name}</strong>
          <ChevronIcon aria-hidden="true" />
        </span>
      </Link>
      {store.address ? (
        <p className="ord-line">
          <PinIcon width={16} height={16} /> <span>{store.address}</span>
          <button type="button" aria-label="주소 복사" onClick={() => copy(store.address)}>
            <CopyIcon />
          </button>
        </p>
      ) : null}
      {store.phone ? (
        <p className="ord-line">
          <PhoneIcon width={16} height={16} /> <span>{store.phone}</span>
          <button type="button" aria-label="전화번호 복사" onClick={() => copy(store.phone)}>
            <CopyIcon />
          </button>
        </p>
      ) : null}
      {order.fulfillment_type === 'PICKUP' ? (
        <div className="ord-actions">
          <a className="ord-btn ord-btn--grow" href={mapUrl} target="_blank" rel="noreferrer">
            길찾기
          </a>
          <button
            type="button"
            className="ord-btn ord-btn--grow"
            onClick={() => setOpen((value) => !value)}
          >
            {guideLabel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="ord-btn ord-btn--block"
          onClick={() => setOpen((value) => !value)}
        >
          {guideLabel}
        </button>
      )}
      {open ? (
        shipped ? (
          <div className="ord-guide">
            {order.tracking_no ? (
              <p className="ord-line">
                <TruckIcon width={16} height={16} />{' '}
                <span>
                  {courierName ? `${courierName} ` : '택배 '}
                  {order.tracking_no}
                </span>
                <button type="button" aria-label="송장번호 복사" onClick={() => copy(order.tracking_no)}>
                  <CopyIcon />
                </button>
              </p>
            ) : (
              <p>송장번호가 아직 등록되지 않았어요. 등록되면 여기에서 확인할 수 있어요.</p>
            )}
          </div>
        ) : (
          <p className="ord-guide">
            {guide || (pickupOrder ? '매장에서 등록한 안내가 아직 없어요.' : '주문 확인 후 순차적으로 배달됩니다.')}
          </p>
        )
      ) : null}
    </section>
  );
}

// 눌러서 펼치는 정보 칸. 접힌 상태에서는 한 줄 요약만 보여준다.
function Fold({ title, summary, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="ord-block ord-fold">
      <button
        type="button"
        className="ord-fold__head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ord-fold__text">
          <strong>{title}</strong>
          {summary ? <span>{summary}</span> : null}
        </span>
        <ChevronIcon className={open ? 'ord-fold__chevron is-open' : 'ord-fold__chevron'} />
      </button>
      {open ? <div className="ord-fold__body">{children}</div> : null}
    </section>
  );
}

function Rows({ rows }) {
  return (
    <dl className="ord-rows">
      {rows.map(([label, value, tone]) => (
        <div key={label} className={tone ? `ord-rows__row is-${tone}` : 'ord-rows__row'}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { status: authStatus } = useSession();
  const detail = useRequest(authStatus === 'in', `order:${orderId}`, () => getOrder(orderId));
  const [cancelOpen, setCancelOpen] = useState(false);
  const { alert: showAlert, confirm, dialog } = useDialog();

  const confirmOrder = async () => {
    const message =
      '구매를 확정할까요?\n구매확정 후에는 반품·교환이 불가능해요.\n확정하면 적립금이 지급되고 리뷰를 쓸 수 있어요.';
    if (!(await confirm(message, { confirmLabel: '구매확정' })))
      return;
    try {
      await confirmPurchase(orderId);
      detail.reload();
    } catch (error) {
      await showAlert(error.message);
    }
  };

  useEffect(() => {
    if (authStatus === 'out') navigate(MY_ROUTES.login, { replace: true });
  }, [authStatus, navigate]);

  if (detail.error) {
    return (
      <main className="ord-page">
        <PageHeader title="주문 상세" />
        <ErrorNotice error={detail.error} onRetry={detail.reload} />
      </main>
    );
  }
  const order = detail.data;
  if (!order) {
    return (
      <main className="ord-page">
        <PageHeader title="주문 상세" />
        <Loading />
      </main>
    );
  }

  const pickup = order.fulfillment_type === 'PICKUP';
  const productReturnState = { listReturnTo: MY_ROUTES.orderDetail(order.id) };
  const headline = detailHeadline(order);
  const payment = order.payments?.[0];
  const requests = order.requests ?? {};
  const info = order.fulfillmentInfo;
  const paymentRows = [
    ['상품 금액', formatWon(order.items_amount)],
    ...(!pickup ? [['배달비', formatWon(order.delivery_fee)]] : []),
    ...(order.discount_amount > 0
      ? [
          // 할인 금액에는 쿠폰 할인과 회원 등급 할인이 함께 들어 있다.
          [order.used_coupon_id ? '쿠폰·등급 할인' : '등급 할인', `-${formatWon(order.discount_amount)}`, 'accent'],
        ]
      : []),
  ];

  return (
    <main className="ord-page ord-page--detail">
      <PageHeader title="주문 상세" />

      <section className="ord-block ord-hero">
        <p className="ord-hero__meta">
          <span className="ord-tag">{FULFILLMENT_LABEL[order.fulfillment_type]}</span> 주문번호{' '}
          {order.order_no}
          <button type="button" aria-label="주문번호 복사" onClick={() => copy(order.order_no)}>
            <CopyIcon />
          </button>
        </p>
        <h2 className="ord-hero__title">{headline.title}</h2>
        <p className="ord-hero__sub">{headline.sub}</p>
        {order.status !== 'CANCELED' ? <Timeline order={order} /> : null}
        {!pickup && order.status === 'SHIPPING' && info?.estimated_days ? (
          <div className="ord-eta">
            <TruckIcon />
            <span>
              <strong>예상 도착 {info.estimated_days}일 이내</strong>
              <span>{info.courier_name ? `${info.courier_name} · ` : ''}도착 전 연락드릴게요</span>
            </span>
          </div>
        ) : null}
      </section>

      {pickup && order.status === 'READY_FOR_PICKUP' ? <PickupCode order={order} /> : null}

      <StoreBlock
        order={order}
        guide={info?.guide_text}
        guideLabel={
          pickup ? '픽업 안내' : ['SHIPPING', 'COMPLETED'].includes(order.status) ? '배송 조회' : '배달 안내'
        }
        courierName={info?.courier_name}
      />

      <section className="ord-block">
        <h2 className="ord-block__title">주문 상품 {order.items.length}개</h2>
        {order.items.map((item) => (
          <div key={item.id} className="ord-item">
            <Link to={MY_ROUTES.product(item.store_product_id)} state={productReturnState} aria-label={`${item.product_name} 상품 상세 보기`}>
              <Thumb src={item.product_image_url} size={44} />
            </Link>
            <span className="ord-item__text">
              <Link to={MY_ROUTES.product(item.store_product_id)} state={productReturnState}>{item.product_name}</Link>
              <span>
                {formatWon(item.unit_price)} · {item.quantity}개
              </span>
            </span>
          </div>
        ))}
      </section>

      {order.groupOrders?.length ? (
        <section className="ord-block">
          <h2 className="ord-block__title">함께 결제한 주문 {order.groupOrders.length}건</h2>
          {order.groupOrders.map((other) => {
            const pill = statusPill(other);
            return (
              <div key={other.id} className="ord-group-order">
                <button
                  type="button"
                  className="ord-group-order__head"
                  onClick={() => navigate(MY_ROUTES.orderDetail(other.id))}
                >
                  <strong>{other.store?.name}</strong>
                  <span className={`ord-pill ord-pill--${pill.tone}`}>{pill.label}</span>
                </button>
                {other.items.map((item) => (
                  <div key={item.id} className="ord-item">
                    <Link to={MY_ROUTES.product(item.store_product_id)} state={productReturnState} aria-label={`${item.product_name} 상품 상세 보기`}>
                      <Thumb src={item.product_image_url} size={44} />
                    </Link>
                    <span className="ord-item__text">
                      <Link to={MY_ROUTES.product(item.store_product_id)} state={productReturnState}>{item.product_name}</Link>
                      <span>
                        {formatWon(item.unit_price)} · {item.quantity}개
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      ) : null}

      {pickup && requests.storeRequest ? (
        <section className="ord-block">
          <h2 className="ord-block__title">요청사항</h2>
          <p className="ord-addr__line">{requests.storeRequest}</p>
        </section>
      ) : null}

      {order.orderer ? (
        <Fold
          title="주문자 정보"
          summary={[order.orderer.name, order.orderer.phone ? formatPhone(order.orderer.phone) : null]
            .filter(Boolean)
            .join(' | ')}
        >
          <Rows
            rows={[
              ['이름', order.orderer.name ?? '-'],
              ['연락처', order.orderer.phone ? formatPhone(order.orderer.phone) : '-'],
              ...(order.orderer.email ? [['이메일', order.orderer.email]] : []),
            ]}
          />
        </Fold>
      ) : null}

      <Fold title="결제 정보" summary={formatWon(order.total_amount)}>
        <Rows rows={paymentRows} />
        <div className="ord-total">
          <span>최종 결제 금액</span>
          <strong>{formatWon(order.total_amount)}</strong>
        </div>
        {payment ? (
          <Rows
            rows={[
              ['결제수단', payment.method_label ?? '-'],
              ...(payment.approved_at ? [['결제 일시', formatDateTime(payment.approved_at)]] : []),
            ]}
          />
        ) : null}
        {payment?.is_mock ? <p className="ord-hint">시연용 결제로 실제 결제되지 않았어요</p> : null}
      </Fold>

      {!pickup ? (
        <Fold
          title="배송지 정보"
          summary={`${order.recipient_name ?? ''} | ${order.shipping_address ?? ''}`}
        >
          <p className="ord-addr__who">
            <strong>{order.recipient_name}</strong> <span>{maskPhone(order.recipient_phone)}</span>
          </p>
          <p className="ord-addr__line">{order.shipping_address}</p>
          {requests.deliveryRequest ? (
            <p className="ord-addr__req">요청사항 · {requests.deliveryRequest}</p>
          ) : null}
          {order.canChangeAddress ? (
            <button
              type="button"
              className="ord-btn ord-btn--block"
              onClick={() => navigate(MY_ROUTES.addresses, { state: { orderId: order.id } })}
            >
              배송지 변경
            </button>
          ) : order.status !== 'CANCELED' && order.status !== 'COMPLETED' ? (
            <>
              <button type="button" className="ord-btn ord-btn--block" disabled>
                배송지 변경
              </button>
              <p className="ord-hint">상품 준비가 시작되어 배송지를 바꿀 수 없어요</p>
            </>
          ) : null}
        </Fold>
      ) : null}

      <Fold title="배송 / 교환 / 반품 안내">
        <ul className="ord-notice">
          <li>상품은 매장별로 준비·배송해 드려요.</li>
          <li>상품 문의는 해당 매장이 답변해 드려요.</li>
          <li>교환·반품은 상품을 받은 뒤 반품·교환 요청에서 접수해 주세요.</li>
          <li>매장마다 교환·반품 배송비가 다를 수 있어요.</li>
        </ul>
      </Fold>

      <footer className="ord-footer">
        {order.canCancel ? (
          <button type="button" className="ord-btn" onClick={() => setCancelOpen(true)}>
            주문 취소
          </button>
        ) : null}
        {order.canConfirm ? (
          <button type="button" className="ord-btn ord-btn--soft" onClick={confirmOrder}>
            구매확정
          </button>
        ) : null}
        {order.status === 'COMPLETED' && !order.purchase_confirmed_at ? (
          <button
            type="button"
            className="ord-btn"
            onClick={() => navigate(MY_ROUTES.claimNew(order.id))}
          >
            반품·교환
          </button>
        ) : null}
        <button
          type="button"
          className="ord-btn ord-btn--grow"
          onClick={() => navigate(MY_ROUTES.support)}
        >
          <ChatIcon /> 문의하기
        </button>
      </footer>

      {dialog}
      {cancelOpen ? (
        <CancelSheet
          order={order}
          onClose={() => setCancelOpen(false)}
          onDone={() => {
            setCancelOpen(false);
            detail.reload();
          }}
        />
      ) : null}
    </main>
  );
}
