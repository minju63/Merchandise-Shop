import { useCallback, useId, useState } from 'react';
import * as inquiryApi from '../../../api/productInquiry.api';
import useCategoryRequest from './useCategoryRequest';
import ProductEmptyState from './ProductEmptyState';
import InquiryForm from './InquiryForm';
import ProductImageGallery from './ProductImageGallery';
import { useDialog } from '../../../components/useDialog.jsx';
import './ProductInquirySection.css';

// 시연용 데이터 앞에 붙은 [샘플], [샘플 문의], [샘플 답변] 표시는 화면에 보이지 않게 한다.
const stripSample = (text) => (text ?? '').replace(/\[샘플[^\]]*\]\s*/g, '');

const STATUS_LABEL = { PENDING: '답변 대기', ANSWERED: '답변 완료', CLOSED: '종료' };

// 내 문의를 고치는 폼
function EditForm({ inquiry, onSave, onCancel }) {
  const [title, setTitle] = useState(stripSample(inquiry.title));
  const [content, setContent] = useState(stripSample(inquiry.content));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const valid = title.trim() && content.trim() && Array.from(title.trim()).length <= 100;
  async function submit(event) {
    event.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setError('');
    try {
      await onSave({ title: title.trim(), content: content.trim() });
    } catch (cause) {
      setError(cause.message || '문의를 수정하지 못했어요.');
      setPending(false);
    }
  }
  return (
    <form className="pi-edit" onSubmit={submit}>
      <input type="text" maxLength={100} value={title} aria-label="문의 제목" disabled={pending} onChange={(event) => setTitle(event.target.value)} />
      <textarea rows={4} value={content} aria-label="문의 내용" disabled={pending} onChange={(event) => setContent(event.target.value)} />
      {error ? <p className="pi-edit__error" role="alert">{error}</p> : null}
      <div className="pi-edit__actions">
        <button type="button" onClick={onCancel} disabled={pending}>취소</button>
        <button type="submit" className="is-primary" disabled={!valid || pending}>{pending ? '저장 중…' : '저장'}</button>
      </div>
    </form>
  );
}

