import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DetailSection, DetailShell, NoticeList } from '../home/BannerDetailParts.jsx';
import { fanApi } from '../../api/fan.api.js';
import { listPaymentMethods } from '../my/account.api.js';
import { useSession } from '../my/hooks.js';
import { PaymentMethodSheet } from './PaymentMethodPicker.jsx';
import { selectedPaymentName } from './paymentMethodPickerFormat.js';
import './FanCheer.css';
import './FanBillboard.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_AHEAD = 6;
// 꾸미기 기한이 게시 7일 전이라, 오늘부터 8일 뒤 날짜부터 신청할 수 있다.
const LEAD_DAYS = 8;
const won = (value) => value.toLocaleString('ko-KR');

// 한국 시간 기준 YYYY-MM-DD
function kstDate(offsetDays = 0) {
  const now = new Date(Date.now() + 9 * 3600000 + offsetDays * 86400000);
  return now.toISOString().slice(0, 10);
}
const pad = (value) => String(value).padStart(2, '0');
const toIso = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array(first).fill(null), ...Array.from({ length }, (_, index) => index + 1)];
}

function formatRange(dates) {
  const sorted = [...dates].sort();
  const runs = [];
  sorted.forEach((date) => {
    const last = runs[runs.length - 1];
    if (last && Date.parse(date) - Date.parse(last.end) === 86400000) last.end = date;
    else runs.push({ start: date, end: date });
  });
  const short = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
  return runs.map((run) => (run.start === run.end ? short(run.start) : `${short(run.start)}~${short(run.end)}`)).join(', ');
}

