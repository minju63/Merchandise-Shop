import ProductEmptyState from './ProductEmptyState.jsx';

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export default function ProductReviewSection({ reviews, loading, error, onRetry }) {
  if (loading) return <p className="category-review-status" role="status">리뷰를 불러오는 중입니다.</p>;
  if (error)
    return <ProductEmptyState message="리뷰를 불러오지 못했습니다." onRetry={onRetry} />;
  if (!reviews?.items?.length)
    return <ProductEmptyState message="아직 작성된 상품 리뷰가 없습니다." />;
  return (
    <div className="category-product-reviews">
      <p className="category-product-reviews__count">상품 리뷰 {reviews.totalCount}개</p>
      {reviews.items.map((review) => (
        <article className="category-product-review" key={review.id}>
          <header>
            <strong>{review.nickname}</strong>
            <time dateTime={review.createdAt}>{dateLabel(review.createdAt)}</time>
          </header>
          <div className="category-product-review__rating" aria-label={`별점 ${review.rating}점`}>
            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
          </div>
          <p>{review.content}</p>
          {review.images.length > 0 && (
            <div className="category-product-review__images">
              {review.images.map((url, index) => (
                <img key={url} src={url} alt={`리뷰 사진 ${index + 1}`} loading="lazy" />
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