// 세로로 쌓은 접이식 목록. 질문을 누르면 내용과 매장 답변이 펼쳐진다. onEdit·onDelete 가 있으면 내 문의로 보고 수정·삭제를 붙인다.
export function InquiryList({ items, label, showStatus = true, storeInquiry = false, renderActions, onEdit, onDelete }) {
  const [openId, setOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  return <ul className="pi-list" aria-label={label}>
    {items.map((inquiry) => {
      const open = openId === inquiry.id;
      return <li className="pi-item" key={inquiry.id}>
        <button type="button" className="pi-item__head" aria-expanded={open} onClick={() => setOpenId(open ? null : inquiry.id)}>
          {showStatus && <span className={`pi-status${inquiry.status === 'ANSWERED' ? ' is-answered' : ''}`}>{STATUS_LABEL[inquiry.status] || '문의 접수'}</span>}
          <strong>{(storeInquiry ? inquiry.title : stripSample(inquiry.title)) || '상품 문의'}</strong>
          {storeInquiry && <span className="si-list-author">{inquiry.authorName}</span>}
          {showStatus && inquiry.created_at && <time dateTime={inquiry.created_at}>{new Date(inquiry.created_at).toLocaleDateString('ko-KR')}</time>}
          <svg className={`pi-item__arrow${open ? ' is-open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {open && <div className="pi-item__body">
          {storeInquiry && <h3 className="si-title">{inquiry.title}</h3>}
          {editingId === inquiry.id ? <EditForm
            inquiry={inquiry}
            onCancel={() => setEditingId(null)}
            onSave={async (input) => { await onEdit(inquiry, input); setEditingId(null); }}
          /> : <p className="category-prewrap">{storeInquiry ? inquiry.content : stripSample(inquiry.content)}</p>}
          {inquiry.inquiry_images?.length > 0 && <ProductImageGallery images={inquiry.inquiry_images} productName="문의 첨부 이미지" />}
          {inquiry.answer_content && <blockquote><strong>매장 답변</strong><p className="category-prewrap">{storeInquiry ? inquiry.answer_content : stripSample(inquiry.answer_content)}</p>{storeInquiry && inquiry.answered_at && <time dateTime={inquiry.answered_at}>{new Date(inquiry.answered_at).toLocaleDateString('ko-KR')}</time>}</blockquote>}
          {storeInquiry && !inquiry.answer_content && <p className="si-no-answer">아직 답변이 등록되지 않았습니다.</p>}
          {storeInquiry && renderActions?.(inquiry)}
          {onEdit && onDelete && editingId !== inquiry.id && <div className="pi-item__actions">
            {inquiry.status === 'PENDING' && <button type="button" onClick={() => setEditingId(inquiry.id)}>수정</button>}
            <button type="button" onClick={() => onDelete(inquiry)}>삭제</button>
          </div>}
        </div>}
      </li>;
    })}
  </ul>;
}

export default function ProductInquirySection({
  storeProductId,
  client,
  user,
  onLogin,
  api = inquiryApi,
}) {
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [tab, setTab] = useState('faq');
  const formId = useId();
  const { alert: showAlert, confirm, dialog } = useDialog();
  const size = 10;
  const load = useCallback(
    (signal) =>
      api.getProductInquiries(storeProductId, { page, size, signal }, client),
    [api, storeProductId, page, client]
  );
  const request = useCategoryRequest(load, user?.id);
  async function submit(input) {
    await api.createProductInquiry(storeProductId, input, client);
    setPage(1);
    request.retry();
  }
  async function edit(inquiry, input) {
    await api.updateProductInquiry(storeProductId, inquiry.id, input, client);
    request.retry();
  }
  async function remove(inquiry) {
    if (!(await confirm('이 문의를 삭제할까요?\n삭제하면 되돌릴 수 없어요.', { confirmLabel: '삭제' }))) return;
    try {
      await api.deleteProductInquiry(storeProductId, inquiry.id, client);
      request.retry();
    } catch (error) {
      await showAlert(error.message || '문의를 삭제하지 못했어요.');
    }
  }
  return (
    <section className="category-section">
      <div className="pi-tabs" role="tablist" aria-label="Q&A 종류">
        <button type="button" role="tab" aria-selected={tab === 'faq'} className={tab === 'faq' ? 'is-on' : ''} onClick={() => setTab('faq')}>자주 묻는 질문</button>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'is-on' : ''} onClick={() => setTab('mine')}>내 문의</button>
      </div>
      {tab === 'faq' && (request.loading ? <p role="status">문의를 불러오는 중입니다.</p> : request.error ? <ProductEmptyState message="문의를 불러오지 못했습니다." onRetry={request.retry} /> : request.data?.samples?.length > 0 ? <>
        <InquiryList items={request.data.samples} label="자주 묻는 질문" showStatus={false} />
      </> : <ProductEmptyState message="등록된 자주 묻는 질문이 없습니다." />)}
      {tab === 'mine' && <>
        <p className="pi-hint">내가 남긴 문의만 보여요. 작성자 본인만 확인할 수 있어요.</p>
        {!user ? (
          <ProductEmptyState message="로그인하면 내가 남긴 문의를 볼 수 있어요." />
        ) : request.loading ? (
          <p role="status">문의를 불러오는 중입니다.</p>
        ) : request.error ? (
          <ProductEmptyState message="문의를 불러오지 못했습니다." onRetry={request.retry} />
        ) : request.data?.items?.length ? (
          <InquiryList key={`${storeProductId}:${page}`} items={request.data.items} label="내 상품 문의" onEdit={edit} onDelete={remove} />
        ) : (
          <ProductEmptyState message="내가 등록한 상품 문의가 없습니다." />
        )}
        {user && (
          <div className="category-pagination pi-pager">
            <button type="button" disabled={request.loading || page <= 1} onClick={() => setPage(page - 1)}>이전</button>
            <span>{page} 페이지</span>
            <button type="button" disabled={request.loading || request.error || page * size >= (request.data?.totalCount || 0)} onClick={() => setPage(page + 1)}>다음</button>
          </div>
        )}
        <button type="button" className="category-inquiry-toggle" aria-expanded={formOpen} aria-controls={formId} onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? '문의 작성 닫기' : '문의 등록'}
        </button>
        <div id={formId} hidden={!formOpen}>
          {formOpen && <InquiryForm user={user} onLogin={onLogin} onSubmit={submit} />}
        </div>
      </>}
      {dialog}
    </section>
  );
}
