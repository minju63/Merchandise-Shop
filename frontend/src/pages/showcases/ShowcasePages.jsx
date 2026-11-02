import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import BottomNavigation from '../../components/BottomNavigation.jsx';
import { showcaseApi } from '../../api/showcase.api.js';
import { cartApi } from '../../api/cart.api.js';
import { useRequireLogin, useSession } from '../my/hooks.js';
import StoreSort from '../stores/components/StoreSort.jsx';
import ShowcaseBoard from './ShowcaseBoard.jsx';
import ShowcaseImage from './ShowcaseImage.jsx';
import './showcases.css';

function Header({ title, action }) {
  const navigate = useNavigate();
  return <header className="showcase-header"><button type="button" onClick={() => navigate(-1)} aria-label="뒤로" />{title && <h1>{title}</h1>}{action}</header>;
}
function State({ query, empty }) {
  if (query.isPending) return <p className="showcase-state">진열장을 불러오는 중이에요…</p>;
  if (query.isError) return <p className="showcase-state">{query.error.message} <button onClick={() => query.refetch()}>다시 시도</button></p>;
  if (empty && !query.data?.items?.length) return <p className="showcase-state">{empty}</p>;
  return null;
}
export function ShowcaseCard({ showcase }) {
  const navigate = useNavigate();
  return <button type="button" className="showcase-card" onClick={() => navigate(`/showcases/${showcase.id}`)}>
    <div className="showcase-card__preview"><ShowcaseBoard showcase={showcase} cacheMedia /></div>
    <strong>{showcase.name}</strong>
    <span>{showcase.type === 'SHOP' ? showcase.storeName : `by ${showcase.ownerNickname}`}</span>
    <small>굿즈 {showcase.itemCount}개 · ♡ {showcase.likeCount}</small>
  </button>;
}
export function ShowcaseGallery({ type = 'PERSONAL', storeId, compact = false }) {
  const navigate = useNavigate();
  const dragState = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const pageSize = compact ? 5 : type === 'SHOP' ? 6 : 12;
  const categories = useQuery({ queryKey: ['showcase-categories'], queryFn: showcaseApi.categories, enabled: type === 'SHOP' && !compact, retry: false });
  const query = useQuery({ queryKey: ['showcases', type, storeId, sort, page, categoryId, compact],
    queryFn: () => showcaseApi.list({ type, storeId, sort, page, categoryId: categoryId || undefined, size: pageSize }), retry: false, staleTime: 60_000, refetchInterval: 60000 });
  const totalPages = Math.ceil((query.data?.totalCount ?? 0) / pageSize);
  const startRailDrag = (event) => {
    if (!compact || event.pointerType !== 'mouse' || event.button !== 0) return;
    dragState.current = { active: true, moved: false, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
  };
  const moveRailDrag = (event) => {
    if (!dragState.current.active) return;
    const distance = event.clientX - dragState.current.startX;
    if (!dragState.current.moved && Math.abs(distance) > 3) {
      dragState.current.moved = true;
      event.currentTarget.classList.add('is-dragging');
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (dragState.current.moved) event.currentTarget.scrollLeft = dragState.current.scrollLeft - distance;
  };
  const stopRailDrag = (event) => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    event.currentTarget.classList.remove('is-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const preventClickAfterDrag = (event) => {
    if (!dragState.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    dragState.current.moved = false;
  };
  return <section className={`showcase-gallery ${compact ? 'is-compact' : ''}`}>
    <div className="showcase-gallery__heading"><div><h2>{type === 'PERSONAL' ? '덕질 진열장' : '진열장 구경'}</h2>
      <p>{type === 'PERSONAL' ? '다른 팬들이 꾸민 진열장을 구경해 보세요' : '굿즈샵에서 꾸민 쇼핑 진열장을 둘러보세요'}</p></div>
      {compact ? <button type="button" onClick={() => navigate(type === 'PERSONAL' ? '/showcases' : '/stores?tab=showcases')}>전체보기 ›</button>
        : <div className="showcase-gallery__sort"><StoreSort value={sort} options={[{ value: 'popular', label: '인기순' }, { value: 'newest', label: '최신순' }]} onChange={(value) => { setSort(value); setPage(1); }} /></div>}
    </div>
    {type === 'SHOP' && !compact && <div className="showcase-filter-chips"><button className={!categoryId ? 'active' : ''} onClick={() => { setCategoryId(''); setPage(1); }}>전체</button>{categories.data?.map((category) => <button key={category.id} className={categoryId === category.id ? 'active' : ''} onClick={() => { setCategoryId(category.id); setPage(1); }}>{category.name}</button>)}</div>}
    <State query={query} empty="아직 공개된 진열장이 없어요." />
    {query.data?.items?.length > 0 && <div className="showcase-gallery__grid" onPointerDown={startRailDrag} onPointerMove={moveRailDrag} onPointerUp={stopRailDrag} onPointerCancel={stopRailDrag} onClickCapture={preventClickAfterDrag}>{query.data.items.map((item) => <ShowcaseCard key={item.id} showcase={item} />)}</div>}
    {!compact && totalPages > 0 && <nav className="showcase-pages" aria-label="진열장 페이지"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>이전</button><span aria-current="page">{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>다음</button></nav>}
  </section>;
}
export function ShowcaseGalleryPage() {
  const navigate = useNavigate();
  return <div className="app-shell"><Header title="덕질 진열장" action={<button type="button" className="showcase-primary" onClick={() => navigate('/my/showcases')}>내 진열장 관리</button>} /><main className="showcase-page"><ShowcaseGallery /></main><BottomNavigation /></div>;
}

export function ShowcaseManagePage({ type = 'PERSONAL' }) {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const signedIn = useRequireLogin('/login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['my-showcases', type, storeId],
    queryFn: () => showcaseApi.mine({ type, storeId }), enabled: signedIn, retry: false });
  const create = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const row = await showcaseApi.create({ type, storeId, name: type === 'SHOP' ? '새 쇼핑 진열장' : '새 진열장' });
      navigate(`/my/showcases/${row.id}/edit`, { state: { defaultPublic: true } });
    } catch (e) { setError(e.message); setBusy(false); }
  };
  const remove = async (id) => {
    if (!window.confirm('진열장을 삭제할까요?')) return;
    try { await showcaseApi.remove(id); query.refetch(); } catch (e) { setError(e.message); }
  };
  return <div className="app-shell"><Header title={type === 'SHOP' ? '매장 진열장' : '내 진열장'} action={<button type="button" className="showcase-primary" disabled={busy} onClick={create}>+ 새 진열장</button>} />
    <main className="showcase-page"><p className="showcase-hint">내 굿즈 사진으로 진열장을 꾸며보세요.</p>{error && <p role="alert">{error}</p>}
      <State query={query} empty="아직 만든 진열장이 없어요." />
      {query.data?.items?.map((row) => <article className="showcase-manage-card" key={row.id}>
        <div className="showcase-manage-card__preview"><ShowcaseBoard showcase={row} /></div>
        <div><h2>{row.name}</h2><p>{row.itemCount}개 · {row.is_public ? '공개' : '비공개'}</p>
          <div className="showcase-manage-card__actions"><button onClick={() => navigate(`/my/showcases/${row.id}/edit`)}>수정</button><button onClick={() => navigate(`/showcases/${row.id}`)}>미리보기</button><button onClick={() => remove(row.id)}>삭제</button></div>
        </div></article>)}
    </main><BottomNavigation /></div>;
}

function ProductSheet({ product, storeName, onClose }) {
  const navigate = useNavigate();
  const [type, setType] = useState(product.pickupAvailable ? 'PICKUP' : 'DELIVERY');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const available = product.status === 'ON_SALE' && product.stock > 0
    && (product.pickupAvailable || product.deliveryAvailable);
  const add = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await cartApi.addItem({ storeProductId: product.id, quantity: 1, fulfillmentType: type }); setMessage('장바구니에 담았어요.'); }
    catch (error) {
      if (error.status === 401 || error.message === '로그인이 필요합니다.') navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
      else setMessage(error.message);
    } finally { setBusy(false); }
  };
  return <div className="showcase-sheet-backdrop" onClick={onClose}><section className="showcase-product-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="상품 정보">
    <button type="button" className="showcase-sheet-close" onClick={onClose} aria-label="닫기">×</button>
    <div className="showcase-sheet-product">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="showcase-image-fallback" aria-label="상품 이미지 없음" />}<div><strong>{product.name}</strong><p>{storeName}</p><b>{Number(product.price).toLocaleString()}원</b><small>재고 {product.stock}개</small></div></div>
    <div className="showcase-sheet-options">{product.pickupAvailable && <label><input type="radio" checked={type === 'PICKUP'} onChange={() => setType('PICKUP')} /> 픽업</label>}{product.deliveryAvailable && <label><input type="radio" checked={type === 'DELIVERY'} onChange={() => setType('DELIVERY')} /> 배달</label>}</div>
    {message && <p role="status">{message}</p>}
    <div className="showcase-sheet-actions"><button onClick={() => navigate(`/products/${product.id}`)}>상품 상세 보기</button><button disabled={!available || busy} onClick={add}>{available ? '장바구니 담기' : '구매할 수 없어요'}</button></div>
  </section></div>;
}

