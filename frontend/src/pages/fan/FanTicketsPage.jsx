import { DetailSection, DetailShell, NoticeList } from '../home/BannerDetailParts.jsx';
import { CHARGE_AMOUNTS, CHEER_PRICE, CREDIT_BUY_QUANTITIES, CREDIT_RETURN_RATE, DAILY_CHEER_LIMIT } from './fanGuideData.js';
import { paymentMethodName } from '../my/accountFormat.js';
import './FanCheer.css';

const CREDIT_LABELS = {
  RETURN_105: '응원 반환(105%)',
  RETURN_100: '응원 반환(100%)',
  USE: '굿즈 구매 사용',
  EXPIRE: '기간 만료',
  TICKET_BUY: '응원권 구매',
  TICKET_REFUND: '응원권 환불',
};

const SOURCE_LABELS = { CASH: '현금 구매', CREDIT: '적립금 구매' };

const won = (value) => value.toLocaleString('ko-KR');
const formatDate = (value) => new Date(value).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });

// 응원권 구매 화면 (/fan/tickets). 현금 결제는 모의다.
export default function FanTicketsPage({
  me,
  tickets,
  method,
  selected,
  working,
  error,
  notice,
  paymentMethods,
  paymentMethodId,
  agreed,
  onSelectPaymentMethod,
  onAgree,
  onAddPaymentMethod,
  onBack,
  onChangeMethod,
  onSelect,
  onBuy,
  onRefund,
  onCheer,
}) {
  const credit = me?.credit ?? 0;
  const creditQuantities = CREDIT_BUY_QUANTITIES;
  const options = method === 'CASH' ? CHARGE_AMOUNTS : creditQuantities;
  const label = method === 'CASH'
    ? (selected ? `${won(selected)}원 결제하기` : '금액을 선택해 주세요')
    : (selected ? `적립금 ${won(selected * CHEER_PRICE)}원으로 ${selected}장 구매` : '장수를 선택해 주세요');
  const lackCredit = method === 'CREDIT' && selected && selected * CHEER_PRICE > credit;
  // 현금 구매는 결제수단을 고르고 동의해야 결제할 수 있다
  const needPayment = method === 'CASH' && selected && (!paymentMethodId || !agreed);

  return (
    <DetailShell
      title="응원권 구매"
      ready={Boolean(me)}
      error={error && !me ? error : undefined}
      onBack={onBack}
      footer={(
        <>
          <button className="bd__btn bd__btn--secondary" type="button" onClick={onCheer}>응원하러 가기</button>
          <button className="bd__btn" type="button" disabled={!selected || working || lackCredit || needPayment} onClick={onBuy}>
            {working ? '처리 중...' : label}
          </button>
        </>
      )}
    >
      {me ? (
        <>
          <DetailSection title="내 응원권">
            <div className="fan-balance">
              <div><span>무료 응원권</span><strong>{me.freeTickets}장</strong></div>
              <div><span>적립금 구매</span><strong>{me.creditTickets}장</strong></div>
              <div><span>현금 구매</span><strong>{me.cashTickets}장</strong></div>
            </div>
            <p className="bd__caption">
              응원할 때는 무료 → 적립금 구매 → 현금 구매 순서로 써요.
              <br />
              보유 적립금 {won(credit)}원
            </p>
            {notice ? <p className="fan-notice" role="status">{notice}</p> : null}
            {error && me ? <p className="fan-error" role="alert">{error}</p> : null}
          </DetailSection>

          <DetailSection title="구매 방법" description={`응원권 1장 = 응원 1회 = ${won(CHEER_PRICE)}원`}>
            <div className="fan-tabs" role="tablist" aria-label="구매 방법">
              <button type="button" role="tab" aria-selected={method === 'CASH'} className={method === 'CASH' ? 'is-on' : ''} onClick={() => onChangeMethod('CASH')}>현금</button>
              <button type="button" role="tab" aria-selected={method === 'CREDIT'} className={method === 'CREDIT' ? 'is-on' : ''} onClick={() => onChangeMethod('CREDIT')}>적립금</button>
            </div>
            <div className="fan-amounts" role="radiogroup" aria-label={method === 'CASH' ? '결제 금액' : '구매 장수'}>
              {options.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected === value}
                  className={selected === value ? 'is-on' : ''}
                  disabled={method === 'CREDIT' && value * CHEER_PRICE > credit}
                  onClick={() => onSelect(value)}
                >
                  <strong>{method === 'CASH' ? `${won(value)}원` : `${value}장`}</strong>
                  <span>{method === 'CASH' ? `응원 ${value / CHEER_PRICE}회` : `적립금 ${won(value * CHEER_PRICE)}원`}</span>
                </button>
              ))}
            </div>
            {method === 'CASH' ? <p className="bd__caption">지금은 시연용 모의 결제라 실제 결제는 일어나지 않아요.</p> : null}
            {method === 'CREDIT' && credit < CHEER_PRICE ? <p className="bd__caption">적립금이 부족해요. 응원에서 지면 적립금으로 돌려드려요.</p> : null}
          </DetailSection>

          {method === 'CASH' && selected ? (
            <DetailSection title="결제수단" description={`${won(selected)}원을 결제해요`}>
              {paymentMethods && paymentMethods.length === 0 ? (
                <p className="bd__empty">
                  등록된 결제수단이 없어요
                  <br />
                  <button className="fan-link" type="button" onClick={onAddPaymentMethod}>결제수단 추가하러 가기 ›</button>
                </p>
              ) : null}
              <ul className="fan-methods">
                {(paymentMethods ?? []).map((item) => (
                  <li key={item.id}>
                    <label className={paymentMethodId === item.id ? 'is-on' : ''}>
                      <input
                        type="radio"
                        name="fan-payment-method"
                        checked={paymentMethodId === item.id}
                        onChange={() => onSelectPaymentMethod(item.id)}
                      />
                      <strong>{paymentMethodName(item)}</strong>
                      {item.is_default ? <em className="fan-badge">기본</em> : null}
                    </label>
                  </li>
                ))}
              </ul>
              <label className="fan-agree">
                <input type="checkbox" checked={agreed} onChange={(event) => onAgree(event.target.checked)} />
                시연용 결제에 동의해요 (실제 결제는 이뤄지지 않아요)
              </label>
            </DetailSection>
          ) : null}

          <DetailSection title="구매 전에 확인해 주세요">
            <NoticeList
              items={[
                `한 사람이 하루에 최대 ${DAILY_CHEER_LIMIT}회까지 응원할 수 있어요 (무료 응원권 포함).`,
                `응원한 최애가 지면 현금으로 산 응원권은 적립금 ${CREDIT_RETURN_RATE}%, 적립금으로 산 응원권은 100%를 돌려드려요.`,
                '이긴 최애에 쓴 응원권과 무료 응원권으로 한 응원은 반환되지 않아요.',
                '현금으로 산 응원권은 한 장도 안 썼다면 구매 후 7일 안에 환불할 수 있어요.',
                '적립금으로 산 응원권은 안 쓴 만큼 적립금으로 돌려받을 수 있어요.',
              ]}
            />
          </DetailSection>

          <DetailSection title="내 응원권 묶음">
            {tickets?.packs.length ? (
              <ul className="fan-ledger">
                {tickets.packs.map((pack) => (
                  <li key={pack.id}>
                    <div>
                      <strong>{SOURCE_LABELS[pack.source]} {pack.quantity}장</strong>
                      <span>
                        남은 {pack.remaining}장 · {formatDate(pack.createdAt)} 구매
                        {pack.status === 'REFUNDED' ? ' · 환불됨' : ''}
                      </span>
                    </div>
                    {pack.refundable ? (
                      <button className="fan-link" type="button" disabled={working} onClick={() => onRefund(pack.id)}>환불</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bd__empty">아직 구매한 응원권이 없어요</p>
            )}
          </DetailSection>

          <DetailSection title="적립금 내역">
            {tickets?.credit.length ? (
              <ul className="fan-ledger">
                {tickets.credit.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>{CREDIT_LABELS[row.type] ?? row.type}</strong>
                      <span>{formatDate(row.createdAt)}</span>
                    </div>
                    <b className={row.amount < 0 ? 'is-minus' : ''}>{row.amount > 0 ? '+' : ''}{won(row.amount)}원</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bd__empty">아직 내역이 없어요</p>
            )}
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
