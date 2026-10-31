// 장바구니 담기 완료 토스트 — 화면은 그대로 두고, 원하면 장바구니로 바로 이동
// 담당: 공용
import { useEffect } from 'react';
import './CartAddedToast.css';

export default function CartAddedToast({ text = '장바구니에 담았어요', duration = 3000, onGoToCart, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [text, duration, onClose]);

  return (
    <div className="cart-added-toast" role="status">
      <span>{text}</span>
      <button type="button" className="cart-added-toast-action" onClick={onGoToCart}>
        장바구니 바로가기
      </button>
    </div>
  );
}
