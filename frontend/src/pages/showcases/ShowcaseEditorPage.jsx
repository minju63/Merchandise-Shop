import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { showcaseApi } from '../../api/showcase.api.js';
import { useRequireLogin } from '../my/hooks.js';
import ShowcaseBoard from './ShowcaseBoard.jsx';
import ShowcaseImage from './ShowcaseImage.jsx';
import './showcases.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const uuid = () => crypto.randomUUID();

export default function ShowcaseEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const signedIn = useRequireLogin('/login');
  const query = useQuery({ queryKey: ['showcase-editor', id], queryFn: () => showcaseApi.detail(id), enabled: signedIn, retry: false });
  const backgrounds = useQuery({ queryKey: ['showcase-backgrounds'], queryFn: showcaseApi.backgrounds, retry: false });
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [original, setOriginal] = useState(null);
  const [cutout, setCutout] = useState(null);
  const [goods, setGoods] = useState({ goods_name: '', work_title: '', character_name: '', note: '' });
  const [showProducts, setShowProducts] = useState(false);
  const products = useQuery({ queryKey: ['showcase-products', draft?.store_id],
    queryFn: () => showcaseApi.products(draft.store_id), enabled: Boolean(draft?.type === 'SHOP' && showProducts), retry: false });

  if (query.data && draft?.id !== query.data.id) setDraft(query.data);
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const change = (patch) => { setDraft((value) => ({ ...value, ...patch })); setDirty(true); };
  const updateItem = (itemId, patch) => {
    setDraft((value) => ({ ...value, items: value.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) }));
    setDirty(true);
  };
  const selectedItem = draft?.items?.find((item) => item.id === selected);
  const back = () => { if (!dirty || window.confirm('저장하지 않은 변경사항이 있어요. 이동할까요?')) navigate(-1); };
  const saveThumbnail = async (saved) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 500;
    const context = canvas.getContext('2d');
    const background = new Image();
    background.src = `/showcase/${saved.background_id}.svg`;
    await background.decode();
    context.drawImage(background, 0, 0, 400, 500);
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
    setBusy(true); setMessage('');
    try {
      const updated = await showcaseApi.save(id, {
        version: draft.version, name: draft.name, description: draft.description,
        backgroundId: draft.background_id, isPublic: draft.is_public,
        items: draft.items.map((item) => ({
          store_product_id: item.store_product_id, goods_name: item.goods_name,
          work_title: item.work_title, character_name: item.character_name,
          note: item.note, original_path: item.original_path, cutout_path: item.cutout_path,
          x: item.x, y: item.y, scale: item.scale, rotation: item.rotation, layer_order: item.layer_order,
        })),
      });
      setDraft(updated); setDirty(false); setMessage('저장했어요.');
      try { await saveThumbnail(updated); }
      catch { setMessage('배치는 저장했어요. 미리보기 파일은 저장하지 못했지만 진열장 화면에서 배치를 볼 수 있어요.'); }
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  const selectFile = async (event) => {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(chosen.type) || chosen.size > 6 * 1024 * 1024) {
      setMessage('PNG, JPG, WebP 사진(6MB 이하)을 선택해 주세요.'); return;
    }
    try {
      const image = await createImageBitmap(chosen);
      const valid = image.width >= 16 && image.height >= 16 && image.width <= 8000 && image.height <= 8000;
      image.close();
      if (!valid) { setMessage('사진 크기는 16~8000px이어야 해요.'); return; }
    } catch { setMessage('사진을 열 수 없어요. 다른 파일을 선택해 주세요.'); return; }
    setFile(chosen); setPreview(URL.createObjectURL(chosen)); setOriginal(null); setCutout(null); setMessage('');
  };
  const upload = async () => {
    if (!file || busy) return;
    setBusy(true); setMessage('');
    try { setOriginal(await showcaseApi.upload(id, 'original', file)); setCutout(null); }
    catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
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
    const item = { id: uuid(), store_product_id: null, ...goods,
      original_path: original.path, cutout_path: useCutout ? cutout?.path : null,
      imageUrl: useCutout ? cutout?.imageUrl : original.imageUrl,
      x: 0.5, y: 0.28, scale: 1, rotation: 0, layer_order: draft.items.length };
    change({ items: [...draft.items, item] });
    setSelected(item.id); setFile(null); setPreview(null); setOriginal(null); setCutout(null);
    setGoods({ goods_name: '', work_title: '', character_name: '', note: '' });
  };
  const addProduct = (product) => {
    const item = { id: uuid(), store_product_id: product.id, original_path: null, cutout_path: null,
      imageUrl: product.imageUrl, product: { name: product.name, imageUrl: product.imageUrl },
      x: 0.5, y: 0.28, scale: 1, rotation: 0, layer_order: draft.items.length };
    change({ items: [...draft.items, item] }); setSelected(item.id); setShowProducts(false);
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

  if (query.isPending) return <main className="showcase-page">진열장을 불러오는 중이에요…</main>;
  if (query.isError) return <main className="showcase-page"><button onClick={back}>뒤로</button><p>{query.error.message}</p><button onClick={() => query.refetch()}>다시 시도</button></main>;
  if (!draft) return null;
  return <div className="app-shell showcase-editor">
    <header className="showcase-header"><button onClick={back} aria-label="뒤로">‹</button><h1>진열장 편집</h1><button className="showcase-primary" disabled={busy || !dirty} onClick={save}>저장</button></header>
    <main className="showcase-page">
      <label className="showcase-field">진열장 이름<input value={draft.name} maxLength={80} onChange={(e) => change({ name: e.target.value })} /></label>
      <label className="showcase-field">설명<textarea value={draft.description ?? ''} maxLength={500} onChange={(e) => change({ description: e.target.value })} /></label>
      <ShowcaseBoard showcase={draft} items={draft.items} selectedId={selected} onSelect={setSelected}
        onMove={(itemId, x, y) => updateItem(itemId, { x, y })}
        onPinch={(itemId, factor) => updateItem(itemId, { scale: clamp((draft.items.find((item) => item.id === itemId)?.scale || 1) * factor, 0.25, 3) })} />
      <p className="showcase-hint">굿즈를 눌러 선택한 뒤 드래그하세요. PC와 모바일에서 배치를 조정할 수 있어요.</p>
      {selectedItem && <div className="showcase-tools" aria-label="선택한 굿즈 편집">
        <button onClick={() => updateItem(selected, { scale: clamp(selectedItem.scale - 0.1, 0.25, 3) })}>축소 −</button>
        <button onClick={() => updateItem(selected, { scale: clamp(selectedItem.scale + 0.1, 0.25, 3) })}>확대 +</button>
        <button onClick={() => updateItem(selected, { rotation: selectedItem.rotation <= -165 ? 180 : selectedItem.rotation - 15 })}>↶ 회전</button>
        <button onClick={() => updateItem(selected, { rotation: selectedItem.rotation >= 165 ? -180 : selectedItem.rotation + 15 })}>회전 ↷</button>
        <button onClick={() => moveLayer(-1)}>뒤로</button><button onClick={() => moveLayer(1)}>앞으로</button>
        {draft.type === 'SHOP' && <button disabled={busy} onClick={cutoutProduct}>자동 누끼</button>}
        <button onClick={() => { change({ items: draft.items.filter((item) => item.id !== selected) }); setSelected(null); }}>삭제</button>
      </div>}
      <div className="showcase-editor-section"><h2>배경 변경</h2>
        {backgrounds.isError && <p>{backgrounds.error.message} <button onClick={() => backgrounds.refetch()}>다시 시도</button></p>}
        <div className="showcase-backgrounds">{backgrounds.data?.map((background) => <button key={background.id} className={draft.background_id === background.id ? 'active' : ''} onClick={() => change({ background_id: background.id })}><span className={`showcase-board--${background.id}`} />{background.name}</button>)}</div>
      </div>
      <div className="showcase-editor-section"><h2>{draft.type === 'SHOP' ? '매장 상품 추가' : '굿즈 사진 추가'}</h2>
        {draft.type === 'SHOP' ? <><button className="showcase-primary" onClick={() => setShowProducts((v) => !v)}>상품 선택</button>
          {showProducts && <div className="showcase-product-picker">{products.isPending ? '상품을 불러오는 중이에요…' : products.isError ? <p>{products.error.message} <button onClick={() => products.refetch()}>다시 시도</button></p> : products.data?.length ? products.data.map((product) => <button key={product.id} onClick={() => addProduct(product)}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="showcase-image-fallback" aria-label="상품 이미지 없음" />}<span>{product.name}</span></button>) : '등록된 상품이 없어요.'}</div>}</>
          : <><input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} />
            {file && <><div className="showcase-image-compare"><div><strong>원본 사진</strong><img src={preview || ''} alt="선택한 원본" /></div><div><strong>배경 제거 결과</strong>{cutout ? <ShowcaseImage src={cutout.imageUrl} alt="배경 제거 결과" /> : <span>처리 전</span>}</div></div>
              {!original && <button disabled={busy} onClick={upload}>원본 업로드</button>}
              {original && <><p className="showcase-hint">배경 제거 시 사진이 remove.bg로 전송됩니다.</p><button disabled={busy} onClick={removeBackground}>자동 배경 제거</button>
                <div className="showcase-goods-fields">{[['goods_name','굿즈 이름'], ['work_title','작품명'], ['character_name','캐릭터명'], ['note','메모']].map(([key, label]) => <label key={key}>{label}<input maxLength={key === 'note' ? 300 : 100} value={goods[key]} onChange={(e) => setGoods((current) => ({ ...current, [key]: e.target.value }))} /></label>)}</div>
                <button onClick={() => addPersonal(false)}>원본으로 추가</button>{cutout && <button className="showcase-primary" onClick={() => addPersonal(true)}>배경 제거 결과 추가</button>}</>}
            </>}</>}
      </div>
      <label className="showcase-visibility"><input type="checkbox" checked={draft.is_public} onChange={(e) => change({ is_public: e.target.checked })} /> 공개하기</label>
      {message && <p role="status">{message}</p>}
      <button className="showcase-primary showcase-save-bottom" disabled={busy || !dirty} onClick={save}>진열장 저장</button>
    </main>
  </div>;
}
