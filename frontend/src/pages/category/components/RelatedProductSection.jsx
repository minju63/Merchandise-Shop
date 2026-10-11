import { Link } from 'react-router-dom';
import ProductEmptyState from './ProductEmptyState';

// ProductCard is the shared component supplied by the integrating route owner.
// Contract: <ProductCard product={cardDTO} />; the wrapper supplies the detail link.
export default function RelatedProductSection({
  products = [],
  ProductCard,
  loading,
  error,
  onRetry,
}) {
  return (
    <section className="category-section">
      <h2>함께 보면 좋은 상품</h2>
      {loading ? (
        <p role="status">관련 상품을 불러오는 중입니다.</p>
      ) : error ? (
        <ProductEmptyState message="관련 상품을 불러오지 못했습니다." onRetry={onRetry} />
      ) : products.length === 0 ? (
        <ProductEmptyState message="관련 상품이 없습니다." />
      ) : !ProductCard ? (
        <ProductEmptyState message="상품 목록을 표시할 수 없습니다." />
      ) : (
        <div className="category-product-grid">
          {products.map((product) => (
            <Link
              key={product.storeProductId}
              to={`/products/${encodeURIComponent(product.storeProductId)}`}
            >
              <ProductCard product={product} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
