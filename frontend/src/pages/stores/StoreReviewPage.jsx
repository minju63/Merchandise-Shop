import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storeApi } from '../../api/store.api.js';
import { supabase } from '../../lib/supabase.js';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState('latest');
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const session = useQuery({
    queryKey: ['review-auth-session'],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    enabled: Boolean(supabase),
    staleTime: 0,
  });
  const isMemberSession =
    session.isSuccess &&
    !session.isFetching &&
    Boolean(session.data) &&
    session.data.user?.is_anonymous !== true;
  const eligible = useQuery({
    queryKey: ['reviewable-items', storeId],
    queryFn: () => storeApi.reviewableItems(storeId),
    enabled: isMemberSession,
    refetchOnMount: 'always',
  });
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['store-reviews', storeId, session.data?.user?.id ?? 'guest', mineOnly, sort, page],
    queryFn: () => storeApi.reviews(storeId, { sort, page, size: 20, mineOnly }),
    enabled: !supabase || session.isSuccess || session.isError,
    refetchOnMount: 'always',
  });
  const reviews = data?.data;
  const deleteMutation = useMutation({
    mutationFn: storeApi.deleteStoreReview,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['store-reviews', storeId] }),
        queryClient.invalidateQueries({ queryKey: ['store', storeId] }),
        queryClient.invalidateQueries({ queryKey: ['stores'] }),
        queryClient.invalidateQueries({ queryKey: ['reviewable-items', storeId] }),
      ]);
    },
  });
  return (
    <div className="app-shell">
      <header className="review-header">
        <button
          type="button"
          aria-label="뒤로가기"
          onClick={() => {
            const historyIndex = window.history.state?.idx ?? 0;
            if (
              location.state?.fromStoreDetail &&
              historyIndex > (location.state?.returnedFromWrite ? 1 : 0)
            ) {
              navigate(location.state?.returnedFromWrite ? -2 : -1);
            } else {
              navigate(`/stores/${storeId}`, { replace: true });
            }
          }}
        >
          <Icon name="back" />
        </button>
        <h1>굿즈샵 리뷰</h1>
      </header>
      <main className="store-main review-main">
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
                    <span
                      className="review-stars"
                      aria-label={`평균 별점 ${reviews.rating.toFixed(1)}점`}
                    >
                      {'★'.repeat(Math.round(reviews.rating))}
                      {'☆'.repeat(5 - Math.round(reviews.rating))}
                    </span>
                    <strong>{reviews.rating.toFixed(1)}</strong>
                  </>
                )}
              </div>
              {isMemberSession && eligible.isSuccess && !eligible.isFetching && (
                <Link
                  className="review-write-button"
                  to={`/stores/${storeId}/reviews/write`}
                  state={{
                    fromStoreDetail: Boolean(location.state?.fromStoreDetail),
                    returnToReview: true,
                    review: eligible.data.data.review,
                  }}
                >
                  {eligible.data.data.review ? '리뷰 수정하기' : '리뷰 쓰기'}
                </Link>
              )}
            </section>
            <section className="review-list-section" aria-label="리뷰 목록">
              <div className="section-heading">
                <div className="review-list-title">
                  <strong>
                    {mineOnly
                      ? `내 리뷰 ${reviews.resultCount ?? 0}개`
                      : `전체 리뷰 ${reviews.reviewCount}개`}
                  </strong>
                  {isMemberSession && (
                    <button
                      className={`review-mine-toggle${mineOnly ? ' is-active' : ''}`}
                      type="button"
                      aria-pressed={mineOnly}
                      onClick={() => {
                        setMineOnly((value) => !value);
                        setPage(1);
                      }}
                    >
                      내 리뷰만 보기
                    </button>
                  )}
                </div>
                <div className="review-list-controls">
                  <StoreSort
                    value={sort}
                    options={sorts}
                    onChange={(value) => {
                      setSort(value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              {(reviews.resultCount ?? reviews.reviewCount) === 0 ? (
                mineOnly ? (
                  <PageState>작성한 리뷰가 없습니다.</PageState>
                ) : (
                <PageState>아직 등록된 리뷰가 없습니다.</PageState>
                )
              ) : reviews.items.length === 0 ? (
                <PageState>이 페이지에는 리뷰가 없습니다.</PageState>
              ) : (
                reviews.items.map((review) => (
                  <StoreReviewCard
                    key={review.id}
                    review={{
                      ...review,
                      isMine: review.isMine,
                    }}
                    deleting={deleteMutation.isPending && deleteMutation.variables === review.id}
                    onEdit={() =>
                      navigate(`/stores/${storeId}/reviews/write`, {
                        state: {
                          review,
                          isMine: true,
                          fromStoreDetail: Boolean(location.state?.fromStoreDetail),
                        },
                      })
                    }
                    onDelete={() => {
                      if (deleteMutation.isPending) return;
                      if (window.confirm('이 리뷰를 삭제할까요?'))
                        deleteMutation.mutate(review.id);
                    }}
                  />
                ))
              )}
              {deleteMutation.isError && (
                <p className="review-error" role="alert">{deleteMutation.error.message}</p>
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
