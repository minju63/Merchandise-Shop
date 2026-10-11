import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../../api/store.api.js';
import Icon from './Icon.jsx';
import { PageState } from './StoreShell.jsx';
import StoreBusinessHours from './StoreBusinessHours.jsx';
import StorePickupInfo from './StorePickupInfo.jsx';
import StoreDeliveryInfo from './StoreDeliveryInfo.jsx';

const titles = {
  location: '찾아가기',
  hours: '영업시간',
  pickup: '픽업 안내',
  delivery: '배달 안내',
};

export default function StoreGuide({ type, store, onClose }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['store-guide', store.id, type],
    queryFn: () => storeApi.guide(store.id, type),
    enabled: Boolean(type && type !== 'location'),
    refetchInterval: type === 'hours' ? 60000 : false,
  });
  useEffect(() => {
    if (!type) return;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [type, onClose]);
  if (!type) return null;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.latitude && store.longitude ? `${store.latitude},${store.longitude}` : store.address)}`;
  return (
    <div className="guide-overlay" onClick={onClose}>
      <section
        className="guide-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={titles[type]}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grip" />
        <div className="sheet-title">
          <h2>{titles[type]}</h2>
          <button onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        {type === 'location' && (
          <div className="guide-content">
            <p>{store.address || '주소 정보가 없습니다.'}</p>
            {store.address && (
              <a className="map-link" href={mapUrl} target="_blank" rel="noreferrer">
                <Icon name="pin" size={18} /> 지도에서 보기
              </a>
            )}
          </div>
        )}
        {type !== 'location' &&
          (isPending ? (
            <div className="guide-content">
              <p>안내 정보를 불러오는 중입니다.</p>
            </div>
          ) : isError ? (
            <PageState onRetry={refetch}>{error.message}</PageState>
          ) : type === 'hours' ? (
            <StoreBusinessHours data={data.data} />
          ) : type === 'pickup' ? (
            <StorePickupInfo data={data.data} />
          ) : (
            <StoreDeliveryInfo data={data.data} />
          ))}
      </section>
    </div>
  );
}
