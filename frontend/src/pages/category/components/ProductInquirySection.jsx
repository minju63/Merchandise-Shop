import { useCallback, useId, useState } from 'react';
import * as inquiryApi from '../../../api/productInquiry.api';
import useCategoryRequest from './useCategoryRequest';
import ProductEmptyState from './ProductEmptyState';
import InquiryForm from './InquiryForm';
import ProductImageGallery from './ProductImageGallery';
import './ProductInquirySection.css';

// 시연용 데이터 앞에 붙은 [샘플], [샘플 문의], [샘플 답변] 표시는 화면에 보이지 않게 한다.
const stripSample = (text) => (text ?? '').replace(/\[샘플[^\]]*\]\s*/g, '');

const STATUS_LABEL = { PENDING: '답변 대기', ANSWERED: '답변 완료', CLOSED: '종료' };

// 세로로 쌓은 접이식 목록. 질문을 누르면 내용과 매장 답변이 펼쳐진다.
function InquiryList({ items, label, showStatus = true }) {
  const [openId, setOpenId] = useState(null);
  return <ul className="pi-list" aria-label={label}>
    {items.map((inquiry) => {
      const open = openId === inquiry.id;
      return <li className="pi-item" key={inquiry.id}>
        <button type="button" className="pi-item__head" aria-expanded={open} onClick={() => setOpenId(open ? null : inquiry.id)}>
          {showStatus && <span className={`pi-status${inquiry.status === 'ANSWERED' ? ' is-answered' : ''}`}>{STATUS_LABEL[inquiry.status] || '문의 접수'}</span>}
          <strong>{stripSample(inquiry.title) || '상품 문의'}</strong>
          {showStatus && inquiry.created_at && <time dateTime={inquiry.created_at}>{new Date(inquiry.created_at).toLocaleDateString('ko-KR')}</time>}
          <svg className={`pi-item__arrow${open ? ' is-open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {open && <div className="pi-item__body">
          <p className="category-prewrap">{stripSample(inquiry.content)}</p>
          {inquiry.inquiry_images?.length > 0 && <ProductImageGallery images={inquiry.inquiry_images} productName="문의 첨부 이미지" />}
          {inquiry.answer_content && <blockquote><strong>매장 답변</strong><p className="category-prewrap">{stripSample(inquiry.answer_content)}</p></blockquote>}
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
  const size = 10;
  const load = useCallback(
    (signal) =>
      api.getProductInquiries(storeProductId, { page, size, signal }, client),
    [api, storeProductId, page, client, user?.id]
  );
  const request = useCategoryRequest(load, user?.id);
  async function submit(input) {
    await api.createProductInquiry(storeProductId, input, client);
    setPage(1);
    request.retry();
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
          <InquiryList key={`${storeProductId}:${page}`} items={request.data.items} label="내 상품 문의" />
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
    </section>
  );
}
