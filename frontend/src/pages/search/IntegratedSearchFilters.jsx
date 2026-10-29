import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../../api/search.api.js';
import {
  EMPTY_FILTERS,
  PRICE_PRESETS,
  REGIONS,
  chipsFor,
  filterParams,
  toggleArray,
} from './searchFilters.js';
import useDragScroll from '../../hooks/useDragScroll.js';
import ProductBrandFilter from '../category/components/ProductBrandFilter.jsx';
import './IntegratedSearchFilters.css';

const TABS = [
  ['category', '카테고리'],
  ['goods', '굿즈 종류'],
  ['brand', '브랜드'],
  ['price', '가격'],
  ['region', '지역'],
  ['reviews', '후기/찜'],
  ['sale', '판매유형'],
];
function CheckGrid({ items, values, onChange, all = false }) {
  return (
    <div className="search-filter-grid">
      {all && (
        <button
          type="button"
          className={!values.length ? 'selected' : ''}
          onClick={() => onChange([])}
        >
          <span className="filter-box">{!values.length ? '✓' : ''}</span>전체
        </button>
      )}
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={values.includes(item.id) ? 'selected' : ''}
          onClick={() => onChange(toggleArray(values, item.id))}
        >
          <span className="filter-box">{values.includes(item.id) ? '✓' : ''}</span>
          {item.name}
        </button>
      ))}
    </div>
  );
}

