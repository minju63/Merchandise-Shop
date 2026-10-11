import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase.js';
import { storeApi } from '../../api/store.api.js';
import { ImageWithFallback, PageState } from './components/StoreShell.jsx';
import Icon from './components/Icon.jsx';

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ type: file.type, data: String(reader.result).split(',')[1] });
    reader.onerror = () => reject(new Error('이미지를 읽을 수 없습니다. 다시 선택해 주세요.'));
    reader.readAsDataURL(file);
  });
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const [selected, setSelected] = useState('');
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const previews = useRef(new Set());
  const [formError, setFormError] = useState('');
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
    enabled: Boolean(session.data),
    refetchOnMount: 'always',
  });
  const mutation = useMutation({ mutationFn: storeApi.writeReview });

  useEffect(
    () => () => {
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

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    if (!selected) {
      setFormError('구매 상품을 선택해 주세요.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setFormError('별점을 선택해 주세요.');
      return;
    }
    if (content.trim().length > 2000) {
      setFormError('리뷰 내용은 2000자 이내여야 합니다.');
      return;
    }
    submitting.current = true;
    setFormError('');
    try {
      const files = await Promise.all(images.map(({ file }) => readImage(file)));
      await mutation.mutateAsync({
        orderItemId: selected,
        rating,
        content: content.trim(),
        images: files,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['store-reviews', storeId] }),
        queryClient.invalidateQueries({ queryKey: ['store', storeId] }),
        queryClient.invalidateQueries({ queryKey: ['stores'] }),
        queryClient.invalidateQueries({ queryKey: ['reviewable-items', storeId] }),
      ]);
      navigate(`/stores/${storeId}/reviews`, {
        replace: true,
        state: { success: '리뷰가 등록되었습니다.' },
      });
    } catch (error) {
      setFormError(error.message || '리뷰 등록에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="app-shell">
      <header className="review-header">
        <Link to={`/stores/${storeId}/reviews`} aria-label="리뷰 목록으로">
          <Icon name="back" />
        </Link>
        <h1>리뷰 작성</h1>
      </header>
      <main className="store-main review-main">
        {!supabase ? (
          <PageState>
            로그인 설정이 필요합니다. 프론트엔드 Supabase 공개 키를 설정해 주세요.
          </PageState>
        ) : session.isPending ? (
          <PageState>로그인 상태를 확인하는 중입니다.</PageState>
        ) : session.isError ? (
          <PageState onRetry={session.refetch}>로그인 상태를 확인할 수 없습니다.</PageState>
        ) : !session.data ? (
          <PageState>
            로그인 화면으로 이동합니다. <Link to={loginPath}>로그인</Link>
          </PageState>
        ) : eligible.isPending ? (
          <PageState>작성 가능한 구매 내역을 확인하는 중입니다.</PageState>
        ) : eligible.isError ? (
          <PageState onRetry={eligible.refetch}>{eligible.error.message}</PageState>
        ) : (
          <form className="review-form" onSubmit={submit}>
            <h2>{eligible.data.data.store.name}</h2>
            <fieldset className="review-fieldset">
              <legend>구매 상품 선택</legend>
              {eligible.data.data.items.length === 0 ? (
                <p className="review-empty-purchase">리뷰를 작성할 수 있는 구매 내역이 없습니다.</p>
              ) : (
                eligible.data.data.items.map((item) => (
                  <label
                    className={`review-purchase ${selected === item.orderItemId ? 'selected' : ''}`}
                    key={item.orderItemId}
                  >
                    <input
                      type="radio"
                      name="purchase"
                      value={item.orderItemId}
                      checked={selected === item.orderItemId}
                      onChange={() => setSelected(item.orderItemId)}
                    />
                    <ImageWithFallback
                      src={item.productImage}
                      alt={item.productName}
                      className="review-purchase-image"
                    />
                    <span>
                      <strong>{item.productName || '상품명 없음'}</strong>
                      <small>{item.storeName}</small>
                      <small>주문일 {dateLabel(item.orderedAt)}</small>
                      <small>리뷰 작성 가능</small>
                    </span>
                  </label>
                ))
              )}
            </fieldset>
            {eligible.data.data.items.length > 0 && (
              <>
                <fieldset className="review-fieldset">
                  <legend>별점 평가</legend>
                  <div className="review-rating-input">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={value <= rating ? 'selected' : ''}
                        onClick={() => setRating(value)}
                        aria-label={`${value}점`}
                        aria-pressed={rating === value}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="review-fieldset">
                  <label htmlFor="review-content">리뷰 내용</label>
                  <p>구매한 상품과 매장 이용 경험을 알려주세요.</p>
                  <textarea
                    id="review-content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    maxLength={2000}
                    rows={6}
                    placeholder="리뷰를 입력해 주세요."
                  />
                  <small>{content.length}/2000</small>
                </div>
                <div className="review-fieldset">
                  <label htmlFor="review-images">사진 첨부 (선택)</label>
                  <p>PNG, JPG, WebP · 각 5MB 이하 · 최대 5장</p>
                  <input
                    id="review-images"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={addImages}
                  />
                  <div className="review-uploads">
                    {images.map((image, index) => (
                      <div key={image.preview}>
                        <img src={image.preview} alt={`첨부 사진 ${index + 1}`} />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(image.preview);
                            previews.current.delete(image.preview);
                            setImages((current) => current.filter((item) => item !== image));
                          }}
                          aria-label={`첨부 사진 ${index + 1} 삭제`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                {formError && (
                  <p className="review-error" role="alert">
                    {formError}
                  </p>
                )}
                <button
                  className="review-write-button review-submit"
                  type="submit"
                  disabled={mutation.isPending || !selected || !rating}
                >
                  {mutation.isPending ? '등록 중...' : '리뷰 등록'}
                </button>
              </>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
