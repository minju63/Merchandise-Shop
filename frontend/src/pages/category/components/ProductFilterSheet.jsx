import { useEffect, useId, useRef, useState } from 'react';
import { REGIONS } from '../../../constants/regions.js';
import ProductBrandFilter from './ProductBrandFilter.jsx';
import {
  PRODUCT_FILTER_KEYS,
  categoryFilterContext,
  categoryProductQuery,
  SALE_STATUS,
  saleChecks,
  saleStatusFrom,
  saleStatusLabel,
  withSaleStatusDefault,
} from './categoryProductFilters.js';

const PRICE_PRESETS = [
  { label: '전체', min: '', max: '' },
  { label: '1만원 이하', min: '', max: '10000' },
  { label: '1만원 ~ 3만원', min: '10000', max: '30000' },
  { label: '3만원 ~ 5만원', min: '30000', max: '50000' },
  { label: '5만원 ~ 10만원', min: '50000', max: '100000' },
  { label: '10만원 이상', min: '100000', max: '' },
];

const RESET_FILTERS = {
  ...Object.fromEntries(PRODUCT_FILTER_KEYS.map((key) => [key, ''])),
  ...SALE_STATUS.inStock,
};

function RadioChoices({ options, value, onChange }) {
  return <div className="category-filter-choices">
    {options.map((option) => <label key={option.value}>
      <input type="radio" checked={value === option.value} onChange={() => onChange(option.value)} />
      <span>{option.label}</span>
    </label>)}
  </div>;
}

