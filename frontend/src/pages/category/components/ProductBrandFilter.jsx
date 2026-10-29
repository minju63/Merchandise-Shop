import { useState } from 'react';
import { BRAND_GROUPS } from '../../../constants/brands.js';

// 필터 시트의 브랜드 탭: 분류(게임·아이돌 …)를 고르고 그 안의 브랜드를 여러 개 선택한다.
export default function ProductBrandFilter({ selected, onChange }) {
  const [groupId, setGroupId] = useState(BRAND_GROUPS[0].id);
  const [keyword, setKeyword] = useState('');
  const group = BRAND_GROUPS.find((item) => item.id === groupId);
  const query = keyword.trim().toLowerCase();
  // 검색어가 있으면 모든 분류에서 찾고, 없으면 고른 분류의 브랜드만 보여준다.
  const visible = query
    ? BRAND_GROUPS.flatMap((item) => item.brands)
      .filter((brand) => brand.name.toLowerCase().includes(query) || brand.en.toLowerCase().includes(query))
    : group.brands;
  const visibleNames = visible.map((brand) => brand.name);
  const allSelected = visible.length > 0 && visibleNames.every((name) => selected.includes(name));

  const toggle = (name) => onChange(selected.includes(name)
    ? selected.filter((item) => item !== name)
    : [...selected, name]);
  const toggleAll = () => onChange(allSelected
    ? selected.filter((name) => !visibleNames.includes(name))
    : [...new Set([...selected, ...visibleNames])]);

  return (
    <section className="category-brand-filter">
      <h3>브랜드 <small>여러 개 선택 가능</small></h3>
      <div className="category-brand-filter__groups" role="tablist" aria-label="브랜드 분류">
        {BRAND_GROUPS.map((item) => {
          const count = item.brands.filter((brand) => selected.includes(brand.name)).length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={!query && item.id === groupId}
              onClick={() => { setGroupId(item.id); setKeyword(''); }}
            >{item.label}{count ? <b>{count}</b> : null}</button>
          );
        })}
      </div>
      <label className="category-brand-filter__search">
        <span className="category-sr-only">브랜드 검색</span>
        <input
          type="search"
          placeholder="브랜드명을 입력해주세요."
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </label>
      {visible.length ? (
        <>
          <label className="category-brand-filter__all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>{query ? '검색 결과 전체' : `${group.label} 브랜드 전체`} ({visible.length}개)</span>
          </label>
          <div className="category-brand-filter__list">
            {visible.map((brand) => (
              <label key={brand.name}>
                <input type="checkbox" checked={selected.includes(brand.name)} onChange={() => toggle(brand.name)} />
                <span><strong>{brand.name}</strong><small>{brand.en}</small></span>
              </label>
            ))}
          </div>
        </>
      ) : (
        <p>검색 결과가 없어요.</p>
      )}
    </section>
  );
}
