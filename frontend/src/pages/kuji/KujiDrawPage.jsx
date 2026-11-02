// 담당: 연수
// 쿠지 뽑기: 산 티켓을 한 장씩 넘겨서 뜯는다. 뜯은 티켓은 서버에 기록돼 새로고침해도 유지된다.
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useRequireLogin } from '../my/hooks.js';
import { kujiApi } from './kuji.api.js';
import TicketDeck from './TicketDeck.jsx';
import { KujiHeader, KujiPage, StateBox } from './KujiParts.jsx';
import { cx, pad } from './kujiUi.js';
import s from './kuji.module.css';

export default function KujiDrawPage() {
  const { kujiId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const signedIn = useRequireLogin('/login');
  const batch = location.state?.numbers ?? null;

  const mine = useQuery({ queryKey: ['kuji', kujiId, 'mine'], queryFn: () => kujiApi.myTickets(kujiId), enabled: signedIn, retry: false });
  const detail = useQuery({ queryKey: ['kuji', kujiId, 'detail'], queryFn: () => kujiApi.detail(kujiId), retry: false });

  // 이번에 산 번호가 있으면 그 번호만, 없으면 아직 뜯지 않은 티켓을 이어서 뜯는다.
  const tickets = useMemo(() => {
    const all = mine.data ?? [];
    return batch ? all.filter((t) => batch.includes(t.number)) : all.filter((t) => !t.openedAt);
  }, [mine.data, batch]);

  const [idx, setIdx] = useState(0);
  const [tornNumbers, setTornNumbers] = useState(() => new Set());
  const [busyAll, setBusyAll] = useState(false);

  const isTorn = (ticket) => Boolean(ticket.openedAt) || tornNumbers.has(ticket.number);
  const current = tickets[Math.min(idx, tickets.length - 1)];

  const markTorn = (numbers) => {
    setTornNumbers((previous) => new Set([...previous, ...numbers]));
    return kujiApi.open(kujiId, numbers).catch(() => {});
  };
  const goResult = () => {
    queryClient.invalidateQueries({ queryKey: ['kuji', kujiId] });
    navigate(`/kuji/${kujiId}/result`, { replace: true });
  };

  let body;
  if (mine.error) body = <StateBox message={mine.error.message} onRetry={() => mine.refetch()} />;
  else if (!mine.data) body = <StateBox message="불러오는 중이에요" />;
  else if (!tickets.length || !current)
    body = (
      <div className={s.state}>
        <p>뜯을 티켓이 없어요.</p>
        <button type="button" onClick={() => navigate(`/kuji/${kujiId}`, { replace: true })}>
          번호 고르러 가기
        </button>
      </div>
    );
  else {
    const torn = isTorn(current);
    const opened = tickets.filter(isTorn).length;
    const last = idx >= tickets.length - 1;
    body = (
      <div className={s['deck-bg']}>
        <i className={cx(s.beam, s.l)} />
        <i className={cx(s.beam, s.r)} />
        {[
          ['8%', '7s', '0s', '24px', '#ffd34d'],
          ['22%', '9s', '2.4s', '-18px', '#ff5b7f'],
          ['37%', '6.5s', '1.1s', '30px', '#8be9ff'],
          ['51%', '8s', '3.6s', '-26px', '#fff'],
          ['66%', '7.4s', '.6s', '20px', '#ffd34d'],
          ['79%', '9.5s', '4.2s', '-22px', '#ff5b7f'],
          ['91%', '6.8s', '1.9s', '-14px', '#8be9ff'],
        ].map(([left, d, dl, dx, color]) => (
          <i key={left} className={s.cf} style={{ left, '--d': d, '--dl': dl, '--dx': dx, background: color }} />
        ))}
        <div className={s.marq} aria-hidden="true" />
        <div className={s.jack}>
          A상 <b>{detail.data?.prizes?.find((p) => p.grade === 'A')?.leftCount ?? 0}</b>개 남음 · 지금 뽑으면 A상도 노려볼 수 있어요
        </div>
        <div className={s.prog}>
          {tickets.map((t, i) => (
            <i key={t.ticketId} className={cx(isTorn(t) && s.done, i === idx && s.cur)} />
          ))}
        </div>
        <div className={s['deck-t']}>
          <h3>{torn ? `${current.grade}상 당첨!` : `${pad(current.number)}번 티켓`}</h3>
          <p>
            {torn
              ? `${pad(current.number)}번 티켓의 결과예요 (${idx + 1}/${tickets.length})`
              : '왼쪽 "천천히 넘기기" 탭을 오른쪽으로 끌어보세요'}
          </p>
        </div>
        <div className={s.deckwrap}>
          <TicketDeck key={current.ticketId} ticket={current} torn={torn} onTorn={(ticket) => markTorn([ticket.number])} />
        </div>
        <div className={s.kbox} aria-hidden="true">
          <i className={s.pk} style={{ '--x': '-80px', '--r': '-8deg' }} />
          <i className={s.pk} style={{ '--x': '-30px', '--r': '3deg' }} />
          <i className={s.pk} style={{ '--x': '26px', '--r': '-4deg' }} />
          <i className={s.pk} style={{ '--x': '76px', '--r': '7deg' }} />
          <div className={s.front}>
            <span>
              쿠지 박스 · 남은 티켓 <b>{detail.data?.leftTickets ?? 0}</b>장
            </span>
          </div>
        </div>
        <div className={cx(s.marq, s.b)} aria-hidden="true" />
        <div className={s.dbar}>
          <button
            type="button"
            className={s.sec}
            disabled={busyAll || opened === tickets.length}
            onClick={async () => {
              setBusyAll(true);
              await markTorn(tickets.filter((t) => !isTorn(t)).map((t) => t.number));
              setBusyAll(false);
            }}
          >
            모두 뜯기
          </button>
          <button type="button" className={s.pri} disabled={!torn} onClick={() => (last ? goResult() : setIdx(idx + 1))}>
            {last ? '결과 보기' : '다음 티켓'}
          </button>
        </div>
      </div>
    );
  }

  const openedCount = tickets.filter(isTorn).length;
  return (
    <KujiPage>
      <KujiHeader
        title="티켓 뜯기"
        onBack={() => navigate(`/kuji/${kujiId}`)}
        right={<span className={s.pill}>{`${openedCount} / ${tickets.length}`}</span>}
      />
      {body}
    </KujiPage>
  );
}
