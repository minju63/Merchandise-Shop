import { useRef, useState } from 'react';
import { paymentMethodName } from '../my/accountFormat.js';
import './FanCheer.css';

const TABS = [
  ['EASY', '간편결제'],
  ['CARD', '카드'],
  ['CASH', '현금'],
  ['MOBILE', '휴대폰'],
];

function paymentTab(option) {
  if (['GOODSPICK_PAY', 'TOSS_PAY', 'NAVER_PAY', 'KAKAO_PAY'].includes(option)) return 'EASY';
  if (option === 'CARD') return 'CARD';
  if (option === 'VIRTUAL_ACCOUNT') return 'CASH';
  if (option === 'MOBILE') return 'MOBILE';
  return 'EASY';
}

function useSheetDrag(onClose) {
  const startY = useRef(0);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const setDragOffset = (value) => {
    offsetRef.current = value;
    setOffset(value);
  };
  const finish = () => {
    setDragging(false);
    if (offsetRef.current >= 96) onClose();
    else setDragOffset(0);
  };
  return {
    sheetStyle: { transform: `translateY(${offset}px)` },
    sheetClass: dragging ? 'is-dragging' : '',
    gripProps: {
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        startY.current = event.clientY;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event) => {
        if (dragging) setDragOffset(Math.max(0, event.clientY - startY.current));
      },
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  };
}

function BenefitGuide({ tab }) {
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
        <p className="fan-payment-benefits__settle">
          • 굿즈픽페이 결제 적립금은 <b>전체 주문상품 구매확정 시 지급돼요.</b>
        </p>
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

export function PaymentMethodSheet({ currentOption, currentMethodId, methods, onAdd, onClose, onConfirm }) {
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
        aria-labelledby="checkout-payment-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="fan-payment-sheet__head" {...drag.gripProps}>
          <span className="fan-payment-sheet__grip" aria-hidden="true" />
          <h2 id="checkout-payment-sheet-title">결제 수단 변경</h2>
        </div>
        <div className="fan-payment-sheet__tabs" role="tablist" aria-label="결제수단 종류">
          {TABS.map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'is-on' : ''} onClick={() => changeTab(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="fan-payment-sheet__body">
          {tab === 'EASY' ? (
            <div className="fan-payment-sheet__choices">
              <button type="button" className={`${draftOption === 'GOODSPICK_PAY' ? 'is-on ' : ''}is-goodspick`.trim()} disabled={!pickedAccount} onClick={() => pickedAccount && choose('GOODSPICK_PAY', pickedAccount.id)}>
                <span><b>GOODSPICK <u>Pay</u></b><small>{pickedAccount ? `${pickedAccount.is_default ? '기본 계좌' : '선택 계좌'} · ${paymentMethodName(pickedAccount)}` : methods ? '기본 결제 계좌를 등록해 주세요' : '기본 계좌 불러오는 중'}</small></span><i aria-hidden="true">✓</i>
              </button>
              {draftOption === 'GOODSPICK_PAY' && methods?.length > 1 ? (
                <div className="fan-payment-accounts" role="radiogroup" aria-label="결제 계좌 선택">
                  {methods.map((account) => (
                    <button key={account.id} type="button" role="radio" aria-checked={pickedAccount?.id === account.id} className={pickedAccount?.id === account.id ? 'is-on' : ''} onClick={() => choose('GOODSPICK_PAY', account.id)}>
                      {paymentMethodName(account)}{account.is_default ? ' · 기본' : ''}
                    </button>
                  ))}
                </div>
              ) : null}
              {methods && defaultAccount ? <button className="is-add" type="button" onClick={onAdd}><span>+ 계좌 추가·관리</span></button> : null}
              {[
                ['TOSS_PAY', '토스페이'],
                ['NAVER_PAY', '네이버페이'],
                ['KAKAO_PAY', '카카오페이'],
              ].map(([value, label]) => (
                <button key={value} type="button" className={draftOption === value ? 'is-on' : ''} onClick={() => choose(value)}><span>{label}</span><i aria-hidden="true">✓</i></button>
              ))}
              {methods && !defaultAccount ? <button className="is-add" type="button" onClick={onAdd}><span>+ 굿즈픽페이 기본 계좌 등록하기</span></button> : null}
            </div>
          ) : null}
          {tab === 'CARD' ? <div className="fan-payment-sheet__choices"><button type="button" className={draftOption === 'CARD' ? 'is-on' : ''} onClick={() => choose('CARD')}><span>신용·체크카드</span><i aria-hidden="true">✓</i></button></div> : null}
          {tab === 'CASH' ? <div className="fan-payment-sheet__choices"><button type="button" className={draftOption === 'VIRTUAL_ACCOUNT' ? 'is-on' : ''} onClick={() => choose('VIRTUAL_ACCOUNT')}><span>가상계좌</span><i aria-hidden="true">✓</i></button></div> : null}
          {tab === 'MOBILE' ? <div className="fan-payment-sheet__choices"><button type="button" className={draftOption === 'MOBILE' ? 'is-on' : ''} onClick={() => choose('MOBILE')}><span>휴대폰 결제</span><i aria-hidden="true">✓</i></button></div> : null}
          <BenefitGuide tab={tab} />
        </div>
        <button className="fan-payment-sheet__confirm" type="button" disabled={!draftOption} onClick={() => { onConfirm(draftOption, draftMethodId); onClose(); }}>확인</button>
      </section>
    </div>
  );
}
