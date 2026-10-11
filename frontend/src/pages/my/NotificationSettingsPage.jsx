import { useState } from 'react';
import { getNotificationSettings, updateNotificationSettings } from './account.api.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './settings.css';

const GROUPS = [
  {
    title: '주문·혜택',
    rows: [
      [
        'order_status',
        'orderStatus',
        '주문 상태 알림',
        '결제, 준비 완료, 배송 상태가 바뀌면 알려드려요',
      ],
      ['restock', 'restock', '재입고 알림', '신청한 상품이 다시 들어오면 알려드려요'],
      ['liked_store_news', 'likedStoreNews', '관심 매장 소식', '찜한 매장의 새 소식을 알려드려요'],
      ['coupon_expiry', 'couponExpiry', '쿠폰 만료 알림', '만료가 가까운 쿠폰을 알려드려요'],
      ['inquiry_answer', 'inquiryAnswer', '문의 답변 알림', '문의에 답변이 달리면 알려드려요'],
    ],
  },
  {
    title: '마케팅',
    rows: [
      ['marketing', 'marketing', '마케팅 정보 수신', '이벤트와 혜택 소식을 받아요'],
      ['night_push', 'nightPush', '야간 푸시 수신', '오후 9시~오전 8시에도 받아요'],
    ],
  },
];

function Switch({ on }) {
  return <span className={on ? 'set-switch is-on' : 'set-switch'} />;
}

export default function NotificationSettingsPage() {
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const settings = useRequest(signedIn, 'notification-settings', getNotificationSettings);
  const [override, setOverride] = useState(null);
  const values = override ?? settings.data?.settings ?? settings.data ?? null;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied';

  const toggle = async (column, key) => {
    if (busy || !values) return;
    const previous = values;
    const next = !values[column];
    const optimistic = { ...values, [column]: next };
    if (column === 'marketing' && !next) optimistic.night_push = false;
    setOverride(optimistic);
    setBusy(true);
    setError('');
    try {
      const saved = await updateNotificationSettings({ [key]: next });
      setOverride(saved.settings ?? saved);
    } catch (cause) {
      setOverride(previous);
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (settings.error) body = <ErrorNotice error={settings.error} onRetry={settings.reload} />;
  else if (!values) body = <Loading />;
  else
    body = (
      <>
        {blocked ? (
          <div className="set-banner">
            <p>브라우저에서 알림이 꺼져 있어요. 주소창 옆 사이트 설정에서 켜 주세요.</p>
          </div>
        ) : null}
        <section className="set-section">
          <button
            type="button"
            className="set-row"
            onClick={() => toggle('push_enabled', 'pushEnabled')}
          >
            <span className="set-row__text">
              푸시 알림
              <small>모든 푸시 알림을 한 번에 켜고 꺼요</small>
            </span>
            <Switch on={values.push_enabled} />
          </button>
        </section>
        {GROUPS.map((group) => (
          <section key={group.title} className="set-section">
            <h2 className="set-title">{group.title}</h2>
            {group.rows.map(([column, key, label, hint]) => {
              const locked = !values.push_enabled || (column === 'night_push' && !values.marketing);
              return (
                <button
                  key={column}
                  type="button"
                  className="set-row"
                  disabled={locked}
                  onClick={() => toggle(column, key)}
                >
                  <span className="set-row__text">
                    {label}
                    <small>{hint}</small>
                  </span>
                  <Switch on={values[column]} />
                </button>
              );
            })}
          </section>
        ))}
        {error ? <p className="set-error">{error}</p> : null}
      </>
    );

  return (
    <main className="ord-page">
      <PageHeader title="알림 설정" />
      {body}
    </main>
  );
}
