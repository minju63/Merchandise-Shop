function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
}

export default function StoreReviewCard({ review }) {
  return (
    <article className="review-card">
      <div className="review-card-head">
        <strong>{review.nickname}</strong>
        <time dateTime={review.createdAt}>{dateLabel(review.createdAt)}</time>
      </div>
      <div className="review-stars" aria-label={`별점 ${review.rating}점`}>
        <span aria-hidden="true">
          {'★'.repeat(review.rating)}
          {'☆'.repeat(5 - review.rating)}
        </span>
        <span>{review.rating}점</span>
      </div>
      {review.productName && <p className="review-product">구매 상품 · {review.productName}</p>}
      {review.content && <p className="review-content">{review.content}</p>}
      {review.images.length > 0 && (
        <div className="review-images">
          {review.images.map((src, index) => (
            <img
              key={`${src}-${index}`}
              src={src}
              alt={`${review.productName || '리뷰'} 사진 ${index + 1}`}
              loading="lazy"
            />
          ))}
        </div>
      )}
    </article>
  );
}
