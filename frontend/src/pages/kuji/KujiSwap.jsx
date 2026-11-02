// 담당: 연수
// 쿠지 교환 탭: 같은 쿠지 · 같은 등급끼리만, 성사되면 한 사람당 1,990원
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { kujiApi } from './kuji.api.js';
import { GradeBadge, Sheet } from './KujiParts.jsx';
import { SWAP_FEE, agoText, cx, pad, won } from './kujiUi.js';
import s from './kuji.module.css';

export default function KujiSwap({ kuji, tickets, listings, signedIn, onLogin, onChanged }) {
  const [filter, setFilter] = useState('ALL');
  const [sheet, setSheet] = useState(null); // { type: 'post' | 'confirm' | 'done', ... }
  const [error, setError] = useState('');

  const variantsOf = (grade) => kuji.prizes.find((prize) => prize.grade === grade)?.variants ?? [];
  const swappable = kuji.prizes.filter((prize) => prize.variants.length > 1);
  const eligible = tickets.filter(
    (t) => t.openedAt && !t.resoldAt && !t.swapCount && !t.listed && variantsOf(t.grade).length > 1
  );
  const mine = listings.filter((l) => l.mine);
  const others = listings.filter((l) => !l.mine && (filter === 'ALL' || l.grade === filter));
  const close = () => {
    setSheet(null);
    setError('');
  };

  const post = useMutation({
    mutationFn: ({ number, wantId }) => kujiApi.swapPost(kuji.id, number, wantId),
    onSuccess: (result, { number }) => {
      onChanged();
      if (result.match) {
        const ticket = tickets.find((t) => t.number === number);
        setSheet({ type: 'confirm', ticket, listing: result.match, instant: true });
      } else close();
    },
    onError: (e) => setError(e.message),
  });
  const accept = useMutation({
    mutationFn: ({ ticket, listing }) => kujiApi.swapAccept(listing.id, ticket.number),
    onSuccess: (result) => {
      onChanged();
      setSheet({ type: 'done', result });
    },
    onError: (e) => {
      setError(e.message);
      onChanged();
    },
  });
  const cancel = useMutation({
    mutationFn: (listingId) => kujiApi.swapCancel(listingId),
    onSuccess: onChanged,
    onError: (e) => setError(e.message),
  });

  if (!signedIn)
    return (
      <div className={s.loginBox}>
        <p>로그인하면 교환글을 보고 올릴 수 있어요.</p>
        <button type="button" onClick={onLogin}>
          로그인
        </button>
      </div>
    );

  const matchTicket = (listing) =>
    eligible.find((t) => t.grade === listing.grade && t.variantId === listing.wantVariantId);

  return (
    <div>
      <div className={s.xnote}>
        <b>같은 쿠지 · 같은 등급끼리만</b> 바꿀 수 있어요. 교환이 성사되면 한 사람당 {won(SWAP_FEE)}이 결제되고,
        글이 대기 중일 때는 무료예요.
      </div>

      <div className={s.xhd}>
        <h4>내 교환글</h4>
        <button
          type="button"
          className={s.xpost}
          disabled={!eligible.length}
          onClick={() => setSheet({ type: 'post', number: eligible[0].number, wantId: null })}
        >
          교환글 올리기
        </button>
      </div>
      {mine.length ? (
        mine.map((l) => (
          <div key={l.id} className={s.xcard}>
            <GradeBadge grade={l.grade} />
            <div className={s.xb}>
              <span className={s.xh}>내놓음 {l.haveLabel}</span>
              <span className={s.xw}>원해요 {l.wantLabel}</span>
              <small>
                No.{pad(l.ticketNumber)} · 상대를 찾는 중
              </small>
            </div>
            <div className={s.xmine}>
              <button type="button" className={s.xlink} disabled={cancel.isPending} onClick={() => cancel.mutate(l.id)}>
                취소
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className={s.xempty}>
          {eligible.length ? (
            '올린 교환글이 없어요.'
          ) : (
            <>
              교환할 수 있는 상품이 없어요.
              <br />
              뜯은 상품 중 종류가 여러 개인 등급만 교환할 수 있어요.
            </>
          )}
        </p>
      )}
      {error && !sheet ? <p className={s.err}>{error}</p> : null}

      <div className={s.xhd}>
        <h4>교환글 목록</h4>
      </div>
      <div className={s.xchips}>
        {['ALL', ...swappable.map((prize) => prize.grade)].map((key) => (
          <button type="button" key={key} className={cx(s.xc, filter === key && s.on)} onClick={() => setFilter(key)}>
            {key === 'ALL' ? '전체' : `${key}상`}
          </button>
        ))}
      </div>
      {others.length ? (
        others.map((l) => {
          const ticket = matchTicket(l);
          return (
            <div key={l.id} className={s.xcard}>
              <GradeBadge grade={l.grade} />
              <div className={s.xb}>
                <span className={s.xh}>내놓음 {l.haveLabel}</span>
                <span className={s.xw}>원해요 {l.wantLabel}</span>
                <small>
                  {l.nick} · {agoText(l.createdAt)}
                </small>
              </div>
              <button
                type="button"
                className={s.xbtn}
                disabled={!ticket}
                onClick={() => setSheet({ type: 'confirm', ticket, listing: l, instant: false })}
              >
                {ticket ? '교환하기' : '내 상품 없음'}
              </button>
            </div>
          );
        })
      ) : (
        <p className={s.xempty}>이 등급의 교환글이 아직 없어요.</p>
      )}

      {sheet?.type === 'post' ? (
        <PostSheet
          eligible={eligible}
          variantsOf={variantsOf}
          sheet={sheet}
          setSheet={setSheet}
          kuji={kuji}
          error={error}
          pending={post.isPending}
          onClose={close}
          onSubmit={() => {
            setError('');
            post.mutate({ number: sheet.number, wantId: sheet.wantId });
          }}
        />
      ) : null}
      {sheet?.type === 'confirm' ? (
        <Sheet label="교환 확인" onClose={close}>
          <h3>{sheet.instant ? '바로 교환할 수 있어요' : '이 교환글과 바꿀까요?'}</h3>
          <div className={s.who}>
            <GradeBadge grade={sheet.ticket.grade} />
            <div>
              <b>{sheet.ticket.name}</b>
              <small>
                {sheet.ticket.grade}상끼리 교환 · 상대 {sheet.listing.nick}
              </small>
            </div>
          </div>
          <div className={s.xswap}>
            <div>
              <small>내가 주는 상품</small>
              <b>{sheet.ticket.variantLabel}</b>
            </div>
            <i>→</i>
            <div className={s.get}>
              <small>내가 받는 상품</small>
              <b>{sheet.listing.haveLabel}</b>
            </div>
          </div>
          <div className={s.price}>
            <span>교환 수수료 (한 사람당)</span>
            <div>
              <b>{won(SWAP_FEE)}</b>
            </div>
          </div>
          <ul>
            <li>성사되면 두 사람의 상품이 시스템에서 바로 바뀌어요.</li>
            <li>한 번 교환하면 취소할 수 없고, 같은 상품은 다시 교환할 수 없어요.</li>
          </ul>
          {error ? <p className={s.err}>{error}</p> : null}
          <div className={s.btns}>
            <button type="button" className={s.sec} onClick={close}>
              취소
            </button>
            <button
              type="button"
              className={s.pri}
              disabled={accept.isPending}
              onClick={() => {
                setError('');
                accept.mutate({ ticket: sheet.ticket, listing: sheet.listing });
              }}
            >
              {won(SWAP_FEE)} 결제하고 교환
            </button>
          </div>
        </Sheet>
      ) : null}
      {sheet?.type === 'done' ? (
        <Sheet label="교환 완료" onClose={close}>
          <div className={s.xdone}>
            <div className={s.ok}>✓</div>
            <h3 style={{ marginBottom: 6 }}>교환이 완료됐어요</h3>
            <p>
              {sheet.result.grade}상 {sheet.result.giveLabel} →{' '}
              <b style={{ color: 'var(--primary-deep)' }}>{sheet.result.getLabel}</b>
            </p>
            <p>
              {sheet.result.nick} 님과 교환 · {won(sheet.result.fee)} 결제됨
            </p>
          </div>
          <div className={s.btns} style={{ marginTop: 16 }}>
            <button type="button" className={s.pri} onClick={close}>
              확인
            </button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function PostSheet({ eligible, variantsOf, sheet, setSheet, error, pending, onClose, onSubmit }) {
  const ticket = eligible.find((t) => t.number === sheet.number) ?? eligible[0];
  const wants = variantsOf(ticket.grade).filter((variant) => variant.id !== ticket.variantId);
  return (
    <Sheet label="교환글 올리기" onClose={onClose}>
      <h3>교환글 올리기</h3>
      <div className={s.xlab} style={{ marginTop: 0 }}>
        내놓을 상품
      </div>
      {eligible.map((t) => (
        <button
          type="button"
          key={t.ticketId}
          className={cx(s.xpick, t.number === ticket.number && s.on)}
          onClick={() => setSheet({ ...sheet, number: t.number, wantId: null })}
        >
          <GradeBadge grade={t.grade} />
          <div>
            <b>
              {t.name} · {t.variantLabel}
            </b>
            <small>
              No.{pad(t.number)} · {t.grade}상
            </small>
          </div>
        </button>
      ))}
      <div className={s.xlab}>
        받고 싶은 종류 <span style={{ fontWeight: 400 }}>(같은 {ticket.grade}상 안에서만 고를 수 있어요)</span>
      </div>
      <div className={s.xvs}>
        {wants.map((variant) => (
          <button
            type="button"
            key={variant.id}
            className={cx(s.xv, sheet.wantId === variant.id && s.on)}
            onClick={() => setSheet({ ...sheet, wantId: variant.id })}
          >
            {variant.label}
          </button>
        ))}
      </div>
      <ul style={{ marginTop: 12 }}>
        <li>대기 중에는 수수료가 없고, 교환이 성사될 때 {won(SWAP_FEE)}이 결제돼요.</li>
        <li>상품 1개당 교환은 1번만 할 수 있어요.</li>
      </ul>
      {error ? <p className={s.err}>{error}</p> : null}
      <div className={s.btns}>
        <button type="button" className={s.sec} onClick={onClose}>
          취소
        </button>
        <button type="button" className={s.pri} disabled={!sheet.wantId || pending} onClick={onSubmit}>
          올리기
        </button>
      </div>
    </Sheet>
  );
}
