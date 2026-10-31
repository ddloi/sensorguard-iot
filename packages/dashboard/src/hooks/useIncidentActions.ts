import { useEffect, useRef, useState } from 'react';
import { ApiError, requestRecoveryRecheck, triggerOverheat } from '../api/client';
import type { Feedback, Incident } from '../types/domain';

interface IncidentActionsOptions {
  incidents: Incident[];
  now: number;
  ready: boolean | undefined;
  refresh: () => Promise<void>;
  onDemoStarted: () => void;
}

/** Owns demo/recheck actions and their feedback, independently of presentation. */
export function useIncidentActions({
  incidents,
  now,
  ready,
  refresh,
  onDemoStarted,
}: IncidentActionsOptions) {
  const [sending, setSending] = useState(false);
  const [rechecking, setRechecking] = useState<string | null>(null);
  const [recheckMessages, setRecheckMessages] = useState<Record<string, Feedback>>({});
  const [demoStarted, setDemoStarted] = useState<number | null>(null);
  const [demoMessage, setDemoMessage] = useState<Feedback | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const motorActive = incidents.some(
    (incident) => incident.deviceId === 'MOTOR-001' && incident.status !== 'resolved',
  );
  const demoIncident = demoStarted
    ? incidents.find(
        (incident) =>
          incident.deviceId === 'MOTOR-001' &&
          new Date(incident.createdAt).getTime() >= demoStarted - 1000,
      )
    : undefined;
  const demoRunning =
    demoStarted !== null && demoIncident?.status !== 'resolved' && now - demoStarted < 60_000;
  const demoTimedOut = demoStarted !== null && now - demoStarted >= 60_000;
  const demoDisabled = sending || demoRunning || motorActive || !ready;
  useEffect(() => {
    if (!demoStarted) return;
    if (demoIncident?.status === 'resolved')
      setDemoMessage({
        text: `MOTOR-001 đã phục hồi${demoIncident.duration != null ? ` sau ${demoIncident.duration} giây` : ''}. Xem nhật ký bên dưới để kiểm tra diễn biến.`,
      });
    else if (demoTimedOut)
      setDemoMessage({
        text: 'Chưa ghi nhận phục hồi sau 60 giây. Kiểm tra nhật ký sự cố và các worker trước khi chạy lại.',
        error: true,
      });
  }, [demoStarted, demoIncident?.status, demoIncident?.duration, demoTimedOut]);

  const triggerDemo = async () => {
    if (demoDisabled) return;
    setSending(true);
    setDemoMessage(null);
    try {
      await triggerOverheat();
      if (!mounted.current) return;
      setDemoStarted(Date.now());
      onDemoStarted();
      setDemoMessage({
        text: 'Đã gửi mẫu quá nhiệt 92,4°C cho MOTOR-001. Đang chờ hệ thống phát hiện và xử lý sự cố.',
      });
      void refreshRef.current();
    } catch {
      if (mounted.current)
        setDemoMessage({
          text: 'Không xác nhận được yêu cầu demo. Kiểm tra nhật ký trước khi thử lại để tránh gửi trùng.',
          error: true,
        });
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  const recheckRecovery = async (id: string) => {
    if (rechecking) return;
    setRechecking(id);
    try {
      await requestRecoveryRecheck(id);
      if (!mounted.current) return;
      setRecheckMessages((previous) => ({
        ...previous,
        [id]: {
          text: 'Đã yêu cầu xác minh lại. Hệ thống chỉ đóng sự cố khi có mẫu mới trong ngưỡng an toàn.',
        },
      }));
      await refreshRef.current();
    } catch (error) {
      if (!mounted.current) return;
      const text =
        error instanceof ApiError
          ? error.status === 409
            ? 'Chưa thể xác minh lại. Sự cố cần ở trạng thái chờ can thiệp và có ngưỡng phù hợp cho từng cảm biến. Kiểm tra cấu hình thiết bị trước khi thử lại.'
            : 'Không xác nhận được yêu cầu. Kiểm tra kết nối và làm mới nhật ký trước khi thử lại.'
          : 'Không kết nối được dịch vụ. Làm mới nhật ký để kiểm tra yêu cầu đã được nhận hay chưa.';
      setRecheckMessages((previous) => ({ ...previous, [id]: { error: true, text } }));
    } finally {
      if (mounted.current) setRechecking(null);
    }
  };

  return {
    sending,
    rechecking,
    recheckMessages,
    demoMessage,
    demoRunning,
    demoDisabled,
    motorActive,
    triggerDemo,
    recheckRecovery,
  };
}
