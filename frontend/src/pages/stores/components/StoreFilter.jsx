export default function StoreFilter({ filters, onChange }) {
  return (
    <div className="filter-row" aria-label="굿즈샵 빠른 필터">
      {[
        ['openNow', '영업 중'],
        ['pickup', '픽업 가능'],
        ['delivery', '배달 가능'],
      ].map(([key, label]) => (
        <button
          key={key}
          className={`filter-chip ${filters[key] ? 'selected' : ''}`}
          aria-pressed={filters[key]}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
