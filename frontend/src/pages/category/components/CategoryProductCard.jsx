import ProductCard from '../../../components/ProductCard.jsx';

export default function CategoryProductCard({ product }) {
  return <ProductCard product={{ ...product, name: product.productName || product.name,
    imageUrl: product.thumbnailUrl, shop: product.storeName,
    price: Number(product.price).toLocaleString('ko-KR') + '?',
    stockText: product.displayStatus === 'SOLD_OUT' ? '??' : '?? ' + product.stock + '?',
    stockTone: product.displayStatus === 'SOLD_OUT' ? 'danger' : undefined,
    shipping: [product.pickupAvailable && '??', product.deliveryAvailable && '??'].filter(Boolean).join(' ? '),
  }} />;
}
