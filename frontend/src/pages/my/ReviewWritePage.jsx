import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { createReview } from './account.api.js';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import { useRequest, useRequireLogin, useSession } from './hooks.js';
import { ImageIcon } from './icons.jsx';
import { getOrder } from './my.api.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './mytab.css';
import './support.css';

const LABELS = ['별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'];
const MAX_PHOTOS = 3;
const BUCKET = 'goods-images';

function Star({ on }) {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 24 24"
      className={on ? 'rv-star is-on' : 'rv-star'}
      aria-hidden="true"
    >
      <path
        d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ReviewWritePage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const { session } = useSession();
  const detail = useRequest(signedIn, `order:${orderId}`, () => getOrder(orderId));
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const order = detail.data;
  const wanted = params.get('item');
  const item = order
    ? (wanted && order.items.find((it) => it.id === wanted)) || order.items[0]
    : null;
  const valid = rating > 0 && content.trim().length >= 10 && !busy;

  const addPhotos = (event) => {
    const files = [...(event.target.files ?? [])].slice(0, MAX_PHOTOS - photos.length);
    event.target.value = '';
    setPhotos((prev) => [
      ...prev,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const userId = session.user.id;
      const imageUrls = [];
      for (const [index, photo] of photos.entries()) {
        const ext = (photo.file.name.split('.').pop() || 'jpg').replace(/[^\w]/g, '').toLowerCase();
        const path = `${userId}/review-${Date.now()}-${index}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, photo.file, { contentType: photo.file.type });
        if (uploadError) throw uploadError;
        imageUrls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      const created = await createReview({
        orderItemId: item.id,
        rating,
        content: content.trim(),
        ...(imageUrls.length ? { imageUrls } : {}),
      });
      if (created?.pointReward?.granted)
        window.alert(`리뷰 작성 완료! 적립금 ${created.pointReward.amount.toLocaleString()}원이 적립됐어요.`);
      navigate(MY_ROUTES.orderDetail(orderId), { replace: true });
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  };

  let body;
  if (detail.error) body = <ErrorNotice error={detail.error} onRetry={detail.reload} />;
  else if (!order) body = <Loading />;
  else if (!item) body = <p className="ord-empty">리뷰를 쓸 상품이 없어요</p>;
  else
    body = (
      <>
        <div className="rv-product">
          <Thumb src={item.product_image_url} size={44} />
          <div>
            <small>{order.store?.name}</small>
            <strong>{item.product_name}</strong>
          </div>
        </div>
        <div className="rv-stars">
          <h2>상품은 어떠셨나요?</h2>
          <div className="rv-stars__row">
            {LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                aria-label={`${index + 1}점`}
                onClick={() => setRating(index + 1)}
              >
                <Star on={index < rating} />
              </button>
            ))}
          </div>
          <span className="rv-stars__label">
            {rating ? LABELS[rating - 1] : '별점을 선택해 주세요'}
          </span>
        </div>
        <label className="rv-label" htmlFor="rv-content">
          리뷰 내용
        </label>
        <textarea
          id="rv-content"
          className="rv-text"
          maxLength={500}
          value={content}
          placeholder="상품 상태, 포장, 픽업·배달 경험을 알려주세요 (10자 이상)"
          onChange={(event) => setContent(event.target.value)}
        />
        <p className="rv-count">{content.length} / 500</p>
        <p className="rv-label">
          사진 <small>최대 {MAX_PHOTOS}장</small>
        </p>
        <div className="rv-photos">
          {photos.map((photo, index) => (
            <span
              key={photo.preview}
              className="rv-photo"
              style={{ backgroundImage: `url(${photo.preview})` }}
            >
              <button
                type="button"
                aria-label="사진 삭제"
                onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </span>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <label className="rv-add">
              <ImageIcon />
              {photos.length} / {MAX_PHOTOS}
              <input type="file" accept="image/*" multiple onChange={addPhotos} />
            </label>
          ) : null}
        </div>
        {error ? (
          <p className="ord-sheet__error" style={{ margin: '-96px 20px 96px' }}>
            {error}
          </p>
        ) : null}
        <footer className="ord-footer">
          <button
            type="button"
            className="ord-btn ord-btn--primary ord-btn--block"
            disabled={!valid}
            onClick={submit}
          >
            등록하기
          </button>
        </footer>
      </>
    );

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="리뷰 쓰기" />
      <p className="mt-notice">리뷰를 작성하면 적립금 500원을 바로 드려요. (상품당 1회)</p>
      {body}
    </main>
  );
}