function Calendar({ blocked, selected, onToggle }) {
  const earliest = kstDate(LEAD_DAYS);
  const [year, month] = [Number(earliest.slice(0, 4)), Number(earliest.slice(5, 7)) - 1];
  const [offset, setOffset] = useState(0);
  const base = new Date(Date.UTC(year, month + offset, 1));
  const viewYear = base.getUTCFullYear();
  const viewMonth = base.getUTCMonth();
  return (
    <div className="fan-cal">
      <div className="fan-cal__head">
        <button type="button" aria-label="이전 달" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>‹</button>
        <strong>{viewYear}년 {viewMonth + 1}월</strong>
        <button type="button" aria-label="다음 달" disabled={offset >= MONTHS_AHEAD} onClick={() => setOffset(offset + 1)}>›</button>
      </div>
      <div className="fan-cal__grid">
        {WEEKDAYS.map((day) => <span key={day} className="fan-cal__week">{day}</span>)}
        {monthCells(viewYear, viewMonth).map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const iso = toIso(viewYear, viewMonth, day);
          const block = blocked[iso];
          const disabled = iso < earliest || Boolean(block);
          const picked = selected.includes(iso);
          const title = block?.reason === 'ANNIVERSARY' ? '기념일이 있는 날' : block ? '이미 신청된 날' : undefined;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              title={title}
              aria-pressed={picked}
              className={`fan-cal__day${picked ? ' is-picked' : ''}${block ? ` is-${block.reason.toLowerCase()}` : ''}`}
              onClick={() => onToggle(iso)}
            >
              {day}
              {block ? <small>{block.reason === 'ANNIVERSARY' ? '기념일' : '마감'}</small> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CharacterPicker({ value, onChange, onRequest }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const characters = useQuery({
    queryKey: ['fan-characters', 'FREE', debounced],
    queryFn: () => fanApi.characters({ slot: 'FREE', q: debounced || undefined }),
    retry: false,
  });
  const list = characters.data?.data.characters ?? [];
  return (
    <>
      <input
        className="fan-input"
        type="search"
        value={query}
        placeholder="캐릭터·작품 이름 검색"
        aria-label="최애 검색"
        onChange={(event) => setQuery(event.target.value)}
      />
      {characters.isFetching && !characters.data ? <p className="bd__empty">불러오는 중...</p> : null}
      {!characters.isFetching && !list.length ? <p className="bd__empty">검색 결과가 없어요</p> : null}
      <ul className="fan-list">
        {list.map((item) => (
          <li key={item.id}>
            <button type="button" aria-pressed={value?.id === item.id} className={value?.id === item.id ? 'is-on' : ''} onClick={() => onChange(item)}>
              <strong>{item.name}</strong>
              <span>{item.workTitle}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="fan-link" type="button" onClick={onRequest}>
        찾는 최애가 없나요? 최애 등록 요청 ›
      </button>
    </>
  );
}

const REVIEW_LABEL = { DRAFT: '꾸미는 중', SUBMITTED: '검수 중', APPROVED: '승인됨', REJECTED: '반려됨' };

function MyBillboards({ items, onDesign }) {
  if (!items.length) return null;
  return (
    <DetailSection title="내가 신청한 전광판" description="게시 7일 전 23:59까지 문구와 이미지를 꾸미고 검수를 요청해 주세요.">
      <ul className="fan-mine">
        {items.map((item) => (
          <li key={item.designId}>
            <div>
              <strong>{item.characterName}</strong>
              <small>{formatRange(Array.from({ length: item.days }, (_, index) => new Date(Date.parse(item.startDate) + index * 86400000).toISOString().slice(0, 10)))} · {item.days}일</small>
            </div>
            <span className={`fan-mine__status is-${item.reviewStatus.toLowerCase()}`}>{REVIEW_LABEL[item.reviewStatus]}</span>
            <button type="button" onClick={() => onDesign(item.designId)}>
              {item.reviewStatus === 'DRAFT' || item.reviewStatus === 'REJECTED' ? '꾸미기' : '보기'}
            </button>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}

export default function FanBillboardRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useSession();
  const loggedIn = status === 'in';
  useEffect(() => {
    if (status === 'out') navigate('/login?returnTo=%2Ffan%2Fbillboard', { replace: true });
  }, [status, navigate]);

  const [character, setCharacter] = useState(null);
  const [dates, setDates] = useState([]);
  const [paymentOption, setPaymentOption] = useState(null);
  const [methodId, setMethodId] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const range = useMemo(() => ({ from: kstDate(LEAD_DAYS), to: kstDate(31 * (MONTHS_AHEAD + 1)) }), []);
  const availability = useQuery({
    queryKey: ['fan-billboard-availability', range.from, range.to],
    queryFn: () => fanApi.billboardAvailability(range),
    enabled: loggedIn,
    retry: false,
  });
  const mine = useQuery({ queryKey: ['fan-billboard-mine'], queryFn: fanApi.myBillboards, enabled: loggedIn, retry: false });
  const methods = useQuery({ queryKey: ['fan-payment-methods'], queryFn: listPaymentMethods, enabled: loggedIn, retry: false });
  const bankAccounts = (methods.data?.items ?? []).filter((item) => item.method_type === 'BANK_ACCOUNT');

  const pricePerDay = availability.data?.data.pricePerDay ?? 500000;
  const blocked = availability.data?.data.blocked ?? {};
  const total = pricePerDay * dates.length;

  const book = useMutation({
    mutationFn: () => fanApi.bookBillboard({ characterId: character.id, dates, paymentOption, paymentMethodId: methodId, paymentAgreed: true }),
    onSuccess: () => {
      setDates([]);
      setAgreed(false);
      queryClient.invalidateQueries({ queryKey: ['fan-billboard-availability'] });
      queryClient.invalidateQueries({ queryKey: ['fan-billboard-mine'] });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['fan-billboard-availability'] }),
  });

  const toggle = (iso) => {
    book.reset();
    setDates((current) => (current.includes(iso) ? current.filter((date) => date !== iso) : [...current, iso].sort()));
  };
  const ready = Boolean(character && dates.length && paymentOption && agreed) && !book.isPending;

  return (
    <DetailShell
      title="자유 응원 전광판 신청"
      ready
      error={availability.error?.message}
      onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/fan/guide'))}
      footer={(
        <button className="bd__btn" type="button" disabled={!ready} onClick={() => book.mutate()}>
          {book.isPending ? '결제 중…' : dates.length ? `${won(total)}원 결제하고 신청하기` : '날짜를 선택해 주세요'}
        </button>
      )}
    >
      <DetailSection title="1. 응원할 최애" description="전광판에 올릴 최애를 골라 주세요.">
        <CharacterPicker value={character} onChange={setCharacter} onRequest={() => navigate('/my/support/inquiries/new')} />
      </DetailSection>

      <DetailSection title="2. 게시 날짜" description={`하루에 ${won(pricePerDay)}원이에요. 연속으로도, 나눠서도 고를 수 있어요.`}>
        <Calendar blocked={blocked} selected={dates} onToggle={toggle} />
        <p className="fan-cal__legend">
          <span className="is-anniversary">기념일</span> 최애 기념일 전광판이 걸리는 날은 신청할 수 없어요 ·
          <span className="is-booked">마감</span> 이미 다른 분이 신청한 날이에요
        </p>
        {dates.length ? (
          <p className="fan-cal__summary">
            <strong>{formatRange(dates)}</strong> · {dates.length}일 × {won(pricePerDay)}원 = <b>{won(total)}원</b>
          </p>
        ) : null}
      </DetailSection>

      <DetailSection title="3. 결제수단" description={dates.length ? `${won(total)}원을 결제해요.` : '날짜를 먼저 선택해 주세요.'}>
        <div className={paymentOption ? 'fan-payment-summary is-selected' : 'fan-payment-summary'}>
          <span className="fan-payment-summary__icon" aria-hidden="true">₩</span>
          <div>
            <strong>{selectedPaymentName(paymentOption, methodId, bankAccounts)}</strong>
            <small>{paymentOption ? (dates.length ? `${won(total)}원 결제 예정` : '선택됨') : '결제 전에 수단을 선택해 주세요'}</small>
          </div>
          <button type="button" onClick={() => setSheetOpen(true)}>{paymentOption ? '변경' : '선택'}</button>
        </div>
        <label className="fan-agree">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          선택한 결제수단으로 {won(total)}원을 결제하는 데 동의해요
        </label>
        {book.error ? <p className="fan-billboard__error" role="alert">{book.error.message}</p> : null}
        {book.isSuccess ? (
          <p className="fan-billboard__done" role="status">
            신청이 완료됐어요. 아래에서 전광판을 꾸미고 검수를 요청해 주세요.
          </p>
        ) : null}
        <p className="bd__caption">지금은 시연용 모의 결제라 실제 결제는 일어나지 않아요.</p>
      </DetailSection>

      <MyBillboards items={mine.data?.data ?? []} onDesign={(id) => navigate(`/fan/design/${id}`)} />

      <DetailSection title="신청 전에 확인해 주세요">
        <NoticeList
          items={[
            `하루 ${won(pricePerDay)}원이며, 선택한 날짜 수만큼 결제돼요.`,
            '최애 기념일 전광판이 걸리는 날과 이미 신청된 날은 선택할 수 없어요.',
            '게시 7일 전까지 꾸며야 해서, 오늘부터 8일 뒤 날짜부터 신청할 수 있어요.',
            '게시 7일 전 23:59까지 문구와 이미지를 꾸미고 검수를 요청해야 해요. 검수에서 승인되면 그날 홈에 게시돼요.',
            '부적절한 문구나 이미지는 반려될 수 있어요.',
          ]}
        />
      </DetailSection>

      {sheetOpen ? (
        <PaymentMethodSheet
          currentOption={paymentOption}
          currentMethodId={methodId}
          methods={bankAccounts}
          onAdd={() => navigate('/my/payment-methods')}
          onClose={() => setSheetOpen(false)}
          onConfirm={(option, id = null) => { setPaymentOption(option); setMethodId(id); setAgreed(false); }}
        />
      ) : null}
    </DetailShell>
  );
}
