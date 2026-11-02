// 담당: 연수
// 쿠지 티켓 한 장. 왼쪽 "천천히 넘기기" 탭을 오른쪽으로 끌면 겉면이 14조각으로 휘어 말려 올라가며 벗겨지고,
// 안쪽의 고객 보관용과 매장 제출용(상품)이 나온다.
import { useEffect, useRef } from 'react';
import s from './kuji.module.css';
import { GRADE_COLORS, cx, serialOf } from './kujiUi.js';

const N = 14; // 겉면 조각 수
const K0 = 26; // 조각 하나가 최대로 꺾이는 각도
const TAB_LABEL = '여기서부터 천천히 넘기기'.split('');

function qrCells(seedNum) {
  const cells = [];
  let x = seedNum;
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      const finder = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
      let on;
      if (finder) {
        const rr = r > 7 ? r - 8 : r;
        const cc = c > 7 ? c - 8 : c;
        on = (rr === 1 && cc === 1) || rr === 0 || rr === 2 || cc === 0 || cc === 2;
      } else {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        on = (x >> 8) % 2 === 0;
      }
      cells.push(on);
    }
  }
  return cells;
}

function CoverArt({ u, serial }) {
  return (
    <div className={s.art} style={{ left: `${(1 - (u * 273) / N).toFixed(2)}px` }}>
      <div className={s.seal}>쿠지</div>
      <h4>굿즈픽 쿠지</h4>
      <span className={s.free}>꽝 없는 한 장</span>
      <span className={s.ser}>No.{serial}</span>
      <div className={s.barcode} />
    </div>
  );
}

function StubArt({ ticket, serial, left }) {
  return (
    <div className={s.sart} style={{ left: `${left}px` }}>
      <div className={s.sh}>매장 제출용</div>
      <div className={s.sm}>구매 확인 후 상품을 받으세요</div>
      <div className={s.sb}>
        <div className={s.gr} style={{ color: GRADE_COLORS[ticket.grade]?.hi }}>
          {ticket.grade}
          <small>상</small>
        </div>
        <div className={s.nm}>{ticket.name}</div>
        <div className={s.sno}>No.{serial}</div>
      </div>
      <div className={s.sf}>※ 구매한 매장에서만 유효</div>
    </div>
  );
}

// u 번째 조각 안에 u-1 번째 조각이 겹쳐 붙는다. 가장 바깥(u = N-1)이 손으로 잡는 쪽이다.
function Strip({ u, serial, ticket }) {
  return (
    <div className={s.ps}>
      <div className={s.pf}>
        <CoverArt u={u} serial={serial} />
      </div>
      <div className={s.pb}>
        <StubArt ticket={ticket} serial={serial} left={(-((N - 1 - u) * 273) / N).toFixed(2)} />
      </div>
      {u > 0 ? <Strip u={u - 1} serial={serial} ticket={ticket} /> : null}
    </div>
  );
}

export default function TicketDeck({ ticket, torn, onTorn }) {
  const deckRef = useRef(null);
  const flapRef = useRef(null);
  const tabRef = useRef(null);
  const run = useRef({ busy: false, drag: null, raf: 0, timer: 0 });
  const serial = serialOf(ticket.number);
  const big = torn && (ticket.grade === 'A' || ticket.grade === 'B');

  useEffect(() => {
    const state = run.current;
    return () => {
      cancelAnimationFrame(state.raf);
      clearTimeout(state.timer);
    };
  }, []);

  const setFlap = (p) => {
    const flap = flapRef.current;
    const deck = deckRef.current;
    if (!flap || !deck) return;
    const front = p * N;
    const keff = front > 0 ? Math.min(K0, 178 / front) : 0;
    let cum = 0;
    const strips = flap.querySelectorAll(`.${s.ps}`);
    strips.forEach((strip, j) => {
      const u = N - 1 - j;
      const angle = keff * Math.max(0, Math.min(1, front - u));
      cum += angle;
      strip.style.transform = `rotateY(${angle.toFixed(2)}deg)`;
      strip.style.setProperty('--sd', (0.5 * (1 - Math.abs(Math.cos((cum * Math.PI) / 180)))).toFixed(3));
    });
    deck.style.setProperty('--sh', Math.min(1, p * 1.6).toFixed(3));
  };

  const autoTear = (from) => {
    const state = run.current;
    if (state.busy || torn) return;
    state.busy = true;
    const duration = 150 + (1 - from) * 650;
    let start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const q = Math.min(1, (ts - start) / duration);
      const eased = q * q * (3 - 2 * q);
      setFlap(from + (1 - from) * eased);
      if (q < 1) {
        state.raf = requestAnimationFrame(step);
        return;
      }
      if (flapRef.current) flapRef.current.style.transform = 'translate3d(80px,-120px,90px) rotateZ(16deg) scale(.7)';
      state.timer = setTimeout(() => onTorn(ticket), 420);
    };
    state.raf = requestAnimationFrame(step);
  };

  const onPointerDown = (event) => {
    const state = run.current;
    if (!tabRef.current?.contains(event.target) || state.busy || torn) return;
    state.drag = { x: event.clientX, p: 0, moved: false };
    try {
      tabRef.current.setPointerCapture(event.pointerId);
    } catch {
      /* 일부 환경에서는 포인터 캡처를 쓸 수 없다 */
    }
  };
  const onPointerMove = (event) => {
    const drag = run.current.drag;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    drag.p = Math.max(0, Math.min(1, dx / 190));
    setFlap(drag.p);
  };
  const endDrag = () => {
    const state = run.current;
    const drag = state.drag;
    if (!drag) return;
    state.drag = null;
    if (!drag.moved) autoTear(0);
    else if (drag.p > 0.55) autoTear(drag.p);
    else setFlap(0);
  };

  const cells = qrCells(ticket.number * 131 + 7);

  return (
    <div
      ref={deckRef}
      className={cx(s.deck, torn && s.done)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className={s.tboard} />
      <button
        type="button"
        ref={tabRef}
        className={s.tab}
        aria-label="티켓 겉면 넘기기"
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            autoTear(0);
          }
        }}
      >
        <span>
          {TAB_LABEL.map((char, index) => (
            <em key={index} className={char === ' ' ? s.gap : undefined}>
              {char === ' ' ? '' : char}
            </em>
          ))}
        </span>
        <i />
      </button>
      <div className={s.inner}>
        <div className={s.kh}>고객 보관용</div>
        <div className={s.kb}>
          <div className={s.qr}>
            {cells.map((on, index) => (
              <i key={index} className={on ? s.on : undefined} />
            ))}
          </div>
          <p>굿즈픽 앱에서 쿠지 번호를 입력하면 내 보관함에서 상품 수령 방법을 고를 수 있어요.</p>
        </div>
        <p className={s.fine}>※ 이 부분은 버리지 말고 보관해 주세요.</p>
        <div className={s.snum}>{serial}</div>
      </div>
      {torn ? (
        <div className={cx(s.piece, big && s.big)}>
          <StubArt ticket={ticket} serial={serial} left={0} />
        </div>
      ) : (
        <div className={s.flap} ref={flapRef}>
          <Strip u={N - 1} serial={serial} ticket={ticket} />
        </div>
      )}
    </div>
  );
}

