import { DetailSection, DetailShell, NoticeList } from './BannerDetailParts.jsx';

const STEPS = [
  { title: '작품·캐릭터로 검색', desc: '찾는 굿즈의 작품명이나 캐릭터 이름으로 검색해요.' },
  { title: '매장별 실시간 재고 확인', desc: '굿즈샵마다 남은 재고와 가격을 한눈에 비교해요.' },
  { title: '결제하고 픽업 또는 택배', desc: '가까운 매장에서 직접 받거나 택배로 받아요.' },
];

const METHODS = [
  { icon: '📦', title: '택배 주문', desc: '집에서 편하게 받아요' },
  { icon: '🏪', title: '매장 픽업', desc: '재고 확인 후 바로 수령' },
  { icon: '🔔', title: '입고 알림', desc: '품절 상품 입고 시 알려드려요' },
];

// 서비스 소개 배너의 "자세히 보기" 화면 (/intro/:bannerId)
export default function ServiceIntroPage({ intro, error, onBack, onRetry, onOpenStore, onFindStores }) {
  return (
    <DetailShell
      title="서비스 소개"
      ready={Boolean(intro)}
      error={error}
      onBack={onBack}
      onRetry={onRetry}
      hero={intro ? (
        <section className="bd__hero bd__hero--service">
          <p className="bd__eyebrow">처음 오셨나요?</p>
          <h2>{intro.title}</h2>
          <p className="bd__hero-desc">
            원하는 굿즈가 어느 굿즈샵에 있는지, 재고가 남아 있는지 굿즈픽에서 한 번에 확인하세요.
          </p>
        </section>
      ) : null}
      footer={<button className="bd__btn" type="button" onClick={onFindStores}>내 주변 굿즈샵 보기</button>}
    >
      {intro ? (
        <>
          <DetailSection title="이렇게 이용해요">
            <ol className="bd__steps">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="bd__step-no">{index + 1}</span>
                  <div><strong>{step.title}</strong><p>{step.desc}</p></div>
                </li>
              ))}
            </ol>
          </DetailSection>

          <DetailSection title="구매 방식 3가지">
            <ul className="bd__methods">
              {METHODS.map((method) => (
                <li key={method.title}>
                  <span className="bd__method-icon" aria-hidden="true">{method.icon}</span>
                  <strong>{method.title}</strong>
                  <p>{method.desc}</p>
                </li>
              ))}
            </ul>
          </DetailSection>

          <DetailSection title="내 주변 굿즈샵" description="거리와 영업시간을 확인하고 방문해 보세요">
            {intro.stores.length ? (
              <ul className="bd__store-list">
                {intro.stores.map((store) => (
                  <li key={store.id}>
                    <button className="bd__store" type="button" onClick={() => onOpenStore(store.id)}>
                      {store.imageUrl
                        ? <img className="bd__store-thumb" src={store.imageUrl} alt="" />
                        : <span className="bd__store-thumb" aria-hidden="true" />}
                      <span className="bd__store-body">
                        <strong>
                          {store.name}
                          <span className={`bd__badge${store.pickupAvailable ? '' : ' bd__badge--off'}`}>
                            {store.pickupAvailable ? '픽업 가능' : '택배만'}
                          </span>
                        </strong>
                        <span className="bd__store-meta">
                          {store.distance} · 오늘 {store.hours ?? '휴무'}<br />{store.address}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bd__empty">아직 등록된 굿즈샵이 없어요</p>
            )}
            <p className="bd__caption">표시된 거리는 위치 기능이 연결되기 전의 예시 값이에요.</p>
          </DetailSection>

          <DetailSection title="예약금 안내">
            <div className="bd__deposit">
              <strong>상품 금액의 {intro.depositRate}%</strong>
              <p>
                예약 구매는 상품 금액의 {intro.depositRate}%를 예약금으로 먼저 결제해요.
                나머지 금액(잔금)은 상품이 입고된 뒤 결제해요.
              </p>
            </div>
            <NoticeList items={['예약 가능한 상품은 상품 상세에서 확인할 수 있어요.']} />
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
