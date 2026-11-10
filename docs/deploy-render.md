# Triển khai demo lên Render

Bản demo trực tuyến chạy trên Render bằng file [`render.yaml`](../render.yaml):

| Thành phần                    | Gói    | Ghi chú                                                                                                   |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Web service `sensorguard`     | Free   | API, 4 worker BullMQ, dashboard đã build và simulator trong cùng một dịch vụ (`scripts/start-hosted.mjs`) |
| Key Value `sensorguard-redis` | Free   | Redis cho BullMQ, chỉ nhận kết nối nội bộ từ Render, không giới hạn lệnh như Upstash                      |
| MongoDB Atlas                 | Có sẵn | Dùng chung cơ sở dữ liệu với bản chạy trên máy                                                            |
| Datadog us5                   | Có sẵn | Metrics và log qua HTTP API (không có Agent nên không có APM trên Render)                                 |

## Các bước

1. **MongoDB Atlas → Network Access → Add IP Address → Allow access from anywhere (`0.0.0.0/0`).** Render gói miễn phí không có IP cố định.
2. Đăng nhập [dashboard.render.com](https://dashboard.render.com) bằng GitHub.
3. **New → Blueprint**, chọn repository `ddloi/sensorguard-iot`, nhánh `main`.
4. Render đọc `render.yaml` và hỏi 2 biến bí mật:
   - `MONGODB_URI`: chuỗi kết nối Atlas (giống file `.env` trên máy).
   - `DD_API_KEY`: API key Datadog us5.
5. Bấm **Apply**. Lần build đầu mất khoảng 3–5 phút. Khi trạng thái là **Live**, link demo có dạng `https://sensorguard-xxxx.onrender.com`.

`DEVICE_API_KEY` được Render tự sinh; simulator chạy cùng dịch vụ tự dùng key đó.

## Lưu ý

- **Ngủ khi không dùng:** gói miễn phí tắt dịch vụ sau 15 phút không có người truy cập. Lần mở tiếp theo chờ khoảng 1 phút để khởi động; simulator và dữ liệu chạy lại từ đó.
- **Không đăng nhập (chủ đích):** ai có link đều xem được dashboard và bấm được nút demo. Nút demo chỉ ghi một mẫu cố định cho MOTOR-001. Cổng nhận dữ liệu `/api/ingest` cần key thiết bị.
- **Dữ liệu dùng chung:** bản host và bản chạy trên máy cùng ghi vào một cơ sở dữ liệu Atlas. Không chạy `npm run seed` khi bản host đang chạy.
- **Kiểm tra sau khi deploy:** mở `https://<link>/health` (phải thấy `"mongodb":"connected","redis":"connected"`), sau đó mở trang chính và bấm "Chạy demo quá nhiệt".

## Chạy thử chế độ host trên máy

```bash
npm run build
PORT=10000 DD_TRACE_ENABLED=false DD_PROFILING_ENABLED=false node scripts/start-hosted.mjs
```

Sau đó mở `http://localhost:10000`.
