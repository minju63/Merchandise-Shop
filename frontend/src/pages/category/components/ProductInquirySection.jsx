import { useCallback, useState } from 'react';
import * as inquiryApi from '../../../api/productInquiry.api';
import useCategoryRequest from './useCategoryRequest';
import ProductEmptyState from './ProductEmptyState';
import InquiryForm from './InquiryForm';
import ProductImageGallery from './ProductImageGallery';

export default function ProductInquirySection({
  storeProductId,
  client,
  user,
  onLogin,
  api = inquiryApi,
}) {
  const [page, setPage] = useState(1);
  const size = 10;
  const load = useCallback(
    (signal) =>
      user?.id
        ? api.getProductInquiries(storeProductId, { page, size, signal }, client)
        : Promise.resolve({ items: [], totalCount: 0 }),
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
      <h2>이 매장에 남긴 내 상품 문의</h2>
      <p>같은 매장의 다른 상품에서 작성한 문의도 함께 표시됩니다.</p>
      {!user ? (
        <p>상품 문의는 작성자 본인만 확인할 수 있습니다.</p>
      ) : request.loading ? (
        <p role="status">문의를 불러오는 중입니다.</p>
      ) : request.error ? (
        <ProductEmptyState message="문의를 불러오지 못했습니다." onRetry={request.retry} />
      ) : request.data?.items?.length ? (
        <ul className="category-inquiries">
          {request.data.items.map((inquiry) => (
            <li key={inquiry.id}>
              <span className="category-chip">
                {{ PENDING: '답변 대기', ANSWERED: '답변 완료', CLOSED: '종료' }[inquiry.status] ||
                  '문의 접수'}
              </span>
              {inquiry.title && <h3>{inquiry.title}</h3>}
              <p className="category-prewrap">{inquiry.content}</p>
              {inquiry.inquiry_images?.length > 0 && (
                <ProductImageGallery
                  images={inquiry.inquiry_images}
                  productName="문의 첨부 이미지"
                />
              )}
              {inquiry.created_at && (
                <time dateTime={inquiry.created_at}>
                  {new Date(inquiry.created_at).toLocaleDateString('ko-KR')}
                </time>
              )}
              {inquiry.answer_content && (
                <blockquote className="category-prewrap">{inquiry.answer_content}</blockquote>
              )}
            </li>
          ))}
        </ul>
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
      <InquiryForm user={user} onLogin={onLogin} onSubmit={submit} />
    </section>
  );
}
