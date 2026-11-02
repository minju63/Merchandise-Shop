// 담당: 연수
// 쿠지 결과: 등급 컬렉션 · 내 진열장(되팔기) · 금액 요약
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useRequireLogin } from '../my/hooks.js';
import { kujiApi } from './kuji.api.js';
import { GradeBadge, KujiHeader, KujiPage, Sheet, StateBox, Toast } from './KujiParts.jsx';
import { GRADES, SWAP_FEE, cx, gradeStyle, pad, won } from './kujiUi.js';
import s from './kuji.module.css';

export default function KujiResultPage() {
  const { kujiId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signedIn = useRequireLogin('/login');
  const [sale, setSale] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const detail = useQuery({ queryKey: ['kuji', kujiId, 'detail'], queryFn: () => kujiApi.detail(kujiId), retry: false });
  const mine = useQuery({ queryKey: ['kuji', kujiId, 'mine'], queryFn: () => kujiApi.myTickets(kujiId), enabled: signedIn, retry: false });

  const resale = useMutation({
    mutationFn: (number) => kujiApi.resale(kujiId, number),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['kuji', kujiId] });
      setSale(null);
      setToast(`${won(result.amount)}이 적립금으로 들어왔어요.`);
      setTimeout(() => setToast(''), 2600);
    },
    onError: (e) => setError(e.message),
  });

  const tickets = mine.data ?? [];
  const price = detail.data?.ticketPrice ?? 0;
  const prizes = detail.data?.prizes ?? [];
  const opened = tickets.filter((t) => t.openedAt);
  const closed = tickets.length - opened.length;
  const counts = {};
  opened.forEach((t) => {
    counts[t.grade] = (counts[t.grade] ?? 0) + 1;
  });
  const got = Object.keys(counts).length;
  const sorted = [...opened].sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade) || a.number - b.number);
  const topGrade = sorted[0]?.grade;
  const resoldTotal = opened.filter((t) => t.resoldAt).reduce((sum, t) => sum + t.buybackPrice, 0);
  const swaps = tickets.filter((t) => t.swapCount > 0).length;
  const hasVariants = (grade) => (prizes.find((p) => p.grade === grade)?.variants.length ?? 0) > 1;
  const expired = (t) => t.resaleUntil && new Date(t.resaleUntil) < new Date();

  let body;
  if (mine.error || detail.error) body = <StateBox message={(mine.error ?? detail.error).message} onRetry={() => { mine.refetch(); detail.refetch(); }} />;
  else if (!mine.data || !detail.data) body = <StateBox message="불러오는 중이에요" />;
  else if (!tickets.length) body = <StateBox message="이 쿠지에서 뽑은 티켓이 없어요." />;
  else if (!opened.length)
    body = (
      <div className={s['empty-msg']}>
        아직 뜯지 않은 티켓이 {tickets.length}장 있어요.
        <br />
        <button type="button" style={{ marginTop: 12, color: 'var(--primary)', fontWeight: 800 }} onClick={() => navigate(`/kuji/${kujiId}/draw`)}>
          티켓 뜯으러 가기
        </button>
      </div>
    );
  else
    body = (
      <>
        <div className={s.coll}>
          <h3>{topGrade === 'A' || topGrade === 'B' ? `${topGrade}상 당첨!` : `컬렉션 ${got}/6`}</h3>
          <p className={s.sub}>
            이번 쿠지의 등급 {got}개를 모았어요 · {opened.length}장 개봉
          </p>
          <div className={s.slots}>
            {GRADES.map((grade) =>
              counts[grade] ? (
                <div key={grade} style={gradeStyle(grade)}>
                  {grade}
                  {counts[grade] > 1 ? <span className={s.x}>×{counts[grade]}</span> : null}
                  <small>{grade}상</small>
                </div>
              ) : (
                <div key={grade} className={s.empty}>
                  ?<small>{grade}상</small>
                </div>
              )
            )}
          </div>
        </div>

        <div className={s.shelf}>
          <h4>내 진열장</h4>
          <p className={s.hint2}>마음에 안 드는 상품은 수령 전에 되팔 수 있어요.</p>
          <div className={s.items}>
            {sorted.map((t) => (
              <div key={t.ticketId} className={cx(s.item, t.resoldAt && s.resold)}>
                <div className={s.im} style={gradeStyle(t.grade)}>
                  {t.grade}
                </div>
                <b>{t.name}</b>
                <small>
                  No.{pad(t.number)} · {t.grade}상{hasVariants(t.grade) ? ` · ${t.variantLabel}` : ''}
                  {t.swapCount > 0 ? ' · 교환 완료' : ''}
                </small>
                {t.resoldAt ? (
                  <span className={s.rsold}>+{won(t.buybackPrice)} 적립</span>
                ) : t.listed ? (
                  <span className={s.rsold}>교환 대기 중</span>
                ) : (
                  <button type="button" className={s.rs} onClick={() => { setError(''); setSale(t); }}>
                    되팔기<em>{won(t.buybackPrice)}</em>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {closed ? (
          <div className={s.note} style={{ margin: '12px 16px 0' }}>
            아직 뜯지 않은 티켓이 {closed}장 있어요.{' '}
            <button type="button" style={{ color: 'var(--primary)', fontWeight: 800 }} onClick={() => navigate(`/kuji/${kujiId}/draw`)}>
              이어서 뜯기
            </button>
          </div>
        ) : null}

        <div className={s.pay}>
          <div className={s.row}>
            <span>구매 금액 ({tickets.length}장)</span>
            <b>{won(tickets.length * price)}</b>
          </div>
          {resoldTotal ? (
            <div className={s.row}>
              <span>되팔기 적립금</span>
              <b style={{ color: 'var(--primary)' }}>+{won(resoldTotal)}</b>
            </div>
          ) : null}
          {swaps ? (
            <div className={s.row}>
              <span>교환 수수료 ({swaps}건)</span>
              <b>{won(swaps * SWAP_FEE)}</b>
            </div>
          ) : null}
        </div>
      </>
    );

  return (
    <KujiPage>
      <KujiHeader
        title="뽑기 결과"
        onBack={() => navigate(`/kuji/${kujiId}`)}
        right={<span className={s.pill}>{tickets.length && closed === 0 ? '모두 열림' : '진행 중'}</span>}
      />
      <div className={cx(s.body, s.gray)}>{body}</div>
      <div className={s.rbar}>
        <button type="button" className={s.sec} onClick={() => navigate(`/kuji/${kujiId}`)}>
          더 뽑기
        </button>
        <button type="button" className={s.pri} onClick={() => navigate('/kuji')}>
          쿠지 목록
        </button>
      </div>

      {sale ? (
        <Sheet label="되팔기" onClose={() => setSale(null)}>
          <h3>이 상품을 되팔까요?</h3>
          <div className={s.who}>
            <GradeBadge grade={sale.grade} />
            <div>
              <b>{sale.name}</b>
              <small>
                No.{pad(sale.number)} · {sale.grade}상 · 정가 {won(sale.retailPrice)}
              </small>
            </div>
          </div>
          <div className={s.price}>
            <span>적립금으로 받기</span>
            <div>
              <b>{won(sale.buybackPrice)}</b>
              <small>등급별 고정 금액</small>
            </div>
          </div>
          <ul>
            <li>적립금은 굿즈픽에서만 쓸 수 있고 현금으로 바꿀 수 없어요.</li>
            <li>수령 전 상품만 되팔 수 있고, 뽑은 날부터 7일 안에 신청해요.</li>
            <li>한 번 되팔면 취소할 수 없어요.</li>
          </ul>
          {expired(sale) ? <p className={s.err}>뽑은 날부터 7일이 지나 되팔 수 없어요.</p> : null}
          {error ? <p className={s.err}>{error}</p> : null}
          <div className={s.btns}>
            <button type="button" className={s.sec} onClick={() => setSale(null)}>
              그대로 받기
            </button>
            <button type="button" className={s.pri} disabled={resale.isPending || expired(sale)} onClick={() => resale.mutate(sale.number)}>
              적립금으로 받기
            </button>
          </div>
        </Sheet>
      ) : null}
      <Toast message={toast} />
    </KujiPage>
  );
}
