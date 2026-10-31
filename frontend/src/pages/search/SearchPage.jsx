import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { parseRegionalQuery } from './searchQuery.js';
import { searchApi } from '../../api/search.api.js';
import Icon from '../../components/Icon.jsx';
import BottomNavigation from '../../components/BottomNavigation.jsx';
import SearchShopList from './SearchShopList.jsx';
import useWishlist from '../../hooks/useWishlist.js';
import GoodsListCard from '../../components/GoodsListCard.jsx';
import IntegratedSearchFilters from './IntegratedSearchFilters.jsx';
import './SearchPage.css';

const RECENT_SEARCH_KEY = 'goodzpick.recentSearches';
const PRODUCT_SORT_OPTIONS = [
  ['popular', '인기순'],
  ['sales', '판매순'],
  ['newest', '최신순'],
  ['wishlist', '찜 많은 순'],
  ['stock', '재고 많은 순'],
  ['stockAsc', '재고 적은 순'],
  ['priceLow', '낮은 가격 순'],
  ['priceHigh', '높은 가격 순'],
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function matchesTokens(values, tokens) {
  const target = values.filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
  return tokens.every((token) => target.includes(token));
}

function getAutocompleteSuggestions(query, data, products, shops, storeId) {
  const tokens = query.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const regionItems = storeId ? [] : data.regions
    .filter((region) => {
      const names = [region.label, region.displayName, ...region.aliases]
        .map((name) => name.toLocaleLowerCase('ko-KR'));
      const matchesQuery = tokens.some((token) => names.some((name) => name.includes(token)));
      const hasResults = shops.some((shop) => matchesRegion(shop, region));
      return matchesQuery && hasResults;
    })
    .map((region) => ({
      id: `region-${region.id}`,
      type: '지역',
      label: region.displayName,
      subtitle: region.label === region.displayName ? '지역 검색' : region.label,
      regionId: region.id,
      searchValue: region.label,
    }));

  const entityItems = [
    ...products.map((product) => ({
      id: `product-${product.storeProductId}`,
      type: '굿즈',
      label: product.name,
      subtitle: product.storeName,
      searchValue: product.name,
    })),
    ...products.filter((product) => product.workTitle && matchesTokens([product.workTitle], tokens))
      .map((product) => ({
        id: `work-${product.workTitle}`,
        type: '작품',
        label: product.workTitle,
        subtitle: product.storeName,
        searchValue: product.workTitle,
      })),
    ...products.filter((product) => product.characterName && matchesTokens([product.characterName], tokens))
      .map((product) => ({
        id: `character-${product.characterName}`,
        type: '캐릭터',
        label: product.characterName,
        subtitle: product.workTitle || product.storeName,
        searchValue: product.characterName,
      })),
    ...(storeId ? [] : shops.filter((shop) => matchesTokens([shop.name, shop.address], tokens))
      .map((shop) => ({
        id: `shop-${shop.id}`,
        type: '굿즈샵',
        label: shop.name,
        subtitle: shop.address,
        searchValue: shop.name,
      }))),
  ];

  return [...regionItems, ...new Map(entityItems.map((item) => [item.id, item])).values()].slice(0, 8);
}

function HighlightText({ text, query }) {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return text;
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');

  return text.split(pattern).map((part, index) => (
    tokens.some((token) => token.toLocaleLowerCase('ko-KR') === part.toLocaleLowerCase('ko-KR'))
      ? <mark key={`${part}-${index}`}>{part}</mark>
      : part
  ));
}

function loadRecentSearches(fallback) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_SEARCH_KEY));
    return Array.isArray(saved) ? saved.slice(0, 10) : fallback;
  } catch {
    return fallback;
  }
}

function saveRecentSearches(searches) {
  window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(searches.slice(0, 10)));
}

function SearchIcon() {
  return <Icon name="search" size={18} />;
}