export default function ProductFilterSheet({
  filters,
  regions = [],
  queryKey,
  api,
  client,
  onApply,
  onClose,
  initialSection = 'price',
}) {
  const [draft, setDraft] = useState(() => withSaleStatusDefault({ ...filters }));
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const titleId = useId();
  const tabs = [
    { id: 'price', label: '가격' },
    { id: 'brand', label: '브랜드' },
    { id: 'region', label: '지역' },
    { id: 'reviews', label: '후기/찜' },
    { id: 'sale', label: '판매유형' },
  ];
  const [tab, setTab] = useState(() => tabs.some((item) => item.id === initialSection)
    ? initialSection : tabs[0].id);
  const validAmount = (value) => value === '' || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)));
  const invalidPrice = !validAmount(draft.minPrice) || !validAmount(draft.maxPrice)
    || Boolean(draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice));
  const previewKey = JSON.stringify([queryKey, draft]);
  const [preview, setPreview] = useState({ key: null, count: null, error: null });
  const [distribution, setDistribution] = useState(null);
  const priceMin = distribution?.min ?? 0;
  const priceMax = distribution?.max ?? 0;
  const sliderMax = Math.max(priceMax, priceMin + 10000, Number(draft.minPrice) || 0, Number(draft.maxPrice) || 0);
  const sliderMinValue = Math.min(sliderMax, Math.max(priceMin, Number(draft.minPrice || priceMin)));
  const sliderMaxValue = Math.min(sliderMax, Math.max(priceMin, Number(draft.maxPrice || sliderMax)));
  const sliderStyle = {
    '--from': `${((sliderMinValue - priceMin) / (sliderMax - priceMin)) * 100}%`,
    '--to': `${((sliderMaxValue - priceMin) / (sliderMax - priceMin)) * 100}%`,
  };
  const selectedRegionNames = [...new Set([
    ...draft.regionNames.split(',').filter(Boolean),
    ...[draft.regionId, ...draft.regionIds.split(',')]
      .filter(Boolean)
      .map((id) => regions.find((region) => region.id === id)?.name)
      .filter(Boolean),
  ])];
  const update = (values) => {
    setDraft((current) => ({ ...current, ...values }));
    setError('');
  };

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    element.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (invalidPrice) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams(queryKey);
      for (const [key, value] of Object.entries(draft)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (categoryFilterContext(params).unavailableGoodsType) {
        setPreview({ key: previewKey, count: 0, error: null });
        return;
      }
      try {
        const result = await api.getProducts({
          ...categoryProductQuery(params), page: 1, size: 1, signal: controller.signal,
        }, client);
        if (!controller.signal.aborted)
          setPreview({ key: previewKey, count: result.totalCount, error: null });
      } catch (requestError) {
        if (!controller.signal.aborted)
          setPreview({ key: previewKey, count: null, error: requestError });
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [api, client, draft, invalidPrice, previewKey, queryKey]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPrices() {
      const params = new URLSearchParams(queryKey);
      for (const key of PRODUCT_FILTER_KEYS) params.delete(key);
      if (categoryFilterContext(params).unavailableGoodsType) {
        setDistribution({ min: 0, max: 0, bins: Array(16).fill(0), count: 0 });
        return;
      }
      try {
        const prices = [];
        let count = 0;
        for (let page = 1; ; page += 1) {
          const result = await api.getProducts({
            ...categoryProductQuery(params, { includePage: false }), page, size: 100,
            signal: controller.signal,
          }, client);
          count = result.totalCount;
          prices.push(...result.items.map((item) => Number(item.price)).filter((price) => Number.isFinite(price) && price >= 0));
          if (page * 100 >= result.totalCount || !result.items.length) break;
        }
        const min = prices.length ? prices.reduce((value, price) => Math.min(value, price), Infinity) : 0;
        const max = prices.length ? prices.reduce((value, price) => Math.max(value, price), 0) : 0;
        const bins = Array(16).fill(0);
        for (const price of prices) {
          const index = max === min ? 0 : Math.min(15, Math.floor(((price - min) / (max - min)) * 16));
          bins[index] += 1;
        }
        if (!controller.signal.aborted) setDistribution({ min, max, bins, count });
      } catch {
        if (!controller.signal.aborted) setDistribution(null);
      }
    }
    loadPrices();
    return () => controller.abort();
  }, [api, client, queryKey]);

  const summary = [];
  if (draft.minPrice || draft.maxPrice)
    summary.push({ key: 'price', label: `${Number(draft.minPrice || 0).toLocaleString('ko-KR')}원 ~ ${draft.maxPrice ? `${Number(draft.maxPrice).toLocaleString('ko-KR')}원` : '전체'}`, clear: { minPrice: '', maxPrice: '' } });
  if (draft.regionId)
    summary.push({ key: 'regionId', label: regions.find((item) => item.id === draft.regionId)?.name || '지역', clear: { regionId: '' } });
  for (const id of draft.regionIds.split(',').filter(Boolean)) {
    summary.push({ key: `region:${id}`, label: regions.find((item) => item.id === id)?.name || '지역', clear: { regionIds: draft.regionIds.split(',').filter((item) => item !== id).join(',') } });
  }
  for (const name of draft.regionNames.split(',').filter(Boolean)) {
    summary.push({ key: `regionName:${name}`, label: name, clear: { regionNames: draft.regionNames.split(',').filter((item) => item !== name).join(',') } });
  }
  for (const name of draft.brands.split(',').filter(Boolean)) {
    summary.push({ key: `brand:${name}`, label: name, clear: { brands: draft.brands.split(',').filter((item) => item !== name).join(',') } });
  }
  if (draft.discountOnly === 'true')
    summary.push({ key: 'discountOnly', label: '할인 중인 굿즈만', clear: { discountOnly: '' } });
  if (draft.inStock !== 'true')
    summary.push({
      key: 'saleStatus',
      label: saleStatusLabel(draft),
      clear: SALE_STATUS.inStock,
    });
  if (draft.ratingMin)
    summary.push({ key: 'ratingMin', label: `별점 ${Number(draft.ratingMin).toFixed(1)} 이상`, clear: { ratingMin: '' } });
  if (draft.wishlistMin)
    summary.push({ key: 'wishlistMin', label: `찜 ${draft.wishlistMin}개 이상`, clear: { wishlistMin: '' } });
  for (const [key, label] of [['pickup', '픽업 가능'], ['delivery', '배달 가능']]) {
    if (draft[key] === 'true') summary.push({ key, label, clear: { [key]: '' } });
  }
  const isPreviewCurrent = preview.key === previewKey;
  const sale = saleChecks(draft);

  function submit(event) {
    event.preventDefault();
    if (invalidPrice) {
      setError('가격은 0 이상의 정수로 입력하고 최소·최대 금액을 확인해 주세요.');
      setTab('price');
      return;
    }
    onApply(draft);
  }

  return <dialog
    ref={dialog}
    className="category-filter-sheet"
    aria-labelledby={titleId}
    tabIndex={-1}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === dialog.current) onClose(); }}
  >
    <form onSubmit={submit}>
      <header className="category-filter-sheet__header">
        <h2 id={titleId}>필터</h2>
        <button type="button" aria-label="필터 닫기" onClick={onClose}>×</button>
      </header>
      <nav className="category-filter-sheet__tabs" role="tablist" aria-label="필터 종류">
        {tabs.map((item) => <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className={tab === item.id ? 'active' : ''}
          onClick={() => setTab(item.id)}
        >{item.label}</button>)}
      </nav>
      {summary.length > 0 && <div className="category-filter-sheet__summary">
        <div>{summary.map((item) => <button key={item.key} type="button" onClick={() => update(item.clear)}>{item.label} ×</button>)}</div>
        <button type="button" onClick={() => update(RESET_FILTERS)}>초기화</button>
      </div>}
      <div className="category-filter-sheet__content" role="tabpanel">
        {tab === 'price' && <>
          <section>
            <h3>가격</h3>
            <div className="category-filter-sheet__prices">
              <label><span className="category-sr-only">최소 가격</span><input type="number" min="0" step="1" placeholder="최소 금액" value={draft.minPrice} onChange={(event) => update({ minPrice: event.target.value })} /></label>
              <span>~</span>
              <label><span className="category-sr-only">최대 가격</span><input type="number" min="0" step="1" placeholder="최대 금액" value={draft.maxPrice} onChange={(event) => update({ maxPrice: event.target.value })} /></label>
            </div>
            {distribution?.bins.some(Boolean) ? <div className="category-filter-sheet__chart" aria-label="실제 판매가격 분포">
              {distribution.bins.map((count, index) => <span key={index} style={{ height: count ? `${Math.max(4, (count / Math.max(...distribution.bins)) * 100)}%` : '0%' }} />)}
            </div> : <p>표시할 가격 분포가 없습니다.</p>}
            <div className="category-filter-sheet__sliders" style={sliderStyle}>
              <input aria-label="최소 가격" type="range" min={priceMin} max={sliderMax} step="1" value={sliderMinValue} style={{ zIndex: sliderMinValue >= sliderMaxValue ? 2 : 1 }} onChange={(event) => update({ minPrice: event.target.value })} />
              <input aria-label="최대 가격" type="range" min={priceMin} max={sliderMax} step="1" value={sliderMaxValue} style={{ zIndex: sliderMinValue >= sliderMaxValue ? 1 : 2 }} onChange={(event) => update({ maxPrice: event.target.value })} />
            </div>
            <div className="category-filter-sheet__price-scale" aria-hidden="true">
              <span>{priceMin.toLocaleString('ko-KR')}원</span>
              <span>{Math.round((priceMin + sliderMax) / 2).toLocaleString('ko-KR')}원</span>
              <span>{sliderMax.toLocaleString('ko-KR')}원~</span>
            </div>
            <div className="category-filter-sheet__price-presets">
              {PRICE_PRESETS.map((preset) => <button
                key={preset.label}
                type="button"
                aria-pressed={draft.minPrice === preset.min && draft.maxPrice === preset.max}
                onClick={() => update({ minPrice: preset.min, maxPrice: preset.max })}
              >{preset.label}</button>)}
            </div>
          </section>
          <section>
            <h3>할인</h3>
            <div className="category-filter-choices">
              <label>
                <input type="checkbox" checked={draft.discountOnly === 'true'} onChange={(event) => update({ discountOnly: event.target.checked ? 'true' : '' })} />
                <span>할인 중인 굿즈만</span>
              </label>
            </div>
          </section>
        </>}
        {tab === 'brand' && (
          <ProductBrandFilter
            selected={draft.brands.split(',').filter(Boolean)}
            onChange={(names) => update({ brands: names.join(',') })}
          />
        )}
        {tab === 'region' && <section>
          <h3>지역 <small>여러 개 선택 가능</small></h3>
          <div className="category-filter-sheet__regions">
            {['전체', ...REGIONS].map((name) => <button
              key={name}
              type="button"
              aria-pressed={name === '전체' ? !selectedRegionNames.length && !draft.regionId && !draft.regionIds : selectedRegionNames.includes(name)}
              onClick={() => update({
                regionId: '', regionIds: '',
                regionNames: name === '전체' ? '' : (selectedRegionNames.includes(name)
                  ? selectedRegionNames.filter((item) => item !== name)
                  : [...selectedRegionNames, name]).join(','),
              })}
            >{name}</button>)}
          </div>
        </section>}
        {tab === 'reviews' && <>
          <section>
            <h3>후기 별점</h3>
            <RadioChoices
              options={[{ value: '', label: '전체' }, ...[3, 3.5, 4, 4.5].map((rating) => ({ value: String(rating), label: `별점 ${rating.toFixed(1)} 이상` }))]}
              value={draft.ratingMin}
              onChange={(value) => update({ ratingMin: value })}
            />
          </section>
          <section>
            <h3>찜 개수</h3>
            <RadioChoices
              options={[{ value: '', label: '전체' }, ...[10, 50, 100, 500].map((count) => ({ value: String(count), label: `찜 ${count}개 이상` }))]}
              value={draft.wishlistMin}
              onChange={(value) => update({ wishlistMin: value })}
            />
          </section>
        </>}
        {tab === 'sale' && <>
          <section>
            <h3>수령 방법</h3>
            <div className="category-filter-choices">
              {[
                ['pickup', '픽업 가능'],
                ['delivery', '배달 가능'],
              ].map(([key, label]) => <label key={key}>
                <input type="checkbox" checked={draft[key] === 'true'} onChange={(event) => update({ [key]: event.target.checked ? 'true' : '' })} />
                <span>{label}</span>
              </label>)}
            </div>
          </section>
          <section>
            <h3>판매 상태</h3>
            <div className="category-filter-choices">
              <label>
                <input type="checkbox" checked={sale.soldOut} onChange={(event) => update(saleStatusFrom(event.target.checked, sale.upcoming))} />
                <span>품절 상품 포함</span>
              </label>
              <label>
                <input type="checkbox" checked={sale.upcoming} onChange={(event) => update(saleStatusFrom(sale.soldOut, event.target.checked))} />
                <span>입고 예정 상품 포함</span>
              </label>
            </div>
          </section>
        </>}
        {error && <p role="alert" className="category-filter-sheet__error">{error}</p>}
      </div>
      <footer className="category-filter-sheet__footer">
        <button type="submit" className="category-primary" disabled={invalidPrice}>
          {isPreviewCurrent && preview.count !== null
            ? `${preview.count.toLocaleString('ko-KR')}개의 굿즈 보기`
            : '굿즈 보기'}
        </button>
        {isPreviewCurrent && preview.error && <p role="status">결과 개수를 미리 확인하지 못했습니다.</p>}
        {summary.length > 0 && <button type="button" onClick={() => onApply(RESET_FILTERS)}>
          선택 초기화하고 {distribution ? `${distribution.count.toLocaleString('ko-KR')}개의 ` : ''}굿즈 보기
        </button>}
      </footer>
    </form>
  </dialog>;
}
