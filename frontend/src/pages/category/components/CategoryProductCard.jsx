import ProductCard from '../../../components/ProductCard.jsx';

// 입고 예정·재입고 예정 상품은 배지 글자만 보여준다(검색 결과와 같은 표시).
function upcomingInfo(product) {
  const restock = product.displayStatus === 'SOLD_OUT' && product.upcomingAt;
  if (product.displayStatus !== 'UPCOMING' && !restock) return null;
  return {
    badge: restock ? { type: 'restock', label: '재입고 예정' } : { type: 'new', label: '입고 예정' },
  };
}

function stockLabel(product) {
  if (product.displayStatus === 'SOLD_OUT') return { text: '품절', tone: 'danger' };
  // 재고가 넉넉하면 표시하지 않고, 10개 이하일 때만 홈과 같이 품절 임박을 빨간색으로 보여준다.
  return product.stock > 0 && product.stock <= 10
    ? { text: `품절 임박 · ${product.stock}개`, tone: 'danger' }
    : { text: null };
}

export default function CategoryProductCard({ product }) {
  const upcoming = upcomingInfo(product);
  // 입고 예정·재입고 예정은 이미지 위 배지 대신 검색 결과처럼 빨간 글자로 보여준다.
  const stock = upcoming ? { text: upcoming.badge.label, tone: 'danger' } : stockLabel(product);
  // 품절·출시 예정·재입고 예정 상품은 이미지를 반투명 회색으로 덮고 가운데에 상태 글자를 보여준다.
  const overlay = upcoming
    ? (upcoming.badge.type === 'restock' ? 'restock' : 'coming')
    : (product.displayStatus === 'SOLD_OUT' ? 'soldout' : undefined);
  return <ProductCard product={{ ...product, name: product.productName || product.name,
    imageUrl: product.thumbnailUrl, shop: product.storeName,
    // 할인 중이면 할인가를 보여주고 할인 전 가격은 옆에 취소선으로 보여준다.
    price: Math.round(Number(product.price) * (100 - (product.discountRate || 0)) / 100).toLocaleString('ko-KR') + '원',
    originalPrice: Number(product.price).toLocaleString('ko-KR') + '원',
    stockText: stock.text,
    stockTone: stock.tone,
    overlay,
    shipping: [product.pickupAvailable && '픽업', product.deliveryAvailable && '배송'].filter(Boolean).join(' · '),
  }} />;
}