function SearchHeader({ query, setQuery, onBack, onSubmit, autoFocus = false, storeId, storeName, onClearStore }) {
  return (
    <header className="search-header">
      <button className="search-header__back" type="button" aria-label="뒤로가기" onClick={onBack}><Icon name="back" size={22} /></button>
      <form className="search-input" onSubmit={onSubmit}>
        {storeId ? (
          <button className="search-input__store" type="button" onClick={() => onClearStore(query)} aria-label={`${storeName || '굿즈샵'} 필터 해제`}>
            <span>{storeName || '굿즈샵 확인 중'}</span><span aria-hidden="true">×</span>
          </button>
        ) : <SearchIcon />}
        <input
          type="search"
          value={query}
          placeholder={storeId ? '매장 상품 검색' : '굿즈, 작품, 캐릭터, 굿즈샵 검색'}
          aria-label="통합 검색어"
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button className="search-input__clear" type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}>×</button>
        ) : null}
        {storeId ? <button className="search-input__submit" type="submit" aria-label="검색 실행"><SearchIcon /></button> : null}
      </form>
    </header>
  );
}

function Trend({ item }) {
  if (item.trend === 'new') return <span className="trend trend--new">NEW</span>;
  if (item.trend === 'same') return <span className="trend trend--same">-</span>;

  return (
    <span className={`trend trend--${item.trend}`}>
      {item.trend === 'up' ? '▲' : '▼'} {item.change}
    </span>
  );
}

function AutocompleteList({ query, suggestions, isLoading, onSelect }) {
  if (isLoading) return <p className="autocomplete-status">검색어를 확인하고 있어요.</p>;
  if (!suggestions.length) return <p className="autocomplete-status">일치하는 검색어가 없습니다.</p>;

  return (
    <section className="autocomplete-list" aria-label="자동완성 검색어">
      {suggestions.map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() => onSelect(item)}
        >
          <span className={`autocomplete-tag autocomplete-tag--${item.type}`}>{item.type}</span>
          <span className="autocomplete-copy">
            <strong><HighlightText text={item.label} query={query} /></strong>
            <small><HighlightText text={item.subtitle} query={query} /></small>
          </span>
          <span className="autocomplete-arrow" aria-hidden="true">↗</span>
        </button>
      ))}
    </section>
  );
}

