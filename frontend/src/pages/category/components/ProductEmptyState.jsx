export default function ProductEmptyState({ message = '조건에 맞는 상품이 없습니다.', onRetry }) {
  return (
    <div className="category-empty" role="status">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
