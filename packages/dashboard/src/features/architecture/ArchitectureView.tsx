import { Activity, CircuitBoard, Cpu, Database, Zap } from 'lucide-react';

export function ArchitectureView() {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h3 className="panel__title">
            <CircuitBoard size={17} />
            Luồng xử lý dữ liệu
          </h3>
          <p className="panel-caption">Cảm biến mô phỏng → API → lưu trữ & xử lý → dashboard</p>
        </div>
      </div>
      <div className="arch-grid">
        {[
          {
            icon: Database,
            title: 'MongoDB Atlas',
            items: [
              'Lưu dữ liệu cảm biến trong Time Series Collection.',
              'Tính trung bình trượt 5 phút bằng $setWindowFields.',
              'Tổng hợp dữ liệu theo thời gian cho biểu đồ.',
            ],
          },
          {
            icon: Zap,
            title: 'Redis + BullMQ',
            items: [
              'Kiểm tra ngưỡng và gom cảnh báo thành sự cố.',
              'Worker xử lý điều tra và khắc phục mô phỏng.',
              'Kiểm tra heartbeat của từng thiết bị định kỳ.',
            ],
          },
          {
            icon: Activity,
            title: 'Datadog',
            items: [
              'Gửi custom metrics và log sự cố.',
              'Theo dõi API với dd-trace khi Agent được cấu hình.',
              'Kiểm tra dữ liệu nhận thực tế trên Datadog trước khi thuyết trình.',
            ],
          },
          {
            icon: Cpu,
            title: 'Fastify + React',
            items: [
              'API xác thực dữ liệu nhận từ bộ mô phỏng.',
              'WebSocket thông báo thay đổi sự cố và trạng thái.',
              'Dashboard đối soát dữ liệu qua API mỗi 5 giây.',
            ],
          },
        ].map((part) => (
          <div className="arch-card" key={part.title}>
            <div className="arch-card__header">
              <part.icon size={23} />
              <h4 className="arch-card__title">{part.title}</h4>
            </div>
            <ul className="arch-card__list">
              {part.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="panel__body">
        <strong>Phạm vi bản demo</strong>
        <p className="panel-caption">
          Tín hiệu cảm biến, chẩn đoán nguyên nhân và tác động làm mát được mô phỏng. MongoDB, hàng
          đợi xử lý và nhật ký sự cố chạy qua các dịch vụ thật.
        </p>
      </div>
    </section>
  );
}
