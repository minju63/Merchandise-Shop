import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase.js';
import {
  createStoreInquiry,
  deleteStoreInquiry,
  listStoreInquiries,
  updateStoreInquiry,
} from '../../api/storeInquiry.api.js';
import { useDialog } from '../../components/useDialog.jsx';
import { InquiryList } from '../category/components/ProductInquirySection.jsx';
import { PageState, TabBar } from './components/StoreShell.jsx';
import Icon from './components/Icon.jsx';
import StoreInquirySheet from './components/StoreInquirySheet.jsx';
import './StoreInquiryPage.css';

function StoreInquiryContent({ storeId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const mutationLock = useRef(false);
  const mounted = useRef(false);
  const { confirm, dialog } = useDialog();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const session = useQuery({
    queryKey: ['store-inquiry-session'],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase 인증 설정이 없습니다.');
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    retry: false,
  });
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queryClient.setQueryData(['store-inquiry-session'], nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
  const user =
    !session.isError && session.data?.user && session.data.user.is_anonymous !== true
      ? session.data.user
      : null;
  const request = useQuery({
    queryKey: ['store-inquiries', storeId, page, user?.id ?? 'guest'],
    queryFn: ({ signal }) => listStoreInquiries(storeId, { page, signal }),
    refetchInterval: 30000,
    refetchOnMount: 'always',
    retry: false,
  });
  const close = useCallback(() => {
    if (window.history.state?.usr?.storeInquirySheet === storeId) {
      navigate(-1);
      return;
    }
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('write');
        return next;
      },
      { replace: true }
    );
  }, [setParams, storeId, navigate]);
  function login() {
    navigate(`/login?returnTo=${encodeURIComponent(`/stores/${storeId}/inquiries?write=1`)}`, {
      state: { notice: '로그인 후 굿즈샵에 문의할 수 있습니다.' },
    });
  }
  async function submit(input) {
    try {
      if (editing)
        await updateStoreInquiry(storeId, editing.id, {
          title: input.title,
          content: input.content,
        });
      else await createStoreInquiry(storeId, input);
    } catch (error) {
      if (error.status === 409)
        queryClient.invalidateQueries({ queryKey: ['store-inquiries', storeId] });
      throw error;
    }
    if (!editing) setPage(1);
    // A refresh failure must not turn an already committed insert into a failed submit.
    queryClient.invalidateQueries({ queryKey: ['store-inquiries', storeId] });
    setNotice(editing ? '문의가 수정되었습니다.' : '문의가 등록되었습니다.');
  }
  async function remove(inquiry) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setDeletingId(inquiry.id);
    try {
      if (
        !(await confirm('이 문의를 삭제할까요?', { confirmLabel: '삭제', danger: true })) ||
        !mounted.current
      )
        return;
      await deleteStoreInquiry(storeId, inquiry.id);
      queryClient.invalidateQueries({ queryKey: ['store-inquiries', storeId] });
      if (mounted.current) {
        setPage(1);
        setNotice('문의가 삭제되었습니다.');
      }
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ['store-inquiries', storeId] });
      if (mounted.current) {
        setNotice(error.message);
        if (error.status === 401) login();
      }
    } finally {
      mutationLock.current = false;
      if (mounted.current) setDeletingId(null);
    }
  }
  const data = request.data;
  return (
    <div className="app-shell store-inquiry-page">
      <header className="review-header">
        <button
          type="button"
          aria-label="뒤로가기"
          onClick={() => {
            if (params.get('write') === '1') close();
            else if (window.history.state?.idx > 0) navigate(-1);
            else navigate(`/stores/${storeId}`, { replace: true });
          }}
        >
          <Icon name="back" />
        </button>
        <h1>굿즈샵 Q&A</h1>
      </header>
      <main className="store-main review-main si-main">
        {request.isPending ? (
          <PageState>문의를 불러오는 중입니다.</PageState>
        ) : request.isError ? (
          <PageState onRetry={request.refetch}>{request.error.message}</PageState>
        ) : (
          <>
            <section className="review-summary">
              <h2>{data.store.name}</h2>
              <button
                className="review-write-button"
                type="button"
                disabled={session.isPending || session.isError}
                onClick={() => {
                  if (!user) login();
                  else {
                    setEditing(null);
                    setParams({ write: '1' }, { state: { storeInquirySheet: storeId } });
                  }
                }}
              >
                문의하기
              </button>
            </section>
            <section className="si-list-section" aria-label="굿즈샵 문의 목록">
              <strong>문의 {data.totalCount}개</strong>
              {data.items.length ? (
                <InquiryList
                  key={`${storeId}:${page}`}
                  items={data.items}
                  label="굿즈샵 문의"
                  storeInquiry
                  renderActions={(inquiry) =>
                    user &&
                    inquiry.isMine &&
                    inquiry.status === 'PENDING' && (
                      <div className="si-actions">
                        <button
                          type="button"
                          disabled={Boolean(deletingId)}
                          onClick={() => {
                            setEditing({ ...inquiry, editorId: user.id });
                            setParams({ write: '1' }, { state: { storeInquirySheet: storeId } });
                          }}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(deletingId)}
                          onClick={() => remove(inquiry)}
                        >
                          {deletingId === inquiry.id ? '삭제 중…' : '삭제'}
                        </button>
                      </div>
                    )
                  }
                />
              ) : (
                <PageState>
                  {data.totalCount
                    ? '이 페이지에는 문의가 없습니다.'
                    : '아직 등록된 문의가 없습니다.'}
                </PageState>
              )}
              <div className="pagination si-pagination">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={page <= 1 || request.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  이전
                </button>
                <span>{page} 페이지</span>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={page * 10 >= data.totalCount || request.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  다음
                </button>
              </div>
            </section>
          </>
        )}
        {session.isError && (
          <p className="si-note" role="alert">
            {session.error.message}{' '}
            <button type="button" onClick={() => session.refetch()}>
              인증 다시 확인
            </button>
          </p>
        )}
        {notice && (
          <p className="si-note" role="status">
            {notice}
          </p>
        )}
      </main>
      <TabBar />
      {dialog}
      {params.get('write') === '1' &&
        data &&
        !request.isError &&
        !session.isPending &&
        !session.isError &&
        (!editing || editing.editorId === user?.id) && (
          <StoreInquirySheet
            key={`${storeId}:${user?.id ?? 'guest'}:${editing?.id ?? 'new'}`}
            user={user}
            draftKey={`store-inquiry-draft:${storeId}:${user?.id ?? 'guest'}${editing ? `:edit:${editing.id}` : ''}`}
            onClose={close}
            onLogin={login}
            onSubmit={submit}
            inquiry={editing}
            locked={Boolean(
              editing && data.items.find((item) => item.id === editing.id)?.status === 'ANSWERED'
            )}
          />
        )}
    </div>
  );
}

export default function StoreInquiryPage() {
  const { storeId } = useParams();
  return <StoreInquiryContent key={storeId} storeId={storeId} />;
}
