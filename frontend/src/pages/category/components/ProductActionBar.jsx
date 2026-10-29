import { useState } from 'react';

// actions: wishlist(id, wished), buy(id, quantity), cart(id, quantity), restock(id), preorder(id).
// Shared handlers own persistence, inventory rechecks and checkout navigation.
export default function ProductActionBar({ product, user, actions = {}, onLogin }) {
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [wishedOverride, setWishedOverride] = useState(null);
  const wished = wishedOverride ?? product.isWishlisted;
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
      const argument = name === 'wishlist' ? !wished : 1;
      await actions[name](product.storeProductId, argument);
      if (name === 'wishlist') setWishedOverride(!wished);
      setMessage(
        name === 'wishlist'
          ? !wished
            ? '찜 목록에 추가했습니다.'
            : '찜을 해제했습니다.'
          : '요청을 완료했습니다.'
      );
    } catch (error) {
      // 수령 방법 선택 시트를 닫은 경우는 실패 안내를 띄우지 않는다.
      if (error.cancelled) return;
      if (error.response?.status === 401) onLogin?.();
      setMessage(
        error.response?.status === 401
          ? '로그인이 필요합니다.'
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
          aria-label={wished ? '찜 해제' : '상품 찜'}
          aria-pressed={Boolean(wished)}
          disabled={disabled('wishlist')}
          onClick={() => run('wishlist')}
        >
          {wished ? '♥' : '♡'}
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
        ) : status === 'SOLD_OUT' && product.storeOperating !== false ? (
          <>
            <button type="button" disabled={disabled('restock')} onClick={() => run('restock')}>
              재입고 알림
            </button>
            <button type="button" disabled={disabled('preorder')} onClick={() => run('preorder')}>
              예약하기
            </button>
          </>
        ) : (
          <span>{product.storeOperating === false ? '매장 운영 중지' : '입고 예정'}</span>
        )}
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
