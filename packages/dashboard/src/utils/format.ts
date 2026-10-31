export function time(value?: string | number): string {
  return value ? new Date(value).toLocaleTimeString('vi-VN', { hour12: false }) : '—';
}
