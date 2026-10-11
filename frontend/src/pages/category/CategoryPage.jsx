import sharedClient from '../../api/client.js';
import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as categoryApi from '../../api/category.api';
import CategorySidebar from './components/CategorySidebar';
import GoodsTypeGrid from './components/GoodsTypeGrid';
import ProductEmptyState from './components/ProductEmptyState';
import useCategoryRequest from './components/useCategoryRequest';
import './components/category.css';
import { buildGoodsTypes } from './components/goodsTypes';

// Route owner supplies the shared Axios client; render inside BrowserRouter.
export default function CategoryPage({ client = sharedClient, api = categoryApi }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('contentCategoryId') || '';
  const load = useCallback(
    async (signal) => {
      const [content, goods] = await Promise.all([
        api.getCategories({ type: 'CONTENT', signal }, client),
        api.getCategories({ type: 'GOODS', signal }, client),
      ]);
      return { content, goods: buildGoodsTypes(goods) };
    },
    [api, client]
  );
  const request = useCategoryRequest(load);
  function selectContent(id) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set('contentCategoryId', id);
      else next.delete('contentCategoryId');
      return next;
    });
  }
  function selectGoods(id, name) {
    const query = new URLSearchParams();
    if (selectedId) query.set('contentCategoryId', selectedId);
    if (id) query.set('goodsCategoryId', id);
    if (name) query.set('goodsType', name);
    navigate(`/category/products${query.size ? `?${query}` : ''}`);
  }
  return (
    <main className="category-page category-main-page">
      <h1 className="category-sr-only">카테고리</h1>
      {request.loading ? (
        <p role="status">카테고리를 불러오는 중입니다.</p>
      ) : request.error ? (
        <ProductEmptyState message="카테고리를 불러오지 못했습니다." onRetry={request.retry} />
      ) : !request.data?.content.length && !request.data?.goods.length ? (
        <ProductEmptyState message="등록된 카테고리가 없습니다." />
      ) : (
        <div className="category-selector">
          <CategorySidebar
            categories={request.data.content}
            selectedId={selectedId}
            onSelect={selectContent}
          />
          <div className="category-goods-panel">
            <h2 className="category-sr-only">
              {request.data.content.find((category) => category.id === selectedId)?.name || '전체'}{' '}
              굿즈
            </h2>
            {request.data.goods.length ? (
              <GoodsTypeGrid categories={request.data.goods} onSelect={selectGoods} />
            ) : (
              <ProductEmptyState message="등록된 굿즈 유형이 없습니다." />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
