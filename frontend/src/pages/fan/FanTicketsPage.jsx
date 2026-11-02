import { useRef, useState } from 'react';
import { DetailSection, DetailShell, NoticeList } from '../home/BannerDetailParts.jsx';
import {
  CHARGE_AMOUNTS,
  CHEER_POINTS_PER_TICKET,
  CHEER_PRICE,
  CREDIT_BUY_QUANTITIES,
  CREDIT_RETURN_RATE,
  DAILY_CHEER_LIMIT,
  cheerPoints,
} from './fanGuideData.js';
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
const PAYMENT_OPTION_LABELS = {
  GOODSPICK_PAY: '굿즈픽페이',
  TOSS_PAY: '토스페이',
  NAVER_PAY: '네이버페이',
  KAKAO_PAY: '카카오페이',
  CARD: '신용·체크카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  MOBILE: '휴대폰 결제',
};
const PAYMENT_TABS = [
  ['EASY', '간편결제'],
  ['CARD', '카드'],
  ['CASH', '현금'],
  ['MOBILE', '휴대폰'],
];

const won = (value) => value.toLocaleString('ko-KR');
const formatDate = (value) => new Date(value).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });

function useSheetDrag(onClose) {
  const startY = useRef(0);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const setDragOffset = (value) => {
    offsetRef.current = value;
    setOffset(value);
  };
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    startY.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragging) return;
    setDragOffset(Math.max(0, event.clientY - startY.current));
  };
  const finish = () => {
    setDragging(false);
    if (offsetRef.current >= 96) {
      onClose();
      return;
    }
    setDragOffset(0);
  };

  return {
    sheetStyle: { transform: `translateY(${offset}px)` },
    sheetClass: dragging ? 'is-dragging' : '',
    gripProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  };
}

function paymentTab(option) {
  if (['GOODSPICK_PAY', 'TOSS_PAY', 'NAVER_PAY', 'KAKAO_PAY'].includes(option)) return 'EASY';
  if (option === 'CARD') return 'CARD';
  if (['VIRTUAL_ACCOUNT', 'REGISTERED_ACCOUNT'].includes(option)) return 'CASH';
  if (option === 'MOBILE') return 'MOBILE';
  return 'EASY';
}

function PaymentBenefitGuide({ tab }) {
  if (tab === 'CARD') return null;
  if (tab === 'EASY') {
    return (
      <div className="fan-payment-benefits">
        <h3>굿즈픽페이 혜택 <em>NEW</em></h3>
        <strong>• 굿즈픽페이 첫 결제 적립금 최대 5,000원</strong>
        <strong>• 계좌 간편결제 시</strong>
        <p>• 2만원 이상 결제 시 0.3%</p>
        <p>• 3만원 이상 결제 시 0.5%</p>
        <p>• 5만원 이상 결제 시 1%</p>
        <p>• 10만원 이상 결제 시 1.5%</p>
        <p>• 굿즈픽페이 결제 시 별도의 카드번호 입력 없이 결제</p>
        <p className="fan-payment-benefits__settle">• 굿즈픽페이 결제 적립금은 <b>전체 주문상품 구매확정 시 지급돼요.</b></p>
      </div>
    );
  }
  if (tab === 'CASH') {
    return (
      <div className="fan-payment-benefits">
        <h3>현금 결제 안내</h3>
        <strong>• 가상계좌로 현금 결제할 수 있어요.</strong>
        <p>• 가상계좌는 주문마다 새로운 계좌가 발급돼요.</p>
      </div>
    );
  }
  return (
    <div className="fan-payment-benefits">
      <h3>휴대폰 결제 안내</h3>
      <strong>• 결제 금액은 다음 달 통신요금에 합산돼요.</strong>
      <p>• 통신사 정책에 따라 결제가 제한될 수 있어요.</p>
    </div>
  );
}

function selectedPaymentName(option, methodId, methods) {
  if (option === 'GOODSPICK_PAY') {
    const account = methods?.find((item) => item.id === methodId);
    return account ? `굿즈픽페이 · ${paymentMethodName(account)}` : '굿즈픽페이';
  }
  if (option === 'REGISTERED_ACCOUNT') {
    const account = methods?.find((item) => item.id === methodId);
    return account ? `등록 계좌 · ${paymentMethodName(account)}` : '등록 계좌';
  }
  return PAYMENT_OPTION_LABELS[option] ?? '결제수단을 선택해 주세요';
}

