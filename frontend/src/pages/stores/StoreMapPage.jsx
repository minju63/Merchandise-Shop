import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../api/store.api.js';
import { StoreHeader, TabBar, PageState, ImageWithFallback } from './components/StoreShell.jsx';
import StoreSort from './components/StoreSort.jsx';
import StoreRegionSelect from './components/StoreRegionSelect.jsx';
import StoreConditions from './components/StoreConditions.jsx';
import Icon from './components/Icon.jsx';
import InventoryMap from './components/InventoryMap.jsx';
import { sortOptions, useStoreLocation } from './storeListTools.js';
import { searchApi } from '../../api/search.api.js';
import { AutocompleteList } from '../search/SearchPage.jsx';
import { getAutocompleteSuggestions, withAreaSuggestion } from '../search/searchAutocomplete.js';
import useWishlist from '../../hooks/useWishlist.js';
import './StoreMapPage.css';

const EMPTY = [];
export default function StoreMapPage() {
  const cardRail = useRef(null);
  const cardDrag = useRef({ pointerId: null, moved: false });
  const navigate = useNavigate();
  const wish = useWishlist();
  const goBack = () => {
    navigate('/stores', { replace: true });
  };
  const [search, setSearch] = useSearchParams();
  const [draft, setDraft] = useState(search.get('keyword') || '');
  const [selectedId, setSelectedId] = useState(null);
  const [viewport, setViewport] = useState(null);
  const [center, setCenter] = useState(() => search.has('latitude') && search.has('longitude')
    ? { lat: Number(search.get('latitude')), lng: Number(search.get('longitude')) } : null);
  const [locationReady, setLocationReady] = useState(() => search.has('latitude') || search.has('region') || search.has('regionId') || search.has('south'));
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const { locate, message } = useStoreLocation();
  useEffect(() => {
    if (locationReady) return;
    let active = true;
    locate().then((point) => {
      if (!active) return;
      if (point) {
        setCenter(point);
        setSearch((current) => {
          // Preserve filters changed while the browser was asking for location access.
          if (current.has('region') || current.has('regionId') || current.has('latitude') || current.has('south')) return current;
          const next = new URLSearchParams(current);
          next.set('latitude', String(point.lat));
          next.set('longitude', String(point.lng));
          next.set('radius', '20');
          next.set('sort', 'distance');
          return next;
        }, { replace: true });
      }
      setLocationReady(true);
    });
    return () => { active = false; };
    // Request location only on entry; later searches and region changes remain user-controlled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const filters = { regionId: search.get('regionId') || '',
    ...Object.fromEntries(['openNow', 'pickup', 'delivery'].map((key) => [key, search.get(key) === 'true'])) };
  const productId = search.get('productId');
  const update = (values) => {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === '') next.delete(key); else next.set(key, String(value));
    }
    if (!next.has('productId') && next.get('sort') === 'stock') next.set('sort', 'popular');
    setSearch(next);
    setSelectedId(null);
  };
  const runKeyword = (value) => {
    setTyping(false);
    update({ keyword: value.trim(), productId: null, productName: null, inStock: null, south: null, north: null, west: null, east: null });
  };
  const params = Object.fromEntries([...search].filter(([k]) => !['view', 'productName'].includes(k)));
  if (params.sort === 'newest') params.sort = 'popular';
  const { data, isPending, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['store-map', params], queryFn: () => storeApi.map(params), refetchInterval: 30000,
    enabled: locationReady,
  });
  const result = data?.data;
  const items = result?.items || EMPTY;
  const { latitude: areaLat, longitude: areaLng, name: areaName } = result?.area ?? {};
  // 30초마다 다시 불러와도 지도가 다시 맞춰지지 않게 값이 같으면 같은 객체를 쓴다.
  const focus = useMemo(() => areaName ? { lat: areaLat, lng: areaLng, name: areaName } : null, [areaLat, areaLng, areaName]);
  // 자동완성의 굿즈샵·지역은 지금 지도에 보이는 매장이 아니라 전체 굿즈샵에서 찾는다.
  const allShops = useQuery({ queryKey: ['search-stores'], queryFn: searchApi.stores, staleTime: 60000, retry: false }).data ?? EMPTY;
  // 홈 검색처럼 입력 중에 굿즈·작품·캐릭터·굿즈샵 자동완성을 보여준다(최근·인기 검색어는 없다).
  useEffect(() => {
    const text = draft.trim();
    if (!typing || !text) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const [response, area] = await Promise.all([
          searchApi.products({ q: text, size: 100, includeSoldOut: false, includeUpcoming: false }),
          searchApi.area(text).catch(() => null),
        ]);
        if (!cancelled) setSuggestions(withAreaSuggestion(getAutocompleteSuggestions(text, { regions: [] }, response.data.items, allShops, undefined), text, area));
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [draft, typing, allShops]);
  const activeId = items.some((s) => s.id === selectedId) ? selectedId : items[0]?.id;
  const selectStore = (id) => {
    setSelectedId(id);
    const rail = cardRail.current;
    const target = rail && [...rail.children].find((node) => node.dataset.storeId === id);
    if (target) rail.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
  };
  const syncCardSelection = () => {
    const rail = cardRail.current;
    if (!rail?.children.length) return;
    const nearest = [...rail.children].reduce((a, b) => Math.abs(a.offsetLeft - rail.scrollLeft) < Math.abs(b.offsetLeft - rail.scrollLeft) ? a : b);
    setSelectedId(nearest.dataset.storeId);
  };
  const moveCard = (step) => {
    const index = items.findIndex((s) => s.id === activeId);
    const store = items[Math.max(0, Math.min(items.length - 1, index + step))];
    if (store) selectStore(store.id);
  };
  const startCardDrag = (event) => {
    if (event.pointerType === 'touch') {
      cardDrag.current = { pointerId: null, moved: false };
      return;
    }
    if (event.button !== 0) return;
    cardDrag.current = { pointerId: event.pointerId, startX: event.clientX,
      startScroll: event.currentTarget.scrollLeft, moved: false };
  };
  const dragCards = (event) => {
    const drag = cardDrag.current;
    if (drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(delta) < 6) return;
    const rail = event.currentTarget;
    if (!drag.moved) {
      drag.moved = true;
      rail.classList.add('is-dragging');
      rail.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    rail.scrollLeft = drag.startScroll - delta;
  };
  const endCardDrag = (event) => {
    const drag = cardDrag.current;
    if (drag.pointerId !== event.pointerId) return;
    drag.pointerId = null;
    const rail = event.currentTarget;
    const nearest = drag.moved && rail.children.length ? [...rail.children].reduce((a, b) =>
      Math.abs(a.offsetLeft - rail.scrollLeft) < Math.abs(b.offsetLeft - rail.scrollLeft) ? a : b) : null;
    rail.classList.remove('is-dragging');
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    if (nearest) rail.scrollTo({ left: nearest.offsetLeft, behavior: 'smooth' });
  };
  const preventDragClick = (event) => {
    if (cardDrag.current.moved && event.detail !== 0) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const selectedProductImage = result?.product?.thumbnailUrl
    || result?.products?.find((p) => p.id === productId)?.thumbnailUrl
    || result?.product?.thumbnail_url;
  const locateStores = async () => {
    const point = await locate();
    if (point) {
      setCenter(point);
      update({ latitude: point.lat, longitude: point.lng, radius: 20, sort: 'distance',
        region: null, district: null, regionId: null, south: null, north: null, east: null, west: null });
    }
  };
  const card = (store) => <article className={`inventory-card${store.id === activeId ? ' is-active' : ''}`} key={store.id} data-store-id={store.id}>
    <Link to={productId && store.storeProductId ? `/products/${store.storeProductId}` : `/stores/${store.id}`} className="inventory-card-main">
      <ImageWithFallback src={store.thumbnailUrl} alt={store.name} className="inventory-image" />
      <div><h2>{store.name}</h2><p>{store.address || store.region}</p>
        {productId && <strong className={store.inStock ? 'inventory-stock' : 'inventory-empty'}>{store.inStock ? `재고 ${store.stock}개` : `품절 · 구매 불가 (등록 재고 ${store.stock}개)`}</strong>}
        <p>{store.pickupAvailable ? '픽업 가능' : '픽업 불가'} · {store.deliveryAvailable ? '배달 가능' : '배달 불가'}{store.distanceKm !== null && ` · ${store.distanceKm.toFixed(1)}km`}</p>
        <span>{productId && store.storeProductId ? '이 매장의 상품 상세 보기 →' : '매장 상세 보기 →'}</span></div>
    </Link>
    {productId && store.storeProductId && <Link className="inventory-product-link" to={`/products/${store.storeProductId}`}>선택 상품 상세 보기</Link>}
    <button className={`card-heart${wish.isShopWished(store.id) ? ' is-wished' : ''}`} type="button"
      aria-pressed={wish.isShopWished(store.id)}
      aria-label={wish.isShopWished(store.id) ? `${store.name} 찜 해제` : `${store.name} 찜하기`}
      onClick={() => wish.toggleShop(store.id)}><Icon name="heart" size={21} /></button>
  </article>;
  return <div className="app-shell"><StoreHeader /><main className="store-main inventory-main">
    <div className="inventory-title">
      <div className="inventory-title-row">
        <button type="button" className="inventory-back" onClick={goBack} aria-label="굿즈샵 목록으로 돌아가기"><Icon name="back" size={26} /></button>
        <h1>지도에서 찾기</h1>
      </div>
      <p>원하는 굿즈와 가까운 매장을 찾아보세요</p>
    </div>
    <form className="inventory-search" onSubmit={(event) => { event.preventDefault(); runKeyword(draft); }}>
      <input aria-label="매장·지역·상품·작품·캐릭터 검색" value={draft} onChange={(e) => { setDraft(e.target.value); setTyping(true); }} placeholder="지역, 매장, 상품, 작품, 캐릭터 검색" />
      <button type="submit">검색</button>
    </form>
    {typing && draft.trim() && suggestions.length > 0 && <div className="inventory-autocomplete">
      <AutocompleteList query={draft} suggestions={suggestions} isLoading={false} onSelect={(item) => { setDraft(item.searchValue ?? item.label); runKeyword(item.searchValue ?? item.label); }} />
    </div>}
    {!productId && search.get('keyword') && result?.products.length > 0 && <div className="inventory-suggestions" aria-label="상품 검색 결과">
      {result.products.map((p) => <button type="button" key={p.id} onClick={() => update({ productId: p.id, productName: p.name, keyword: null, south: null, north: null, west: null, east: null })}>
        <ImageWithFallback src={p.thumbnailUrl} alt={p.name} className="inventory-suggestion-image" />
        <span className="inventory-suggestion-content"><strong>{p.name}</strong><small>{[p.workTitle, p.characterName].filter(Boolean).join(' · ')}</small></span>
        <span className="inventory-suggestion-arrow" aria-hidden="true">›</span>
      </button>)}
    </div>}
    {productId && <section className="inventory-selection" aria-label="재고 조회 중인 굿즈">
      <ImageWithFallback src={selectedProductImage} alt={result?.product?.name || search.get('productName') || '선택한 굿즈'} className="inventory-selection-image" />
      <div className="inventory-selection-content">
        <h2>{result?.product?.name || search.get('productName') || '상품 재고 찾기'}</h2>
        <p>ⓘ 구매 시점에 따라 실제 재고와 다를 수 있어요.</p>
      </div>
      <button type="button" onClick={() => update({ productId: null, productName: null, inStock: null })} aria-label="상품 선택 해제">✕</button>
    </section>}
    <div className="inventory-controls">
      {productId && <button type="button" className={`filter-chip ${search.get('inStock') === 'true' ? 'selected' : ''}`} aria-pressed={search.get('inStock') === 'true'} onClick={() => update({ inStock: search.get('inStock') !== 'true' })}>재고 있는 매장만</button>}
      <StoreConditions filters={filters} onChange={(key) => update({ [key]: filters[key] ? null : true })} />
      <StoreRegionSelect region={search.get('region') || result?.regions.find((region) => region.id === search.get('regionId'))?.name || ''}
        district={search.get('district') || ''}
        onChange={(region, district) => update({ region, district, regionId: null, south: null, north: null, west: null, east: null, radius: null })} />
      <StoreSort value={['popular', 'distance'].includes(search.get('sort')) ? search.get('sort') : 'popular'}
        options={sortOptions.filter((option) => ['popular', 'distance'].includes(option.value))
          .map((option) => ({ ...option, label: option.value === 'popular' ? '인기 매장' : '가까운 매장' }))}
        onChange={(value) => value === 'distance' ? locateStores() : update({ sort: value })} />
    </div>
    {message && <p role="status">{message} 지역을 선택하거나 검색해서 찾아보세요.</p>}
    <div className="inventory-result-count" role="status">{!locationReady ? '현재 위치 확인 중…' : isFetching ? '재고 확인 중…' : isError ? '조회 실패' : items.length ? `${items.length}개 매장` : result?.area ? '주변 매장이 없습니다' : '검색 결과가 없습니다'}{dataUpdatedAt > 0 && <small> · {new Date(dataUpdatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 조회</small>}</div>
    {result?.area && <p className="inventory-area-note" role="status">‘{search.get('keyword')}’은(는) 장소로 찾았어요. {items.length ? <><strong>{result.area.name}</strong> 주변 {result.area.radius}km 매장이에요.</> : <><strong>{result.area.name}</strong> 주변 {result.area.radius}km에는 등록된 굿즈샵이 없어요.</>}</p>}
    {isPending ? <PageState>{!locationReady ? '현재 위치를 확인하는 중입니다.' : '매장과 재고를 불러오는 중입니다.'}</PageState> : isError ? <PageState onRetry={refetch}>{error.message}</PageState> : <>
      {productId && items.length > 0 && result.inStockCount === 0 && <p role="status">현재 재고가 있는 매장이 없습니다.</p>}
      <div className="inventory-map-wrap"><InventoryMap items={items} productMode={Boolean(productId)} selectedId={activeId} onSelect={selectStore} onBounds={setViewport} center={search.has('radius') ? center : null} focus={focus} />
        <button className="inventory-area-button" disabled={!viewport} onClick={() => update({ ...viewport, radius: null })}>이 지도 영역에서 검색</button></div>
      <p className="inventory-legend">● 재고 있음 <span>● 품절</span> · 카드를 옆으로 넘겨 매장을 확인하세요</p>
      {items.length > 0 && <section className="inventory-carousel" aria-label="굿즈샵 카드">
        <div className="inventory-carousel-controls"><span>{items.findIndex((s) => s.id === activeId) + 1} / {items.length}</span><button type="button" aria-label="이전 매장" onClick={() => moveCard(-1)} disabled={activeId === items[0].id}>‹</button><button type="button" aria-label="다음 매장" onClick={() => moveCard(1)} disabled={activeId === items[items.length - 1].id}>›</button></div>
        <div className="inventory-card-rail" ref={cardRail} onScroll={syncCardSelection}
          onPointerDown={startCardDrag} onPointerMove={dragCards} onPointerUp={endCardDrag}
          onPointerCancel={endCardDrag} onLostPointerCapture={endCardDrag}
          onPointerLeave={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) endCardDrag(event); }}
          onClickCapture={preventDragClick} onDragStart={(event) => event.preventDefault()}
          tabIndex={0} role="region" aria-label="카드를 잡아 좌우로 넘겨 굿즈샵 보기">{items.map(card)}</div>
      </section>}
      {result.noCoordinateCount > 0 && <p>위치 정보가 없는 매장 {result.noCoordinateCount}곳은 지도 결과에서 제외됩니다.</p>}
    </>}
    <p className="inventory-notice">재고는 30초마다 갱신되는 참고 정보입니다. 실제 구매 직전에 현재 재고를 다시 확인합니다.</p>
  </main><TabBar /></div>;
}
