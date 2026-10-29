import { Link } from 'react-router-dom';
import ProductCard from './ProductCard.jsx';
import './GoodsListCard.css';

// 카테고리·검색·굿즈샵 상세의 상품 목록이 같은 카드(같은 표시 규칙)를 쓰도록 한 곳에서 만든다.
const OVERLAY_STOCK_TEXTS = { soldout: '품절', coming: '입고 예정', restock: '재입고 예정' };

const won = (value) => `${Number(value).toLocaleString('ko-KR')}원`;

// 이미지를 덮는 상태: 출시 예정 / 재입고 예정 / 품절 (서버가 overlay를 내려주면 그대로 쓴다)
function overlayOf(item) {
  if ('overlay' in item) return item.overlay ?? undefined;
  if (item.status === 'UPCOMING') return 'coming';
  if (item.status !== 'SOLD_OUT' && item.stock !== 0) return undefined;
  return item.restockExpectedAt && new Date(item.restockExpectedAt) > new Date() ? 'restock' : 'soldout';
}

// item: { storeProductId, storeId, storeName, name, image, price, discountRate, stock, status,
//         restockExpectedAt, overlay, pickupAvailable, deliveryAvailable }
export default function GoodsListCard({ item, linkState, shopSuffix = '' }) {
  const overlay = overlayOf(item);
  const lowStock = !overlay && item.stock > 0 && item.stock <= 10;
  const rate = item.discountRate > 0 ? item.discountRate : 0;
  const hasPrice = item.price != null;
  const card = {
    storeProductId: item.storeProductId,
    storeId: item.storeId,
    name: item.name,
    imageUrl: item.image,
    shop: `${item.storeName ?? ''}${shopSuffix}`,
    price: hasPrice ? won(Math.round(item.price * (100 - rate) / 100)) : '가격 정보 없음',
    discountRate: hasPrice && rate ? rate : undefined,
    originalPrice: hasPrice && rate ? won(item.price) : undefined,
    stockText: overlay ? OVERLAY_STOCK_TEXTS[overlay] : (lowStock ? `품절 임박 · ${item.stock}개` : null),
    stockTone: 'danger',
    overlay,
    shipping: [item.pickupAvailable && '픽업', item.deliveryAvailable && '배달'].filter(Boolean).join(' · '),
  };
  return (
    <Link to={`/products/${encodeURIComponent(item.storeProductId)}`} state={linkState}>
      <ProductCard product={card} />
    </Link>
  );
}
