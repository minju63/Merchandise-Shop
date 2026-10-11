// 팀 라우터/로그인이 아직 없어서 마이 화면만 단독으로 띄우는 개발용 진입점이다.
// 실행: npm run dev → http://localhost:5173/src/pages/my/dev/index.html
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CheckoutPage from '../../common/CheckoutPage.jsx';
import LoginPage from '../../common/LoginPage.jsx';
import OrderCompletePage from '../../common/OrderCompletePage.jsx';
import SignupDonePage from '../../common/SignupDonePage.jsx';
import SignupFormPage from '../../common/SignupFormPage.jsx';
import SignupTermsPage from '../../common/SignupTermsPage.jsx';
import { Stub } from './DevTools.jsx';
import MyPage from '../MyPage.jsx';
import AddressFormPage from '../AddressFormPage.jsx';
import AddressesPage from '../AddressesPage.jsx';
import CouponsPage from '../CouponsPage.jsx';
import MembershipPage from '../MembershipPage.jsx';
import OrderDetailPage from '../OrderDetailPage.jsx';
import OrdersPage from '../OrdersPage.jsx';
import NotificationSettingsPage from '../NotificationSettingsPage.jsx';
import ReviewWritePage from '../ReviewWritePage.jsx';
import SellerApplyPage from '../SellerApplyPage.jsx';
import SupportPage from '../SupportPage.jsx';
import ProfilePage from '../ProfilePage.jsx';
import PaymentMethodsPage from '../PaymentMethodsPage.jsx';

// ?p=/login 처럼 시작 경로를 고를 수 있다. ?demo=checkout 은 테스트 상품 2개로 결제 화면을 연다.
const query = new URLSearchParams(window.location.search);
const DEMO_ITEMS = [
  { storeProductId: '30000000-0000-4000-8000-000000000001', quantity: 1 },
  { storeProductId: '30000000-0000-4000-8000-000000000002', quantity: 1 },
];
const initialEntry =
  query.get('demo') === 'checkout'
    ? { pathname: '/checkout', state: { mode: 'DIRECT', items: DEMO_ITEMS } }
    : (query.get('p') ?? '/');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<MyPage />} />
        <Route path="/my/orders" element={<OrdersPage />} />
        <Route path="/my/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="/my/membership" element={<MembershipPage />} />
        <Route path="/my/coupons" element={<CouponsPage />} />
        <Route path="/my/addresses" element={<AddressesPage />} />
        <Route path="/my/addresses/new" element={<AddressFormPage />} />
        <Route path="/my/addresses/:addressId/edit" element={<AddressFormPage />} />
        <Route path="/my/payment-methods" element={<PaymentMethodsPage />} />
        <Route path="/my/settings/notifications" element={<NotificationSettingsPage />} />
        <Route path="/my/profile" element={<ProfilePage />} />
        <Route path="/my/orders/:orderId/review" element={<ReviewWritePage />} />
        <Route path="/my/support" element={<SupportPage />} />
        <Route path="/my/seller-apply" element={<SellerApplyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupTermsPage />} />
        <Route path="/signup/info" element={<SignupFormPage />} />
        <Route path="/signup/done" element={<SignupDonePage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/complete/:groupId" element={<OrderCompletePage />} />
        <Route path="*" element={<Stub />} />
      </Routes>
    </MemoryRouter>
  </StrictMode>
);
