import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CategoryPreview from './CategoryPreview';
import '../../../index.css';

const live = new URLSearchParams(window.location.search).get('live') === '1';
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CategoryPreview live={live} />
  </StrictMode>
);
