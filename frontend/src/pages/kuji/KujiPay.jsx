// 담당: 연수
// 쿠지 결제창: 주문 요약 + 결제수단 선택 + 동의 → 결제하기 (시연용 모의 결제)
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listPaymentMethods } from '../my/account.api.js';
import { PaymentMethodSheet } from '../fan/PaymentMethodPicker.jsx';
import { selectedPaymentName } from '../fan/paymentMethodPickerFormat.js';
import { Sheet } from './KujiParts.jsx';
import { won } from './kujiUi.js';
import s from './kuji.module.css';

export default function KujiPaySheet({ title, lines, amount, pending, error, onClose, onPay }) {
  const navigate = useNavigate();
  const [option, setOption] = useState(null);
  const [methodId, setMethodId] = useState(null);
  const [agree, setAgree] = useState(false);
  const [picking, setPicking] = useState(false);

  const methods = useQuery({ queryKey: ['kuji-payment-methods'], queryFn: listPaymentMethods, retry: false });
  const accounts = (methods.data?.items ?? []).filter((item) => item.method_type === 'BANK_ACCOUNT');
  const defaultAccount = accounts.find((item) => item.is_default) ?? accounts[0] ?? null;
  const selectedOption = option ?? (defaultAccount ? 'GOODSPICK_PAY' : null);
  const selectedId =
    selectedOption === 'GOODSPICK_PAY' ? (accounts.find((item) => item.id === methodId) ?? defaultAccount)?.id ?? null : null;

  return (
    <>
      <Sheet label="결제" onClose={() => (pending ? null : onClose())}>
        <h3>{title}</h3>
        <div className={s.plines}>
          {lines.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
        </div>
        <div className={selectedOption ? 'fan-payment-summary is-selected' : 'fan-payment-summary'}>
          <span className="fan-payment-summary__icon" aria-hidden="true">
            ₩
          </span>
          <div>
            <strong>{selectedPaymentName(selectedOption, selectedId, accounts)}</strong>
            <small>{selectedOption ? `${won(amount)} 결제 예정` : '결제 전에 수단을 선택해 주세요'}</small>
          </div>
          <button type="button" onClick={() => setPicking(true)}>
            {selectedOption ? '변경' : '선택'}
          </button>
        </div>
        <label className="fan-agree">
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
          주문 내용을 확인했으며 결제에 동의합니다 (필수)
        </label>
        <div className={s.price}>
          <span>총 결제 금액</span>
          <div>
            <b>{won(amount)}</b>
          </div>
        </div>
        {error ? <p className={s.err}>{error}</p> : null}
        <div className={s.btns}>
          <button type="button" className={s.sec} disabled={pending} onClick={onClose}>
            취소
          </button>
          <button type="button" className={s.pri} disabled={!selectedOption || !agree || pending} onClick={() => onPay({ option: selectedOption, methodId: selectedId })}>
            {pending ? '결제 중…' : `${won(amount)} 결제하기`}
          </button>
        </div>
        <p className={s.pnote}>시연용 결제로 실제 금액이 빠져나가지 않아요</p>
      </Sheet>
      {picking
        ? createPortal(
            <PaymentMethodSheet
              currentOption={selectedOption}
              currentMethodId={selectedId}
              methods={methods.data ? accounts : undefined}
              onAdd={() => navigate('/my/payment-methods')}
              onClose={() => setPicking(false)}
              onConfirm={(nextOption, nextId = null) => {
                setOption(nextOption);
                setMethodId(nextId);
              }}
            />,
            document.body
          )
        : null}
    </>
  );
}