// 검색어가 없을 때 보여주는 최근 검색어와 인기 검색어
function RecentAndPopular({ data, recentSearches, onSelect, onRemove, onClear }) {
  return (
    <>
      <section className="search-section">
        <div className="search-section__heading">
          <h1>최근 검색어</h1>
          {recentSearches.length ? <button type="button" onClick={onClear}>전체 삭제</button> : null}
        </div>
        {recentSearches.length ? (
          <div className="recent-keywords">
            {recentSearches.map((keyword) => (
              <div className="recent-chip" key={keyword}>
                <button type="button" onClick={() => onSelect(keyword)}>{keyword}</button>
                <button type="button" aria-label={`${keyword} 삭제`} onClick={() => onRemove(keyword)}>×</button>
              </div>
            ))}
          </div>
        ) : <p className="search-empty">최근 검색어가 없습니다.</p>}
      </section>

      <section className="search-section popular-searches">
        <div className="search-section__heading">
          <h1>인기 검색어</h1>
          <time>{data.popularUpdatedAt}</time>
        </div>
        {data.popularKeywords.length ? null : <p className="search-empty">아직 집계된 인기 검색어가 없어요.</p>}
        <ol>
          {data.popularKeywords.map((item) => (
            <li key={item.rank}>
              <button type="button" onClick={() => onSelect(item.keyword)}>
                <b>{item.rank}</b>
                <span>{item.keyword}</span>
                <Trend item={item} />
              </button>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export default function SearchPage({
  data,
  initialQuery = '',
  shops = [],
  isAuthenticated = false,
  serverRecentSearches = [],
  onSaveRecentSearch,
  onDeleteRecentSearch,
  onClearRecentSearches,
  onBack,
  onSearch,
  storeId,
  storeName,
  storeError,
  onClearStore,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => (
    isAuthenticated
      ? serverRecentSearches.slice(0, 10)
      : loadRecentSearches(data.defaultRecentSearches)
  ));
  const isTyping = query.trim().length > 0;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }
      try {
        // 결과 화면이 기본으로 품절·입고 예정을 빼므로, 눌렀을 때 결과가 없는 상품이 뜨지 않게 같은 조건으로 찾는다
        const response = await searchApi.products({
          storeId: storeId || undefined,
          q: query.trim(),
          size: 100,
          includeSoldOut: false,
          includeUpcoming: false,
        });
        if (!cancelled) setSuggestions(getAutocompleteSuggestions(query, data, response.data.items, shops, storeId));
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [data, query, shops, storeId]);

  const updateQuery = (value) => {
    setQuery(value);
    setIsLoading(value.trim().length > 0);
  };

  const rememberSearch = (keyword) => {
    const next = [keyword, ...recentSearches.filter((item) => item !== keyword)].slice(0, 10);
    setRecentSearches(next);
    if (isAuthenticated) onSaveRecentSearch?.(keyword);
    else saveRecentSearches(next);
  };

  const runSearch = (keyword) => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword && !storeId) return;
    if (normalizedKeyword) rememberSearch(normalizedKeyword);
    onSearch(normalizedKeyword);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runSearch(query);
  };

  const removeRecent = (keyword) => {
    const next = recentSearches.filter((item) => item !== keyword);
    setRecentSearches(next);
    if (isAuthenticated) onDeleteRecentSearch?.(keyword);
    else saveRecentSearches(next);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    if (isAuthenticated) onClearRecentSearches?.();
    else saveRecentSearches([]);
  };

  const selectSuggestion = (item) => runSearch(item.searchValue ?? item.label);

  return (
    <div className="search-shell">
      <SearchHeader
        query={query}
        setQuery={updateQuery}
        onBack={onBack}
        onSubmit={handleSubmit}
        autoFocus
        storeId={storeId}
        storeName={storeName}
        onClearStore={onClearStore}
      />

      <main className="search-main">
        {storeError ? <p className="search-store-error" role="alert">{storeError}</p> : null}
        {isTyping ? (
          <AutocompleteList
            query={query}
            suggestions={suggestions}
            isLoading={isLoading}
            onSelect={selectSuggestion}
          />
        ) : <>
        <RecentAndPopular
          data={data}
          recentSearches={recentSearches}
          onSelect={runSearch}
          onRemove={removeRecent}
          onClear={clearRecent}
        />
        </>}
      </main>
      <BottomNavigation />
    </div>
  );
}

function matchesRegion(location, region) {
  if (!location || !region) return false;
  if (location.address) {
    const address = location.address.toLocaleLowerCase('ko-KR');
    return (!region.sido || address.includes(region.sido.slice(0, 2).toLocaleLowerCase('ko-KR')))
      && (!region.sigungu || address.includes(region.sigungu.toLocaleLowerCase('ko-KR')))
      && (!region.area || address.includes(region.area.toLocaleLowerCase('ko-KR')));
  }
  return (!region.sido || location.sido === region.sido)
    && (!region.sigungu || location.sigungu === region.sigungu)
    && (!region.area || location.area === region.area);
}

// 카테고리·굿즈샵 상세와 같은 상품 카드. 샵 이름을 누르면 매장으로 이동한다.
function ResultProductCard({ product, currentShopId }) {
  const location = useLocation();
  return (
    <GoodsListCard
      item={product}
      shopSuffix={currentShopId && product.storeId === currentShopId ? ' · 지금 보는 굿즈샵' : ''}
      linkState={{ listReturnTo: `${location.pathname}${location.search}`, storeId: product.storeId, storeName: product.storeName }}
    />
  );
}

function ProductSortMenu({ sort, onSortChange }) {
  const [open, setOpen] = useState(false);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!menu.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  return (
    <div className="result-sort" ref={menu}>
      <button type="button" aria-label="굿즈 정렬" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)}>{PRODUCT_SORT_OPTIONS.find(([value]) => value === sort)?.[1] || '인기순'}<span className="sort-chevron" aria-hidden="true" /></button>
      {open && <div className="result-sort__menu" role="menu">{PRODUCT_SORT_OPTIONS.map(([value, label]) => <button type="button" role="menuitemradio" aria-checked={sort === value} key={value} onClick={() => { onSortChange(value); setOpen(false); }}>{label}{sort === value && <span aria-hidden="true">✓</span>}</button>)}</div>}
    </div>
  );
}

