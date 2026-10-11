import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/user.routes.js';
import orderRoutes from './routes/order.routes.js';
import membershipRoutes from './routes/membership.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import addressRoutes from './routes/address.routes.js';
import paymentMethodRoutes from './routes/paymentMethod.routes.js';
import notificationSettingRoutes from './routes/notificationSetting.routes.js';
import authRoutes from './routes/auth.routes.js';
import checkoutRoutes from './routes/checkout.routes.js';
import supportRoutes from './routes/support.routes.js';
import reviewRoutes from './routes/review.routes.js';
import sellerApplicationRoutes from './routes/sellerApplication.routes.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({ ok: true });
});

// 라우터는 이 아래에 추가 (예: app.use('/api/v1/wishlist', wishlistRoutes))
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/memberships', membershipRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/payment-methods', paymentMethodRoutes);
app.use('/api/v1/notification-settings', notificationSettingRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/seller-applications', sellerApplicationRoutes);
// /notices · /faqs · /inquiries — 문서 기준으로 루트에 붙이므로 다른 라우터 뒤에 둔다.
app.use('/api/v1', supportRoutes);

// 404 — Express 5에서는 app.get('*') 대신 app.use() 사용
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// 에러 핸들러 — 반드시 맨 마지막, 인자 4개 고정
// Express 5는 async 핸들러에서 throw된 에러도 여기로 자동 전달됨
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`server on :${PORT}`));
