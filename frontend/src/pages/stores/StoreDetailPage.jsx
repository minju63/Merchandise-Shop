import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../api/store.api.js';
import { PageState, StoreHeader, TabBar } from './components/StoreShell.jsx';
import StoreImageSlider from './components/StoreImageSlider.jsx';
import StoreInfo from './components/StoreInfo.jsx';
import StoreGuide from './components/StoreGuide.jsx';
import StoreProductSection from './components/StoreProductSection.jsx';

export default function StoreDetailPage() {
  const { storeId } = useParams();
  const [guide, setGuide] = useState(null);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => storeApi.detail(storeId),
    refetchInterval: 60000,
  });
  const store = data?.data;
  const searchContext = store ? { storeId: store.id, storeName: store.name } : null;
  return (
    <div className="app-shell">
      <StoreHeader back />
      <main className="store-main detail-main">
        {isPending ? (
          <div className="detail-skeleton" aria-label="굿즈샵 정보 불러오는 중" />
        ) : isError ? (
          <PageState onRetry={refetch}>{error.message}</PageState>
        ) : (
          <>
            <StoreImageSlider images={store.images} name={store.name} />
            <StoreInfo store={store} onGuide={setGuide} />
            <StoreProductSection storeId={storeId} searchContext={searchContext} />
          </>
        )}
      </main>
      <TabBar />
      {store && <StoreGuide type={guide} store={store} onClose={() => setGuide(null)} />}
    </div>
  );
}
