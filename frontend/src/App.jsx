import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import HomePage from './pages/home/HomePage.jsx';
import { homeMockData, homeMockUserState } from './pages/home/homeMockData.js';
import SearchPage, { SearchResultsPage } from './pages/search/SearchPage.jsx';
import { searchMockData } from './pages/search/searchMockData.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function logSearch(payload) {
  fetch(`${API_BASE_URL}/search/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // 검색 API가 아직 실행되지 않은 로컬 환경에서도 화면은 정상 동작해야 합니다.
  });
}

const searchProducts = [
  ...searchMockData.searchProducts,
  ...homeMockData.popularProducts,
  ...homeMockData.newProducts,
  ...homeMockData.upcomingProducts,
  ...homeMockData.lowStockProducts,
].filter((product, index, products) => (
  products.findIndex((candidate) => candidate.id === product.id) === index
));

function HomeRoute() {
  const navigate = useNavigate();
  return (
    <HomePage
      data={homeMockData}
      {...homeMockUserState}
      onSearch={() => navigate('/search')}
    />
  );
}

function SearchRoute() {
  const navigate = useNavigate();
  return (
    <SearchPage
      data={searchMockData}
      onBack={() => navigate(-1)}
      onSearch={(query) => navigate(`/search/results?q=${encodeURIComponent(query)}`)}
      onHome={() => navigate('/')}
    />
  );
}

function SearchResultsRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim();

  if (!query) return <Navigate to="/search" replace />;

  return (
    <SearchResultsPage
      key={query}
      initialQuery={query}
      data={searchMockData}
      products={searchProducts}
      onBack={() => navigate('/search')}
      onSearch={(nextQuery) => navigate(`/search/results?q=${encodeURIComponent(nextQuery)}`)}
      onLogSearch={logSearch}
      onHome={() => navigate('/')}
    />
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/search" element={<SearchRoute />} />
      <Route path="/search/results" element={<SearchResultsRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
