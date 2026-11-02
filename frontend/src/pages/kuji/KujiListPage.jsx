// 담당: 연수
// 쿠지 목록: 추천 1장 + 진행 중 · 오픈 예정 가로형 목록
import { useEffect, useRef, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../my/hooks.js';
import { kujiApi } from './kuji.api.js';
import BottomNavigation from '../../components/BottomNavigation.jsx';
import { KujiHeader, KujiPage, StateBox } from './KujiParts.jsx';
import { TILE_COLORS, GRADES, agoText, cx, formatOpenAt, won } from './kujiUi.js';
import s from './kuji.module.css';

const ratio = (event) => Math.round((event.leftTickets / event.totalTickets) * 100);

export default function KujiListPage() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['kuji', 'list'], queryFn: kujiApi.list, retry: false });
  const events = query.data ?? [];
  const onSale = events.filter((event) => event.status === 'ON_SALE');
  const upcoming = events.filter((event) => event.status === 'UPCOMING');
  const featured = onSale[0];
  const banners = [...onSale, ...upcoming].filter((event) => event.bannerUrl);
  const open = (event) => navigate(`/kuji/${event.id}`);

  // 홈 화면 배너와 같은 방식: 한 장씩 보여주고 5초마다 넘기며, 좌우로 끌면 넘어간다.
  const [bannerIndex, setBannerIndex] = useState(0);
  const [slideVersion, setSlideVersion] = useState(0);
  const bannerDrag = useRef({ active: false, moved: false, startX: 0 });
  const bannerCount = banners.length;
  const shownBanner = bannerCount ? banners[bannerIndex % bannerCount] : null;
  useEffect(() => {
    if (bannerCount <= 1) return undefined;
    const timer = window.setInterval(() => setBannerIndex((current) => (current + 1) % bannerCount), 5000);
    return () => window.clearInterval(timer);
  }, [bannerCount, slideVersion]);
  const showBanner = (index) => {
    if (!bannerCount) return;
    setBannerIndex((index + bannerCount) % bannerCount);
    setSlideVersion((version) => version + 1);
  };
  const resetDrag = (event) => {
    bannerDrag.current.active = false;
    event.currentTarget.style.transform = '';
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const dragProps = {
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      bannerDrag.current = { active: true, moved: false, startX: event.clientX };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!bannerDrag.current.active) return;
      const distance = event.clientX - bannerDrag.current.startX;
      if (Math.abs(distance) > 3) bannerDrag.current.moved = true;
      event.currentTarget.style.transform = `translateX(${distance * 0.35}px)`;
    },
    onPointerUp: (event) => {
      if (!bannerDrag.current.active) return;
      const distance = event.clientX - bannerDrag.current.startX;
      resetDrag(event);
      if (Math.abs(distance) >= 40) showBanner(bannerIndex + (distance < 0 ? 1 : -1));
    },
    onPointerCancel: resetDrag,
    onClickCapture: (event) => {
      if (!bannerDrag.current.moved) return;
      event.preventDefault();
      event.stopPropagation();
      bannerDrag.current.moved = false;
    },
  };

  const { status } = useSession();
  const signedIn = status === 'in';
  const swaps = useQueries({
    queries: onSale.map((event) => ({
      queryKey: ['kuji', event.id, 'swap'],
      queryFn: () => kujiApi.swapList(event.id),
      enabled: signedIn,
      retry: false,
    })),
  });
  const mines = useQueries({
    queries: onSale.map((event) => ({
      queryKey: ['kuji', event.id, 'mine'],
      queryFn: () => kujiApi.myTickets(event.id),
      enabled: signedIn,
      retry: false,
    })),
  });
  const recentSwaps = onSale
    .flatMap((event, index) => (swaps[index]?.data ?? []).filter((item) => !item.mine).map((item) => ({ event, item })))
    .sort((a, b) => new Date(b.item.createdAt) - new Date(a.item.createdAt))
    .slice(0, 4);
  const myKujis = onSale
    .map((event, index) => {
      const tickets = mines[index]?.data ?? [];
      const sellable = tickets.filter(
        (t) => t.openedAt && !t.resoldAt && !t.listed && new Date(t.resaleUntil).getTime() > Date.now()
      ).length;
      return { event, count: tickets.filter((t) => !t.resoldAt).length, sellable };
    })
    .filter((row) => row.count > 0);

  let body;
  if (query.error) body = <StateBox message={query.error.message} onRetry={() => query.refetch()} />;
  else if (!query.data) body = <StateBox message="불러오는 중이에요" />;
  else if (!events.length) body = <StateBox message="진행 중인 쿠지가 아직 없어요" />;
  else
    body = (
      <>
        {banners.length ? (
          <>
            <div className={s['sec-t']} style={{ paddingTop: 14 }}>
              <h3>지금 가장 인기 있는 쿠지</h3>
              <span>실시간</span>
            </div>
            <div className={s.banners}>
              <button type="button" key={shownBanner.id} className={s.banner} onClick={() => open(shownBanner)} {...dragProps}>
                <img src={shownBanner.bannerUrl} alt={shownBanner.title} draggable={false} />
                <span className={s.bcount}>
                  {bannerIndex % bannerCount + 1} / {bannerCount}
                </span>
              </button>
              <div className={s.bdots} aria-label="배너 선택">
                {banners.map((event, index) => (
                  <button
                    type="button"
                    key={event.id}
                    className={index === bannerIndex % bannerCount ? s.active : ''}
                    aria-label={`${index + 1}번째 배너 보기`}
                    onClick={() => showBanner(index)}
                  />
                ))}
              </div>
            </div>
          </>
        ) : featured ? (
          <>
            <div className={s['sec-t']} style={{ paddingTop: 14 }}>
              <h3>지금 가장 인기 있는 쿠지</h3>
              <span>실시간</span>
            </div>
            <button type="button" className={s.feat} onClick={() => open(featured)}>
              {featured.coverUrl ? (
                <>
                  <img className={s.featimg} src={featured.coverUrl} alt="" />
                  <span className={s.featshade} />
                </>
              ) : (
                <span className={s.glyph}>A</span>
              )}
              <span className={s.pill}>판매 중</span>
              <small>{featured.shopName}</small>
              <h3>{featured.title}</h3>
              <div className={s.meter}>
                <i style={{ width: `${ratio(featured)}%` }} />
              </div>
              <div className={s.row}>
                <span>
                  남은 티켓 <b>{featured.leftTickets}</b> / {featured.totalTickets}
                </span>
                <b>1장 {won(featured.ticketPrice)}</b>
              </div>
              <div className={s.grades}>
                {GRADES.slice(0, 3).map((grade) => (
                  <span key={grade}>
                    {grade}상 {featured.leftByGrade?.[grade] ?? 0}개
                  </span>
                ))}
              </div>
            </button>
          </>
        ) : null}

        {onSale.length ? (
          <>
            <div className={s['sec-t']}>
              <h3>진행 중</h3>
              <span>{onSale.length}개</span>
            </div>
            {onSale.map((event, index) => {
              const tile = TILE_COLORS[index % TILE_COLORS.length];
              const low = ratio(event) < 30;
              return (
                <button type="button" key={event.id} className={s.lrow} onClick={() => open(event)}>
                  <div className={s.th} style={{ background: tile.bg, color: tile.fg }}>
                    {event.coverUrl ? <img src={event.coverUrl} alt="" /> : GRADES[index % GRADES.length]}
                  </div>
                  <div>
                    <p className={s.shop}>{event.shopName}</p>
                    <h4>
                      {event.title} {low ? <span className={cx(s.pill, s.hot)}>마감 임박</span> : null}
                    </h4>
                    <div className={cx(s['mini-gauge'], low && s.low)}>
                      <i style={{ width: `${ratio(event)}%` }} />
                    </div>
                    <div className={s.m}>
                      <span>남은 {event.leftTickets}장</span>
                      <b>{won(event.ticketPrice)}</b>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        ) : null}

        {upcoming.length ? (
          <>
            <div className={s['sec-t']}>
              <h3>오픈 예정</h3>
              <span>{upcoming.length}개</span>
            </div>
            {upcoming.map((event, index) => {
              const tile = TILE_COLORS[(index + 2) % TILE_COLORS.length];
              return (
                <button type="button" key={event.id} className={s.lrow} onClick={() => open(event)}>
                  <div className={s.th} style={{ background: tile.bg, color: tile.fg }}>
                    {event.coverUrl ? <img src={event.coverUrl} alt="" /> : GRADES[(index + 2) % GRADES.length]}
                  </div>
                  <div>
                    <p className={s.shop}>{event.shopName}</p>
                    <h4>{event.title}</h4>
                    <div className={s.m}>
                      <span>{formatOpenAt(event.opensAt)} 오픈</span>
                      <span className={s.bellOff}>오픈 예정</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        ) : null}
        {recentSwaps.length ? (
          <>
            <div className={s['sec-t']}>
              <h3>지금 올라온 교환글</h3>
              <span>최근</span>
            </div>
            {recentSwaps.map(({ event, item }) => (
              <button
                type="button"
                key={item.id}
                className={s.srow}
                onClick={() => navigate(`/kuji/${event.id}?tab=swap`)}
              >
                <span className={s.sg}>{item.grade}상</span>
                <span className={s.st}>
                  <b>
                    {item.haveLabel} ↔ {item.wantLabel}
                  </b>
                  <small>
                    {event.title} · {item.nick} · {agoText(item.createdAt)}
                  </small>
                </span>
              </button>
            ))}
          </>
        ) : null}

        {myKujis.length ? (
          <>
            <div className={s['sec-t']}>
              <h3>내가 뽑은 쿠지</h3>
              <span>{myKujis.length}개</span>
            </div>
            {myKujis.map(({ event, count, sellable }) => (
              <button type="button" key={event.id} className={s.srow} onClick={() => open(event)}>
                <span className={s.sth}>{event.coverUrl ? <img src={event.coverUrl} alt="" /> : null}</span>
                <span className={s.st}>
                  <b>{event.title}</b>
                  <small>
                    뽑은 {count}장{sellable ? ` · 되팔기 가능 ${sellable}장` : ''}
                  </small>
                </span>
              </button>
            ))}
          </>
        ) : null}
        <div style={{ height: 90, background: 'var(--surface)' }} />
      </>
    );

  return (
    <KujiPage>
      <KujiHeader title="쿠지" onBack={() => navigate('/')} />
      <div className={s.body}>{body}</div>
      <BottomNavigation />
    </KujiPage>
  );
}
