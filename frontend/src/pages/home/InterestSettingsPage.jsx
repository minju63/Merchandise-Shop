import { useState } from 'react';
import { DetailSection, DetailShell } from './BannerDetailParts.jsx';
import { brandGroupFor, hasPickedBrands } from './interestMatch.js';

const GROUPS = [
  { type: 'CONTENT', title: '작품', description: '좋아하는 작품 분류를 골라주세요. 분류를 고르면 아래에 브랜드가 나와요' },
  { type: 'GOODS', title: '굿즈 종류', description: '모으는 굿즈 종류를 골라주세요' },
];

// 홈 "회원님을 위한 추천"에 반영할 관심 카테고리·브랜드를 고르는 화면 (/interests)
export default function InterestSettingsPage({ categories, initialIds, initialBrands, error, onBack, onRetry, onSave }) {
  const [selected, setSelected] = useState(initialIds);
  const [brands, setBrands] = useState(initialBrands);
  // 접어 둔 브랜드 박스(분류 id). 접어도 고른 브랜드는 그대로 유지된다.
  const [collapsed, setCollapsed] = useState([]);

  const toggle = (id) => setSelected((current) => (
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  ));
  const toggleCollapsed = (id) => setCollapsed((current) => (
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  ));
  // "전체" 선택: 이 분류에서 고른 브랜드를 모두 해제한다
  const clearBrands = (group) => setBrands((current) => current.filter((name) => !group.brands.some((brand) => brand.name === name)));
  const toggleBrand = (name) => setBrands((current) => (
    current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
  ));

  // 고른 작품 분류의 브랜드만 남긴다 (분류를 해제하면 그 안의 브랜드 선택도 함께 사라진다)
  const activeBrandGroups = selected.map((id) => brandGroupFor(id)).filter(Boolean);
  const activeBrands = brands.filter((name) => activeBrandGroups.some((group) => group.brands.some((brand) => brand.name === name)));
  // 브랜드를 고른 분류는 분류 자체가 아니라 고른 브랜드 개수로 센다
  const total = selected.filter((id) => !hasPickedBrands(id, activeBrands)).length + activeBrands.length;

  return (
    <DetailShell
      title="관심사 설정"
      ready={Boolean(categories)}
      error={error}
      onBack={onBack}
      onRetry={onRetry}
      footer={(
        <>
          <button
            className="bd__btn bd__btn--secondary"
            type="button"
            onClick={() => { setSelected([]); setBrands([]); }}
            disabled={!total}
          >
            선택 해제
          </button>
          <button className="bd__btn" type="button" onClick={() => onSave(selected, activeBrands)}>
            저장하기{total ? ` (${total})` : ''}
          </button>
        </>
      )}
    >
      {categories ? (
        <>
          <DetailSection title="어떤 굿즈를 좋아하세요?" description="고른 카테고리의 상품을 홈 추천에 먼저 보여드려요">
            <p className="bd__caption">
              여러 개를 고를 수 있어요. 브랜드는 `전체`를 고르면 그 분류 전체를, 특정 브랜드를 고르면 그 브랜드만 추천해요. 지금은 이 기기에 저장돼요.
            </p>
          </DetailSection>
          {GROUPS.map((group) => {
            const items = categories.filter((category) => category.type === group.type);
            return (
              <DetailSection key={group.type} title={group.title} description={group.description}>
                <div className="bd__interest-chips">
                  {items.map((category) => (
                    <button
                      className="bd__chip"
                      type="button"
                      key={category.id}
                      aria-pressed={selected.includes(category.id)}
                      onClick={() => toggle(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                {group.type === 'CONTENT' ? activeBrandGroups.map((brandGroup) => {
                  const picked = brandGroup.brands.filter((brand) => brands.includes(brand.name));
                  const isCollapsed = collapsed.includes(brandGroup.id);
                  return (
                    <div className="bd__interest-brands" key={brandGroup.id}>
                      <button
                        className="bd__interest-brands-head"
                        type="button"
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleCollapsed(brandGroup.id)}
                      >
                        <span>{brandGroup.label} 브랜드 <small>{picked.length ? `${picked.length}개 선택` : '전체'}</small></span>
                        <i aria-hidden="true" />
                      </button>
                      {isCollapsed ? (
                        <p className="bd__interest-brands-summary">
                          {picked.length ? picked.map((brand) => brand.name).join(', ') : `${brandGroup.label} 전체`}
                        </p>
                      ) : (
                        <div className="bd__interest-chips">
                          <button
                            className="bd__chip bd__chip--brand"
                            type="button"
                            aria-pressed={picked.length === 0}
                            onClick={() => clearBrands(brandGroup)}
                          >
                            전체
                          </button>
                          {brandGroup.brands.map((brand) => (
                            <button
                              className="bd__chip bd__chip--brand"
                              type="button"
                              key={brand.name}
                              aria-pressed={brands.includes(brand.name)}
                              onClick={() => toggleBrand(brand.name)}
                            >
                              {brand.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }) : null}
              </DetailSection>
            );
          })}
        </>
      ) : null}
    </DetailShell>
  );
}
