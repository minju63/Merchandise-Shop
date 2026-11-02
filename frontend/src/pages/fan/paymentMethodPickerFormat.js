import { paymentMethodName } from '../my/accountFormat.js';

const OPTION_LABELS = {
  GOODSPICK_PAY: '굿즈픽페이',
  TOSS_PAY: '토스페이',
  NAVER_PAY: '네이버페이',
  KAKAO_PAY: '카카오페이',
  CARD: '신용·체크카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  MOBILE: '휴대폰 결제',
};

export function selectedPaymentName(option, methodId, methods) {
  if (option === 'GOODSPICK_PAY') {
    const account = methods?.find((item) => item.id === methodId);
    return account ? `굿즈픽페이 · ${paymentMethodName(account)}` : '굿즈픽페이';
  }
  return OPTION_LABELS[option] ?? '결제수단을 선택해 주세요';
}
