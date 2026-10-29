import { useRef, useState } from 'react';
import { DetailSection, DetailShell, NoticeList } from './BannerDetailParts.jsx';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTICES = [
  '굿즈 재고와 가격은 매장 사정에 따라 변경될 수 있어요.',
  '표시된 거리는 위치 기능이 연결되기 전의 예시 값이에요.',
  '입고 예정 상품은 알림을 신청하면 입고 소식을 알려드려요.',
];

// 한국 날짜 기준이 아닌 기기 날짜로 생일까지 남은 일수를 센다.
function daysUntil(month, day) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let target = new Date(today.getFullYear(), month - 1, day);
  if (target < start) target = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((target - start) / DAY_MS);
}

const dDayLabel = (days) => (days === 0 ? 'D-DAY' : `D-${days}`);
const formatDay = (value) => {
  const date = new Date(value);
  return `${date.getMonth() + 1}.${date.getDate()}`;
};

function stockLine(item) {
  if (item.stockState === 'RESTOCK') return { text: `${formatDay(item.restockAt)} 입고 예정`, danger: false };
  if (item.stockState === 'SOLD_OUT') return { text: '품절', danger: true };
  const how = item.pickupAvailable ? '픽업 가능' : '택배 가능';
  return { text: `${how}·재고 ${item.stockQuantity}개`, danger: item.stockState === 'LAST_ONE' };
}

function GoodsCard({ item, onOpen }) {
  const [alerted, setAlerted] = useState(false);
  const line = stockLine(item);

  return (
    <article
      className="bd__goods-card"
      role={onOpen ? 'link' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (onOpen && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="bd__goods-img">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <span>{item.category}</span>}
      </div>
      <p className="bd__goods-store">{item.storeName} · {item.distance}</p>
      <h3 className="bd__goods-name">{item.name}</h3>
      <strong className="bd__goods-price">{item.price}</strong>
      <p className={`bd__goods-stock${line.danger ? ' bd__goods-stock--danger' : ''}`}>{line.text}</p>
      {item.stockState === 'RESTOCK' ? (
        <button
          className="bd__alert"
          type="button"
          aria-pressed={alerted}
          onClick={(event) => {
            event.stopPropagation();
            setAlerted((current) => !current);
          }}
        >
          {alerted ? '알림 신청 완료' : '알림 받기'}
        </button>
      ) : null}
    </article>
  );
}

// 기획전 배너의 "자세히 보기" 화면 (/exhibitions/:bannerId)
export default function ExhibitionPage({
  exhibition,
  loading,
  error,
  filters,
  onBack,
  onRetry,
  onSelectCharacter,
  onChangeType,
  onToggleInStock,
  onOpenProduct,
  onShowAll,
}) {
  const goodsSection = useRef(null);
  const selected = exhibition?.selected;
  const month = exhibition?.month;

  const showAllCharacters = () => {
    onSelectCharacter('all');
    goodsSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <DetailShell
      title="기획전"
      ready={Boolean(exhibition)}
      error={error}
      onBack={onBack}
      onRetry={onRetry}
      hero={exhibition ? (
        <section className="bd__hero bd__hero--exhibition">
          <span className="bd__pill">{month}.1 ~ {month}.31</span>
          <h2 style={{ marginTop: 14 }}>{exhibition.title}</h2>
          <p className="bd__hero-desc">{month}월에 태어난 캐릭터들의 굿즈를 한곳에서 볼 수 있어요</p>
        </section>
      ) : null}
      footer={<button className="bd__btn" type="button" onClick={showAllCharacters}>{month}월 생일 굿즈 전체 보기</button>}
    >
      {exhibition ? (
        <>
          <DetailSection title={`${month}월 생일 캘린더`} description="캐릭터를 고르면 그 캐릭터의 굿즈를 보여드려요">
            <div className="bd__calendar">
              {exhibition.characters.map((character) => (
                <button
                  className="bd__cal-card"
                  type="button"
                  key={character.name}
                  aria-pressed={selected?.name === character.name}
                  onClick={() => onSelectCharacter(character.name)}
                >
                  <span className="bd__avatar">
                    {character.imageUrl ? <img src={character.imageUrl} alt="" /> : character.name.slice(0, 1)}
                  </span>
                  <span className="bd__cal-date">{character.month}.{character.day}</span>
                  <span className="bd__cal-name">{character.name}</span>
                </button>
              ))}
            </div>
          </DetailSection>

          <DetailSection className="bd__goods-section">
            <div ref={goodsSection} className="bd__goods-head">
              {selected ? (
                <>
                  <p>
                    {selected.month}월 {selected.day}일 생일 · {dDayLabel(daysUntil(selected.month, selected.day))}
                  </p>
                  <h3>{selected.name}</h3>
                </>
              ) : (
                <>
                  <p>{month}월 생일 캐릭터 전체</p>
                  <h3>{month}월 생일 굿즈</h3>
                </>
              )}
            </div>

            <div className="bd__chips" role="group" aria-label="굿즈 종류">
              {['', ...exhibition.goodsTypes].map((type) => (
                <button
                  className="bd__chip"
                  type="button"
                  key={type || 'all'}
                  aria-pressed={filters.type === type}
                  onClick={() => onChangeType(type)}
                >
                  {type || '전체'}
                </button>
              ))}
            </div>

            <label className="bd__check">
              <input type="checkbox" checked={filters.inStock} onChange={onToggleInStock} />
              재고 있음만
            </label>

            <div className={`bd__goods${loading ? ' is-loading' : ''}`}>
              {exhibition.goods.length ? (
                <div className="bd__grid">
                  {exhibition.goods.map((item) => (
                    <GoodsCard
                      key={item.id}
                      item={item}
                      onOpen={item.storeProductId ? () => onOpenProduct(item) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <p className="bd__empty">조건에 맞는 굿즈를 준비 중이에요</p>
              )}
            </div>

            {selected ? (
              <button className="bd__more" type="button" onClick={() => onShowAll(selected.name)}>
                {selected.name} 굿즈 더 보기
              </button>
            ) : null}
          </DetailSection>

          <DetailSection title="유의사항">
            <NoticeList items={NOTICES} />
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
