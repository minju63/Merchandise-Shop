import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../api/store.api.js';
import { PageState, TabBar } from './components/StoreShell.jsx';
import StoreSort from './components/StoreSort.jsx';
import StoreReviewCard from './components/StoreReviewCard.jsx';
import Icon from './components/Icon.jsx';

const sorts = [
  { value: 'latest', label: '최신순' },
  { value: 'high', label: '별점 높은 순' },
  { value: 'low', label: '별점 낮은 순' },
];

export default function StoreReviewPage() {
  const { storeId } = useParams();
  const location = useLocation();
  const [sort, setSort] = useState('latest');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['store-reviews', storeId, sort, page],
    queryFn: () => storeApi.reviews(storeId, { sort, page, size: 20 }),
    refetchOnMount: 'always',
  });
  const reviews = data?.data;
  return (
    <div className="app-shell">
      <header className="review-header">
        <Link to={`/stores/${storeId}`} aria-label="굿즈샵 상세페이지로">
          <Icon name="back" />
        </Link>
        <h1>굿즈샵 리뷰</h1>
      </header>
      <main className="store-main review-main">
        {location.state?.success && (
          <p className="review-success" role="status">
            {location.state.success}
          </p>
        )}
        {isPending ? (
          <PageState>리뷰를 불러오는 중입니다.</PageState>
        ) : isError ? (
          <PageState onRetry={refetch}>{error.message}</PageState>
        ) : (
          <>
            <section className="review-summary">
              <h2>{reviews.store.name}</h2>
              <div className="review-summary-rating">
                {reviews.rating == null ? (
                  <strong>평점 없음</strong>
                ) : (
                  <>
                    <span className="star">★</span>
                    <strong>{reviews.rating.toFixed(1)}</strong>
                    <span
                      className="review-stars"
                      aria-label={`평균 별점 ${reviews.rating.toFixed(1)}점`}
                    >
                      {'★'.repeat(Math.round(reviews.rating))}
                      {'☆'.repeat(5 - Math.round(reviews.rating))}
                    </span>
                  </>
                )}
              </div>
              <p>리뷰 {reviews.reviewCount}개</p>
              <Link className="review-write-button" to={`/stores/${storeId}/reviews/write`}>
                리뷰 작성
              </Link>
            </section>
            <section className="review-list-section" aria-label="리뷰 목록">
              <div className="section-heading">
                <strong>전체 리뷰 {reviews.reviewCount}개</strong>
                <StoreSort
                  value={sort}
                  options={sorts}
                  onChange={(value) => {
                    setSort(value);
                    setPage(1);
                  }}
                />
              </div>
              {reviews.reviewCount === 0 ? (
                <PageState>아직 등록된 리뷰가 없습니다.</PageState>
              ) : reviews.items.length === 0 ? (
                <PageState>이 페이지에는 리뷰가 없습니다.</PageState>
              ) : (
                reviews.items.map((review) => <StoreReviewCard key={review.id} review={review} />)
              )}
              <div className="pagination">
                {page > 1 && (
                  <button className="secondary-button" onClick={() => setPage(page - 1)}>
                    이전
                  </button>
                )}
                {page < reviews.totalPages && (
                  <button className="secondary-button" onClick={() => setPage(page + 1)}>
                    다음
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      <TabBar />
    </div>
  );
}
