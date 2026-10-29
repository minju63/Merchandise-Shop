import ProductCard from '../../../components/ProductCard.jsx';
import { formatOpenTime } from '../../../utils/openTime.js';

// 입고 예정·재입고 예정 상품은 홈의 입고 예정 카드처럼 배지와 오픈 시각으로 보여준다.
function upcomingInfo(product) {
  const restock = product.displayStatus === 'SOLD_OUT' && product.upcomingAt;
  if (product.displayStatus !== 'UPCOMING' && !restock) return null;
  return {
    badge: restock ? { type: 'restock', label: '재입고 예정' } : { type: 'new', label: '출시 예정' },
    openText: product.upcomingAt ? formatOpenTime(product.upcomingAt, Date.now()).text : null,
  };
}

function stockLabel(product) {
  if (product.displayStatus === 'SOLD_OUT') return { text: '품절', tone: 'danger' };
  // 재고 10개 이하는 홈과 같이 빨간색으로 보여준다.
  return { text: '재고 ' + product.stock + '개', tone: product.stock <= 10 ? 'danger' : undefined };
}

export default function CategoryProductCard({ product }) {
  const upcoming = upcomingInfo(product);
  const stock = upcoming ? { text: null } : stockLabel(product);
  // 품절·출시 예정·재입고 예정 상품은 이미지를 반투명 회색으로 덮고 가운데에 상태 글자를 보여준다.
  const overlay = upcoming
    ? (upcoming.badge.type === 'restock' ? 'restock' : 'coming')
    : (product.displayStatus === 'SOLD_OUT' ? 'soldout' : undefined);
  return <ProductCard product={{ ...product, name: product.productName || product.name,
    imageUrl: product.thumbnailUrl, shop: product.storeName,
    price: Number(product.price).toLocaleString('ko-KR') + '원',
    stockText: stock.text,
    stockTone: stock.tone,
    overlay,
    upcomingBadge: upcoming?.badge,
    openText: upcoming?.openText,
    shipping: [product.pickupAvailable && '픽업', product.deliveryAvailable && '배송'].filter(Boolean).join(' · '),
  }} />;
}
