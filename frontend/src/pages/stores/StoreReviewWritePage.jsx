import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase.js';
import { storeApi } from '../../api/store.api.js';
import { ImageWithFallback, PageState } from './components/StoreShell.jsx';
import Icon from './components/Icon.jsx';
import { ImageIcon } from '../my/icons.jsx';
import '../my/orders.css';
import '../my/support.css';

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const REVIEW_IMAGE_BUCKET = 'review';
const REVIEW_IMAGE_FOLDER = 'shop';
const RATING_LABELS = ['별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'];

function RatingStar({ selected }) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      className={selected ? 'rv-star is-on' : 'rv-star'}
      aria-hidden="true"
    >
      <path
        d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z"
        fill={selected ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

export default function StoreReviewWritePage() {
  const { storeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initializedReviewId, setInitializedReviewId] = useState(null);
  const submitting = useRef(false);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [showAllPurchases, setShowAllPurchases] = useState(false);
  const [draggingPreview, setDraggingPreview] = useState(null);
  const photoPress = useRef(null);
  const didDragPhoto = useRef(false);
  const photoDragTimer = useRef(null);
  const lastDropTarget = useRef(null);
  const previews = useRef(new Set());
  const [formError, setFormError] = useState('');
  const [contentError, setContentError] = useState('');
  const loginPath = `/login?returnTo=${encodeURIComponent(`/stores/${storeId}/reviews/write`)}`;
  const session = useQuery({
    queryKey: ['review-auth-session'],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    enabled: Boolean(supabase),
    staleTime: 0,
  });
  useEffect(() => {
    if (session.isSuccess && !session.data) navigate(loginPath, { replace: true });
  }, [session.isSuccess, session.data, navigate, loginPath]);
  const eligible = useQuery({
    queryKey: ['reviewable-items', storeId],
    queryFn: () => storeApi.reviewableItems(storeId),
    enabled: Boolean(session.data) && session.data.user?.is_anonymous !== true,
    refetchOnMount: 'always',
  });
  const editingReview = eligible.data?.data?.review;
  const isEditing = Boolean(editingReview?.id);
  if (editingReview?.id && initializedReviewId !== editingReview.id) {
    setInitializedReviewId(editingReview.id);
    setRating(editingReview.rating);
    setContent(editingReview.content || '');
    setImages((editingReview.images || []).map((url) => ({ file: null, preview: url })));
  }
  const purchasedItems = eligible.data?.data.items ?? [];
  const displayedPurchasedItems = [...purchasedItems].sort(
    (a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()
  );
  const mutation = useMutation({
    mutationFn: (body) =>
      isEditing
        ? storeApi.updateStoreReview(editingReview.id, body)
        : storeApi.writeStoreReview(storeId, body),
  });

  useEffect(
    () => () => {
      if (photoDragTimer.current) window.clearTimeout(photoDragTimer.current);
      for (const preview of previews.current) URL.revokeObjectURL(preview);
    },
    []
  );

  function addImages(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (images.length + files.length > MAX_IMAGES) {
      setFormError('이미지는 최대 5장까지 첨부할 수 있습니다.');
      return;
    }
    if (
      files.some(
        (file) =>
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
          file.size > MAX_IMAGE_BYTES
      )
    ) {
      setFormError('PNG, JPG, WebP 이미지(각 5MB 이하)만 첨부할 수 있습니다.');
      return;
    }
    setFormError('');
    setImages((current) => [
      ...current,
      ...files.map((file) => {
        const preview = URL.createObjectURL(file);
        previews.current.add(preview);
        return { file, preview };
      }),
    ]);
  }

  function startPhotoDrag(event, preview) {
    if (event.target.closest('button') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    photoPress.current = {
      preview,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    photoDragTimer.current = window.setTimeout(() => {
      if (photoPress.current?.preview !== preview) return;
      setDraggingPreview(preview);
      didDragPhoto.current = true;
      lastDropTarget.current = preview;
    }, 100);
  }

  function movePhotoDrag(event) {
    const pendingPress = photoPress.current;
    if (!draggingPreview && pendingPress) {
      if (Math.hypot(event.clientX - pendingPress.startX, event.clientY - pendingPress.startY) > 8) {
        if (photoDragTimer.current) window.clearTimeout(photoDragTimer.current);
        photoDragTimer.current = null;
        photoPress.current = null;
      }
      return;
    }

    const draggedPreview = draggingPreview;
    if (!draggedPreview) return;

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-review-photo]')
      ?.getAttribute('data-review-photo');
    if (!target || target === lastDropTarget.current) return;

    lastDropTarget.current = target;
    setImages((current) => {
      const fromIndex = current.findIndex((image) => image.preview === draggedPreview);
      const toIndex = current.findIndex((image) => image.preview === target);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function endPhotoDrag(event) {
    const pressedPreview = photoPress.current?.preview;
    const wasDragging = didDragPhoto.current;
    if (photoDragTimer.current) window.clearTimeout(photoDragTimer.current);
    photoDragTimer.current = null;
    photoPress.current = null;
    lastDropTarget.current = null;
    didDragPhoto.current = false;
    setDraggingPreview(null);
    if (!wasDragging && pressedPreview && !event.target.closest('button')) {
      setEnlargedImage(pressedPreview);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  useEffect(() => {
    if (!enlargedImage) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setEnlargedImage(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [enlargedImage]);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    if (!isEditing && !purchasedItems.length) {
      setFormError('리뷰를 작성할 수 있는 구매 내역이 없습니다.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setFormError('별점을 선택해 주세요.');
      return;
    }
    if (content.trim().length < 10) {
      setContentError('리뷰 내용은 10자 이상 입력해 주세요.');
      return;
    }
    if (content.length > 500) {
      setFormError('리뷰 내용은 500자 이내로 입력해 주세요.');
      return;
    }
    setContentError('');
    submitting.current = true;
    setFormError('');
    try {
      const userId = session.data?.user?.id;
      const imageUrls = [];
      for (const [index, { file }] of images.entries()) {
        if (!file) {
          imageUrls.push(images[index].preview);
          continue;
        }
        const ext = (file.name.split('.').pop() || 'jpg').replace(/[^\w]/g, '').toLowerCase();
        const path = `${REVIEW_IMAGE_FOLDER}/${storeId}/${userId}/review-${Date.now()}-${index}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(REVIEW_IMAGE_BUCKET)
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        imageUrls.push(
          supabase.storage.from(REVIEW_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
        );
      }
      await mutation.mutateAsync({
        storeId,
        rating,
        content: content.trim(),
        imageUrls,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['store-reviews', storeId] }),
        queryClient.invalidateQueries({ queryKey: ['store', storeId] }),
        queryClient.invalidateQueries({ queryKey: ['stores'] }),
        queryClient.invalidateQueries({ queryKey: ['reviewable-items', storeId] }),
      ]);
      navigate(`/stores/${storeId}/reviews`, {
        replace: true,
        state: {
          returnedFromWrite: true,
          fromStoreDetail: Boolean(location.state?.fromStoreDetail),
        },
      });
    } catch (error) {
      setFormError(error.message || (isEditing ? '리뷰 수정에 실패했습니다.' : '리뷰 등록에 실패했습니다. 다시 시도해 주세요.'));
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="app-shell">
      <header className="review-header">
        <button
          type="button"
          aria-label="뒤로가기"
          onClick={() => {
            if (location.state?.returnToReview && (window.history.state?.idx ?? 0) > 0) {
              navigate(-1);
            } else {
              navigate(`/stores/${storeId}/reviews`, {
                replace: true,
                state: { fromStoreDetail: Boolean(location.state?.fromStoreDetail) },
              });
            }
          }}
        >
          <Icon name="back" />
        </button>
        <h1>{isEditing ? '리뷰 수정' : '리뷰 작성'}</h1>
      </header>
      <main className="store-main review-main goods-review-main">
        {!supabase ? (
          <PageState>
            로그인 설정이 필요합니다. 프론트엔드 Supabase 공개 키를 설정해 주세요.
          </PageState>
        ) : session.isPending ? (
          <PageState>로그인 상태를 확인하는 중입니다.</PageState>
        ) : session.isError ? (
          <PageState onRetry={session.refetch}>로그인 상태를 확인할 수 없습니다.</PageState>
        ) : !session.data || session.data.user?.is_anonymous === true ? (
          <PageState>
            로그인 화면으로 이동합니다. <Link to={loginPath}>로그인</Link>
          </PageState>
        ) : eligible.isPending ? (
          <PageState>작성 가능한 구매 내역을 확인하는 중입니다.</PageState>
        ) : eligible.isError ? (
          <PageState onRetry={eligible.refetch}>{eligible.error.message}</PageState>
        ) : (
          <form className="review-form goods-review-form" onSubmit={submit}>
            <section className="goods-review-purchases" aria-labelledby="purchased-products-title">
              <h2 id="purchased-products-title">
                {eligible.data.data.store.name}에서 구매한 상품
              </h2>
              {eligible.data.data.items.length === 0 ? (
                <p className="review-empty-purchase">리뷰를 작성할 수 있는 구매 내역이 없습니다.</p>
              ) : (
                <>
                  <div className="goods-review-items" id="purchased-products-list">
                    {displayedPurchasedItems
                      .slice(0, showAllPurchases ? displayedPurchasedItems.length : Math.min(3, displayedPurchasedItems.length))
                      .map((item, index) => (
                        <div
                          className={`rv-product goods-review-item ${!showAllPurchases && index === 2 ? 'goods-review-item--peek' : ''}`}
                          key={item.productId}
                        >
                          <ImageWithFallback
                            src={item.productImage}
                            alt={item.productName}
                            className="review-purchase-image"
                          />
                          <span>
                            <small>{item.storeName}</small>
                            <strong>{item.productName || '상품명 없음'}</strong>
                            <small>주문일 {dateLabel(item.orderedAt)}</small>
                            {!item.eligible && <small>구매 취소 또는 환불로 새 선택 불가</small>}
                          </span>
                        </div>
                      ))}
                  </div>
                  {eligible.data.data.items.length > 2 && (
                    <button
                      className={`goods-review-toggle${showAllPurchases ? ' is-expanded' : ' goods-review-toggle--peek'}`}
                      type="button"
                      aria-expanded={showAllPurchases}
                      aria-controls="purchased-products-list"
                      onClick={() => setShowAllPurchases((shown) => !shown)}
                    >
                      {showAllPurchases ? '접기' : '더보기'}
                      <Icon name="chevron" size={13} />
                    </button>
                  )}
                </>
              )}
            </section>
            {(isEditing || eligible.data.data.items.length > 0) && (
              <>
                <section className="rv-stars" aria-labelledby="goods-review-rating-title">
                  <h2 id="goods-review-rating-title">굿즈샵 이용은 어떠셨나요?</h2>
                  <div className="rv-stars__row">
                    {RATING_LABELS.map((label, index) => {
                      const value = index + 1;
                      return (
                        <button
                          type="button"
                          key={label}
                          aria-label={`${value}점`}
                          aria-pressed={rating === value}
                          onClick={() => setRating(value)}
                        >
                          <RatingStar selected={value <= rating} />
                        </button>
                      );
                    })}
                  </div>
                  <span className="rv-stars__label">
                    {rating ? RATING_LABELS[rating - 1] : '별점을 선택해 주세요'}
                  </span>
                </section>
                <div className="goods-review-content">
                  <label className="rv-label" htmlFor="review-content">
                    리뷰 내용
                  </label>
                  <textarea
                    id="review-content"
                    className="rv-text"
                    value={content}
                    onChange={(event) => {
                      const nextContent = event.target.value;
                      setContent(nextContent);
                      if (nextContent.trim().length >= 10) setContentError('');
                    }}
                    maxLength={500}
                    placeholder="구매한 상품과 매장 이용 경험을 알려주세요."
                  />
                  {contentError && (
                    <p className="review-error goods-review-content-error" role="alert">
                      {contentError}
                    </p>
                  )}
                  <p className="rv-count">{content.length} / 500</p>
                </div>
                <section className="goods-review-photos" aria-labelledby="review-images-label">
                  <p className="rv-label" id="review-images-label">
                    사진 <small>최대 {MAX_IMAGES}장</small>
                  </p>
                  <div className="rv-photos">
                    {images.map((image, index) => (
                      <span
                        key={image.preview}
                        className={`rv-photo ${draggingPreview === image.preview ? 'is-dragging' : ''}`}
                        data-review-photo={image.preview}
                        style={{ backgroundImage: `url(${image.preview})` }}
                        onPointerDown={(event) => startPhotoDrag(event, image.preview)}
                        onPointerMove={movePhotoDrag}
                        onPointerUp={endPhotoDrag}
                        onPointerCancel={endPhotoDrag}
                        role="button"
                        tabIndex={0}
                        aria-label={`첨부 사진 ${index + 1} 크게 보기`}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setEnlargedImage(image.preview);
                          }
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (image.file) {
                              URL.revokeObjectURL(image.preview);
                              previews.current.delete(image.preview);
                            }
                            setImages((current) => current.filter((item) => item !== image));
                          }}
                          aria-label={`첨부 사진 ${index + 1} 삭제`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {images.length < MAX_IMAGES && (
                      <label className="rv-add">
                        <ImageIcon />
                        {images.length} / {MAX_IMAGES}
                        <input
                          id="review-images"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          onChange={addImages}
                        />
                      </label>
                    )}
                  </div>
                  <p className="goods-review-photo-guide">PNG, JPG, WebP · 각 5MB 이하 · 사진을 꾹 눌러 순서 변경</p>
                </section>
                {enlargedImage && (
                  <div
                    className="goods-review-image-viewer"
                    role="dialog"
                    aria-modal="true"
                    aria-label="첨부 사진 크게 보기"
                    onClick={() => setEnlargedImage(null)}
                  >
                    <button
                      type="button"
                      className="goods-review-image-viewer__close"
                      aria-label="사진 확대 닫기"
                      onClick={() => setEnlargedImage(null)}
                    >
                      ×
                    </button>
                    <img src={enlargedImage} alt="첨부 사진 크게 보기" onClick={(event) => event.stopPropagation()} />
                  </div>
                )}
                {formError && (
                  <p className="review-error" role="alert">
                    {formError}
                  </p>
                )}
                <footer className="ord-footer">
                  <button
                    className="ord-btn ord-btn--primary ord-btn--block"
                    type="submit"
                    disabled={mutation.isPending || (!isEditing && !purchasedItems.length) || !rating}
                  >
                    {mutation.isPending
                      ? isEditing ? '수정 중...' : '등록 중...'
                      : isEditing ? '수정 완료' : '등록하기'}
                  </button>
                </footer>
              </>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
