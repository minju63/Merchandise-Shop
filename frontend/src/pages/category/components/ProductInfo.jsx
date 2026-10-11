import Icon from '../../../components/Icon.jsx';

export default function ProductInfo({ product }) {
  const status =
    product.displayStatus ||
    (product.status === 'ON_SALE' && product.stock <= 0 ? 'SOLD_OUT' : product.status);
  const labels = { ON_SALE: '판매 중', SOLD_OUT: '품절', UPCOMING: '입고 예정' };
  const categories = (product.categories || []).map((row) => row.category || row);
  const breadcrumb = [
    categories.find((row) => row.type === 'CONTENT')?.name,
    product.workTitle,
    product.characterName,
  ].filter(Boolean);
  return (
    <section className="category-product-info">
      {breadcrumb.length > 0 && (
        <p className="category-detail-breadcrumb">{breadcrumb.join(' › ')}</p>
      )}
      <h1>{product.productName || product.name}</h1>
      <p className="category-price">
        {product.discountRate > 0 && <span>{product.discountRate}% </span>}
        {Number(product.price).toLocaleString('ko-KR')}원
      </p>
      <div className="category-detail-tags">
        {product.conditionGrade && (
          <span className="category-chip">
            {{ NEW: '새상품', A: 'A등급', B: 'B등급', C: 'C등급' }[product.conditionGrade] ||
              product.conditionGrade}
          </span>
        )}
        <span className="category-chip">
          {status === 'ON_SALE' ? `재고 ${product.stock}개` : labels[status] || '이용 불가'}
        </span>
      </div>
      <div className="category-fulfillment">
        <span><Icon name="store" size={22} />{product.pickupAvailable ? '매장 픽업 가능' : '매장 픽업 불가'}</span>
        <span><Icon name="truck" size={22} />{product.deliveryAvailable ? '일반 배송 가능' : '배송 불가'}</span>
      </div>
      {product.storeOperating === false && (
        <p role="status">현재 매장 운영이 중지되어 구매할 수 없습니다.</p>
      )}
    </section>
  );
}
