import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DetailSection, DetailShell, NoticeList } from './BannerDetailParts.jsx';
import { PaymentMethodSheet, PaymentOptionName } from '../fan/FanTicketsPage.jsx';
import { listPaymentMethods } from '../my/account.api.js';
import { useSession } from '../my/hooks.js';
import './EventCheckout.css';

const won = (value) => value.toLocaleString('ko-KR');

const DEFAULT_NOTICES = [
  '지금은 시연용 모의 결제라 실제로 돈이 나가지 않아요.',
  '결제가 끝나면 바로 결과 화면으로 넘어가요.',
];

// 랜덤박스·최애박스·쿠지 결제 화면: 주문 내역 → 결제수단 → 동의 → 결제하기 (시연용 모의 결제)
export default function EventCheckout({
  title = '결제하기',
  heading,
  lines,
  total,
  notices = DEFAULT_NOTICES,
  working = false,
  error,
  onBack,
  onPay,
  onAddPaymentMethod,
}) {
  const { status } = useSession();
  const [option, setOption] = useState(null);
  const [methodId, setMethodId] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // 굿즈픽페이·등록 계좌는 마이페이지에 등록한 계좌를 쓴다 (응원권 구매와 같은 방식)
  const methods = useQuery({
    queryKey: ['event-payment-methods'],
    queryFn: listPaymentMethods,
    enabled: status === 'in',
    retry: false,
  });
  const bankAccounts = (methods.data?.items ?? []).filter((item) => item.method_type === 'BANK_ACCOUNT');
  const ready = Boolean(option) && agreed && !working;

  return (
    <DetailShell
      title={title}
      ready
      onBack={onBack}
      footer={(
        <button className="bd__btn" type="button" disabled={!ready} onClick={() => onPay({ option, methodId })}>
          {working ? '결제 중...' : !option ? '결제수단을 선택해 주세요' : !agreed ? '결제 동의가 필요해요' : `${won(total)}원 결제하기`}
        </button>
      )}
    >
      <DetailSection title="주문 내역">
        {heading ? <p className="event-checkout__heading">{heading}</p> : null}
        <dl className="event-checkout__lines">
          {lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
          <div className="event-checkout__total">
            <dt>결제 금액</dt>
            <dd>{won(total)}원</dd>
          </div>
        </dl>
      </DetailSection>

      <DetailSection title="결제수단">
        <div className={option ? 'fan-payment-summary is-selected' : 'fan-payment-summary'}>
          <span className="fan-payment-summary__icon" aria-hidden="true">₩</span>
          <div>
            <strong><PaymentOptionName option={option} methodId={methodId} methods={bankAccounts} /></strong>
            <small>{option ? `${won(total)}원 결제 예정` : '결제 전에 수단을 선택해 주세요'}</small>
          </div>
          <button type="button" onClick={() => setSheetOpen(true)}>{option ? '변경' : '선택'}</button>
        </div>
        <label className="fan-agree">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          주문 내용을 확인했고, {won(total)}원 결제에 동의해요
        </label>
        {error ? <p className="fan-error" role="alert">{error}</p> : null}
      </DetailSection>

      <DetailSection title="결제 전에 확인해 주세요">
        <NoticeList items={notices} />
      </DetailSection>

      {sheetOpen ? (
        <PaymentMethodSheet
          currentOption={option}
          currentMethodId={methodId}
          // 로그인 전이면 등록 계좌가 없는 것으로 보여 준다 (불러오는 중 표시가 계속 남지 않게)
          methods={methods.data || status === 'out' ? bankAccounts : undefined}
          onAdd={onAddPaymentMethod}
          onClose={() => setSheetOpen(false)}
          onConfirm={(next, id = null) => {
            setOption(next);
            setMethodId(id);
            setAgreed(false);
          }}
        />
      ) : null}
    </DetailShell>
  );
}
