/**
 * 핀테크 표준 날짜 포맷팅
 * MMM DD, YYYY 또는 상대 시간 (Today, Yesterday)
 */
export function formatTransactionDate(timestamp: number | string | Date): string {
  const d = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Yesterday';

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** 날짜 + 시간 (상대 날짜 + HH:MM) */
export function formatTransactionDateTime(timestamp: number | string | Date): string {
  const d = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  const dateStr = formatTransactionDate(timestamp);
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return dateStr === 'Today' || dateStr === 'Yesterday'
    ? `${dateStr}, ${timeStr}`
    : `${dateStr} ${timeStr}`;
}
