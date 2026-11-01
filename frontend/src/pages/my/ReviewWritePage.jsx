import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createReview } from './account.api.js';
import { uploadReviewImages } from '../../api/reviewImage.api.js';
import Dialog from '../../components/Dialog.jsx';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { ImageIcon } from './icons.jsx';
import { getOrder } from './my.api.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './mytab.css';
import './support.css';

const LABELS = ['별로예요', '아쉬워요', '보통이에요', '좋아요', '최고예요'];
const MAX_PHOTOS = 3;
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
  const detail = useRequest(signedIn, `order:${orderId}`, () => getOrder(orderId));
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const order = detail.data;
  const wanted = params.get('item');
  const item = order
    ? (wanted && order.items.find((it) => it.id === wanted && !it.review_completed))
      || order.items.find((it) => !it.review_completed)
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
      const imageUrls = photos.length
        ? await uploadReviewImages(photos.map((photo) => photo.file))
        : [];
      const created = await createReview({
        orderItemId: item.id,
        rating,
        content: content.trim(),
        ...(imageUrls.length ? { imageUrls } : {}),
      });
      const reward = created?.pointReward;
      const to = `/products/${item.store_product_id}#product-feedback`;
      if (reward?.granted)
        setDone({
          to,
          title: '리뷰 작성 완료!',
          message: `적립금 ${reward.amount.toLocaleString()}원이 적립됐어요.`,
        });
      else if (reward?.reason === 'REWARD_EXPIRED')
        setDone({
          to,
          title: '리뷰가 등록됐어요',
          message: '구매 후 30일이 지나 적립금은 지급되지 않아요.',
        });
      else navigate(to, { replace: true });
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  };

  let body;
  if (detail.error) body = <ErrorNotice error={detail.error} onRetry={detail.reload} />;
  else if (!order) body = <Loading />;
  else if (!item) body = <p className="ord-empty">이 주문의 리뷰 작성을 완료했어요.</p>;
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
      <p className="mt-notice">구매 후 30일 안에 리뷰를 작성하면 적립금 500원을 바로 드려요. (상품당 1회)</p>
      {body}
      <Dialog
        open={Boolean(done)}
        title={done?.title}
        message={done?.message}
        onConfirm={() => navigate(done.to, { replace: true })}
      />
    </main>
  );
}
