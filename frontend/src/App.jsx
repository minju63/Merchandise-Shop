import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StoreListPage from './pages/stores/StoreListPage.jsx';
import StoreDetailPage from './pages/stores/StoreDetailPage.jsx';
import StoreReviewPage from './pages/stores/StoreReviewPage.jsx';
import StoreReviewWritePage from './pages/stores/StoreReviewWritePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/stores" replace />} />
          <Route path="/stores" element={<StoreListPage />} />
          <Route path="/stores/:storeId" element={<StoreDetailPage />} />
          <Route path="/stores/:storeId/reviews" element={<StoreReviewPage />} />
          <Route path="/stores/:storeId/reviews/write" element={<StoreReviewWritePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/stores" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
