import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useNavigate, useParams } from 'react-router-dom';
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
import { getOrder, getPickupInfo } from './my.api.js';
import {
  FULFILLMENT_LABEL,
  detailHeadline,
  formatDateTime,
  formatPickupDeadlineShort,
  formatRemaining,
  formatWon,
  maskPhone,
  timelineSteps,
} from './orderFormat.js';
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

function StoreBlock({ order, guide, guideLabel }) {
  const [open, setOpen] = useState(false);
  const store = order.store;
  if (!store) return null;
  const mapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(store.address ?? store.name)}`;
  return (
    <section className="ord-block">
      <h2 className="ord-block__title">매장 정보</h2>
      <div className="ord-store">
        <Thumb src={store.thumbnail_url} size={44} />
        <span className="ord-store__text">
          <strong>{store.name}</strong>
          <span>매장 페이지로 이동</span>
        </span>
        <ChevronIcon />
      </div>
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
      {open ? <p className="ord-guide">{guide || '매장에서 등록한 안내가 아직 없어요.'}</p> : null}
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
  const headline = detailHeadline(order);
  const payment = order.payments?.[0];
  const requests = order.requests ?? {};
  const info = order.fulfillmentInfo;
  const paymentRows = [
    ['상품 금액', formatWon(order.items_amount)],
    ...(!pickup ? [['배달비', formatWon(order.delivery_fee)]] : []),
    ...(order.discount_amount > 0
      ? [['쿠폰 할인', `-${formatWon(order.discount_amount)}`, 'accent']]
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

      {!pickup ? (
        <section className="ord-block">
          <h2 className="ord-block__title">배송지</h2>
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
        </section>
      ) : null}

      <StoreBlock
        order={order}
        guide={info?.guide_text}
        guideLabel={pickup ? '픽업 안내' : '배달 안내'}
      />

      <section className="ord-block">
        <h2 className="ord-block__title">주문 상품 {order.items.length}개</h2>
        {order.items.map((item) => (
          <div key={item.id} className="ord-item">
            <Thumb src={item.product_image_url} size={44} />
            <span className="ord-item__text">
              <strong>{item.product_name}</strong>
              <span>
                {formatWon(item.unit_price)} · {item.quantity}개
              </span>
            </span>
          </div>
        ))}
      </section>

      <section className="ord-block">
        <h2 className="ord-block__title">결제 정보</h2>
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
      </section>

      {pickup && requests.storeRequest ? (
        <section className="ord-block">
          <h2 className="ord-block__title">요청사항</h2>
          <p className="ord-addr__line">{requests.storeRequest}</p>
        </section>
      ) : null}

      <footer className="ord-footer">
        {order.canCancel ? (
          <button type="button" className="ord-btn" onClick={() => setCancelOpen(true)}>
            주문 취소
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
