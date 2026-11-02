// 담당: 연수
// 쿠지 상세: 번호 고르기 · 상품 구성 · 쿠지 교환 · 안내
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSession } from '../my/hooks.js';
import { kujiApi } from './kuji.api.js';
import KujiSwap from './KujiSwap.jsx';
import { GradeBadge, KujiHeader, KujiPage, StateBox, Toast } from './KujiParts.jsx';
import { SWAP_FEE, cx, formatOpenAt, pad, won } from './kujiUi.js';
import s from './kuji.module.css';

const TABS = [
  ['pick', '티켓 고르기'],
  ['prize', '상품 구성'],
  ['swap', '쿠지 교환'],
  ['guide', '안내'],
];

// 남은 번호 중에서 count 개를 무작위로 고른다
function pickRandom(list, count) {
  const pool = [...list];
  const picked = [];
  while (picked.length < count && pool.length) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return picked;
}

export default function KujiDetailPage() {
  const { kujiId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useSession();
  const signedIn = status === 'in';
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const wanted = searchParams.get('tab');
    return TABS.some(([key]) => key === wanted) ? wanted : 'pick';
  });
  const [sel, setSel] = useState([]);
  const [toast, setToast] = useState('');

  const detail = useQuery({ queryKey: ['kuji', kujiId, 'detail'], queryFn: () => kujiApi.detail(kujiId), retry: false });
  const board = useQuery({ queryKey: ['kuji', kujiId, 'board'], queryFn: () => kujiApi.board(kujiId), retry: false });
  const mine = useQuery({
    queryKey: ['kuji', kujiId, 'mine'],
    queryFn: () => kujiApi.myTickets(kujiId),
    enabled: signedIn,
    retry: false,
  });
  const swapList = useQuery({
    queryKey: ['kuji', kujiId, 'swap'],
    queryFn: () => kujiApi.swapList(kujiId),
    enabled: signedIn && tab === 'swap',
    retry: false,
  });

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['kuji', kujiId] });
  const buy = useMutation({
    mutationFn: (numbers) => kujiApi.buy(kujiId, numbers),
    onSuccess: (_result, numbers) => {
      setSel([]);
      refresh();
      navigate(`/kuji/${kujiId}/draw`, { state: { numbers } });
    },
    onError: (error) => {
      setToast(error.message);
      setSel([]);
      refresh();
    },
  });

  const goLogin = () => navigate('/login', { state: { from: `/kuji/${kujiId}` } });

  if (detail.error) {
    return (
      <KujiPage>
        <KujiHeader title="쿠지" onBack={() => navigate('/kuji')} />
        <div className={s.body}>
          <StateBox message={detail.error.message} onRetry={() => detail.refetch()} />
        </div>
      </KujiPage>
    );
  }
  if (!detail.data) {
    return (
      <KujiPage>
        <KujiHeader title="쿠지" onBack={() => navigate('/kuji')} />
        <div className={s.body}>
          <StateBox message="불러오는 중이에요" />
        </div>
      </KujiPage>
    );
  }

  const kuji = detail.data;
  const onSale = kuji.status === 'ON_SALE';
  const upcoming = kuji.status === 'UPCOMING';
  const max = kuji.maxPerPurchase;
  const cells = board.data ?? [];
  const toggle = (number) =>
    setSel((current) => (current.includes(number) ? current.filter((n) => n !== number) : current.length < max ? [...current, number] : current));
  const random = (count) => {
    const free = cells.filter((cell) => !cell.sold && !sel.includes(cell.number)).map((cell) => cell.number);
    setSel([...sel, ...pickRandom(free, Math.min(count, max - sel.length))]);
  };
  const submit = () => {
    if (!signedIn) {
      goLogin();
      return;
    }
    if (sel.length) buy.mutate(sel);
  };

  return (
    <KujiPage>
      <KujiHeader title={kuji.title} onBack={() => navigate('/kuji')} />
      <div className={s.body} id="kuji-detail">
        <div className={s.sum}>
          <div className={s.pills}>
            <span className={cx(s.pill, onSale && s.live)}>{onSale ? '판매 중' : upcoming ? '오픈 예정' : '판매 종료'}</span>
            <span className={s.pill}>1인 최대 {max}장</span>
          </div>
          <h3>{kuji.title}</h3>
          <div className={s.sub}>
            {upcoming ? (
              <span>
                <b>{formatOpenAt(kuji.opensAt)}</b> 오픈 예정 · 총 {kuji.totalTickets}장
              </span>
            ) : (
              <span>
                남은 티켓 <b>{kuji.leftTickets}</b>장 / {kuji.totalTickets}장
              </span>
            )}
            <strong>1장 {won(kuji.ticketPrice)}</strong>
          </div>
        </div>
        {kuji.lastOneText ? (
          <div style={{ background: 'var(--surface)', paddingTop: 2 }}>
            <div className={s.last}>
              <b>라스트원상</b>
              {kuji.lastOneText}
            </div>
          </div>
        ) : null}

        <div className={s.tabs} role="tablist">
          {TABS.map(([key, label]) => (
            <button
              type="button"
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? s.on : undefined}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'pick' ? (
          <div className={s.pane}>
            <div className={s['left-chips']}>
              {kuji.prizes.map((prize) => (
                <div key={prize.grade}>
                  {prize.grade}상<b>{upcoming ? prize.totalCount : prize.leftCount}</b>
                </div>
              ))}
            </div>
            <div className={s['pick-head']}>
              <strong>번호를 눌러 고르세요</strong>
              <div className={s.rand}>
                {[1, 3, 5].map((count) => (
                  <button type="button" key={count} onClick={() => random(count)}>
                    랜덤 {count}
                  </button>
                ))}
              </div>
            </div>
            {board.error ? (
              <StateBox message={board.error.message} onRetry={() => board.refetch()} />
            ) : (
              <div className={s.board}>
                {cells.map((cell) => (
                  <button
                    type="button"
                    key={cell.number}
                    className={cx(s.no, cell.sold && !upcoming ? (cell.mine ? s.mine : s.sold) : sel.includes(cell.number) && s.sel)}
                    disabled={cell.sold || !onSale}
                    aria-label={`${cell.number}번 티켓`}
                    onClick={() => toggle(cell.number)}
                  >
                    {pad(cell.number)}
                  </button>
                ))}
              </div>
            )}
            <div className={s.legend}>
              <span>
                <i style={{ background: 'var(--surface)' }} />
                선택 가능
              </span>
              <span>
                <i style={{ background: 'var(--primary)' }} />
                선택함
              </span>
              <span>
                <i style={{ background: 'var(--primary-soft)', borderColor: 'var(--btn)' }} />
                내가 뽑음
              </span>
              <span>
                <i style={{ background: '#efedf3' }} />
                판매됨
              </span>
            </div>
            {mine.data?.some((t) => !t.openedAt) ? (
              <div className={s.note}>
                아직 뜯지 않은 티켓이 있어요.{' '}
                <button type="button" style={{ color: 'var(--primary)', fontWeight: 800 }} onClick={() => navigate(`/kuji/${kujiId}/draw`)}>
                  이어서 뜯기
                </button>
              </div>
            ) : null}
            {mine.data?.length ? (
              <div className={s.note}>
                내가 뽑은 티켓 {mine.data.filter((t) => !t.resoldAt).length}장 ·{' '}
                <button type="button" style={{ color: 'var(--primary)', fontWeight: 800 }} onClick={() => navigate(`/kuji/${kujiId}/result`)}>
                  결과 보기
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'prize' ? (
          <div className={s.pane}>
            {kuji.prizes.map((prize) => (
              <div key={prize.grade} className={cx(s.pz, prize.leftCount === 0 ? s.gone : prize.leftCount <= 1 && s.low)}>
                <div className={s.pzimg}>
                  {prize.imageUrl ? <img src={prize.imageUrl} alt={prize.name} loading="lazy" /> : <span>{prize.grade}</span>}
                  <i className={s.pzshade} />
                  <GradeBadge grade={prize.grade} />
                  {prize.leftCount === 0 ? <em className={s.pzsold}>소진</em> : null}
                  <div className={s.pzcap}>
                    <div className={s.pzn}>
                      {prize.name}
                      {prize.description ? <small>{prize.description}</small> : null}
                      <small>
                        {prize.grade}상 · 되팔기 {won(prize.buybackPrice)}
                      </small>
                    </div>
                    <div className={s.pzl}>
                      <b>{prize.leftCount}개</b> 남음<small> / 총 {prize.totalCount}개</small>
                    </div>
                  </div>
                </div>
                <div className={s.pzbar}>
                  <i style={{ width: `${(prize.leftCount / prize.totalCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'swap' ? (
          <div className={s.pane}>
            <KujiSwap
              kuji={kuji}
              tickets={mine.data ?? []}
              listings={swapList.data ?? []}
              signedIn={signedIn}
              onLogin={goLogin}
              onChanged={refresh}
            />
          </div>
        ) : null}

        {tab === 'guide' ? (
          <div className={s.pane}>
            <ul className={s.guide}>
              <li>
                <b>모든 티켓에 상품이 있어요.</b> 꽝은 없습니다.
              </li>
              <li>등급별 남은 수량은 항상 공개돼요.</li>
              <li>번호마다 상품이 정해져 있고, 판매 중에는 바뀌지 않아요.</li>
              <li>상품은 실물로만 제공하고 현금으로 바꿀 수 없어요.</li>
              <li>
                마음에 안 드는 상품은 수령 전에 되팔기로 적립금(굿즈픽에서만 사용)으로 바꿀 수 있어요. 등급별 되팔기 금액은
                상품 구성 탭에서 볼 수 있어요.
              </li>
              <li>
                같은 쿠지 안에서 같은 등급끼리는 쿠지 교환 탭에서 상품 종류를 바꿀 수 있어요. 성사되면 한 사람당{' '}
                {won(SWAP_FEE)}이 결제돼요.
              </li>
              <li>현장에서 캡처 화면으로 하는 교환은 지원하지 않아요. 교환은 쿠지 교환 탭에서만 가능해요.</li>
              <li>1인 1회 최대 {max}장까지 구매할 수 있어요.</li>
            </ul>
          </div>
        ) : null}
      </div>

      {tab !== 'swap' ? (
        <div className={s.buybar}>
          <div className={s.info}>
            <small>선택 {sel.length}장</small>
            <b>{won(sel.length * kuji.ticketPrice)}</b>
          </div>
          <button type="button" className={s.cta} disabled={!onSale || buy.isPending || (signedIn && sel.length === 0)} onClick={submit}>
            {!onSale ? (upcoming ? `${formatOpenAt(kuji.opensAt)} 오픈 예정` : '판매가 끝났어요') : buy.isPending ? '결제 중…' : !signedIn ? '로그인하고 뽑기' : sel.length ? `${sel.length}장 뽑기` : '번호를 골라주세요'}
          </button>
        </div>
      ) : null}
      <Toast message={toast} />
    </KujiPage>
  );
}
