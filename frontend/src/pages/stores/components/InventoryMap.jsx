import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function InventoryMap({ items, productMode, selectedId, onSelect, onBounds, center, focus }) {
  const host = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const callbacks = useRef({ onSelect, onBounds });
  useEffect(() => { callbacks.current = { onSelect, onBounds }; }, [onSelect, onBounds]);
  useEffect(() => {
    const instance = L.map(host.current).setView([37.556, 126.923], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).addTo(instance);
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);
    instance.on('moveend', () => {
      const b = instance.getBounds();
      callbacks.current.onBounds({ south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() });
    });
    return () => { instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!center) return;
    const point = L.circleMarker([center.lat, center.lng], {
      radius: 7, color: '#fff', weight: 3, fillColor: '#3478f6', fillOpacity: 1,
    }).addTo(map.current).bindTooltip('내 위치');
    return () => { point.remove(); };
  }, [center]);
  // 장소 이름으로 찾았을 때 그 장소를 표시한다.
  useEffect(() => {
    if (!focus) return;
    const point = L.circleMarker([focus.lat, focus.lng], {
      radius: 8, color: '#fff', weight: 3, fillColor: '#8047ca', fillOpacity: 1,
    }).addTo(map.current).bindTooltip(focus.name, { permanent: true, direction: 'top', offset: [0, -8] });
    return () => { point.remove(); };
  }, [focus]);
  useEffect(() => {
    layer.current.clearLayers();
    for (const store of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `inventory-pin${productMode && !store.inStock ? ' sold-out' : ''}${store.id === selectedId ? ' active' : ''}`;
      const symbol = document.createElement('span');
      symbol.className = 'inventory-pin-symbol';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '25');
      svg.setAttribute('height', '25');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M3 10 5 4h14l2 6v11H3V10ZM3 10c0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0M9 21v-6h6v6');
      svg.append(path);
      symbol.append(svg);
      const label = document.createElement('span');
      label.className = 'inventory-pin-label';
      label.textContent = store.name;
      button.append(symbol, label);
      // 재고가 10개 이하일 때만 개수를 보여주고, 11개 이상이면 매장 아이콘만 보인다.
      if (productMode && store.stock <= 10) {
        const stock = document.createElement('span');
        stock.className = 'inventory-pin-stock';
        stock.textContent = `${store.stock}개${store.inStock ? '' : ' · 품절'}`;
        button.append(stock);
      }
      button.setAttribute('aria-label', `${store.name}${productMode ? store.inStock ? ` 재고 ${store.stock}개` : ' 품절' : ''}`);
      button.setAttribute('aria-pressed', String(store.id === selectedId));
      button.onclick = () => callbacks.current.onSelect(store.id);
      L.marker([store.latitude, store.longitude], {
        icon: L.divIcon({ html: button, className: 'inventory-marker', iconSize: [120, 90], iconAnchor: [60, 46] }),
        keyboard: false, zIndexOffset: store.id === selectedId ? 1000 : 0,
      }).addTo(layer.current);
    }
    // Fit only when result membership changes; periodic inventory updates preserve the viewport.
  }, [items, productMode, selectedId]);
  const membership = items.map((s) => `${s.id}:${s.latitude}:${s.longitude}`).join('|');
  useEffect(() => {
    const points = items.map((s) => [s.latitude, s.longitude]);
    if (center) points.push([center.lat, center.lng]);
    if (focus) points.push([focus.lat, focus.lng]);
    if (points.length) map.current.fitBounds(points, { paddingTopLeft: [70, 60], paddingBottomRight: [70, 105], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membership, center, focus]);
  return <div className="inventory-map" ref={host} aria-label="굿즈샵 위치와 상품 재고 지도" />;
}