function PaymentMethodSheet({ currentOption, currentMethodId, methods, onAdd, onClose, onConfirm }) {
  const [tab, setTab] = useState(paymentTab(currentOption));
  const [draftOption, setDraftOption] = useState(currentOption);
  const [draftMethodId, setDraftMethodId] = useState(currentMethodId);
  const drag = useSheetDrag(onClose);
  const defaultAccount = methods?.find((item) => item.is_default) ?? null;
  const pickedAccount = methods?.find((item) => item.id === draftMethodId) ?? defaultAccount;

  const changeTab = (next) => {
    setTab(next);
    if (paymentTab(draftOption) !== next) {
      setDraftOption(null);
      setDraftMethodId(null);
    }
  };
  const choose = (option, id = null) => {
    setDraftOption(option);
    setDraftMethodId(id);
  };

  return (
    <div className="fan-payment-sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        className={`fan-payment-sheet ${drag.sheetClass}`.trim()}
        style={drag.sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fan-payment-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="fan-payment-sheet__head" {...drag.gripProps}>
          <span className="fan-payment-sheet__grip" aria-hidden="true" />
          <h2 id="fan-payment-sheet-title">결제 수단 변경</h2>
        </div>
        <div className="fan-payment-sheet__tabs" role="tablist" aria-label="결제수단 종류">
          {PAYMENT_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? 'is-on' : ''}
              onClick={() => changeTab(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="fan-payment-sheet__body">
          {tab === 'EASY' ? (
            <div className="fan-payment-sheet__choices">
              <button
                type="button"
                className={`${draftOption === 'GOODSPICK_PAY' ? 'is-on ' : ''}is-goodspick`.trim()}
                disabled={!pickedAccount}
                onClick={() => pickedAccount && choose('GOODSPICK_PAY', pickedAccount.id)}
              >
                <span>
                  <b>GOODSPICK <u>Pay</u></b>
                  <small>
                    {pickedAccount
                      ? `${pickedAccount.is_default ? '기본 계좌' : '선택 계좌'} · ${paymentMethodName(pickedAccount)}`
                      : methods ? '기본 결제 계좌를 등록해 주세요' : '기본 계좌 불러오는 중'}
                  </small>
                </span>
                <i aria-hidden="true">✓</i>
              </button>
              {draftOption === 'GOODSPICK_PAY' && methods?.length > 1 ? (
                <div className="fan-payment-accounts" role="radiogroup" aria-label="결제 계좌 선택">
                  {methods.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      role="radio"
                      aria-checked={pickedAccount?.id === account.id}
                      className={pickedAccount?.id === account.id ? 'is-on' : ''}
                      onClick={() => choose('GOODSPICK_PAY', account.id)}
                    >
                      {paymentMethodName(account)}{account.is_default ? ' · 기본' : ''}
                    </button>
                  ))}
                </div>
              ) : null}
              {methods && defaultAccount ? (
                <button className="is-add" type="button" onClick={onAdd}>
                  <span>+ 계좌 추가·관리</span>
                </button>
              ) : null}
              {[
                ['TOSS_PAY', '토스페이'],
                ['NAVER_PAY', '네이버페이'],
                ['KAKAO_PAY', '카카오페이'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={draftOption === value ? 'is-on' : ''}
                  onClick={() => choose(value)}
                >
                  <span>{label}</span>
                  <i aria-hidden="true">✓</i>
                </button>
              ))}
              {methods && !defaultAccount ? (
                <button className="is-add" type="button" onClick={onAdd}>
                  <span>+ 굿즈픽페이 기본 계좌 등록하기</span>
                </button>
              ) : null}
            </div>
          ) : null}

          {tab === 'CARD' ? (
            <div className="fan-payment-sheet__choices">
              <button type="button" className={draftOption === 'CARD' ? 'is-on' : ''} onClick={() => choose('CARD')}>
                <span>신용·체크카드</span><i aria-hidden="true">✓</i>
              </button>
            </div>
          ) : null}

          {tab === 'CASH' ? (
            <div className="fan-payment-sheet__choices">
              <button type="button" className={draftOption === 'VIRTUAL_ACCOUNT' ? 'is-on' : ''} onClick={() => choose('VIRTUAL_ACCOUNT')}>
                <span>가상계좌</span><i aria-hidden="true">✓</i>
              </button>
            </div>
          ) : null}

          {tab === 'MOBILE' ? (
            <div className="fan-payment-sheet__choices">
              <button type="button" className={draftOption === 'MOBILE' ? 'is-on' : ''} onClick={() => choose('MOBILE')}>
                <span>휴대폰 결제</span><i aria-hidden="true">✓</i>
              </button>
            </div>
          ) : null}

          <PaymentBenefitGuide tab={tab} />
        </div>

        <button
          className="fan-payment-sheet__confirm"
          type="button"
          disabled={!draftOption}
          onClick={() => { onConfirm(draftOption, draftMethodId); onClose(); }}
        >
          확인
        </button>
      </section>
    </div>
  );
}

function RefundSheet({ pack, working, onClose, onSubmit }) {
  const [form, setForm] = useState({ bank: '', last4: '', holder: '' });
  const [error, setError] = useState('');
  const drag = useSheetDrag(onClose);
  const valid = form.bank.trim() && /^\d{4}$/.test(form.last4) && form.holder.trim();

  const submit = async (event) => {
    event.preventDefault();
    if (!valid || working) return;
    setError('');
    try {
      await onSubmit(pack.id, form);
      onClose();
    } catch (cause) {
      setError(cause.message);
    }
  };

  return (
    <div className="fan-refund-backdrop" role="presentation" onClick={working ? undefined : onClose}>
      <form
        className={`fan-refund-sheet ${drag.sheetClass}`.trim()}
        style={drag.sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fan-refund-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <button type="button" className="fan-refund-sheet__grip" aria-label="아래로 끌어 닫기" {...drag.gripProps} />
        <h2 id="fan-refund-title">환불 계좌 입력</h2>
        <p className="fan-refund-sheet__amount">
          {SOURCE_LABELS[pack.source]} 응원권 {pack.remaining}장
          <strong>{won(pack.remaining * pack.unitPrice)}원</strong>
        </p>
        <p className="fan-refund-sheet__notice">환불 신청 후 입금까지 영업일 기준 2~3일이 소요될 수 있어요.</p>
        <label>
          <span>은행</span>
          <input
            value={form.bank}
            maxLength={50}
            placeholder="국민은행"
            autoFocus
            onChange={(event) => setForm({ ...form, bank: event.target.value })}
          />
        </label>
        <label>
          <span>계좌번호 뒤 4자리</span>
          <input
            value={form.last4}
            inputMode="numeric"
            placeholder="1234"
            onChange={(event) => setForm({ ...form, last4: event.target.value.replace(/\D/g, '').slice(0, 4) })}
          />
        </label>
        <label>
          <span>예금주</span>
          <input
            value={form.holder}
            maxLength={50}
            placeholder="홍길동"
            onChange={(event) => setForm({ ...form, holder: event.target.value })}
          />
        </label>
        <p className="fan-refund-sheet__demo">시연용이라 계좌번호 전체는 저장하지 않고 뒤 4자리만 받아요.</p>
        {error ? <p className="fan-error" role="alert">{error}</p> : null}
        <div className="fan-refund-sheet__actions">
          <button type="button" onClick={onClose} disabled={working}>취소</button>
          <button className="is-primary" type="submit" disabled={!valid || working}>
            {working ? '신청 중...' : '환불 신청'}
          </button>
        </div>
      </form>
    </div>
  );
}

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
  paymentOption,
  paymentMethodId,
  agreed,
  onSelectPaymentOption,
  onAgree,
  onAddPaymentMethod,
  onBack,
  onChangeMethod,
  onSelect,
  onBuy,
  onRefund,
  onCheer,
}) {
  const [refundPack, setRefundPack] = useState(null);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const credit = me?.credit ?? 0;
  const creditQuantities = CREDIT_BUY_QUANTITIES;
  const options = method === 'CASH' ? CHARGE_AMOUNTS : creditQuantities;
  const label = method === 'CASH'
    ? (selected ? `${won(selected)}원 결제하기` : '금액을 선택해 주세요')
    : (selected ? `적립금 ${won(selected * CHEER_PRICE)}원으로 ${selected}장 구매` : '장수를 선택해 주세요');
  const lackCredit = method === 'CREDIT' && selected && selected * CHEER_PRICE > credit;
  // 현금 구매는 결제수단을 고르고 동의해야 결제할 수 있다
  const needPayment = method === 'CASH' && selected && (!paymentOption || !agreed);

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
              <div><span>무료 응원권</span><strong>{me.freeTickets}장</strong><em>{won(cheerPoints(me.freeTickets))}점</em></div>
              <div><span>적립금 구매</span><strong>{me.creditTickets}장</strong><em>{won(cheerPoints(me.creditTickets))}점</em></div>
              <div><span>현금 구매</span><strong>{me.cashTickets}장</strong><em>{won(cheerPoints(me.cashTickets))}점</em></div>
            </div>
            <p className="bd__caption">
              보유 적립금 {won(credit)}원
            </p>
            {notice ? <p className="fan-notice" role="status">{notice}</p> : null}
            {error && me ? <p className="fan-error" role="alert">{error}</p> : null}
          </DetailSection>

          <DetailSection title="구매 방법" description={`응원권 1장 = 응원포인트 ${won(CHEER_POINTS_PER_TICKET)}점 = ${won(CHEER_PRICE)}원`}>
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
                  <span>{method === 'CASH'
                    ? `응원포인트 ${won(cheerPoints(value / CHEER_PRICE))}점`
                    : `응원포인트 ${won(cheerPoints(value))}점 · 적립금 ${won(value * CHEER_PRICE)}원`}</span>
                </button>
              ))}
            </div>
            {method === 'CASH' ? <p className="bd__caption">지금은 시연용 모의 결제라 실제 결제는 일어나지 않아요.</p> : null}
            {method === 'CREDIT' && credit < CHEER_PRICE ? <p className="bd__caption">적립금이 부족해요. 응원에서 지면 적립금으로 돌려드려요.</p> : null}
          </DetailSection>

          {method === 'CASH' && selected ? (
            <DetailSection title="결제수단" description={`${won(selected)}원을 결제해요. 결제수단을 선택해 주세요.`}>
              <div className={paymentOption ? 'fan-payment-summary is-selected' : 'fan-payment-summary'}>
                <span className="fan-payment-summary__icon" aria-hidden="true">₩</span>
                <div>
                  <strong>{selectedPaymentName(paymentOption, paymentMethodId, paymentMethods)}</strong>
                  <small>{paymentOption ? `${won(selected)}원 결제 예정` : '결제 전에 수단을 선택해 주세요'}</small>
                </div>
                <button type="button" onClick={() => setPaymentSheetOpen(true)}>
                  {paymentOption ? '변경' : '선택'}
                </button>
              </div>
              <label className="fan-agree">
                <input type="checkbox" checked={agreed} onChange={(event) => onAgree(event.target.checked)} />
                선택한 결제수단으로 {won(selected)}원을 결제하는 데 동의해요
              </label>
            </DetailSection>
          ) : null}

          <DetailSection title="구매 전에 확인해 주세요">
            <NoticeList
              items={[
                `한 사람이 하루에 최대 응원포인트 ${won(cheerPoints(DAILY_CHEER_LIMIT))}점까지 보낼 수 있어요 (무료 응원권 포함).`,
                `응원한 최애가 지면 현금으로 산 응원권은 적립금 ${CREDIT_RETURN_RATE}%, 적립금으로 산 응원권은 100%를 돌려드려요.`,
                '이긴 최애에 쓴 응원권과 무료 응원권으로 한 응원은 반환되지 않아요.',
                '구매한 응원권은 구매 후 30일 안에만 환불할 수 있어요.',
                '현금 구매분은 한 장도 사용하지 않아야 하며, 적립금 구매분은 안 쓴 만큼 돌려받을 수 있어요.',
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
                      <button className="fan-link" type="button" disabled={working} onClick={() => setRefundPack(pack)}>환불</button>
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
      {refundPack ? (
        <RefundSheet
          pack={refundPack}
          working={working}
          onClose={() => setRefundPack(null)}
          onSubmit={onRefund}
        />
      ) : null}
      {paymentSheetOpen ? (
        <PaymentMethodSheet
          currentOption={paymentOption}
          currentMethodId={paymentMethodId}
          methods={paymentMethods}
          onAdd={onAddPaymentMethod}
          onClose={() => setPaymentSheetOpen(false)}
          onConfirm={onSelectPaymentOption}
        />
      ) : null}
    </DetailShell>
  );
}
