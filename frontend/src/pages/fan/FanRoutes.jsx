import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fanApi } from '../../api/fan.api.js';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../my/hooks.js';
import { listPaymentMethods } from '../my/account.api.js';
import FanCheerPage from './FanCheerPage.jsx';
import FanTicketsPage from './FanTicketsPage.jsx';
import FanResultPage from './FanResultPage.jsx';
import FanDesignPage from './FanDesignPage.jsx';
import FanRankingPage from './FanRankingPage.jsx';

const RANKING_REFRESH_MS = 5000;

// 로그인하지 않았다면 로그인 화면으로 보냈다가 돌아오게 한다.
function useRequireLogin(returnTo) {
  const navigate = useNavigate();
  const { status } = useSession();
  useEffect(() => {
    if (status === 'out') navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [status, navigate, returnTo]);
  return status === 'in';
}

const goBack = (navigate, fallback) => () => (window.history.length > 1 ? navigate(-1) : navigate(fallback));

export function FanTicketsRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loggedIn = useRequireLogin('/fan/tickets');
  const [method, setMethod] = useState('CASH');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [methodId, setMethodId] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const me = useQuery({ queryKey: ['fan-me'], queryFn: fanApi.me, enabled: loggedIn, retry: false });
  const tickets = useQuery({ queryKey: ['fan-tickets'], queryFn: fanApi.tickets, enabled: loggedIn, retry: false });
  // 현금 구매는 멤버십처럼 내 결제수단을 골라 결제한다
  const methods = useQuery({
    queryKey: ['fan-payment-methods'],
    queryFn: listPaymentMethods,
    enabled: loggedIn && method === 'CASH',
    retry: false,
  });
  const methodItems = methods.data?.items ?? [];
  const activeMethodId = methodId ?? methodItems.find((item) => item.is_default)?.id ?? methodItems[0]?.id ?? null;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fan-me'] });
    queryClient.invalidateQueries({ queryKey: ['fan-tickets'] });
  };
  const buy = useMutation({
    mutationFn: ({ kind, value }) => (kind === 'CASH' ? fanApi.buyWithCash(value, activeMethodId) : fanApi.buyWithCredit(value)),
    onSuccess: (response) => {
      refresh();
      setNotice(`응원권 ${response.data.bought}장을 구매했어요.`);
      setSelected(null);
      setAgreed(false);
    },
  });
  const refund = useMutation({
    mutationFn: fanApi.refundPack,
    onSuccess: (response) => {
      refresh();
      setNotice(`${response.data.amount.toLocaleString('ko-KR')}원을 ${response.data.source === 'CASH' ? '결제 취소로' : '적립금으로'} 돌려드렸어요.`);
    },
  });
  const mutationError = buy.error?.message ?? refund.error?.message;

  return (
    <FanTicketsPage
      me={me.data?.data}
      tickets={tickets.data?.data}
      method={method}
      selected={selected}
      working={buy.isPending || refund.isPending}
      error={mutationError ?? me.error?.message}
      notice={notice}
      paymentMethods={methods.data ? methodItems : undefined}
      paymentMethodId={activeMethodId}
      agreed={agreed}
      onSelectPaymentMethod={setMethodId}
      onAgree={setAgreed}
      onAddPaymentMethod={() => navigate('/my/payment-methods')}
      onBack={goBack(navigate, '/fan/guide')}
      onChangeMethod={(next) => { setMethod(next); setSelected(null); setNotice(''); buy.reset(); refund.reset(); }}
      onSelect={(value) => { setSelected(value); setNotice(''); buy.reset(); }}
      onBuy={() => buy.mutate({ kind: method, value: selected })}
      onRefund={(packId) => { setNotice(''); refund.mutate(packId); }}
      onCheer={() => navigate('/fan/cheer')}
    />
  );
}

export function FanCheerRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loggedIn = useRequireLogin('/fan/cheer');
  const [slot, setSlot] = useState('ANNIV');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const me = useQuery({ queryKey: ['fan-me'], queryFn: fanApi.me, enabled: loggedIn, retry: false });
  const characters = useQuery({
    queryKey: ['fan-characters', slot, debouncedQuery],
    queryFn: () => fanApi.characters({ slot, q: debouncedQuery || undefined }),
    enabled: loggedIn,
    placeholderData: (previous) => previous,
    retry: false,
  });
  const send = useMutation({
    mutationFn: ({ body }) => fanApi.sendCheers(body),
    onSuccess: (response, { eventDate }) => {
      queryClient.invalidateQueries({ queryKey: ['fan-me'] });
      queryClient.invalidateQueries({ queryKey: ['fan-ranking'] });
      const params = new URLSearchParams({ slot });
      if (eventDate) params.set('date', eventDate);
      navigate(`/fan/ranking?${params}`);
    },
  });

  return (
    <FanCheerPage
      me={me.data?.data}
      characters={characters.data?.data.characters ?? []}
      charactersLoading={characters.isFetching && !characters.data}
      slot={slot}
      query={query}
      sending={send.isPending}
      error={send.error?.message ?? me.error?.message}
      onBack={goBack(navigate, '/fan/guide')}
      onChangeSlot={(next) => { setSlot(next); setQuery(''); send.reset(); }}
      onChangeQuery={setQuery}
      onSubmit={(body, eventDate) => send.mutate({ body, eventDate })}
      onCharge={() => navigate('/fan/tickets')}
      onRequestAnniversary={() => navigate('/my/support/inquiries/new')}
    />
  );
}

