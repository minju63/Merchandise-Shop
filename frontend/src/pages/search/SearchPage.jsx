import { useEffect, useRef, useState } from 'react';
import './SearchPage.css';

const RECENT_SEARCH_KEY = 'goodzpick.recentSearches';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function matchesTokens(values, tokens) {
  const target = values.filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
  return tokens.every((token) => target.includes(token));
}

function getAutocompleteSuggestions(query, data) {
  const tokens = query.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const regionItems = data.regions
    .filter((region) => {
      const names = [region.label, region.displayName, ...region.aliases]
        .map((name) => name.toLocaleLowerCase('ko-KR'));
      const matchesQuery = tokens.some((token) => names.some((name) => name.includes(token)));
      const hasResults = data.shops.some((shop) => matchesRegion(shop, region))
        || data.searchProducts.some((product) => matchesRegion(product.location, region));
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

  const entityItems = data.autocompleteItems.filter((item) => (
    matchesTokens([item.label, item.subtitle, ...(item.searchTerms ?? [])], tokens)
  ));

  return [...regionItems, ...entityItems].slice(0, 8);
}

function parseRegionalQuery(query, data) {
  const normalized = query.trim();
  const lowerQuery = normalized.toLocaleLowerCase('ko-KR');
  const exactEntity = data.autocompleteItems.some((item) => (
    ['작품', '굿즈샵'].includes(item.type)
    && item.label.toLocaleLowerCase('ko-KR') === lowerQuery
  ));

  if (exactEntity) return { region: null, keyword: normalized };

  const regionNames = data.regions.flatMap((region) => (
    [region.label, region.displayName, ...region.aliases].map((name) => ({
      name: name.toLocaleLowerCase('ko-KR'),
      region,
    }))
  ));
  const exactRegion = regionNames.find(({ name }) => name === lowerQuery);
  if (exactRegion) return { region: exactRegion.region, keyword: '' };

  const words = normalized.split(/\s+/).filter(Boolean);
  const regionalWordIndex = words.findIndex((word) => (
    regionNames.some(({ name }) => name === word.toLocaleLowerCase('ko-KR'))
  ));

  if (regionalWordIndex >= 0) {
    const matched = regionNames.find(({ name }) => (
      name === words[regionalWordIndex].toLocaleLowerCase('ko-KR')
    ));
    return {
      region: matched.region,
      keyword: words.filter((_, index) => index !== regionalWordIndex).join(' '),
    };
  }

  if (words.length === 1) {
    const prefix = regionNames
      .filter(({ name }) => lowerQuery.startsWith(name) && lowerQuery.length > name.length)
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (prefix) {
      return { region: prefix.region, keyword: normalized.slice(prefix.name.length).trim() };
    }
  }

  return { region: null, keyword: normalized };
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
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function SearchHeader({ query, setQuery, onBack, onSubmit, autoFocus = false }) {
  return (
    <header className="search-header">
      <button className="search-header__back" type="button" aria-label="뒤로가기" onClick={onBack}>‹</button>
      <form className="search-input" onSubmit={onSubmit}>
        <SearchIcon />
        <input
          type="search"
          value={query}
          placeholder="굿즈, 작품, 캐릭터, 굿즈샵 검색"
          aria-label="통합 검색어"
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button className="search-input__clear" type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}>×</button>
        ) : null}
      </form>
    </header>
  );
}

