import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteReview, getMyPoints, listMyReviews, updateReview } from './account.api.js';
import { uploadReviewImages } from '../../api/reviewImage.api.js';
import { daysLeft, formatFullDate } from './accountFormat.js';
import Dialog from '../../components/Dialog.jsx';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { ImageIcon } from './icons.jsx';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './mytab.css';
import './myreviews.css';

const MAX_PHOTOS = 3;

const TABS = [
  ['WRITABLE', '작성 가능'],
  ['WRITTEN', '작성한 리뷰'],
];

function Stars({ value }) {
  return (
    <span className="mr-stars" role="img" aria-label={`별점 ${value}점`}>
      {'★'.repeat(value)}
      <span className="mr-stars__off">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

// 적립 마감까지 남은 일수에 맞는 안내 문구와 상태
function rewardNotice(deadline) {
  const left = daysLeft(deadline);
  if (left < 0) return { text: '적립 기간이 끝났어요', expired: true };
  return { text: left === 0 ? '오늘 적립 종료' : `포인트 적립 종료 D-${left}`, expired: false };
}

function WritableCard({ item, reward, onWrite }) {
  const notice = rewardNotice(item.reward_deadline);
  return (
    <article className="mr-card">
      <div className="mr-card__product">
        <Thumb src={item.product_image_url} size={64} />
        <div className="mr-card__text">
          <strong>{item.product_name}</strong>
          <span>{formatFullDate(item.created_at)} 구매</span>
        </div>
      </div>
      <p className={notice.expired ? 'mr-dday is-expired' : 'mr-dday'}>
        {notice.expired ? notice.text : `${notice.text} · ${formatWon(reward)} 적립`}
      </p>
      <button type="button" className="mr-btn" onClick={onWrite}>
        리뷰 남기기
      </button>
    </article>
  );
}

function WrittenCard({ review, onOpenProduct, onChanged }) {
  const photos = review.images ?? [];
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [content, setContent] = useState(review.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 기존 사진은 주소(url)로, 새로 고른 사진은 파일로 들고 있다가 저장할 때 합친다.
  const [kept, setKept] = useState(photos.map((photo) => photo.image_url));
  const [added, setAdded] = useState([]);
  const valid = rating > 0 && content.trim().length >= 10 && !busy;

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      // 굿즈샵 폴더에 올린 사진이 있던 리뷰는 같은 폴더에 새 사진을 올린다.
      const shopFolder = kept.some((url) => url.includes('/review/shop/'));
      const uploaded = added.length
        ? await uploadReviewImages(
            added.map((photo) => photo.file),
            shopFolder ? { storeId: review.store_id } : {}
          )
        : [];
      await updateReview(review.id, {
        rating,
        content: content.trim(),
        imageUrls: [...kept, ...uploaded],
      });
    });
  const remove = () => {
    setConfirmDelete(false);
    run(() => deleteReview(review.id));
  };
  const addPhotos = (event) => {
    const files = [...(event.target.files ?? [])].slice(0, MAX_PHOTOS - kept.length - added.length);
    event.target.value = '';
    setAdded((prev) => [...prev, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };
  const cancel = () => {
    setRating(review.rating);
    setContent(review.content);
    setKept(photos.map((photo) => photo.image_url));
    setAdded([]);
    setError('');
    setEditing(false);
  };

  return (
    <article className="mr-card">
      <button
        type="button"
        className="mr-card__product mr-card__product--link"
        disabled={!review.store_product_id}
        onClick={onOpenProduct}
      >
        <Thumb src={review.product_image_url} size={48} />
        <div className="mr-card__text">
          <strong>{review.product_name ?? '상품 정보 없음'}</strong>
          <span>{formatFullDate(review.created_at)} 작성</span>
        </div>
      </button>
      {editing ? (
        <>
          <div className="mr-edit-stars" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                role="radio"
                aria-checked={rating === score}
                aria-label={`${score}점`}
                className={score <= rating ? 'is-on' : ''}
                onClick={() => setRating(score)}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className="mt-textarea"
            maxLength={500}
            value={content}
            aria-label="리뷰 내용"
            onChange={(event) => setContent(event.target.value)}
          />
          <p className="mr-count">{content.length} / 500 · 10자 이상</p>
          <div className="mr-photos">
            {kept.map((url) => (
              <span key={url} className="mr-photo" style={{ backgroundImage: `url(${url})` }}>
                <button
                  type="button"
                  aria-label="사진 삭제"
                  onClick={() => setKept((prev) => prev.filter((item) => item !== url))}
                >
                  ×
                </button>
              </span>
            ))}
            {added.map((photo, index) => (
              <span
                key={photo.preview}
                className="mr-photo"
                style={{ backgroundImage: `url(${photo.preview})` }}
              >
                <button
                  type="button"
                  aria-label="사진 삭제"
                  onClick={() => setAdded((prev) => prev.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </span>
            ))}
            {kept.length + added.length < MAX_PHOTOS ? (
              <label className="mr-photo mr-photo--add">
                <ImageIcon />
                {kept.length + added.length} / {MAX_PHOTOS}
                <input type="file" accept="image/*" multiple onChange={addPhotos} />
              </label>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Stars value={review.rating} />
          <p className="mr-card__content">{review.content}</p>
          {photos.length ? (
            <div className="mr-photos">
              {photos.map((photo) => (
                <img key={photo.id ?? photo.image_url} src={photo.image_url} alt="" />
              ))}
            </div>
          ) : null}
        </>
      )}
      {review.is_hidden ? <p className="mr-hidden">운영 정책에 따라 비공개 처리된 리뷰예요.</p> : null}
      {error ? <p className="mt-error">{error}</p> : null}
      <div className="mr-actions">
        {editing ? (
          <>
            <button type="button" className="mr-link" disabled={busy} onClick={cancel}>
              취소
            </button>
            <button type="button" className="mr-link is-strong" disabled={!valid} onClick={save}>
              저장
            </button>
          </>
        ) : (
          <>
            {review.is_hidden ? null : (
              <button type="button" className="mr-link" disabled={busy} onClick={() => setEditing(true)}>
                수정
              </button>
            )}
            <button type="button" className="mr-link" disabled={busy} onClick={() => setConfirmDelete(true)}>
              삭제
            </button>
          </>
        )}
      </div>
      <Dialog
        open={confirmDelete}
        title="리뷰를 삭제할까요?"
        message="삭제해도 이미 받은 적립금은 유지돼요. 다시 쓰면 추가 적립은 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}

export default function MyReviewsPage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const [tab, setTab] = useState('WRITABLE');
  const writable = useRequest(signedIn, 'my-reviews:writable', () => listMyReviews('WRITABLE'));
  const written = useRequest(signedIn, 'my-reviews:written', () => listMyReviews('WRITTEN'));
  const points = useRequest(signedIn, 'my-reviews:points', getMyPoints);

  // 삭제하면 같은 상품이 '작성 가능'에 다시 나타나므로 두 목록을 함께 새로고침한다.
  const refreshAll = () => {
    writable.reload();
    written.reload();
  };

  const reward = points.data?.policy?.reviewReward ?? 500;
  const rewardDays = points.data?.policy?.reviewRewardDays ?? 30;
  const writableCount = writable.data?.totalCount ?? 0;
  const rewardable = (writable.data?.items ?? []).filter(
    (item) => daysLeft(item.reward_deadline) >= 0,
  ).length;
  const writtenCount = written.data?.totalCount ?? 0;
  const counts = { WRITABLE: writableCount, WRITTEN: writtenCount };
  const current = tab === 'WRITABLE' ? writable : written;

  let list;
  if (current.error) list = <ErrorNotice error={current.error} onRetry={current.reload} />;
  else if (!current.data) list = <Loading />;
  else if (current.data.items.length === 0)
    list = (
      <p className="ord-empty">
        {tab === 'WRITABLE' ? '지금 쓸 수 있는 리뷰가 없어요' : '아직 작성한 리뷰가 없어요'}
      </p>
    );
  else if (tab === 'WRITABLE')
    list = current.data.items.map((item) => (
      <WritableCard
        key={item.id}
        item={item}
        reward={reward}
        onWrite={() => navigate(`${MY_ROUTES.reviewWrite(item.order_id)}?item=${item.id}`)}
      />
    ));
  else
    list = current.data.items.map((review) => (
      <WrittenCard
        key={review.id}
        review={review}
        onOpenProduct={() => navigate(MY_ROUTES.product(review.store_product_id))}
        onChanged={refreshAll}
      />
    ));

  return (
    <main className="ord-page">
      <PageHeader title="리뷰" />
      <section className="mr-summary">
        <div>
          <strong>{writtenCount}개</strong>
          <span>작성한 리뷰</span>
        </div>
        <div>
          <strong>{writableCount}개</strong>
          <span>작성 가능</span>
        </div>
      </section>
      {rewardable > 0 ? (
        <p className="mt-notice">
          구매 후 {rewardDays}일 안에 리뷰를 쓰면 적립금{' '}
          <strong className="mr-accent">최대 {formatWon(rewardable * reward)}</strong>을 받을 수 있어요.
          (상품당 {formatWon(reward)})
        </p>
      ) : null}
      <div className="ord-tabs mr-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'ord-tab is-active' : 'ord-tab'}
            onClick={() => setTab(key)}
          >
            {label} {counts[key]}
          </button>
        ))}
      </div>
      <div className="mr-list">{list}</div>
    </main>
  );
}