function ScopedResults({
  query, storeName, storeId, products, totalCount, loading, error, sort, page,
  onSortChange, onPageChange, onRetry, filterState, onFilterChange,
}) {
  return (
    <main className="search-results">
      <h1>{query ? <>{storeName || '굿즈샵'} 내 <span>'{query}'</span> 검색 결과</> : `${storeName || '굿즈샵'} 판매 상품 전체보기`}</h1>
      {loading ? <p className="search-result-status">상품을 불러오는 중입니다.</p> : error ? (
        <div className="search-result-status" role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>다시 시도</button>
        </div>
      ) : <>
        <section className="integrated-products">
          <div className="result-heading">
            <h2>굿즈 <span>{totalCount}</span></h2>
            <ProductSortMenu sort={sort} onSortChange={onSortChange} />
          </div>
          <IntegratedSearchFilters filters={filterState} onChange={onFilterChange} query={query} storeId={storeId} sort={sort} />
          {totalCount === 0 ? (
            <section className="no-search-results">
              <div className="no-search-results__icon" aria-hidden="true"><SearchIcon /></div>
              <h2>{query ? `‘${query}’에 대한 매장 상품이 없어요` : '판매상품이 없습니다.'}</h2>
              {query ? <p>다른 검색어나 필터 조건으로 다시 찾아보세요.</p> : null}
            </section>
          ) : (
            <div className="goods-grid" aria-label="굿즈샵 상품 검색 결과">
              {products.map((product) => (
                <ResultProductCard product={product} key={product.storeProductId} />
              ))}
            </div>
          )}
          {totalCount > 20 ? <nav className="search-pagination" aria-label="상품 페이지">
            <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>이전</button>
            <span>{page} / {Math.ceil(totalCount / 20)}</span>
            <button type="button" disabled={page * 20 >= totalCount} onClick={() => onPageChange(page + 1)}>다음</button>
          </nav> : null}
        </section>
      </>}
    </main>
  );
}

