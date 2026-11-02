import { useState } from 'react';
import RatingStars from '../../../components/RatingStars.jsx';
import ProductReviewEditor from '../../../components/ProductReviewEditor.jsx';

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

export default function StoreReviewCard({ review, type = 'store', onEdit, onDelete, onLike, onLogin, onChanged, storeId, canLike, deleting = false }) {
  const [likePending, setLikePending] = useState(false);
  const [likeError, setLikeError] = useState('');
  const [editingProduct, setEditingProduct] = useState(false);
  const toggleLike = async () => {
    if (!canLike) {
      onLogin?.();
      return;
    }
    if (likePending || review.isMine) return;
    setLikePending(true);
    setLikeError('');
    try {
      await onLike(!review.liked);
    } catch {
      setLikeError('좋아요를 처리하지 못했습니다.');
    } finally {
      setLikePending(false);
    }
  };
  const details = (productActions) => <>
    {review.content && <p className="review-content">{review.content}</p>}
    {review.images.length > 0 && (
      <div className="review-images">
        {review.images.map((src, index) => (
          <img key={`${src}-${index}`} src={src} alt={`리뷰 사진 ${index + 1}`} loading="lazy" />
        ))}
      </div>
    )}
    <div className="review-card-footer">
      <button type="button" className={`review-like-button${review.liked ? ' is-liked' : ''}`} aria-pressed={Boolean(review.liked)} disabled={likePending || review.isMine} onClick={toggleLike}>
        <span aria-hidden="true">{review.liked ? '♥' : '♡'}</span> 좋아요 {(review.likeCount ?? 0).toLocaleString('ko-KR')}
      </button>
      {review.isMine && type === 'store' && (
        <div className="review-card-actions">
          <button type="button" onClick={onEdit}>수정하기</button>
          <button type="button" onClick={onDelete} disabled={deleting}>{deleting ? '삭제 중…' : '삭제하기'}</button>
        </div>
      )}
      {productActions}
    </div>
    {likeError && <p className="review-error" role="alert">{likeError}</p>}
  </>;
  return (
    <article className="review-card">
      <div className="review-card-head">
        <strong>{review.nickname}</strong>
        <time dateTime={review.createdAt}>{dateLabel(review.createdAt)}</time>
      </div>
      {!(type === 'product' && review.isMine && editingProduct) && <div className="review-stars" aria-label={`별점 ${review.rating}점`}>
        <RatingStars value={review.rating} size={18} />
        <span>{review.rating}점</span>
      </div>}
      {type === 'product' && (
        <div className="review-product-snapshot">
          {review.productImage ? <img src={review.productImage} alt="" loading="lazy" /> : <span aria-hidden="true">상품</span>}
          <strong>{review.productName || '상품 정보 없음'}</strong>
        </div>
      )}
      {type === 'store' && review.products?.length > 0 && (
        <p className="review-product">구매 상품 · {review.products.join(', ')}</p>
      )}
      {review.isMine && type === 'product' ? <ProductReviewEditor review={review} storeId={storeId} onChanged={onChanged} onEditingChange={setEditingProduct} storeCardActions>{(actions) => details(actions)}</ProductReviewEditor> : details()}
    </article>
  );
}
