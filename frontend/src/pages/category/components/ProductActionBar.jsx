import { useEffect, useState } from 'react';
import Icon from '../../../components/Icon.jsx';

// actions: wishlist(id, wished), buy(id, quantity), cart(id, quantity), restock(id), preorder(id).
// Shared handlers own persistence, inventory rechecks and checkout navigation.
export default function ProductActionBar({ product, user, actions = {}, wished: wishedProp, onLogin }) {
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [wishedOverride, setWishedOverride] = useState(null);
  const [preorderedOverride, setPreorderedOverride] = useState(null);
  const [restockAlertedOverride, setRestockAlertedOverride] = useState(null);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2600);
    return () => clearTimeout(timer);
  }, [message]);
  const wished = wishedOverride ?? wishedProp ?? product.isWishlisted;
  const preordered = preorderedOverride ?? actions.isPreordered?.(product.storeProductId) ?? false;
  const restockAlerted =
    restockAlertedOverride ?? actions.isRestockAlerted?.(product.storeProductId) ?? false;
  const status =
    product.displayStatus ||
    (product.status === 'ON_SALE' && product.stock <= 0 ? 'SOLD_OUT' : product.status);
  const canBuy = product.canPurchase === true && status === 'ON_SALE' && product.stock > 0;
  async function run(name) {
    if (pending || !actions[name]) return;
    if (!user) {
      setMessage('로그인이 필요합니다.');
      onLogin?.();
      return;
    }
    setPending(name);
    setMessage('');
    try {
      const argument =
        name === 'wishlist' ? !wished : name === 'restock' ? !restockAlerted : 1;
      await actions[name](product.storeProductId, argument);
      if (name === 'wishlist') setWishedOverride(!wished);
      if (name === 'preorder') setPreorderedOverride(true);
      if (name === 'restock') setRestockAlertedOverride(argument);
      // 장바구니 담기 결과는 화면 아래 토스트로 따로 알려 준다.
      setMessage(
        name === 'wishlist'
          ? !wished
            ? '찜 목록에 추가했습니다.'
            : '찜을 해제했습니다.'
          : name === 'restock'
            ? argument
              ? '알림을 신청했어요. 마이 > 알림 신청에서 확인할 수 있어요.'
              : '알림 신청을 취소했어요.'
          : name === 'preorder'
            ? '사전예약이 완료됐어요. 마이 > 알림 신청에서 확인할 수 있어요.'
          : name === 'cart'
            ? ''
            : '요청을 완료했습니다.'
      );
    } catch (error) {
      // 수령 방법 선택 시트를 닫은 경우는 실패 안내를 띄우지 않는다.
      if (error.cancelled) return;
      const status = error.status ?? error.response?.status;
      if (status === 401) onLogin?.();
      setMessage(
        status === 401
          ? '로그인이 필요합니다.'
          : error.code === 'PREORDER_NOT_ALLOWED'
            ? '이 상품은 사전예약을 받지 않아요.'
            : error.code === 'ALREADY_PREORDERED'
              ? '이미 사전예약한 상품이에요.'
              : '요청에 실패했습니다. 다시 시도해 주세요.'
      );
    } finally {
      setPending('');
    }
  }
  const disabled = (name) => Boolean(pending) || !actions[name];
  return (
    <div className="category-action-area">
      <div className="category-action-bar" aria-label="상품 구매 및 저장">
        <button
          type="button"
          className="category-wish-button"
          aria-label={wished ? '찜 해제' : '상품 찜'}
          aria-pressed={Boolean(wished)}
          disabled={disabled('wishlist')}
          onClick={() => run('wishlist')}
        >
          <Icon name="heart" size={24} fill={wished ? 'currentColor' : 'none'} />
        </button>
        {canBuy ? (
          <>
            <button
              type="button"
              className="category-primary"
              disabled={disabled('buy')}
              onClick={() => run('buy')}
            >
              지금 구매
            </button>
            <button type="button" disabled={disabled('cart')} onClick={() => run('cart')}>
              장바구니
            </button>
          </>
        ) : ['SOLD_OUT', 'UPCOMING'].includes(status) && product.storeOperating !== false ? (
          <>
            <button
              type="button"
              aria-pressed={restockAlerted}
              disabled={disabled('restock')}
              onClick={() => run('restock')}
            >
              {restockAlerted ? '알림 신청 완료' : '재입고 알림'}
            </button>
            <button
              type="button"
              disabled={disabled('preorder') || preordered}
              onClick={() => run('preorder')}
            >
              {preordered ? '예약 완료' : '예약하기'}
            </button>
          </>
        ) : (
          <span>{product.storeOperating === false ? '매장 운영 중지' : '입고 예정'}</span>
        )}
      </div>
      {message && (
        <div className="category-action-toast" role="status" aria-live="polite">
          {message === '찜 목록에 추가했습니다.' && <Icon name="heart" size={18} fill="currentColor" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
