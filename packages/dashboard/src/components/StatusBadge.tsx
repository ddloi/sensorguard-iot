const statusLabels: Record<string, string> = {
  online: 'Hoạt động',
  warning: 'Cảnh báo',
  critical: 'Nguy cấp',
  offline: 'Mất tín hiệu',
  maintenance: 'Đang làm mát',
  open: 'Phát hiện',
  investigating: 'Điều tra',
  mitigating: 'Đang xử lý',
  resolved: 'Đã phục hồi',
  escalated: 'Cần can thiệp',
};

export function Badge({ status }: { status: string }) {
  const color = ['online', 'resolved'].includes(status)
    ? 'emerald'
    : status === 'critical' || status === 'open' || status === 'escalated'
      ? 'rose'
      : status === 'warning'
        ? 'amber'
        : ['maintenance', 'investigating', 'mitigating'].includes(status)
          ? 'purple'
          : '';
  return (
    <span className={`badge ${color ? `badge--${color}` : ''}`}>
      <span className={`status-dot status-dot--${status === 'resolved' ? 'online' : status}`} />
      {statusLabels[status] || status}
    </span>
  );
}
