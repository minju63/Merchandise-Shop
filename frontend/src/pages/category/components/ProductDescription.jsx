export default function ProductDescription({ description, spec, images = [] }) {
  return (
    <section className="category-section category-description">
      <h2>상품 설명</h2>
      {images.length > 0 && (
        <div className="category-description-images">
          {images.map((image, index) => (
            <img
              key={image.id || image.image_url || image.url || index}
              src={image.image_url || image.url}
              alt={`상품 상세 이미지 ${index + 1}`}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ))}
        </div>
      )}
      <p className="category-prewrap">{description || '등록된 상품 설명이 없습니다.'}</p>
      {spec && (
        <>
          <h3>상품 정보</h3>
          {typeof spec === 'object' && !Array.isArray(spec) ? (
            <dl className="category-spec">
              {Object.entries(spec).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="category-prewrap">
              {typeof spec === 'string' ? spec : JSON.stringify(spec)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
