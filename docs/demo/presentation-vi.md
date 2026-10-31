# SensorGuard — Kịch bản demo hackathon (3 phút)

## Trước khi trình bày

1. Từ thư mục project, chạy `npm run dev` nếu hệ thống chưa chạy. Không chạy thêm một bản trên cùng cổng.
2. Chờ API, MongoDB và Redis sẵn sàng; bộ mô phỏng gửi dữ liệu mỗi 5 giây.
3. Chạy `npm run verify`. Sửa các mục FAIL; đọc từng WARN trước khi trình bày.
4. Mở http://localhost:3000. Chọn MOTOR-001 và kiểm tra nhiệt độ, độ rung, RPM và biểu đồ.
5. Nếu trình bày Datadog, mở dashboard/logs trên tài khoản của bạn và xác nhận dữ liệu mới thực sự xuất hiện. Có API key không đồng nghĩa dữ liệu đã được nhận; APM cần Datadog Agent hoạt động.

Không chạy `npm run seed` trên dữ liệu demo hiện tại: script này xoá thiết bị, ngưỡng, cảnh báo và sự cố để nạp lại từ đầu. Các sửa đổi UX/UI không yêu cầu seed lại.

## 0:00–0:40 — Bài toán và phạm vi

“SensorGuard giúp theo dõi cảm biến công nghiệp và phản ứng với sự cố quá nhiệt. Trong bản demo, cảm biến và hành động làm mát được mô phỏng; MongoDB, Redis/BullMQ, API và nhật ký sự cố chạy qua dịch vụ thật.”

Chỉ vào số thiết bị có tín hiệu và thời điểm cập nhật. Nhấn mạnh trạng thái được lấy từ dữ liệu, không phải chỉ báo hiển thị cố định.

## 0:40–1:45 — Chạy kịch bản

Bấm **Chạy demo quá nhiệt**. Dashboard gửi một mẫu 92,4°C cho MOTOR-001 và chuyển sang **Nhật ký sự cố**.

“Ngưỡng demo của MOTOR-001 là 85°C. Worker phát hiện vi phạm, tạo sự cố, ghi chẩn đoán và hành động khắc phục mô phỏng. Hệ thống chỉ kết luận phục hồi khi có mẫu mới, đủ gần thời điểm hiện tại và nằm trong ngưỡng an toàn.”

Theo dõi trạng thái và timeline; thời gian thực tế tuỳ mạng và hàng đợi. Lần kiểm tra ngày 28/10/2026 ghi nhận phục hồi trong 13 giây, không cam kết luôn đúng một mốc thời gian cố định.

Nếu chưa phục hồi sau khoảng một phút, dashboard báo cần can thiệp. Khôi phục bộ mô phỏng/kết nối, kiểm tra cấu hình rồi dùng **Kiểm tra phục hồi lại**; thao tác này không ép đóng sự cố khi chưa có bằng chứng an toàn.

## 1:45–2:30 — MongoDB và biểu đồ

Chuyển về **Giám sát thiết bị**, chọn MOTOR-001. Chỉ vào điểm tăng nhiệt và đường trung bình trượt 5 phút.

“Đường trung bình được tính bởi `$setWindowFields` trong MongoDB. Trục thời gian phản ánh thời điểm dữ liệu; dashboard tự đối soát dữ liệu mỗi 5 giây và nhận sự kiện qua WebSocket.”

Có thể chọn PUMP-001 để cho thấy áp suất, không chỉ các cảm biến động cơ.

## 2:30–3:00 — Kiến trúc và kết thúc

Mở **Kiến trúc hệ thống** hoặc Datadog nếu đã xác nhận dữ liệu.

“Luồng chính là nhận dữ liệu → lưu Time Series → kiểm tra ngưỡng theo loại thiết bị → xử lý sự cố → xác nhận phục hồi bằng dữ liệu mới. Khi dịch vụ gián đoạn, dashboard báo lỗi và giữ rõ trạng thái dữ liệu cũ.”

## Lưu ý của lần kiểm tra 28/10/2026

- Đã sửa lỗi áp ngưỡng động cơ sang băng chuyền/máy nén.
- Một sự cố RPM cũ của CONV-001, được tạo trước bản sửa, vẫn được giữ cùng lịch sử. Nó cần kiểm tra cấu hình; không dùng làm ví dụ phục hồi thành công. Preflight có thể WARN vì sự cố này.
- Không mô tả chẩn đoán nguyên nhân hoặc giảm RPM/bật làm mát là điều khiển phần cứng thật.
- Nếu dùng cơ sở dữ liệu khác có unique index cũ `deviceId_1_sensorType_1`, cần kiểm tra/chuyển index trước khi seed. Không tự xoá index hay dữ liệu trên cơ sở dữ liệu đang dùng.
