import CategoryLayout from './components/CategoryLayout.jsx';
import sharedClient from '../../api/client.js';
import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as categoryApi from '../../api/category.api';
import * as defaultProductApi from '../../api/product.api';
import CategoryBrandList from './components/CategoryBrandList';
import CategorySidebar from './components/CategorySidebar';
import { BRAND_GROUPS } from '../../constants/brands.js';
import GoodsTypeGrid from './components/GoodsTypeGrid';
import ProductEmptyState from './components/ProductEmptyState';
import useCategoryRequest from './components/useCategoryRequest';
import './components/category.css';
import { buildGoodsTypes } from './components/goodsTypes';

// Route owner supplies the shared Axios client; render inside BrowserRouter.
function CategoryPageContent({ client = sharedClient, api = categoryApi, productApi = defaultProductApi }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('contentCategoryId') || '';
  const selectedBrand = params.get('brand') || '';
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
  const goods = request.data?.goods;
  const loadPhotos = useCallback(async (signal) => {
    if (!goods) return [];
    return Promise.all(goods.map(async (category) => {
      if (!category.id) return { ...category, imageUrl: undefined };
      try {
        for (let page = 1; ; page++) {
          const result = await productApi.getProducts({
            ...(selectedId ? { contentCategoryId: selectedId } : {}),
            ...(selectedBrand ? { brands: selectedBrand } : {}),
            goodsCategoryId: category.id, sort: 'price_asc', page, size: 20, signal,
          }, client);
          const photo = result.items.find((product) => product.thumbnailUrl);
          if (photo) return { ...category, imageUrl: photo.thumbnailUrl };
          if (!result.items.length || page * 20 >= result.totalCount) break;
        }
      } catch (error) {
        if (signal.aborted) throw error;
        // Image lookup failure must not prevent category navigation.
      }
      return { ...category, imageUrl: undefined };
    }));
  }, [goods, selectedId, selectedBrand, productApi, client]);
  const photos = useCategoryRequest(loadPhotos, `${selectedId}|${selectedBrand}`);
  function selectContent(id) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set('contentCategoryId', id);
      else next.delete('contentCategoryId');
      next.delete('brand'); // 분류를 바꾸면 고른 브랜드는 초기화한다
      return next;
    });
  }
  function selectBrand(name) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (name) next.set('brand', name);
      else next.delete('brand');
      return next;
    });
  }
  function selectGoods(id, name) {
    const query = new URLSearchParams();
    query.set('resultType', 'goods');
    if (selectedId) query.set('contentCategoryId', selectedId);
    if (selectedBrand) query.set('brands', selectedBrand);
    query.set('contentName', request.data?.content.find((category) => category.id === selectedId)?.name || '전체');
    if (id) query.set('goodsCategoryId', id);
    if (name) query.set('goodsType', name);
    if (!id && !name) query.set('allGoods', 'true');
    navigate(`/category/products${query.size ? `?${query}` : ''}`);
  }
  const selectedContentName = request.data?.content.find((category) => category.id === selectedId)?.name;
  const brandGroup = selectedId ? BRAND_GROUPS.find((group) => group.label === selectedContentName) : undefined;
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
        <>
          <div className={`category-selector${brandGroup ? ' category-selector--brands' : ' category-selector--single'}`}>
            <CategorySidebar
              categories={request.data.content}
              selectedId={selectedId}
              onSelect={selectContent}
            />
            {brandGroup && (
              <CategoryBrandList
                label={brandGroup.label}
                brands={brandGroup.brands}
                selected={selectedBrand}
                onSelect={selectBrand}
              />
            )}
          <div className="category-goods-panel">
            <h2 className="category-sr-only">
              {request.data.content.find((category) => category.id === selectedId)?.name || '전체'}{' '}
              굿즈
            </h2>
            {request.data.goods.length ? (
              <GoodsTypeGrid categories={photos.data || request.data.goods.map((category) => ({ ...category, imageUrl: undefined }))} onSelect={selectGoods} onSelectAll={() => selectGoods()} />
            ) : (
              <ProductEmptyState message="등록된 굿즈 유형이 없습니다." />
            )}
          </div>
          </div>
        </>
      )}
    </main>
  );
}

export default function CategoryPage({ embedded = false, ...props }) {
  return <CategoryLayout embedded={embedded}><CategoryPageContent {...props} /></CategoryLayout>;
}
