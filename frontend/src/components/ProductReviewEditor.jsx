import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteReview, updateReview } from '../pages/my/account.api.js';
import { uploadReviewImages } from '../api/reviewImage.api.js';
import { ImageIcon } from '../pages/my/icons.jsx';
import Dialog from './Dialog.jsx';
import './ProductReviewEditor.css';

export default function ProductReviewEditor({ review, storeId, onChanged, onEditingChange, storeCardActions = false, children }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [content, setContent] = useState(review.content || '');
  const [kept, setKept] = useState(review.images || []);
  const [added, setAdded] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const previews = useRef(new Set());

  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const clearAdded = () => {
    added.forEach((photo) => {
      URL.revokeObjectURL(photo.preview);
      previews.current.delete(photo.preview);
    });
    setAdded([]);
  };

  const refresh = async () => {
    await onChanged?.();
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['store-reviews'] }),
      queryClient.invalidateQueries({ queryKey: ['store'] }),
      queryClient.invalidateQueries({ queryKey: ['stores'] }),
      queryClient.invalidateQueries({ queryKey: ['reviewable-items'] }),
    ]);
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const shopFolder = kept.some((url) => url.includes('/review/shop/'));
      const uploaded = added.length
        ? await uploadReviewImages(added.map((photo) => photo.file), shopFolder ? { storeId } : {})
        : [];
      await updateReview(review.id, { rating, content: content.trim(), imageUrls: [...kept, ...uploaded] });
      setKept([...kept, ...uploaded]);
      clearAdded();
      setEditing(false);
      onEditingChange?.(false);
      await refresh();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setConfirmDelete(false);
    setBusy(true);
    setError('');
    try {
      await deleteReview(review.id);
      await refresh();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => {
    setRating(review.rating);
    setContent(review.content || '');
    setKept(review.images || []);
    clearAdded();
    setError('');
    setEditing(false);
    onEditingChange?.(false);
  };
  const addPhotos = (event) => {
    const files = [...(event.target.files || [])].slice(0, 3 - kept.length - added.length);
    event.target.value = '';
    setAdded((previous) => [...previous, ...files.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { file, preview };
    })]);
  };
  const removeAdded = (photo) => {
    URL.revokeObjectURL(photo.preview);
    previews.current.delete(photo.preview);
    setAdded((previous) => previous.filter((item) => item !== photo));
  };
  const viewActions = <div className={storeCardActions ? 'review-card-actions' : 'product-review-edit__actions'} data-rail-interactive>
    <button type="button" disabled={busy} onClick={() => { setEditing(true); onEditingChange?.(true); }}>{storeCardActions ? '수정하기' : '수정'}</button>
    <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>{storeCardActions ? '삭제하기' : '삭제'}</button>
  </div>;

  return <>
    {editing ? <div className="product-review-edit" data-rail-interactive>
      <div className="product-review-edit__stars" role="radiogroup" aria-label="별점">
        {[1, 2, 3, 4, 5].map((score) => <button key={score} type="button" role="radio" aria-checked={rating === score} aria-label={`${score}점`} className={score <= rating ? 'is-on' : ''} onClick={() => setRating(score)}>★</button>)}
      </div>
      <textarea aria-label="리뷰 내용" maxLength={500} value={content} onChange={(event) => setContent(event.target.value)} />
      <p className="product-review-edit__count">{content.length} / 500 · 10자 이상</p>
      <div className="product-review-edit__photos">
        {kept.map((url) => <span key={url} className="product-review-edit__photo" style={{ backgroundImage: `url(${url})` }}><button type="button" aria-label="사진 삭제" onClick={() => setKept((previous) => previous.filter((item) => item !== url))}>×</button></span>)}
        {added.map((photo) => <span key={photo.preview} className="product-review-edit__photo" style={{ backgroundImage: `url(${photo.preview})` }}><button type="button" aria-label="사진 삭제" onClick={() => removeAdded(photo)}>×</button></span>)}
        {kept.length + added.length < 3 && <label className="product-review-edit__photo product-review-edit__photo--add"><ImageIcon />{kept.length + added.length} / 3<input type="file" accept="image/*" multiple onChange={addPhotos} /></label>}
      </div>
    </div> : typeof children === 'function' ? children(viewActions) : children}
    {error && <p className="product-review-edit__error" role="alert">{error}</p>}
    {editing ? <div className={storeCardActions ? 'review-card-actions product-review-edit__store-actions' : 'product-review-edit__actions'} data-rail-interactive>
        <button type="button" disabled={busy} onClick={cancel}>취소</button>
        <button type="button" className="is-strong" disabled={busy || rating < 1 || content.trim().length < 10} onClick={save}>{storeCardActions ? '저장하기' : '저장'}</button>
      </div> : typeof children === 'function' ? null : viewActions}
    <Dialog open={confirmDelete} title="리뷰를 삭제할까요?" message="삭제해도 이미 받은 적립금은 유지돼요. 다시 쓰면 추가 적립은 없어요." confirmLabel="삭제" cancelLabel="취소" danger onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
  </>;
}
