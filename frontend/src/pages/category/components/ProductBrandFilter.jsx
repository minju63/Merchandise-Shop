import { useState } from 'react';
import { BRAND_GROUPS } from '../../../constants/brands.js';

// 필터 시트의 브랜드 탭: 분류(게임·아이돌 …)를 고르고 그 안의 브랜드를 여러 개 선택한다. (검색 입력은 두지 않는다)
export default function ProductBrandFilter({ selected, onChange }) {
  const [groupId, setGroupId] = useState(BRAND_GROUPS[0].id);
  const group = BRAND_GROUPS.find((item) => item.id === groupId);
  const visible = group.brands;
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
              aria-selected={item.id === groupId}
              onClick={() => setGroupId(item.id)}
            >{item.label}{count ? <b>{count}</b> : null}</button>
          );
        })}
      </div>
      <label className="category-brand-filter__all">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
        <span>{group.label} 브랜드 전체 ({visible.length}개)</span>
      </label>
      <div className="category-brand-filter__list">
        {visible.map((brand) => (
          <label key={brand.name}>
            <input type="checkbox" checked={selected.includes(brand.name)} onChange={() => toggle(brand.name)} />
            <span><strong>{brand.name}</strong><small>{brand.en}</small></span>
          </label>
        ))}
      </div>
    </section>
  );
}
