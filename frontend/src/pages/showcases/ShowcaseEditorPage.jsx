import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showcaseApi } from '../../api/showcase.api.js';
import { useRequireLogin } from '../my/hooks.js';
import ShowcaseBoard from './ShowcaseBoard.jsx';
import ShowcaseImage from './ShowcaseImage.jsx';
import './showcases.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const uuid = () => crypto.randomUUID();

export default function ShowcaseEditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signedIn = useRequireLogin('/login');
  const query = useQuery({ queryKey: ['showcase-editor', id], queryFn: () => showcaseApi.detail(id), enabled: signedIn, retry: false, refetchOnMount: 'always' });
  const backgrounds = useQuery({ queryKey: ['showcase-backgrounds'], queryFn: showcaseApi.backgrounds, retry: false });
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [backgroundEditing, setBackgroundEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [original, setOriginal] = useState(null);
  const [cutout, setCutout] = useState(null);
  const [goods, setGoods] = useState({ goods_name: '', work_title: '' });
  const [productChoice, setProductChoice] = useState(null);
  const [productCutout, setProductCutout] = useState(null);
  const [newNameError, setNewNameError] = useState(false);
  const [invalidItemId, setInvalidItemId] = useState(null);
  const [showProducts, setShowProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const fileSelection = useRef(0);
  const newNameInput = useRef(null);
  const selectedNameInput = useRef(null);
  const backgroundFileInput = useRef(null);
  const products = useQuery({ queryKey: ['showcase-products', draft?.store_id],
    queryFn: () => showcaseApi.products(draft.store_id), enabled: Boolean(draft?.type === 'SHOP' && showProducts), retry: false });
  const searchTerm = productSearch.trim().toLocaleLowerCase();
  const filteredProducts = products.data?.filter((product) =>
    (product.name ?? '').toLocaleLowerCase().includes(searchTerm)) ?? [];

  if (query.isSuccess && query.isFetchedAfterMount && !query.isFetching
    && (draft?.id !== query.data.id || (!dirty && draft.version !== query.data.version)))
    setDraft(location.state?.defaultPublic && draft?.id !== query.data.id
      ? { ...query.data, is_public: true } : query.data);
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (invalidItemId && selected === invalidItemId) selectedNameInput.current?.focus();
  }, [invalidItemId, selected]);
  const change = (patch) => { setDraft((value) => ({ ...value, ...patch })); setDirty(true); };
  const updateItem = (itemId, patch) => {
    setDraft((value) => ({ ...value, items: value.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) }));
    setDirty(true);
  };
  const selectedItem = draft?.items?.find((item) => item.id === selected);
  const removeItem = (itemId) => {
    change({ items: draft.items.filter((item) => item.id !== itemId) });
    if (invalidItemId === itemId) setInvalidItemId(null);
    setSelected(null);
  };
  const back = () => { if (!dirty || window.confirm('저장하지 않은 변경사항이 있어요. 이동할까요?')) navigate(-1); };
  const saveThumbnail = async (saved) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 500;
    const context = canvas.getContext('2d');
    if (saved.background_path && saved.backgroundUrl) {
      const photo = new Image();
      const photoUrl = URL.createObjectURL(await showcaseApi.image(saved.backgroundUrl));
      try {
        photo.src = photoUrl;
        await photo.decode();
        const scale = Math.max(400 / photo.width, 500 / photo.height);
        context.drawImage(photo, -(photo.width * scale - 400) * (saved.background_x ?? 0.5),
          -(photo.height * scale - 500) * (saved.background_y ?? 0.5),
          photo.width * scale, photo.height * scale);
      } finally { URL.revokeObjectURL(photoUrl); }
      context.fillStyle = '#ffffff38';
      context.fillRect(0, 0, 400, 500);
      for (const y of [155, 320, 480]) {
        context.fillStyle = '#ffffffb8'; context.fillRect(0, y, 400, 5);
        context.fillStyle = '#d7c9e1b8'; context.fillRect(0, y + 5, 400, 6);
      }
    } else {
      const background = new Image();
      background.src = `/showcase/${saved.background_id}.svg`;
      await background.decode();
      context.drawImage(background, 0, 0, 400, 500);
    }
    for (const item of [...saved.items].sort((a, b) => a.layer_order - b.layer_order)) {
      if (!item.imageUrl) throw new Error('굿즈 이미지를 불러오지 못했어요.');
      const snapshotImage = new Image();
      snapshotImage.crossOrigin = 'anonymous';
      let objectUrl;
      if (item.imageUrl.startsWith('/api/v1/showcases/')) {
        objectUrl = URL.createObjectURL(await showcaseApi.image(item.imageUrl));
        snapshotImage.src = objectUrl;
      } else snapshotImage.src = item.imageUrl;
      try {
        await snapshotImage.decode();
        context.save();
        context.translate(item.x * 400, item.y * 500);
        context.rotate(item.rotation * Math.PI / 180);
        const side = 104 * item.scale;
        context.drawImage(snapshotImage, -side / 2, -side / 2, side, side);
        context.restore();
      } finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('미리보기를 생성하지 못했어요.');
    await showcaseApi.upload(id, 'thumbnail', new File([blob], 'preview.png', { type: 'image/png' }));
  };
  const save = async () => {
    if (busy || !draft) return;
    if (backgroundEditing) { setMessage('배경 위치를 ✓ 버튼으로 확정해 주세요.'); return; }
    const unnamed = draft.type === 'PERSONAL' && draft.items.find((item) => !item.goods_name?.trim());
    if (unnamed) {
      setSelected(unnamed.id); setInvalidItemId(unnamed.id);
      if (unnamed.id === selected) selectedNameInput.current?.focus();
      return;
    }
    setBusy(true); setMessage('');
    try {
      const updated = await showcaseApi.save(id, {
        version: draft.version, name: draft.name, description: draft.description,
        backgroundId: draft.background_id, backgroundPath: draft.background_path ?? null,
        backgroundX: draft.background_x ?? 0.5, backgroundY: draft.background_y ?? 0.5,
        isPublic: draft.is_public,
        items: draft.items.map((item) => ({
          store_product_id: item.store_product_id,
          goods_name: draft.type === 'PERSONAL' ? item.goods_name.trim() : item.goods_name,
          work_title: item.work_title, character_name: item.character_name,
          note: item.note, original_path: item.original_path, cutout_path: item.cutout_path,
          x: item.x, y: item.y, scale: item.scale, rotation: item.rotation, layer_order: item.layer_order,
        })),
      });
      queryClient.setQueryData(['showcase-editor', id], updated);
      setDraft(updated); setDirty(false);
      try { await saveThumbnail(updated); }
      catch { setMessage('배치는 저장했어요. 미리보기 파일은 저장하지 못했지만 진열장 화면에서 배치를 볼 수 있어요.'); }
      queryClient.setQueryData(['showcase', id], updated);
      queryClient.invalidateQueries({ queryKey: ['showcase', id] });
      queryClient.invalidateQueries({ queryKey: ['my-showcases'] });
      queryClient.invalidateQueries({ queryKey: ['showcases'] });
      navigate(-1);
    } catch (e) {
      setMessage(e.status === 409
        ? '진열장 정보가 변경돼 저장하지 못했어요. 현재 편집 내용을 확인한 뒤 새로고침해 주세요.'
        : e.message);
    }
    finally { setBusy(false); }
  };
  const selectFile = async (event) => {
    const chosen = event.target.files?.[0];
    if (!chosen || busy) return;
    const selection = ++fileSelection.current;
    event.target.value = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(chosen.type) || chosen.size > 6 * 1024 * 1024) {
      if (selection === fileSelection.current) setMessage('PNG, JPG, WebP 사진(6MB 이하)을 선택해 주세요.');
      return;
    }
    try {
      const image = await createImageBitmap(chosen);
      const valid = image.width >= 16 && image.height >= 16 && image.width <= 8000 && image.height <= 8000;
      image.close();
      if (!valid) { if (selection === fileSelection.current) setMessage('사진 크기는 16~8000px이어야 해요.'); return; }
    } catch { if (selection === fileSelection.current) setMessage('사진을 열 수 없어요. 다른 파일을 선택해 주세요.'); return; }
    if (selection !== fileSelection.current) return;
    setFile(chosen); setPreview(URL.createObjectURL(chosen)); setOriginal(null); setCutout(null); setMessage('');
    await upload(chosen);
  };
  const selectBackground = async (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen || busy) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(chosen.type) || chosen.size > 6 * 1024 * 1024) {
      setMessage('배경은 PNG, JPG, WebP 사진(6MB 이하)을 선택해 주세요.'); return;
    }
    try {
      const bitmap = await createImageBitmap(chosen);
      const valid = bitmap.width >= 16 && bitmap.height >= 16 && bitmap.width <= 8000 && bitmap.height <= 8000;
      bitmap.close();
      if (!valid) { setMessage('배경 사진 크기는 16~8000px이어야 해요.'); return; }
    } catch { setMessage('배경 사진을 열 수 없어요. 다른 파일을 선택해 주세요.'); return; }
    setBusy(true); setBackgroundUploading(true); setMessage('');
    try {
      const uploaded = await showcaseApi.upload(id, 'background', chosen);
      change({ background_id: 'glass', background_path: uploaded.path, backgroundUrl: uploaded.imageUrl,
        background_x: 0.5, background_y: 0.5 });
      setSelected(null); setBackgroundEditing(true);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); setBackgroundUploading(false); }
  };
  const upload = async (chosen) => {
    if (!chosen || busy) return;
    setBusy(true); setUploading(true); setMessage('');
    try { setOriginal(await showcaseApi.upload(id, 'original', chosen)); setCutout(null); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); setUploading(false); }
  };
  const removeBackground = async () => {
    if (!original || busy) return;
    setBusy(true); setMessage('');
    try { setCutout(await showcaseApi.removeBackground(id, original.path)); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  const addPersonal = (useCutout) => {
    if (!original) return;
    if (!goods.goods_name.trim()) {
      setNewNameError(true); newNameInput.current?.focus();
      return;
    }
    const item = { id: uuid(), store_product_id: null,
      goods_name: goods.goods_name.trim(), work_title: goods.work_title.trim(),
      original_path: original.path, cutout_path: useCutout ? cutout?.path : null,
      imageUrl: useCutout ? cutout?.imageUrl : original.imageUrl,
      x: 0.5, y: 0.28, scale: 1, rotation: 0, layer_order: draft.items.length };
    change({ items: [...draft.items, item] });
    setSelected(item.id); setFile(null); setPreview(null); setOriginal(null); setCutout(null);
    setGoods({ goods_name: '', work_title: '' }); setNewNameError(false);
  };
  const addProduct = (useCutout) => {
    if (!productChoice || (useCutout && !productCutout)) return;
    const product = productChoice;
    const item = { id: uuid(), store_product_id: product.id, original_path: null,
      cutout_path: useCutout ? productCutout.path : null,
      imageUrl: useCutout ? productCutout.imageUrl : product.imageUrl,
      isSoldOut: product.stock <= 0,
      product: { name: product.name, imageUrl: product.imageUrl },
      x: 0.5, y: 0.28, scale: 1, rotation: 0, layer_order: draft.items.length };
    change({ items: [...draft.items, item] }); setSelected(item.id);
    setProductChoice(null); setProductCutout(null);
  };
  const cutoutProductChoice = async () => {
    if (!productChoice?.imageUrl || busy) return;
    setBusy(true); setMessage('');
    try { setProductCutout(await showcaseApi.removeProductBackground(id, productChoice.id)); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  const cutoutProduct = async () => {
    if (!selectedItem?.store_product_id || busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await showcaseApi.removeProductBackground(id, selectedItem.store_product_id);
      updateItem(selected, { cutout_path: result.path, imageUrl: result.imageUrl });
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  const moveLayer = (amount) => {
    const ordered = [...draft.items].sort((a, b) => a.layer_order - b.layer_order);
    const current = ordered.findIndex((item) => item.id === selected);
    const next = clamp(current + amount, 0, ordered.length - 1);
    [ordered[current], ordered[next]] = [ordered[next], ordered[current]];
    change({ items: ordered.map((item, index) => ({ ...item, layer_order: index })) });
  };

  if (query.isPending || (!query.isFetchedAfterMount && !query.isError)) return <main className="showcase-page">진열장을 불러오는 중이에요…</main>;
  if (query.isError) return <main className="showcase-page"><button onClick={back}>뒤로</button><p>{query.error.message}</p><button onClick={() => query.refetch()}>다시 시도</button></main>;
  if (!draft) return null;
  return <div className="app-shell showcase-editor">
    <header className="showcase-header"><button type="button" onClick={back} aria-label="뒤로" /><h1>진열장 편집</h1></header>
    <main className="showcase-page">
      <label className="showcase-field">진열장 이름<input value={draft.name} maxLength={80} onChange={(e) => change({ name: e.target.value })} /></label>
      <label className="showcase-field">설명<textarea value={draft.description ?? ''} maxLength={500} onChange={(e) => change({ description: e.target.value })} /></label>
      <ShowcaseBoard showcase={draft} items={draft.items} selectedId={backgroundEditing ? null : selected}
        onSelect={backgroundEditing ? undefined : setSelected}
        onRemove={backgroundEditing ? undefined : removeItem}
        onBackgroundMove={backgroundEditing ? (x, y) => change({ background_x: x, background_y: y }) : undefined}
        backgroundControls={backgroundEditing && <>
          <button type="button" aria-label="배경 위치 확정" title="배경 위치 확정"
            onClick={() => { setBackgroundEditing(false); setMessage(''); }}>✓</button>
          <button type="button" aria-label="배경 사진 제거" title="배경 사진 제거"
            onClick={() => { change({ background_id: 'glass', background_path: null, backgroundUrl: null,
              background_x: 0.5, background_y: 0.5 }); setBackgroundEditing(false); setMessage(''); }}>×</button>
        </>}
        onMove={backgroundEditing ? undefined : (itemId, x, y) => updateItem(itemId, { x, y })}
        onPinch={backgroundEditing ? undefined : (itemId, factor) => updateItem(itemId, { scale: clamp((draft.items.find((item) => item.id === itemId)?.scale || 1) * factor, 0.25, 3) })}
        onResize={backgroundEditing ? undefined : (itemId, scale) => updateItem(itemId, { scale: clamp(scale, 0.25, 3) })}
        onRotate={backgroundEditing ? undefined : (itemId, rotation) => updateItem(itemId, { rotation: ((rotation + 180) % 360 + 360) % 360 - 180 })} />
      <p className="showcase-hint">사진을 눌러 선택하세요. 드래그해 옮기고, 위쪽 손잡이로 회전하거나 오른쪽 아래 손잡이로 크기를 조절할 수 있어요. 우측 상단 X로 삭제할 수 있어요.</p>
      {backgroundEditing && <p className="showcase-hint">진열장의 빈 곳을 드래그해 배경 위치를 맞춘 뒤 ✓를 눌러 확정하세요. ×를 누르면 배경 사진이 사라져요.</p>}
      {selectedItem && draft.type === 'PERSONAL' && <div className="showcase-goods-fields showcase-selected-goods">
        <label><span>선택한 굿즈 이름 <span className="showcase-required" aria-hidden="true">*</span></span>
          <input ref={selectedNameInput} required maxLength={100} value={selectedItem.goods_name ?? ''}
            aria-invalid={invalidItemId === selected} aria-describedby={invalidItemId === selected ? 'showcase-selected-name-error' : undefined}
            onChange={(e) => { updateItem(selected, { goods_name: e.target.value }); if (e.target.value.trim()) setInvalidItemId(null); }} />
          {invalidItemId === selected && <small id="showcase-selected-name-error" className="showcase-field-error">굿즈 이름을 입력해 주세요.</small>}
        </label>
        <label>작품명 (선택)<input maxLength={100} value={selectedItem.work_title ?? ''} onChange={(e) => updateItem(selected, { work_title: e.target.value })} /></label>
      </div>}
      {selectedItem && <details className="showcase-tools">
        <summary className="showcase-tools__title">굿즈 수정하기
          <svg className="showcase-tools__chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
        </summary>
        <div className="showcase-tools__row"><span>크기</span>
          <button type="button" onClick={() => updateItem(selected, { scale: clamp(selectedItem.scale - 0.1, 0.25, 3) })}><span aria-hidden="true">−</span> 축소</button>
          <button type="button" onClick={() => updateItem(selected, { scale: clamp(selectedItem.scale + 0.1, 0.25, 3) })}><span aria-hidden="true">＋</span> 확대</button>
        </div>
        <div className="showcase-tools__row"><span>회전</span>
          <button type="button" onClick={() => updateItem(selected, { rotation: selectedItem.rotation <= -165 ? 180 : selectedItem.rotation - 15 })}><span aria-hidden="true">↶</span> 왼쪽</button>
          <button type="button" onClick={() => updateItem(selected, { rotation: selectedItem.rotation >= 165 ? -180 : selectedItem.rotation + 15 })}><span aria-hidden="true">↷</span> 오른쪽</button>
        </div>
        <div className="showcase-tools__row"><span>순서</span>
          <button type="button" onClick={() => moveLayer(-1)}><span aria-hidden="true">↓</span> 뒤로</button>
          <button type="button" onClick={() => moveLayer(1)}><span aria-hidden="true">↑</span> 앞으로</button>
        </div>
        <div className="showcase-tools__footer">
          {draft.type === 'SHOP' && (selectedItem.cutout_path
            ? <button type="button" disabled={busy || !selectedItem.product?.imageUrl}
              onClick={() => updateItem(selected, { cutout_path: null, imageUrl: selectedItem.product.imageUrl })}>원본 사진 사용</button>
            : <button type="button" disabled={busy || !selectedItem.product?.imageUrl} onClick={cutoutProduct}>자동 배경 제거</button>)}
          <button type="button" className="showcase-tools__delete" onClick={() => removeItem(selected)}>사진 삭제</button>
        </div>
      </details>}
      <div className="showcase-editor-section"><h2>배경 변경</h2>
        {backgrounds.isError && <p>{backgrounds.error.message} <button onClick={() => backgrounds.refetch()}>다시 시도</button></p>}
        <div className="showcase-backgrounds">{backgrounds.data?.map((background) => <button key={background.id} type="button"
          disabled={busy} className={draft.background_id === background.id && !draft.background_path ? 'active' : ''}
          onClick={() => { change({ background_id: background.id, background_path: null, backgroundUrl: null,
            background_x: 0.5, background_y: 0.5 }); setBackgroundEditing(false); }}>
          <span className={`showcase-board--${background.id}`} />{background.name}</button>)}
          <button type="button" className={`showcase-backgrounds__custom ${draft.background_path ? 'active' : ''}`}
            disabled={busy} onClick={() => backgroundFileInput.current?.click()}>
            <span className="showcase-backgrounds__custom-preview">{draft.backgroundUrl
              ? <ShowcaseImage src={draft.backgroundUrl} alt="선택한 배경 사진"
                style={{ objectPosition: `${(draft.background_x ?? 0.5) * 100}% ${(draft.background_y ?? 0.5) * 100}%` }} /> : '+'}</span>
            {backgroundUploading ? '올리는 중…' : '사진 +'}</button>
        </div>
        <input ref={backgroundFileInput} className="showcase-backgrounds__input" type="file"
          accept="image/png,image/jpeg,image/webp" aria-label="진열장 배경 사진 선택" onChange={selectBackground} />
        {draft.background_path && !backgroundEditing && <button type="button" onClick={() => { setSelected(null); setBackgroundEditing(true); }}>배경 위치 다시 조절</button>}
      </div>
      <div className="showcase-editor-section"><h2>{draft.type === 'SHOP' ? '매장 상품 추가' : '굿즈 사진 추가'}</h2>
        {draft.type === 'SHOP' ? <><button className="showcase-primary" disabled={busy} onClick={() => { setShowProducts((v) => !v); setProductSearch(''); }}>상품 선택</button>
          {showProducts && <div className="showcase-product-selection">
            <label className="showcase-product-search">상품 검색
              <input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="상품 이름을 입력하세요" />
            </label>
            {products.isSuccess && <p className="showcase-product-search-count">{filteredProducts.length}개 상품</p>}
            <div className="showcase-product-picker">{products.isPending ? '상품을 불러오는 중이에요…' : products.isError ? <p>{products.error.message} <button onClick={() => products.refetch()}>다시 시도</button></p> : filteredProducts.length ? filteredProducts.map((product) => <button key={product.id} disabled={busy} onClick={() => { setProductChoice(product); setProductCutout(null); setShowProducts(false); setProductSearch(''); setMessage(''); }}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="showcase-image-fallback" aria-label="상품 이미지 없음" />}<span>{product.name}</span></button>) : products.data?.length ? '검색 결과가 없어요.' : '등록된 상품이 없어요.'}</div>
          </div>}
          {productChoice && <><p className="showcase-hint">{productChoice.name}</p>
            <div className="showcase-image-compare"><div><strong>원본 상품 사진</strong><ShowcaseImage src={productChoice.imageUrl} alt="원본 상품 사진" /></div>
              <div><strong>배경 제거 결과</strong>{productCutout ? <ShowcaseImage src={productCutout.imageUrl} alt="배경 제거 결과" /> : <span>처리 전</span>}</div></div>
            <button type="button" disabled={busy || !productChoice.imageUrl} onClick={cutoutProductChoice}>{productCutout ? '배경 제거 다시 하기' : '자동 배경 제거'}</button>
            <p className="showcase-hint">배경 제거 시 상품 사진이 remove.bg로 전송됩니다.</p>
            <button type="button" disabled={busy} onClick={() => addProduct(false)}>원본으로 추가</button>
            {productCutout && <button type="button" className="showcase-primary" disabled={busy} onClick={() => addProduct(true)}>배경 제거 결과 추가</button>}
          </>}</>
          : <><input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={selectFile} />
            {file && <><div className="showcase-image-compare"><div><strong>원본 사진</strong><img src={preview || ''} alt="선택한 원본" /></div><div><strong>배경 제거 결과</strong>{cutout ? <ShowcaseImage src={cutout.imageUrl} alt="배경 제거 결과" /> : <span>처리 전</span>}</div></div>
              {uploading && <p role="status">사진을 업로드하는 중이에요…</p>}
              {!original && !uploading && <button onClick={() => upload(file)}>업로드 다시 시도</button>}
              <button disabled={!original || busy} onClick={removeBackground}>자동 배경 제거</button>
              <p className="showcase-hint">배경 제거 시 사진이 remove.bg로 전송됩니다.</p>
              <div className="showcase-goods-fields">
                <label><span>굿즈 이름 <span className="showcase-required" aria-hidden="true">*</span></span>
                  <input ref={newNameInput} required maxLength={100} value={goods.goods_name}
                    aria-invalid={newNameError} aria-describedby={newNameError ? 'showcase-new-name-error' : undefined}
                    onChange={(e) => { setGoods((current) => ({ ...current, goods_name: e.target.value })); if (e.target.value.trim()) setNewNameError(false); }} />
                  {newNameError && <small id="showcase-new-name-error" className="showcase-field-error">굿즈 이름을 입력해 주세요.</small>}
                </label>
                <label>작품명 (선택)<input maxLength={100} value={goods.work_title} onChange={(e) => setGoods((current) => ({ ...current, work_title: e.target.value }))} /></label>
              </div>
              <button disabled={!original || busy} onClick={() => addPersonal(false)}>원본으로 추가</button>{cutout && <button className="showcase-primary" disabled={busy} onClick={() => addPersonal(true)}>배경 제거 결과 추가</button>}
            </>}</>}
      </div>
      <label className="showcase-visibility">
        <span className="showcase-visibility__text"><strong>공개하기</strong><small>{draft.is_public ? '다른 사람도 이 진열장을 볼 수 있어요' : '나만 볼 수 있어요'}</small></span>
        <input type="checkbox" role="switch" checked={draft.is_public} onChange={(e) => change({ is_public: e.target.checked })} />
      </label>
      {message && <p role="status">{message}</p>}
      <button className="showcase-primary showcase-save-bottom" disabled={busy || !dirty || backgroundEditing} onClick={save}>진열장 저장</button>
    </main>
  </div>;
}
