function ImagePlaceholder({ label, accent = '#eee8ff' }) {
  return (
    <div className="product-card__image" style={{ '--placeholder-color': accent }} aria-hidden="true">
      <svg viewBox="0 0 24 24" role="presentation">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="10" r="2" />
        <path d="m5.5 17 4.2-4 3.1 2.7 2.3-2.1 3.4 3.4" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

export default function ProductCard({ product, rank, compact = false, onClick }) {
  const stockClass = product.stockTone === 'danger' ? ' product-card__stock--danger' : '';

  const handleKeyDown = (event) => {
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onClick();
  };

  return (
    <article
      className={`product-card${compact ? ' product-card--compact' : ''}${onClick ? ' product-card--clickable' : ''}`}
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="product-card__media">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <ImagePlaceholder label={product.category} accent={product.accent} />
        )}
        {rank ? <span className="product-card__rank">{rank}</span> : null}
        {product.isNew ? <span className="product-card__new">NEW</span> : null}
        {product.stockLabel ? (
          <span className="product-card__remaining">{product.stockLabel}</span>
        ) : null}
        <button className="product-card__wish" type="button" aria-label="찜 기능 준비 중" disabled>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.8 4.6a5.4 5.4 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7l1.1 1.1L12 21l7.7-7.6 1.1-1.1a5.4 5.4 0 0 0 0-7.7Z" />
          </svg>
        </button>
      </div>
      <div className="product-card__body">
        <p className="product-card__shop">{product.shop}</p>
        <h3>{product.name}</h3>
        <strong>{product.price}</strong>
        {product.stockText ? (
          <div className="product-card__meta">
            <span className={`product-card__stock${stockClass}`}>{product.stockText}</span>
            <span>{product.shipping}</span>
          </div>
        ) : null}
        {product.openAt ? <p className="product-card__open">{product.openAt}</p> : null}
      </div>
    </article>
  );
}
