import { useMemo, useState } from 'react';
import StoreCard from '../stores/components/StoreCard.jsx';
import StoreFilter from '../stores/components/StoreFilter.jsx';
import StoreSort from '../stores/components/StoreSort.jsx';
import StoreDistance from '../stores/components/StoreDistance.jsx';
import { applyStoreControls, sortOptions, useStoreLocation } from '../stores/storeListTools.js';

// 검색 결과의 굿즈샵 탭: 굿즈샵 탭과 같은 필터·정렬·거리 조건을 이미 받은 목록에 적용한다.
export default function SearchShopList({ shops, currentShopId }) {
  const [filters, setFilters] = useState({ openNow: false, pickup: false, delivery: false });
  const [sort, setSort] = useState('popular');
  const { location, locating, message, radiusKm, setRadiusKm, locate } = useStoreLocation();
  const distanceMode = sort === 'distance' && Boolean(location);
  const { items, noCoordinateCount } = useMemo(
    () =>
      applyStoreControls(shops, {
        filters,
        sort,
        origin: distanceMode ? location : null,
        radiusKm,
      }),
    [shops, filters, sort, distanceMode, location, radiusKm]
  );
  const changeSort = async (value) => {
    if (value === 'distance' && !(await locate())) return;
    setSort(value);
  };
  return (
    <div className="list-main store-embed">
      <div className="result-heading">
        <h2>
          굿즈샵 <span>{items.length}</span>
        </h2>
        <StoreSort value={sort} options={sortOptions} onChange={changeSort} />
      </div>
      <StoreFilter
        filters={filters}
        onChange={(key) => setFilters((current) => ({ ...current, [key]: !current[key] }))}
      />
      {distanceMode ? (
        <StoreDistance radiusKm={radiusKm} onRadiusChange={setRadiusKm} />
      ) : (
        (locating || message) && (
          <p className="distance-message" role="status">
            {locating ? '현재 위치를 확인하는 중입니다…' : message}
          </p>
        )
      )}
      {distanceMode && noCoordinateCount > 0 && (
        <p className="distance-message">
          위치 정보가 없는 굿즈샵 {noCoordinateCount}곳은 거리 기능에서 제외됩니다.
        </p>
      )}
      {items.length ? (
        <div className="store-list">
          {items.map((store) => (
            <div className="store-current-wrap" key={store.id}>
              {store.id === currentShopId && <span className="store-current-tag">지금 보는 굿즈샵</span>}
              <StoreCard store={store} />
            </div>
          ))}
        </div>
      ) : (
        <p className="result-empty">
          {distanceMode
            ? `반경 ${radiusKm}km 이내에 조건에 맞는 굿즈샵이 없습니다.`
            : '조건에 맞는 굿즈샵이 없습니다.'}
        </p>
      )}
    </div>
  );
}