export function FanRankingRoute() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const slot = searchParams.get('slot') === 'FREE' ? 'FREE' : 'ANNIV';
  const loggedIn = useSession().status === 'in';
  const dates = useQuery({
    queryKey: ['fan-anniversary-dates'],
    queryFn: fanApi.anniversaryDates,
    enabled: loggedIn,
    retry: false,
  });
  const dateList = dates.data?.data.dates ?? [];
  const date = searchParams.get('date') ?? dateList[0]?.date ?? '';
  const ranking = useQuery({
    queryKey: ['fan-ranking', slot, date, loggedIn],
    queryFn: () => fanApi.ranking({ slot, date: slot === 'ANNIV' ? date : undefined }),
    enabled: slot === 'FREE' || Boolean(date),
    refetchInterval: RANKING_REFRESH_MS,
    placeholderData: (previous) => previous,
    retry: false,
  });

  return (
    <FanRankingPage
      ranking={slot === 'ANNIV' && !date ? { items: [], open: true, applyEndAt: new Date().toISOString() } : ranking.data?.data}
      dates={dateList}
      slot={slot}
      date={date}
      loading={ranking.isFetching}
      error={ranking.error?.message}
      onBack={goBack(navigate, '/fan/guide')}
      onChangeSlot={(next) => setSearchParams({ slot: next }, { replace: true })}
      onChangeDate={(next) => setSearchParams({ slot, date: next }, { replace: true })}
      onCheer={() => navigate(loggedIn ? '/fan/cheer' : '/login?returnTo=%2Ffan%2Fcheer')}
    />
  );
}

export function FanResultRoute() {
  const navigate = useNavigate();
  const loggedIn = useRequireLogin('/fan/result');
  const result = useQuery({ queryKey: ['fan-results'], queryFn: fanApi.results, enabled: loggedIn, retry: false });

  return (
    <FanResultPage
      result={result.data?.data}
      error={result.error?.message}
      onBack={goBack(navigate, '/fan/guide')}
      onDesign={(designId) => navigate(`/fan/design/${designId}`)}
      onCheer={() => navigate('/fan/cheer')}
      onTickets={() => navigate('/fan/tickets')}
    />
  );
}

// 꾸미기 이미지는 Supabase Storage(fan-banner)에 본인 폴더로 직접 올리고, 서버에는 경로만 보낸다.
async function uploadDesignImage(designId, file, target) {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('로그인이 필요합니다.');
  const extension = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${designId}/${target}-${Date.now()}.${extension}`;
  const uploaded = await supabase.storage.from('fan-banner').upload(path, file, { contentType: file.type, upsert: true });
  if (uploaded.error) throw new Error('이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.');
  const signed = await supabase.storage.from('fan-banner').createSignedUrl(path, 3600);
  if (signed.error) throw new Error('이미지를 불러오지 못했어요.');
  return { path, url: signed.data.signedUrl };
}

export function FanDesignRoute() {
  const navigate = useNavigate();
  const { designId } = useParams();
  const queryClient = useQueryClient();
  const loggedIn = useRequireLogin(`/fan/design/${designId}`);
  const [saveState, setSaveState] = useState('');
  const [saveError, setSaveError] = useState('');
  const design = useQuery({
    queryKey: ['fan-design', designId],
    queryFn: () => fanApi.design(designId),
    enabled: loggedIn,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const save = useMutation({
    mutationFn: ({ payload, paths }) => fanApi.saveDesign(designId, { design: payload, ...paths }),
    onMutate: () => { setSaveState('saving'); setSaveError(''); },
    onSuccess: () => setSaveState('saved'),
    onError: (error) => { setSaveState('error'); setSaveError(error.message); },
  });
  const submit = useMutation({
    mutationFn: async ({ payload, paths }) => {
      await fanApi.saveDesign(designId, { design: payload, ...paths });
      return fanApi.submitDesign(designId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fan-design', designId] });
      queryClient.invalidateQueries({ queryKey: ['fan-results'] });
      navigate('/fan/result', { replace: true });
    },
    onError: (error) => setSaveError(error.message),
  });

  return (
    <FanDesignPage
      data={design.data?.data}
      saveState={saveState}
      error={design.error?.message ?? saveError}
      onBack={goBack(navigate, '/fan/result')}
      onSave={(payload, paths) => save.mutate({ payload, paths })}
      onSubmit={(payload, paths) => submit.mutate({ payload, paths })}
      onUpload={(file, target) => uploadDesignImage(designId, file, target)}
    />
  );
}
