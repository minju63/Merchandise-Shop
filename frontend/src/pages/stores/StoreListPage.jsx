import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../api/store.api.js';
import { PageState, StoreHeader, TabBar } from './components/StoreShell.jsx';
import StoreCard from './components/StoreCard.jsx';
import StoreFilter from './components/StoreFilter.jsx';
import StoreSort from './components/StoreSort.jsx';

const sortOptions = [
  { value: 'popular', label: '인기순' },
  { value: 'newest', label: '신규 입점 순' },
  { value: 'stock', label: '재고 많은 순' },
];

export default function StoreListPage() {
  const [filters, setFilters] = useState({ openNow: false, pickup: false, delivery: false });
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const params = { ...filters, sort, page, size: 20 };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['stores', params],
    queryFn: () => storeApi.list(params),
    refetchInterval: 60000,
  });
  const changeFilter = (key) => {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
    setPage(1);
  };
  return (
    <div className="app-shell">
      <StoreHeader />
      <main className="store-main list-main">
        <StoreFilter filters={filters} onChange={changeFilter} />
        <div className="section-heading store-list-heading">
          <div>
            <h1>굿즈샵 둘러보기</h1>
            <p>
              전체 {data?.data.allStoresCount ?? 0}곳
              {Object.values(filters).some(Boolean) && ` · 검색 결과 ${data?.data.totalCount ?? 0}곳`}
            </p>
          </div>
          <StoreSort
            value={sort}
            options={sortOptions}
            onChange={(value) => {
              setSort(value);
              setPage(1);
            }}
          />
        </div>
        {isPending ? (
          <div className="list-skeleton" aria-label="굿즈샵 목록 불러오는 중">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="skeleton-row">
                <div />
                <span />
              </div>
            ))}
          </div>
        ) : isError ? (
          <PageState onRetry={refetch}>{error.message}</PageState>
        ) : data.data.items.length ? (
          <div className="store-list">
            {data.data.items.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        ) : (
          <PageState>
            {Object.values(filters).some(Boolean)
              ? '조건에 맞는 굿즈샵이 없습니다.'
              : '등록된 굿즈샵이 없습니다.'}
          </PageState>
        )}
        <div className="pagination">
          {page > 1 && (
            <button className="secondary-button" onClick={() => setPage(page - 1)}>
              이전
            </button>
          )}
          {data?.data.totalCount > page * 20 && (
            <button className="secondary-button" onClick={() => setPage(page + 1)}>
              다음
            </button>
          )}
        </div>
      </main>
      <TabBar />
    </div>
  );
}