function PersonalItemSheet({ item, onClose }) {
  return <div className="showcase-sheet-backdrop" onClick={onClose}>
    <section className="showcase-product-sheet showcase-personal-sheet" role="dialog" aria-label="굿즈 정보" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="showcase-sheet-close" onClick={onClose} aria-label="닫기">×</button>
      <div className="showcase-personal-sheet__body">
        <div className="showcase-personal-sheet__image"><ShowcaseImage src={item.imageUrl} alt={item.goods_name || '굿즈 사진'} /></div>
        <div><strong>{item.goods_name?.trim() || '굿즈 사진'}</strong>{item.work_title?.trim() && <p>작품명 · {item.work_title}</p>}</div>
      </div>
    </section>
  </div>;
}

export function ShowcaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const query = useQuery({ queryKey: ['showcase', id], queryFn: () => showcaseApi.detail(id), retry: false, refetchInterval: 30000 });
  const [selected, setSelected] = useState(null);
  const [selectedPersonal, setSelectedPersonal] = useState(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [message, setMessage] = useState('');
  const row = query.data;
  const isOwner = session.status === 'in' && row?.owner_id === session.session?.user?.id;
  const removeOwn = async () => {
    if (!isOwner || deleteBusy || !window.confirm('진열장을 삭제할까요? 삭제한 진열장은 복구할 수 없어요.')) return;
    setDeleteBusy(true); setDeleteError('');
    try {
      await showcaseApi.remove(id);
      navigate(row.type === 'SHOP' ? `/my/seller-center/stores/${row.store_id}/showcases` : '/my/showcases', { replace: true });
    } catch (error) { setDeleteError(error.message); setDeleteBusy(false); }
  };
  const toggleLike = async () => {
    if (!row || likeBusy) return;
    if (session.status === 'loading') return;
    if (session.status !== 'in') { navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`); return; }
    setLikeBusy(true);
    try { await showcaseApi.like(id, !row.liked); await query.refetch(); }
    catch (e) { setMessage(e.message); }
    finally { setLikeBusy(false); }
  };
  const choose = async (item) => {
    if (row?.type === 'PERSONAL') { setSelectedPersonal(item); return; }
    if (row?.type !== 'SHOP' || !item.store_product_id) return;
    try {
      const fresh = await showcaseApi.detail(id);
      setSelected(fresh.items.find((candidate) => candidate.id === item.id)?.product || null);
      if (!fresh.items.find((candidate) => candidate.id === item.id)?.product) setMessage('판매가 종료된 상품이에요.');
    } catch (e) { setMessage(e.message); }
  };
  return <div className="app-shell"><Header />
    <main className="showcase-page"><State query={query} />{!query.isError && row && <>
      <div className="showcase-detail-title"><h2>{row.name}</h2>
        {isOwner && <details className="showcase-owner-menu">
          <summary>관리</summary>
          <div className="showcase-owner-menu__panel">
            <button type="button" disabled={deleteBusy} onClick={() => navigate(`/my/showcases/${row.id}/edit`)}>수정하기</button>
            <button type="button" disabled={deleteBusy} onClick={removeOwn}>{deleteBusy ? '삭제 중…' : '삭제하기'}</button>
          </div>
        </details>}
      </div>
      {row.type === 'SHOP'
        ? <Link className="showcase-detail-owner showcase-detail-store" to={`/stores/${row.store_id}`}>{row.storeName}<span aria-hidden="true">›</span></Link>
        : <span className="showcase-detail-owner">by {row.ownerNickname}</span>}
      {row.description && <p>{row.description}</p>}
      {deleteError && <p role="alert">{deleteError}</p>}
      <ShowcaseBoard showcase={row} onItemClick={choose} />
      <p className="showcase-hint">{row.type === 'SHOP' ? '궁금한 굿즈를 눌러 상품 정보를 확인해 보세요' : '굿즈를 눌러 이름과 작품명을 확인해 보세요'}</p>
      <button className="showcase-like" type="button" disabled={likeBusy || row.owner_id === session.session?.user?.id} onClick={toggleLike}>{row.liked ? '♥' : '♡'} {row.likeCount}</button>
      {message && <p role="alert">{message}</p>}
    </>}</main><BottomNavigation />
    {row?.type === 'SHOP' && selected && <ProductSheet product={selected} storeName={row.storeName} onClose={() => setSelected(null)} />}
    {row?.type === 'PERSONAL' && selectedPersonal && <PersonalItemSheet item={selectedPersonal} onClose={() => setSelectedPersonal(null)} />}
  </div>;
}
