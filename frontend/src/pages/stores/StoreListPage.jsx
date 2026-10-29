import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../api/store.api.js';
import { PageState, StoreHeader, TabBar } from './components/StoreShell.jsx';
import StoreCard from './components/StoreCard.jsx';
import StoreFilter from './components/StoreFilter.jsx';
import StoreSort from './components/StoreSort.jsx';
import StoreDistance from './components/StoreDistance.jsx';
import { sortOptions, useStoreLocation } from './storeListTools.js';

export default function StoreListPage() {
  const [filters, setFilters] = useState({ openNow: false, pickup: false, delivery: false });
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const {
    location,
    locating,
    message: locationMessage,
    radiusKm,
    setRadiusKm,
    locate: requestLocation,
  } = useStoreLocation();
  // 거리순을 고른 동안에만 위치와 반경을 요청에 쓴다.
  const distanceMode = sort === 'distance' && Boolean(location);
  const params = {
    ...filters,
    sort,
    page,
    size: 20,
    ...(distanceMode && { lat: location.lat, lng: location.lng, radiusKm }),
  };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['stores', params],
    queryFn: () => storeApi.list(params),
    refetchInterval: 60000,
  });
  const locate = async () => {
    const point = await requestLocation();
    if (point) setPage(1);
    return point;
  };
  const changeSort = async (value) => {
    if (value === 'distance' && !(await locate())) return;
    setSort(value);
    setPage(1);
  };
  // 홈 배너의 "내 주변 굿즈샵 보기"처럼 ?sort=distance로 들어오면 거리순을 눌린 상태로 시작한다.
  const [searchParams] = useSearchParams();
  const startedWithDistance = useRef(false);
  useEffect(() => {
    if (startedWithDistance.current || searchParams.get('sort') !== 'distance') return;
    startedWithDistance.current = true;
    changeSort('distance');
    // 처음 열 때 한 번만 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const changeFilter = (key) => {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
    setPage(1);
  };
  return (
    <div className="app-shell">
      <StoreHeader />
      <main className="store-main list-main">
        <div className="section-heading store-list-heading">
          <div>
            <h1>굿즈샵 둘러보기</h1>
            <p>
              전체 {data?.data.allStoresCount ?? 0}곳
              {(distanceMode || Object.values(filters).some(Boolean)) && ` · 검색 결과 ${data?.data.totalCount ?? 0}곳`}
            </p>
          </div>
          <StoreSort
            value={sort}
            options={sortOptions}
            onChange={changeSort}
          />
        </div>
        <StoreFilter filters={filters} onChange={changeFilter} />
        {distanceMode ? (
          <StoreDistance
            radiusKm={radiusKm}
            onRadiusChange={(value) => {
              setRadiusKm(value);
              setPage(1);
            }}
          />
        ) : (
          (locating || locationMessage) && (
            <p className="distance-message" role="status">
              {locating ? '현재 위치를 확인하는 중입니다…' : locationMessage}
            </p>
          )
        )}
        {distanceMode && data?.data.noCoordinateCount > 0 && (
          <p className="distance-message">
            위치 정보가 없는 굿즈샵 {data.data.noCoordinateCount}곳은 거리 기능에서 제외됩니다.
          </p>
        )}
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
            {distanceMode
              ? `반경 ${radiusKm}km 이내에 조건에 맞는 굿즈샵이 없습니다.`
              : Object.values(filters).some(Boolean)
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
