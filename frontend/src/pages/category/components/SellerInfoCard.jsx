import { Link } from 'react-router-dom';

export default function SellerInfoCard({ store, storeId, storeName }) {
  const region = store?.region || store?.regions;
  return (
    <section className="category-section category-seller">
      <h2>이 상품을 취급하는 굿즈샵</h2>
      <Link
        className="category-seller-card"
        to={`/stores/${encodeURIComponent(storeId || store.id)}`}
      >
        <div className="category-seller-thumbnail" aria-hidden="true">
          ⌂
          {store?.thumbnail_url && (
            <img
              src={store.thumbnail_url}
              alt=""
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
        </div>
        <div>
          <h3>{storeName || store?.name}</h3>
          {region?.name && <p>{region.name}</p>}
          {store?.address && <p>⌖ {store.address}</p>}
        </div>
        <span aria-hidden="true">›</span>
      </Link>
    </section>
  );
}
