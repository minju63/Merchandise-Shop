import { useEffect, useId, useRef, useState } from 'react';

// Mount only while open, so draft filters start from the latest applied URL values.
export default function ProductFilterSheet({
  filters,
  regions = [],
  onApply,
  onClose,
  initialSection = 'all',
}) {
  const [draft, setDraft] = useState({ ...filters });
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    element.querySelector(`[data-filter-control="${initialSection}"]`)?.focus();
    return () => element.close();
  }, [initialSection]);
  const update = (name, value) => setDraft((current) => ({ ...current, [name]: value }));
  function submit(event) {
    event.preventDefault();
    for (const name of ['minPrice', 'maxPrice']) {
      if (
        draft[name] &&
        (!/^\d+$/.test(draft[name]) || !Number.isSafeInteger(Number(draft[name])))
      ) {
        setError('가격은 0 이상의 정수로 입력해 주세요.');
        return;
      }
    }
    if (draft.minPrice && draft.maxPrice && Number(draft.minPrice) > Number(draft.maxPrice)) {
      setError('최소 가격은 최대 가격보다 클 수 없습니다.');
      return;
    }
    onApply(draft);
  }
  return (
    <dialog
      ref={dialog}
      className="category-filter-sheet"
      aria-labelledby={titleId}
      onCancel={onClose}
    >
      <form onSubmit={submit}>
        <div className="category-section-heading">
          <h2 id={titleId}>상세 필터</h2>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </div>
        <fieldset>
          <legend>가격</legend>
          <label>
            최소 가격
            <input
              type="number"
              data-filter-control="price"
              min="0"
              step="1"
              value={draft.minPrice || ''}
              onChange={(event) => update('minPrice', event.target.value)}
            />
          </label>
          <label>
            최대 가격
            <input
              type="number"
              min="0"
              step="1"
              value={draft.maxPrice || ''}
              onChange={(event) => update('maxPrice', event.target.value)}
            />
          </label>
        </fieldset>
        <label>
          지역
          <select
            data-filter-control="region"
            value={draft.regionId || ''}
            onChange={(event) => update('regionId', event.target.value)}
          >
            <option value="">전체 지역</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        {[
          ['inStock', '구매 가능한 상품만'],
          ['pickup', '픽업 가능'],
          ['delivery', '배송 가능'],
        ].map(([name, label]) => (
          <label className="category-checkbox" key={name}>
            <input
              type="checkbox"
              data-filter-control={name === 'inStock' ? 'status' : undefined}
              checked={draft[name] === 'true'}
              onChange={(event) => update(name, event.target.checked ? 'true' : '')}
            />
            {label}
          </label>
        ))}
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="category-primary">
          필터 적용
        </button>
      </form>
    </dialog>
  );
}
