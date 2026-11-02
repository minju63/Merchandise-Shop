import { useCallback, useRef, useState } from 'react';
import ProductEmptyState from './ProductEmptyState.jsx';
import StoreSort from '../../stores/components/StoreSort.jsx';
import useCategoryRequest from './useCategoryRequest.js';
import * as productApi from '../../../api/product.api.js';
import sharedClient from '../../../api/client.js';
import './ProductReviewSection.css';
import useDraggableRail from '../../../hooks/useDraggableRail.js';

const reviewSortOptions = [
  { value: 'latest', label: '최신순' },
  { value: 'high', label: '별점 높은 순' },
  { value: 'low', label: '별점 낮은 순' },
  { value: 'likes', label: '좋아요 많은 순' },
];

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function ReviewPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);
  return !failed && src ? <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} /> : null;
}

function AverageStars({ averageRating }) {
  if (averageRating == null) return null;
  return <div className="pr-average-stars" role="img" aria-label={`평균 별점 ${averageRating.toFixed(1)}점`}>
    {Array.from({ length: 5 }, (_, index) => <span key={index}>{index < Math.round(averageRating) ? '★' : '☆'}</span>)}
  </div>;
}

function ReviewItem({ review, api, client, user, onLogin, onLikeChanged }) {
  const aiPhoto = review.images?.some((url) => url.includes('/reviews/ai-samples-v1/'));
  const [liked, setLiked] = useState(Boolean(review.liked));
  const [likeCount, setLikeCount] = useState(review.likeCount ?? 0);
  const [likePending, setLikePending] = useState(false);
  const [likeError, setLikeError] = useState('');
  const toggleLike = async () => {
    if (!user || user.is_anonymous === true) {
      onLogin?.();
      return;
    }
    if (likePending || review.isMine) return;
    setLikePending(true);
    setLikeError('');
    try {
      const result = await api.toggleProductReviewLike(review.id, !liked, client);
      setLiked(Boolean(result.liked));
      setLikeCount(result.likeCount ?? likeCount + (liked ? -1 : 1));
      onLikeChanged?.();
    } catch {
      setLikeError('\uC88B\uC544\uC694\uB97C \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.');
    } finally {
      setLikePending(false);
    }
  };
  return <article className="pr-full-review">
    <header><strong>{review.nickname}</strong><time dateTime={review.createdAt}>{dateLabel(review.createdAt)}</time></header>
    <div className="pr-stars" aria-label={`별점 ${review.rating}점`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
    <p>{review.content || '등록된 리뷰 내용이 없습니다.'}</p>
    {review.images?.length > 0 && <div className="pr-review-photos">{review.images.map((url, i) => <ReviewPhoto key={url} src={url} alt={`${aiPhoto ? 'AI로 제작한 샘플' : '리뷰'} 사진 ${i + 1}`} />)}</div>}
    {aiPhoto && <small className="pr-ai-disclosure">AI로 제작한 샘플 사진입니다. 실제 구매자의 촬영 사진이 아닙니다.</small>}
    <button type="button" className={`pr-like-button${liked ? ' is-liked' : ''}`} aria-pressed={liked} disabled={likePending || review.isMine} onClick={toggleLike}>
      <span aria-hidden="true">{'\u2665'}</span> {'\uC88B\uC544\uC694'} {likeCount.toLocaleString('ko-KR')}
    </button>
    {likeError && <p className="pr-like-error" role="alert">{likeError}</p>}
  </article>;
}

function AllReviews({ storeProductId, api, client, satisfaction, averageRating, totalCount, user, onLogin }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('latest');
  const load = useCallback((signal) => api.getProductReviews(storeProductId, { signal, page, sort, size: 20 }, client), [api, client, storeProductId, page, sort]);
  const request = useCategoryRequest(load);
  return <section className="pr-all-reviews" aria-labelledby="pr-all-reviews-title">
    <header className="pr-all-reviews-header">
      <div className="pr-all-reviews-title-group">
        <h3 id="pr-all-reviews-title">전체 리뷰 <span>{(request.data?.totalCount ?? totalCount).toLocaleString('ko-KR')}</span></h3>
        {satisfaction !== null && <AverageStars averageRating={averageRating} />}
        <div className="pr-all-reviews-summary-row">
          <p className="pr-satisfaction">{satisfaction !== null ? <><strong>{satisfaction}%</strong>가 만족한 상품이에요</> : totalCount ? '구매자들의 솔직한 후기를 확인해 보세요' : '첫 번째 리뷰를 기다리고 있어요'}</p>
          <div className="pr-all-reviews-toolbar"><StoreSort value={sort} options={reviewSortOptions} onChange={(value) => { setSort(value); setPage(1); }} label="리뷰 정렬 기준" /></div>
        </div>
      </div>
    </header>
    <div className="pr-all-reviews-content">
      {request.loading ? <p role="status">리뷰를 불러오는 중입니다.</p> : request.error ? <ProductEmptyState message="리뷰를 불러오지 못했습니다." onRetry={request.retry} /> : !request.data?.items.length ? <p>아직 작성된 리뷰가 없습니다.</p> : request.data.items.map((review) => <ReviewItem key={review.id} review={review} api={api} client={client} user={user} onLogin={onLogin} onLikeChanged={request.retry} />)}
    </div>
    <nav className="pr-pagination" aria-label="리뷰 페이지"><button type="button" disabled={request.loading || page <= 1} onClick={() => setPage(page - 1)}>이전</button><span>{page} / {Math.max(1, request.data?.totalPages || Math.ceil((request.data?.totalCount || 0) / 20))}</span><button type="button" disabled={request.loading || !request.data || page * 20 >= request.data.totalCount} onClick={() => setPage(page + 1)}>다음</button></nav>
  </section>;
}

export default function ProductReviewSection({ reviews, loading, error, onRetry, storeProductId, user, onLogin, api = productApi, client = sharedClient }) {
  const [showAll, setShowAll] = useState(false);
  const rail = useRef(null);
  const dragScroll = useDraggableRail();
  if (loading) return <p className="category-review-status" role="status">리뷰를 불러오는 중입니다.</p>;
  if (error)
    return <ProductEmptyState message="리뷰를 불러오지 못했습니다." onRetry={onRetry} />;
  const items = reviews?.items || [];
  const totalCount = reviews?.totalCount || 0;
  const summary = reviews?.summary;
  // Older API processes may omit summary; do not imply a page sample is the whole product.
  const satisfaction = summary?.satisfactionPercent ?? (totalCount > 0 && items.length === totalCount
    ? Math.round(items.filter((r) => r.rating >= 4).length / items.length * 100) : null);
  const averageRating = summary?.averageRating ?? (totalCount > 0 && items.length === totalCount
    ? Number((items.reduce((sum, review) => sum + Number(review.rating || 0), 0) / items.length).toFixed(1)) : null);
  return (
    <div className={`pr-section${showAll ? ' pr-section--all-reviews' : ''}`}>
      {!showAll && <>
      <div className="pr-heading"><h2>리뷰 <span>{totalCount.toLocaleString('ko-KR')}</span></h2>{totalCount > 0 && <button type="button" className="pr-view-all" onClick={() => setShowAll(true)}>전체보기 <span aria-hidden="true">›</span></button>}</div>
      {satisfaction !== null ? <><AverageStars averageRating={averageRating} /><p className="pr-satisfaction"><strong>{satisfaction}%</strong>가 만족한 상품이에요</p></> : <p className="pr-satisfaction">{totalCount ? '구매자들의 솔직한 후기를 확인해 보세요' : '첫 번째 리뷰를 기다리고 있어요'}</p>}
      </>}
      {showAll ? <AllReviews storeProductId={storeProductId} api={api} client={client} satisfaction={satisfaction} averageRating={averageRating} totalCount={totalCount} user={user} onLogin={onLogin} /> : items.length > 0 ? <>
        <div className="pr-preview-rail" ref={rail} {...dragScroll} tabIndex={0} role="region" aria-label="잡아 끌어 상품 리뷰 넘기기">
          {items.slice(0, 8).map((review) => <button type="button" className="pr-preview-card" key={review.id} onClick={() => setShowAll(true)} aria-label={`${review.nickname}님의 리뷰 전체보기`}>
            {review.images?.[0] && <div className="pr-preview-photo"><ReviewPhoto src={review.images[0]} alt={review.images[0].includes('/reviews/ai-samples-v1/') ? 'AI로 제작한 샘플 리뷰 사진' : '구매자 리뷰 사진'} />{review.images[0].includes('/reviews/ai-samples-v1/') && <span className="pr-ai-badge">AI 샘플</span>}</div>}
            <div className="pr-preview-content"><div className="pr-preview-title"><strong>{review.rating >= 4 ? '만족해요' : review.rating === 3 ? '괜찮아요' : '아쉬워요'}</strong><span className="pr-preview-rating">★ {review.rating}</span></div><p>{review.content || '내용 없이 별점을 남긴 리뷰예요.'}</p><small>{review.nickname}</small></div>
          </button>)}
        </div>
        {items.length > 1 && <div className="pr-rail-controls"><button type="button" aria-label="이전 리뷰 카드" onClick={() => rail.current.scrollBy({ left: -rail.current.clientWidth * .88, behavior: 'smooth' })}>‹</button><button type="button" aria-label="다음 리뷰 카드" onClick={() => rail.current.scrollBy({ left: rail.current.clientWidth * .88, behavior: 'smooth' })}>›</button></div>}
      </> : <p className="pr-empty">아직 작성된 상품 리뷰가 없습니다.</p>}
    </div>
  );
}