export function SearchResultsPage({
  initialQuery,
  data,
  products,
  productTotalCount,
  shops,
  similarShopIds,
  similarBasis,
  currentShopId,
  initialResultType,
  onBack,
  onSearch,
  onLogSearch,
  storeId,
  storeName,
  storeError,
  scopedLoading,
  scopedTotalCount,
  globalLoading,
  globalError,
  showTabsWhenEmpty = false,
  hasActiveFilters = false,
  regionEnabled,
  useNationwideFallback,
  sort,
  page,
  onRetry,
  onClearStore,
  onSortChange,
  onPageChange,
  onDisableRegion,
  onEnableRegion,
  filterState,
  onFilterChange,
  filterQuery,
  filterRegion,
}) {
  const wish = useWishlist();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resultType, setResultType] = useState(initialResultType ?? 'all');
  const loggedSearch = useRef(null);
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches(data.defaultRecentSearches));
  // 입력창을 직접 고친 뒤에는 현재 검색어와 같은 글자(예: 서 → 서면)여도 자동완성을 보여준다.
  const [typed, setTyped] = useState(false);
  const isEditing = typed || query.trim() !== initialQuery.trim();
  const parsedQuery = parseRegionalQuery(initialQuery, data);
  const keywordTokens = (regionEnabled ? parsedQuery.keyword : initialQuery)
    .toLocaleLowerCase('ko-KR')
    .split(/\s+/)
    .filter(Boolean);
  const nationwideShops = shops.filter((shop) => (
    !keywordTokens.length || matchesTokens([shop.name, shop.address, ...(shop.categoryNames ?? [])], keywordTokens)
  ));
  const regionalShops = parsedQuery.region
    ? nationwideShops.filter((shop) => matchesRegion(shop, parsedQuery.region))
    : nationwideShops;
  const matchedShops = similarShopIds
    ? shops.filter((shop) => similarShopIds.includes(shop.id))
    : regionEnabled && parsedQuery.region && !useNationwideFallback
      ? regionalShops
      : nationwideShops;
  const totalResultCount = storeId ? scopedTotalCount : productTotalCount + matchedShops.length;
  const hasNoResults = totalResultCount === 0;
  useEffect(() => {
    if (!initialQuery || scopedLoading || globalLoading || storeError || globalError) return;
    const logKey = `${storeId ?? ''}:${initialQuery}:${totalResultCount}:${parsedQuery.region?.id ?? ''}`;
    if (loggedSearch.current === logKey) return;
    loggedSearch.current = logKey;
    onLogSearch?.({
      query: initialQuery,
      resultCount: totalResultCount,
      regionId: null,
    });
  }, [globalError, globalLoading, initialQuery, onLogSearch, parsedQuery.region?.id, scopedLoading, storeError, storeId, totalResultCount]);

  useEffect(() => {
    if (!isEditing) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }
      try {
        // 결과 화면이 기본으로 품절·입고 예정을 빼므로, 눌렀을 때 결과가 없는 상품이 뜨지 않게 같은 조건으로 찾는다
        const response = await searchApi.products({
          storeId: storeId || undefined,
          q: query.trim(),
          size: 100,
          includeSoldOut: false,
          includeUpcoming: false,
        });
        if (!cancelled) setSuggestions(getAutocompleteSuggestions(query, data, response.data.items, shops, storeId));
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [data, isEditing, query, shops, storeId]);

  const updateQuery = (value) => {
    setQuery(value);
    setTyped(true);
    setIsLoading(value.trim().length > 0);
  };

  const rememberSearch = (keyword) => {
    const next = [keyword, ...recentSearches.filter((item) => item !== keyword)].slice(0, 10);
    setRecentSearches(next);
    saveRecentSearches(next);
  };

  const runSearch = (keyword) => {
    const nextKeyword = keyword.trim();
    if (!nextKeyword && !storeId) return;
    if (nextKeyword) rememberSearch(nextKeyword);
    setTyped(false);
    onSearch(nextKeyword);
  };

  const removeRecent = (keyword) => {
    const next = recentSearches.filter((item) => item !== keyword);
    setRecentSearches(next);
    saveRecentSearches(next);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    saveRecentSearches([]);
  };

  const selectSuggestion = (item) => runSearch(item.searchValue ?? item.label);

  const handleSubmit = (event) => {
    event.preventDefault();
    runSearch(query);
  };

  return (
    <div className="search-shell">
      <SearchHeader query={query} setQuery={updateQuery} onBack={onBack} onSubmit={handleSubmit} storeId={storeId} storeName={storeName} onClearStore={onClearStore} />
      {storeId && !isEditing ? (
        <ScopedResults
          query={initialQuery}
          storeName={storeName}
          storeId={storeId}
          products={products}
          totalCount={scopedTotalCount}
          loading={scopedLoading}
          error={storeError}
          sort={sort}
          page={page}
          onSortChange={onSortChange}
          onPageChange={onPageChange}
          onRetry={onRetry}
          filterState={filterState}
          onFilterChange={onFilterChange}
        />
      ) : isEditing ? (
        <main className="search-main">
          {query.trim() ? (
            <AutocompleteList
              query={query}
              suggestions={suggestions}
              isLoading={isLoading}
              onSelect={selectSuggestion}
            />
          ) : storeId ? <p className="autocomplete-status">검색어를 입력해 주세요.</p> : (
            <RecentAndPopular
              data={data}
              recentSearches={recentSearches}
              onSelect={runSearch}
              onRemove={removeRecent}
              onClear={clearRecent}
            />
          )}
        </main>
      ) : globalLoading ? (
        <main className="search-results"><p className="search-result-status">검색 결과를 불러오는 중입니다.</p></main>
      ) : globalError ? (
        <main className="search-results"><div className="search-result-status" role="alert"><p>{globalError}</p><button type="button" onClick={onRetry}>다시 시도</button></div></main>
      ) : <main className="search-results">
        {(!hasNoResults || showTabsWhenEmpty || hasActiveFilters) ? <div className="result-type-tabs" role="tablist" aria-label="검색 결과 종류">
          <button className={resultType === 'all' ? 'active' : ''} role="tab" aria-selected={resultType === 'all'} type="button" onClick={() => setResultType('all')}>전체</button>
          <button className={resultType === 'products' ? 'active' : ''} role="tab" aria-selected={resultType === 'products'} type="button" onClick={() => setResultType('products')}>굿즈 {productTotalCount}</button>
          <button className={resultType === 'shops' ? 'active' : ''} role="tab" aria-selected={resultType === 'shops'} type="button" onClick={() => setResultType('shops')}>굿즈샵 {matchedShops.length}</button>
        </div> : null}

        {similarBasis ? (
          <div className="region-notice">
            <span aria-hidden="true">≈</span>
            <p>‘{similarBasis}’와 같거나 비슷한 상품 기준이에요.</p>
          </div>
        ) : null}

        {parsedQuery.region && regionEnabled ? (
          <div className={useNationwideFallback ? 'region-notice region-notice--fallback' : 'region-notice'}>
            <span aria-hidden="true">⌖</span>
            <p>
              {useNationwideFallback
                ? `${parsedQuery.region.label}에는 '${parsedQuery.keyword}'이(가) 없어 전국 결과를 보여드려요.`
                : `${parsedQuery.region.label} 지역의 결과예요.`}
            </p>
            {useNationwideFallback ? null : (
              <button type="button" onClick={onDisableRegion}>전국에서 보기</button>
            )}
          </div>
        ) : null}

        {parsedQuery.region && regionEnabled && !useNationwideFallback && !hasNoResults ? (
          <div className="applied-region-chip">
            <span>{parsedQuery.region.label}</span>
            <button type="button" aria-label={`${parsedQuery.region.label} 지역 필터 해제`} onClick={onDisableRegion}>×</button>
          </div>
        ) : null}

        {parsedQuery.region && !regionEnabled && onEnableRegion ? (
          <div className="applied-region-chip">
            <span>{initialQuery.trim()}</span>
            <button type="button" aria-label={`${parsedQuery.region.label} 지역 결과로 돌아가기`} onClick={onEnableRegion}>×</button>
          </div>
        ) : null}

        {hasNoResults && !hasActiveFilters ? (
          <section className="no-search-results">
            <div className="no-search-results__icon" aria-hidden="true"><SearchIcon /></div>
            <h2>‘{initialQuery}’에 대한<br />검색 결과가 없어요</h2>
            <p>띄어쓰기나 철자를 확인해 보세요<br />더 짧은 단어로 검색해 보세요</p>
            {data.popularKeywords.length ? <div className="no-search-results__popular">
              <h3>인기 검색어로 다시 찾아보세요</h3>
              <div>
                {data.popularKeywords.slice(0, 5).map((item) => (
                  <button type="button" key={item.rank} onClick={() => onSearch(item.keyword)}>
                    {item.keyword}
                  </button>
                ))}
              </div>
            </div> : null}
          </section>
        ) : null}

        {!hasNoResults && resultType !== 'products' ? <section className={`integrated-shops ${resultType === 'shops' ? 'integrated-shops--only' : ''}`}>
          {resultType === 'all' && <div className="result-heading"><h2>굿즈샵 <span>{matchedShops.length}</span></h2><button type="button" onClick={() => setResultType('shops')}>굿즈샵 더보기 ›</button></div>}
          {resultType === 'all' ? (
            <div className="integrated-shops__list">
              {matchedShops.map((shop) => (
                <div className="result-shop-item" key={shop.id}>
                  <Link className="result-shop" to={`/stores/${shop.id}`}>
                    <span className="result-shop__icon"><Icon name="store" size={19} /></span>
                    <span className="result-shop__copy">
                      <strong>{shop.name}</strong>
                      <small><Icon name="pin" size={10} />{shop.region || shop.address}</small>
                    </span>
                  </Link>
                  <button type="button" className={`result-shop__heart${wish.isShopWished(shop.id) ? ' is-wished' : ''}`} aria-pressed={wish.isShopWished(shop.id)} aria-label={`${shop.name} 찜하기`} onClick={() => wish.toggleShop(shop.id)}>
                    <Icon name="heart" size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <SearchShopList shops={matchedShops} currentShopId={currentShopId} />
          )}
          {!matchedShops.length ? <p className="result-empty">일치하는 굿즈샵이 없습니다.</p> : null}
        </section> : null}

        {(!hasNoResults || hasActiveFilters) && resultType !== 'shops' ? <section className="integrated-products">
          <div className="result-heading">
            <h2>굿즈 <span>{productTotalCount}</span></h2>
            <ProductSortMenu sort={sort} onSortChange={onSortChange} />
          </div>
          {filterState && <IntegratedSearchFilters filters={filterState} onChange={onFilterChange} query={filterQuery} region={filterRegion} sort={sort} />}
          {products.length ? (
            <div className="goods-grid">
              {products.map((product) => (
                <ResultProductCard product={product} key={product.storeProductId} currentShopId={currentShopId} />
              ))}
            </div>
          ) : <p className="result-empty">일치하는 상품이 없습니다.</p>}
          {productTotalCount > 20 ? <nav className="search-pagination" aria-label="상품 페이지">
            <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>이전</button>
            <span>{page} / {Math.ceil(productTotalCount / 20)}</span>
            <button type="button" disabled={page * 20 >= productTotalCount} onClick={() => onPageChange(page + 1)}>다음</button>
          </nav> : null}
        </section> : null}

      </main>}
      <BottomNavigation />
    </div>
  );
}
