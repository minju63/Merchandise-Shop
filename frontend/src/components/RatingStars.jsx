const STAR_PATH = 'm12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z';

export default function RatingStars({ value = 0, className = '', size }) {
  const rating = Math.min(5, Math.max(0, Number(value) || 0));
  return (
    <span
      className={`rating-stars ${className}`.trim()}
      role="img"
      aria-label={`5점 만점에 ${rating}점`}
      style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle', flexShrink: 0, lineHeight: 1, fontSize: size }}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const filled = Math.min(1, Math.max(0, rating - index));
        return (
          <svg key={index} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
            <path d={STAR_PATH} fill="#e3e5eb" />
            <path d={STAR_PATH} fill="#f5ad27" style={{ clipPath: `inset(0 ${(1 - filled) * 100}% 0 0)` }} />
          </svg>
        );
      })}
    </span>
  );
}
