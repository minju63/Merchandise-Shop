import { useCallback, useId, useRef, useState } from 'react';
import * as inquiryApi from '../../../api/productInquiry.api';
import useCategoryRequest from './useCategoryRequest';
import ProductEmptyState from './ProductEmptyState';
import InquiryForm from './InquiryForm';
import ProductImageGallery from './ProductImageGallery';
import useDraggableRail from '../../../hooks/useDraggableRail.js';
import './ProductInquirySection.css';

function InquiryCards({ items, label }) {
  const rail = useRef(null);
  const dragScroll = useDraggableRail();
  return <div className="pi-carousel">
    <div className="pi-card-rail" ref={rail} {...dragScroll} role="region" aria-label={label} tabIndex={0}>
      {items.map((inquiry) => <article className="pi-card" key={inquiry.id}>
        <header><span className={`pi-status${inquiry.status === 'ANSWERED' ? ' is-answered' : ''}`}>{{ PENDING: '답변 대기', ANSWERED: '답변 완료', CLOSED: '종료' }[inquiry.status] || '문의 접수'}</span>
          {inquiry.created_at && <time dateTime={inquiry.created_at}>{new Date(inquiry.created_at).toLocaleDateString('ko-KR')}</time>}
        </header>
        <h3>{inquiry.title || '상품 문의'}</h3>
        <p className="category-prewrap">{inquiry.content}</p>
        {inquiry.inquiry_images?.length > 0 && <ProductImageGallery images={inquiry.inquiry_images} productName="문의 첨부 이미지" />}
        {inquiry.answer_content && <blockquote><strong>매장 답변</strong><p className="category-prewrap">{inquiry.answer_content}</p></blockquote>}
      </article>)}
    </div>
    {items.length > 1 && <div className="pi-carousel-controls"><span>옆으로 넘겨 문의를 확인하세요</span><button type="button" aria-label="이전 문의 카드" onClick={() => rail.current.scrollBy({ left: -rail.current.clientWidth * .9, behavior: 'smooth' })}>‹</button><button type="button" aria-label="다음 문의 카드" onClick={() => rail.current.scrollBy({ left: rail.current.clientWidth * .9, behavior: 'smooth' })}>›</button></div>}
  </div>;
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
      <h2>Q&A</h2>
      {request.loading ? <p role="status">문의를 불러오는 중입니다.</p> : request.error ? <ProductEmptyState message="문의를 불러오지 못했습니다." onRetry={request.retry} /> : request.data?.samples?.length > 0 && <>
        <p className="category-inquiry-demo-note">화면 확인을 위한 샘플 Q&A입니다. 실제 구매자의 문의가 아닙니다.</p>
        <InquiryCards items={request.data.samples} label="잡아 끌어 샘플 Q&A 넘기기" />
      </>}
      <h2>이 매장에 남긴 내 상품 문의</h2>
      <p>같은 매장의 다른 상품에서 작성한 문의도 함께 표시됩니다.</p>
      {!user ? (
        <p>상품 문의는 작성자 본인만 확인할 수 있습니다.</p>
      ) : request.loading ? (
        <p role="status">문의를 불러오는 중입니다.</p>
      ) : request.error ? (
        null
      ) : request.data?.items?.length ? (
        <InquiryCards key={`${storeProductId}:${page}`} items={request.data.items} label="잡아 끌어 내 상품 문의 넘기기" />
      ) : (
        <ProductEmptyState message="내가 등록한 상품 문의가 없습니다." />
      )}
      {user && (
        <div className="category-pagination">
          <button
            type="button"
            disabled={request.loading || page <= 1}
            onClick={() => setPage(page - 1)}
          >
            이전
          </button>
          <span>{page} 페이지</span>
          <button
            type="button"
            disabled={
              request.loading || request.error || page * size >= (request.data?.totalCount || 0)
            }
            onClick={() => setPage(page + 1)}
          >
            다음
          </button>
        </div>
      )}
      <button type="button" className="category-inquiry-toggle" aria-expanded={formOpen} aria-controls={formId} onClick={() => setFormOpen((open) => !open)}>
        {formOpen ? '문의 작성 닫기' : '문의 등록'}
      </button>
      <div id={formId} hidden={!formOpen}>
        {formOpen && <InquiryForm user={user} onLogin={onLogin} onSubmit={submit} />}
      </div>
    </section>
  );
}
