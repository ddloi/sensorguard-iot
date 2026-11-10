# Datadog cho SensorGuard

Thư mục này chứa dashboard và monitor mẫu. Cả hai chỉ dùng metric mà `packages/api` thật sự gửi lên Datadog.

**Xem dashboard thật (không cần tài khoản Datadog):** [SensorGuard — Giám sát vận hành](https://p.us5.datadoghq.com/sb/e5ad17af-dbf4-11f1-b42f-ee5a36c85258-ea6401425bf74119e12bb0497cfb00b4). Dữ liệu đến từ bản demo trên Render; bản miễn phí ngủ sau 15 phút không có truy cập, nên hãy mở [link demo](https://sensorguard-hnnh.onrender.com) trước vài phút, hoặc chọn **Past 1 Day** để xem lần chạy trước.

## Cách app gửi dữ liệu

- **Metrics:** gửi qua Datadog HTTP API mỗi 5 giây khi có `DD_API_KEY`; không cần Datadog Agent. Nếu có Agent (chạy Docker Compose), metric cũng đi qua DogStatsD cổng 8125.
- **Logs:** log cảnh báo và sự cố gửi tới Logs intake API, `service:sensorguard`.
- **APM (trace):** cần Datadog Agent đang chạy; khi chạy `npm run dev` không có Agent thì mục APM sẽ trống.
- `DD_SITE` phải khớp vùng của tài khoản, ví dụ `us5.datadoghq.com` nếu bạn đăng nhập ở `us5.datadoghq.com`.

## Metric

Tất cả có tiền tố `sensorguard.` và tag `env`, `service`.

| Metric                       | Loại  | Tag chính                           | Ý nghĩa                                     |
| ---------------------------- | ----- | ----------------------------------- | ------------------------------------------- |
| `sensor.reading.value`       | gauge | `device`, `sensor_type`, `location` | Giá trị từng số đo                          |
| `sensor.ingest.count`        | count | `device`                            | Số mẫu được tiếp nhận                       |
| `sensor.threshold.exceeded`  | count | `device`, `sensor_type`, `severity` | Số lần vượt ngưỡng                          |
| `sensor.alert.triggered`     | count | `device`, `sensor_type`, `severity` | Số cảnh báo được tạo                        |
| `sensor.reading.alert_value` | gauge | `device`, `sensor_type`             | Giá trị gây cảnh báo                        |
| `remediation.executed`       | count | `device`, `sensor_type`             | Số lần khắc phục mô phỏng                   |
| `incident.duration`          | gauge | `device`, `severity`                | Thời gian từ lúc mở đến lúc resolved (giây) |
| `device.status.change`       | count | `device`, `new_status`              | Thay đổi trạng thái thiết bị                |
| `device.count`               | gauge | `status`                            | Số thiết bị theo trạng thái (mỗi 30 giây)   |
| `queue.job.duration`         | gauge | `queue`, `stage`                    | Thời gian xử lý job (ms)                    |

Datadog tự chuyển giá trị tag sang chữ thường, nên dùng `device:motor-001` khi lọc.

## Import dashboard

1. **Dashboards → New Dashboard → Blank Dashboard**.
2. Bấm **Configure** (biểu tượng bánh răng) → **Import dashboard JSON**.
3. Dán toàn bộ nội dung `dashboard.json` rồi bấm **Import**.

Dashboard có 4 nhóm: Tổng quan, Dữ liệu cảm biến, Phát hiện → điều tra → xử lý, Nhật ký. Chọn **Past 15 Minutes** khi app đang chạy.

## Import monitor

`monitors.json` chứa 5 monitor trong mảng `monitors`. Import từng cái:

1. **Monitors → New Monitor → Import from JSON**.
2. Dán **một** phần tử trong mảng `monitors` (từ `{` đến `}`), bấm **Import**.
3. Thêm người nhận thông báo (email, Slack) vào ô message trước khi lưu.

| Monitor                     | Điều kiện                                                |
| --------------------------- | -------------------------------------------------------- |
| Vượt ngưỡng critical        | Có vi phạm critical trong 5 phút, theo từng thiết bị     |
| Ngừng nhận dữ liệu cảm biến | Không có mẫu nào trong 5 phút                            |
| Thiết bị mất kết nối        | Có thiết bị ở trạng thái offline                         |
| Job hàng đợi xử lý chậm     | Job mất hơn 5 giây (cảnh báo từ 2 giây)                  |
| Xử lý sự cố quá 30 giây     | Sự cố mất hơn 30 giây mới phục hồi (cảnh báo từ 20 giây) |

Monitor "Ngừng nhận dữ liệu" sẽ báo khi app tắt. Có thể tắt tạm (Mute) monitor này ngoài giờ demo.
