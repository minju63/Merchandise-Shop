import ProductCard from '../../../components/ProductCard.jsx';

export default function CategoryProductCard({ product }) {
  return <ProductCard product={{ ...product, name: product.productName || product.name,
    imageUrl: product.thumbnailUrl, shop: product.storeName,
    price: Number(product.price).toLocaleString('ko-KR') + '원',
    stockText: product.displayStatus === 'SOLD_OUT' ? '품절' : '재고 ' + product.stock + '개',
    stockTone: product.displayStatus === 'SOLD_OUT' ? 'danger' : undefined,
    shipping: [product.pickupAvailable && '픽업', product.deliveryAvailable && '배송'].filter(Boolean).join(' · '),
  }} />;
}