function RadioGrid({ items, value, onChange, disabled = false }) {
  return (
    <div className="search-filter-grid">
      {items.map((item) => (
        <button
          type="button"
          disabled={disabled}
          key={item.id}
          className={value === item.id ? 'selected' : ''}
          onClick={() => onChange(item)}
        >
          <span className="filter-radio" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function FilterSheet({ applied, categories, query, region, storeId, sort, onApply, onClose }) {
  const dialog = useRef(null);
  const touchStart = useRef(null);
  const [draft, setDraft] = useState(() => ({
    ...applied,
    contentCategories: [...applied.contentCategories],
    goodsCategories: [...applied.goodsCategories],
    regions: [...applied.regions],
    discountBands: [...applied.discountBands],
  }));
  const [tab, setTab] = useState('category');
  const tabsRef = useRef(null);
  useDragScroll(tabsRef);
  const [error, setError] = useState('');
  const chips = chipsFor(draft, categories);
  const goodsCategories = categories
    .filter((item) => item.type === 'GOODS')
    .sort((a, b) => Number(a.name === '기타 굿즈') - Number(b.name === '기타 굿즈'));
  const validAmount = (value) =>
    value === '' || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)));
  const invalidPrice =
    !validAmount(draft.minPrice) ||
    !validAmount(draft.maxPrice) ||
    Boolean(draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice));
  const params = { storeId, q: query, region, sort, size: 1, ...filterParams(draft) };
  const preview = useQuery({
    queryKey: ['search-filter-preview', params],
    queryFn: () => searchApi.products(params),
    enabled: !invalidPrice,
    retry: false,
  });
  const base = useQuery({
    queryKey: ['search-filter-base', storeId, query, region, sort],
    queryFn: () => searchApi.products({ storeId, q: query, region, sort, size: 1 }),
    retry: false,
  });
  const distribution = base.data?.data?.priceDistribution;
  const priceMin = distribution?.min ?? 0;
  const priceMax = distribution?.max ?? 0;
  const sliderMax = Math.max(priceMax, priceMin + 10000);
  const sliderMinValue = Math.min(
    sliderMax,
    Math.max(priceMin, Number(draft.minPrice || priceMin))
  );
  const sliderMaxValue = Math.min(
    sliderMax,
    Math.max(priceMin, Number(draft.maxPrice || sliderMax))
  );
  const sliderStyle = {
    '--from': `${((sliderMinValue - priceMin) / (sliderMax - priceMin)) * 100}%`,
    '--to': `${((sliderMaxValue - priceMin) / (sliderMax - priceMin)) * 100}%`,
  };
  const update = (part) => {
    setDraft((current) => ({ ...current, ...part }));
    setError('');
  };
  const selectPreset = (item) =>
    update({ minPrice: item.min, maxPrice: item.max, pricePreset: item.id });
  const updatePrice = (name, value) => update({ [name]: value, pricePreset: 'custom' });

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, []);

  const sectionFlags = {
    category: draft.contentCategories.length,
    goods: draft.goodsCategories.length,
    price: Number(
      Boolean(draft.minPrice || draft.maxPrice || draft.discountOnly || draft.discountBands.length)
    ),
    region: draft.regions.length,
    brand: draft.brands.length,
    reviews: Number(Boolean(draft.ratingMin || draft.wishlistMin)),
    sale: Number(
      draft.inStock || draft.pickup || draft.delivery || draft.includeSoldOut || draft.includeUpcoming
    ),
  };
  return (
    <dialog
      ref={dialog}
      className="search-filter-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      aria-label="굿즈 필터"
    >
      <div className="search-filter-sheet">
        <header
          className="search-filter-header"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            if (
              touchStart.current !== null &&
              event.changedTouches[0]?.clientY - touchStart.current > 80
            )
              onClose();
            touchStart.current = null;
          }}
        >
          <h2>필터</h2>
          <button type="button" aria-label="필터 닫기" onClick={onClose}>
            ×
          </button>
        </header>
        <nav className="search-filter-tabs" aria-label="필터 종류" ref={tabsRef}>
          {TABS.map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              {label}
              {sectionFlags[id] ? <i aria-label="조건 설정됨" /> : null}
            </button>
          ))}
        </nav>
        {chips.length ? (
          <div className="search-filter-summary">
            <div>
              {chips.map((chip) => (
                <button type="button" key={chip.key} onClick={() => setDraft(chip.remove)}>
                  {chip.label} ×
                </button>
              ))}
            </div>
            <button
              type="button"
              className="search-filter-clear"
              onClick={() => setDraft({ ...EMPTY_FILTERS })}
            >
              초기화
            </button>
          </div>
        ) : null}
        <div className="search-filter-content">
          {tab === 'category' && (
            <section>
              <h3>카테고리</h3>
              <CheckGrid
                all
                items={categories.filter((item) => item.type === 'CONTENT')}
                values={draft.contentCategories}
                onChange={(value) => update({ contentCategories: value })}
              />
            </section>
          )}
          {tab === 'goods' && (
            <section>
              <h3>굿즈 종류</h3>
              <CheckGrid
                all
                items={goodsCategories}
                values={draft.goodsCategories}
                onChange={(value) => update({ goodsCategories: value })}
              />
            </section>
          )}
          {tab === 'price' && (
            <>
              <section>
                <h3>가격</h3>
                <div className="search-filter-price-inputs">
                  <label>
                    <span className="search-filter-sr-only">최소 금액</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="최소 금액"
                      value={draft.minPrice}
                      onChange={(event) => updatePrice('minPrice', event.target.value)}
                    />
                  </label>
                  <span>~</span>
                  <label>
                    <span className="search-filter-sr-only">최대 금액</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="최대 금액"
                      value={draft.maxPrice}
                      onChange={(event) => updatePrice('maxPrice', event.target.value)}
                    />
                  </label>
                </div>
                {invalidPrice && (
                  <p className="search-filter-error" role="alert">
                    가격은 0 이상의 정수로 입력하고 최소·최대 금액을 확인해 주세요.
                  </p>
                )}
                {distribution && distribution.bins.some(Boolean) ? (
                  <div className="search-price-chart" aria-label="실제 판매가격 분포">
                    {distribution.bins.map((count, index) => (
                      <span
                        key={index}
                        style={{
                          height: count
                            ? `${Math.max(4, (count / Math.max(...distribution.bins)) * 100)}%`
                            : '0%',
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="search-filter-help">표시할 가격 분포가 없습니다.</p>
                )}
                <div className="search-filter-sliders" style={sliderStyle}>
                  <input
                    aria-label="최소 가격"
                    type="range"
                    min={priceMin}
                    max={sliderMax}
                    step="1000"
                    value={sliderMinValue}
                    onChange={(event) => updatePrice('minPrice', event.target.value)}
                  />
                  <input
                    aria-label="최대 가격"
                    type="range"
                    min={priceMin}
                    max={sliderMax}
                    step="1000"
                    value={sliderMaxValue}
                    onChange={(event) => updatePrice('maxPrice', event.target.value)}
                  />
                </div>
                <div className="search-price-scale" aria-hidden="true">
                  <span>{priceMin.toLocaleString('ko-KR')}원</span>
                  <span>{Math.round((priceMin + sliderMax) / 2).toLocaleString('ko-KR')}원</span>
                  <span>{sliderMax.toLocaleString('ko-KR')}원~</span>
                </div>
                <RadioGrid
                  items={PRICE_PRESETS}
                  value={draft.pricePreset}
                  onChange={selectPreset}
                />
              </section>
              <section>
                <h3>할인</h3>
                <CheckGrid
                  items={[{ id: 'discountOnly', name: '할인 중인 굿즈만' }]}
                  values={draft.discountOnly ? ['discountOnly'] : []}
                  onChange={(values) => update({ discountOnly: values.length > 0 })}
                />
              </section>
            </>
          )}
          {tab === 'brand' && (
            <ProductBrandFilter
              selected={draft.brands}
              onChange={(names) => update({ brands: names })}
            />
          )}
          {tab === 'region' && (
            <section>
              <h3>지역 <small>여러 개 선택 가능</small></h3>
              <p className="search-filter-region-hint">검색창에 ‘부산 OO샵’처럼 지역을 함께 입력하면 그 지역이 자동으로 선택돼요.</p>
              <div className="search-region-grid">
                <button
                  type="button"
                  className={!draft.regions.length ? 'selected' : ''}
                  onClick={() => update({ regions: [] })}
                >
                  전체
                </button>
                {REGIONS.map((name) => (
                  <button
                    type="button"
                    key={name}
                    className={draft.regions.includes(name) ? 'selected' : ''}
                    onClick={() => update({ regions: toggleArray(draft.regions, name) })}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </section>
          )}
          {tab === 'reviews' && (
            <>
              <section>
                <h3>후기 별점</h3>
                <RadioGrid
                  items={[
                    { id: '', label: '전체' },
                    ...[3, 3.5, 4, 4.5].map((rating) => ({
                      id: String(rating),
                      label: `별점 ${rating.toFixed(1)} 이상`,
                    })),
                  ]}
                  value={draft.ratingMin}
                  onChange={(item) => update({ ratingMin: item.id })}
                />
              </section>
              <section>
                <h3>찜 개수</h3>
                <RadioGrid
                  items={[
                    { id: '', label: '전체' },
                    ...[10, 50, 100, 500].map((count) => ({
                      id: String(count),
                      label: `찜 ${count}개 이상`,
                    })),
                  ]}
                  value={draft.wishlistMin}
                  onChange={(item) => update({ wishlistMin: item.id })}
                />
              </section>
            </>
          )}
          {tab === 'sale' && (
            <>
              <section>
                <h3>수령 방법</h3>
                <CheckGrid
                  items={[
                    { id: 'pickup', name: '픽업 가능' },
                    { id: 'delivery', name: '배달 가능' },
                  ]}
                  values={['pickup', 'delivery'].filter((key) => draft[key])}
                  onChange={(values) =>
                    update({
                      pickup: values.includes('pickup'),
                      delivery: values.includes('delivery'),
                    })
                  }
                />
              </section>
              <section>
                <h3>판매 상태</h3>
                <CheckGrid
                  items={[
                    { id: 'soldOut', name: '품절 상품 포함' },
                    { id: 'upcoming', name: '입고 예정 상품 포함' },
                  ]}
                  values={[draft.includeSoldOut && 'soldOut', draft.includeUpcoming && 'upcoming'].filter(
                    Boolean
                  )}
                  onChange={(values) =>
                    update({
                      includeSoldOut: values.includes('soldOut'),
                      includeUpcoming: values.includes('upcoming'),
                      // 품절·입고 예정을 포함하면 "재고 있음만 보기"는 자동으로 꺼진다.
                      ...(values.length ? { inStock: false } : {}),
                    })
                  }
                />
              </section>
            </>
          )}
        </div>
        <footer className="search-filter-footer">
          <button
            type="button"
            className="search-filter-apply"
            disabled={invalidPrice || preview.isPending || preview.isError}
            onClick={() => {
              if (invalidPrice) {
                setError('가격 범위를 확인해 주세요.');
                return;
              }
              onApply(draft);
            }}
          >
            {preview.isPending
              ? '결과 계산 중…'
              : `${preview.data?.data.totalCount ?? 0}개의 굿즈 보기`}
          </button>
          {error && <p role="alert">{error}</p>}
          {preview.error && (
            <p role="alert">
              결과 개수를 불러오지 못했습니다.{' '}
              <button type="button" onClick={() => preview.refetch()}>
                다시 시도
              </button>
            </p>
          )}
          {chips.length ? (
            <button
              type="button"
              className="search-filter-reset-apply"
              disabled={base.isPending || base.isError}
              onClick={() => onApply({ ...EMPTY_FILTERS })}
            >
              선택 초기화하고 {base.data?.data.totalCount ?? 0}개의 굿즈 보기
            </button>
          ) : null}
        </footer>
      </div>
    </dialog>
  );
}

export default function IntegratedSearchFilters({ filters, onChange, query, region, storeId, sort }) {
  const [open, setOpen] = useState(false);
  const categoryQuery = useQuery({
    queryKey: ['search-filter-categories'],
    queryFn: async () => {
      const [content, goods] = await Promise.all([
        searchApi.categories('CONTENT'),
        searchApi.categories('GOODS'),
      ]);
      return [...content, ...goods];
    },
    staleTime: 300000,
    retry: false,
  });
  const categories = categoryQuery.data ?? [];
  const chips = chipsFor(filters, categories);
  const setQuick = (key) =>
    onChange(
      key === 'inStock'
        ? { ...filters, inStock: !filters.inStock, includeSoldOut: false, includeUpcoming: false }
        : { ...filters, [key]: !filters[key] }
    );
  return (
    <>
      <div className="search-quick-filters">
        <button
          type="button"
          className={chips.length ? 'has-filters' : ''}
          onClick={() => setOpen(true)}
        >
          ☷ 필터{chips.length ? ` ${chips.length}` : ''}
        </button>
        <button
          type="button"
          className={filters.inStock ? 'selected' : ''}
          onClick={() => setQuick('inStock')}
        >
          {filters.inStock ? '✓ ' : ''}재고 있음
        </button>
        <button
          type="button"
          className={filters.pickup ? 'selected' : ''}
          onClick={() => setQuick('pickup')}
        >
          픽업 가능
        </button>
        <button
          type="button"
          className={filters.delivery ? 'selected' : ''}
          onClick={() => setQuick('delivery')}
        >
          배달 가능
        </button>
      </div>
      {chips.length ? (
        <div className="search-applied-filters">
          {chips.map((chip) => (
            <button type="button" key={chip.key} onClick={() => onChange(chip.remove(filters))}>
              {chip.label} ×
            </button>
          ))}
          <button
            type="button"
            className="search-applied-clear"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
          >
            전체 초기화
          </button>
        </div>
      ) : null}
      {categoryQuery.error && (
        <p className="search-filter-error" role="alert">
          카테고리를 불러오지 못했습니다.{' '}
          <button type="button" onClick={() => categoryQuery.refetch()}>
            다시 시도
          </button>
        </p>
      )}
      {open && (
        <FilterSheet
          applied={filters}
          categories={categories}
          query={query}
          region={region}
          storeId={storeId}
          sort={sort}
          onApply={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
