const KST = 'Asia/Seoul';

function kstParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KST,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

// "오늘 20:00까지" / "10.12 20:00까지"
export function formatPickupDeadline(isoString, now = new Date()) {
  const deadline = kstParts(new Date(isoString));
  const today = kstParts(now);
  const time = `${deadline.hour}:${deadline.minute}`;
  const sameDay = deadline.month === today.month && deadline.day === today.day;
  return sameDay ? `오늘 ${time}까지` : `${deadline.month}.${deadline.day} ${time}까지`;
}

export function formatBadgeCount(count) {
  if (!count || count < 1) return '';
  return count > 99 ? '99+' : String(count);
}

const PROVIDER_LABELS = {
  kakao: '카카오',
  google: 'Google',
  apple: 'Apple',
  email: '이메일',
};

export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] ?? '이메일';
}

// 플랜 이름이 "플러스" 든 "플러스 멤버십" 이든 같은 표시가 되도록 맞춘다.
export function membershipShortName(name) {
  return name.replace(/\s*멤버십$/, '');
}