function SearchTabBar({ onHome }) {
  const tabs = [
    ['⌂', '홈'], ['▣', '굿즈샵'], ['▦', '카테고리'], ['♡', '찜'], ['♙', '마이'],
  ];

  return (
    <nav className="search-tabbar" aria-label="하단 메뉴">
      {tabs.map(([icon, label]) => (
        <button
          className={label === '홈' ? 'home-enabled' : ''}
          type="button"
          key={label}
          disabled={label !== '홈'}
          onClick={label === '홈' ? onHome : undefined}
        >
          <span aria-hidden="true">{icon}</span><small>{label}</small>
        </button>
      ))}
    </nav>
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
          disabled={item.type === '굿즈샵'}
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

export default function SearchPage({
  data,
  isAuthenticated = false,
  serverRecentSearches = [],
  onSaveRecentSearch,
  onDeleteRecentSearch,
  onClearRecentSearches,
  onBack,
  onSearch,
  onHome,
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => (
    isAuthenticated
      ? serverRecentSearches.slice(0, 10)
      : loadRecentSearches(data.defaultRecentSearches)
  ));
  const isTyping = query.trim().length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSuggestions(getAutocompleteSuggestions(query, data));
      setIsLoading(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [data, query]);

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
    if (!normalizedKeyword) return;
    rememberSearch(normalizedKeyword);
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
      />

      <main className="search-main">
        {isTyping ? (
          <AutocompleteList
            query={query}
            suggestions={suggestions}
            isLoading={isLoading}
            onSelect={selectSuggestion}
          />
        ) : <>
        <section className="search-section">
          <div className="search-section__heading">
            <h1>최근 검색어</h1>
            {recentSearches.length ? <button type="button" onClick={clearRecent}>전체 삭제</button> : null}
          </div>
          {recentSearches.length ? (
            <div className="recent-keywords">
              {recentSearches.map((keyword) => (
                <div className="recent-chip" key={keyword}>
                  <button type="button" onClick={() => runSearch(keyword)}>{keyword}</button>
                  <button type="button" aria-label={`${keyword} 삭제`} onClick={() => removeRecent(keyword)}>×</button>
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
          <ol>
            {data.popularKeywords.map((item) => (
              <li key={item.rank}>
                <button type="button" onClick={() => runSearch(item.keyword)}>
                  <b>{item.rank}</b>
                  <span>{item.keyword}</span>
                  <Trend item={item} />
                </button>
              </li>
            ))}
          </ol>
        </section>
        </>}
      </main>
      <SearchTabBar onHome={onHome} />
    </div>
  );
}

function matchesRegion(location, region) {
  if (!location || !region) return false;
  return (!region.sido || location.sido === region.sido)
    && (!region.sigungu || location.sigungu === region.sigungu)
    && (!region.area || location.area === region.area);
}

export function SearchResultsPage({
  initialQuery,
  data,
  products,
  onBack,
  onSearch,
  onLogSearch,
  onHome,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [regionEnabled, setRegionEnabled] = useState(true);
  const [resultType, setResultType] = useState('all');
  const loggedSearch = useRef(null);
  const isEditing = query.trim() !== initialQuery.trim();
  const parsedQuery = parseRegionalQuery(initialQuery, data);
  const keywordTokens = parsedQuery.keyword
    .toLocaleLowerCase('ko-KR')
    .split(/\s+/)
    .filter(Boolean);
  const nationwideProducts = products.filter((product) => (
    !keywordTokens.length
    || matchesTokens(
      [product.name, product.shop, product.category, product.work, product.character],
      keywordTokens
    )
  ));
  const regionalProducts = parsedQuery.region
    ? nationwideProducts.filter((product) => matchesRegion(product.location, parsedQuery.region))
    : nationwideProducts;
  const useNationwideFallback = Boolean(
    regionEnabled
    && parsedQuery.region
    && parsedQuery.keyword
    && regionalProducts.length === 0
  );
  const matchedProducts = regionEnabled && parsedQuery.region && !useNationwideFallback
    ? regionalProducts
    : nationwideProducts;
  const nationwideShops = data.shops.filter((shop) => (
    !keywordTokens.length || matchesTokens([shop.name, shop.address, ...shop.categories], keywordTokens)
  ));
  const regionalShops = parsedQuery.region
    ? nationwideShops.filter((shop) => matchesRegion(shop, parsedQuery.region))
    : nationwideShops;
  const matchedShops = regionEnabled && parsedQuery.region && !useNationwideFallback
    ? regionalShops
    : nationwideShops;
  const totalResultCount = matchedProducts.length + matchedShops.length;
  const hasNoResults = totalResultCount === 0;

  useEffect(() => {
    const logKey = `${initialQuery}:${totalResultCount}:${parsedQuery.region?.id ?? ''}`;
    if (loggedSearch.current === logKey) return;
    loggedSearch.current = logKey;
    onLogSearch?.({
      query: initialQuery,
      resultCount: totalResultCount,
      regionId: parsedQuery.region?.id ?? null,
    });
  }, [initialQuery, onLogSearch, parsedQuery.region?.id, totalResultCount]);

  useEffect(() => {
    if (!isEditing) return undefined;

    const timer = window.setTimeout(() => {
      setSuggestions(getAutocompleteSuggestions(query, data));
      setIsLoading(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [data, isEditing, query]);

  const updateQuery = (value) => {
    setQuery(value);
    setIsLoading(value.trim().length > 0 && value.trim() !== initialQuery.trim());
  };

  const selectSuggestion = (item) => onSearch(item.searchValue ?? item.label);

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery) onSearch(nextQuery);
  };

  return (
    <div className="search-shell">
      <SearchHeader query={query} setQuery={updateQuery} onBack={onBack} onSubmit={handleSubmit} />
      {isEditing ? (
        <main className="search-main">
          {query.trim() ? (
            <AutocompleteList
              query={query}
              suggestions={suggestions}
              isLoading={isLoading}
              onSelect={selectSuggestion}
            />
          ) : <p className="autocomplete-status">검색어를 입력해 주세요.</p>}
        </main>
      ) : <main className="search-results">
        <h1><span>‘{initialQuery}’</span> 검색 결과</h1>

        {!hasNoResults ? <div className="result-type-tabs" role="tablist" aria-label="검색 결과 종류">
          <button className={resultType === 'all' ? 'active' : ''} type="button" onClick={() => setResultType('all')}>전체</button>
          <button className={resultType === 'products' ? 'active' : ''} type="button" onClick={() => setResultType('products')}>굿즈 {matchedProducts.length}</button>
          <button className={resultType === 'shops' ? 'active' : ''} type="button" onClick={() => setResultType('shops')}>굿즈샵 {matchedShops.length}</button>
        </div> : null}

        {parsedQuery.region && regionEnabled ? (
          <div className={useNationwideFallback ? 'region-notice region-notice--fallback' : 'region-notice'}>
            <span aria-hidden="true">⌖</span>
            <p>
              {useNationwideFallback
                ? `${parsedQuery.region.label}에는 '${parsedQuery.keyword}'이(가) 없어 전국 결과를 보여드려요.`
                : `${parsedQuery.region.label} 지역의 결과예요.`}
            </p>
            {useNationwideFallback ? null : (
              <button type="button" onClick={() => setRegionEnabled(false)}>전국에서 보기</button>
            )}
          </div>
        ) : null}

        {parsedQuery.region && regionEnabled && !useNationwideFallback && !hasNoResults ? (
          <div className="applied-region-chip">
            <span>{parsedQuery.region.label}</span>
            <button type="button" aria-label={`${parsedQuery.region.label} 지역 필터 해제`} onClick={() => setRegionEnabled(false)}>×</button>
          </div>
        ) : null}

        {hasNoResults ? (
          <section className="no-search-results">
            <div className="no-search-results__icon" aria-hidden="true"><SearchIcon /></div>
            <h2>‘{initialQuery}’에 대한 검색 결과가 없어요</h2>
            <p>검색어의 띄어쓰기와 철자를 확인하거나<br />더 짧은 단어로 다시 검색해 보세요.</p>
            <div className="no-search-results__popular">
              <h3>인기 검색어로 다시 찾아보세요</h3>
              <div>
                {data.popularKeywords.slice(0, 5).map((item) => (
                  <button type="button" key={item.rank} onClick={() => onSearch(item.keyword)}>
                    {item.keyword}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {!hasNoResults && resultType !== 'shops' ? <section>
          <div className="result-heading"><h2>상품</h2><span>{matchedProducts.length}</span></div>
          {matchedProducts.length ? (
            <div className="result-list">
              {matchedProducts.map((product) => (
                <button className="result-product" type="button" key={product.id} disabled>
                  <span className="result-product__image" style={{ '--result-color': product.accent }}>
                    {product.category}
                  </span>
                  <span className="result-product__content">
                    <small>{product.shop}</small><strong>{product.name}</strong><b>{product.price}</b>
                  </span>
                </button>
              ))}
            </div>
          ) : <p className="result-empty">일치하는 상품이 없습니다.</p>}
        </section> : null}

        {!hasNoResults && resultType !== 'products' ? <section>
          <div className="result-heading"><h2>굿즈샵</h2><span>{matchedShops.length}</span></div>
          {matchedShops.map((shop) => (
            <button className="result-shop" type="button" key={shop.id} disabled>
              <span>G</span><strong>{shop.name}</strong><small>{shop.area}</small>
            </button>
          ))}
          {!matchedShops.length ? <p className="result-empty">일치하는 굿즈샵이 없습니다.</p> : null}
        </section> : null}
      </main>}
      <SearchTabBar onHome={onHome} />
    </div>
  );
}
