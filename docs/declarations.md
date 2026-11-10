# Khai báo thành phần tái sử dụng, dữ liệu và công cụ AI

Tài liệu này liệt kê những gì SensorGuard (đội Reliops) dùng lại từ bên ngoài, nguồn dữ liệu, và các công cụ AI đã hỗ trợ quá trình làm dự án.

## 1. Thành phần tái sử dụng

### 1.1. Thư viện mã nguồn mở (chạy trong sản phẩm)

| Thư viện                          | Phiên bản | License                      | Dùng để                                       |
| --------------------------------- | --------- | ---------------------------- | --------------------------------------------- |
| fastify                           | 5.12      | MIT                          | HTTP API                                      |
| @fastify/cors, @fastify/websocket | 11.x      | MIT                          | CORS, WebSocket                               |
| @fastify/static                   | 8.x       | MIT                          | Phục vụ dashboard đã build khi chạy trên host |
| mongoose                          | 8.24      | MIT                          | Kết nối và mô hình MongoDB                    |
| bullmq                            | 5.81      | MIT                          | Hàng đợi công việc trên Redis                 |
| ioredis                           | 5.11      | MIT                          | Kết nối Redis                                 |
| zod                               | 4.6       | MIT                          | Kiểm tra payload và biến môi trường           |
| dd-trace                          | 5.132     | Apache-2.0 hoặc BSD-3-Clause | Trace APM gửi tới Datadog                     |
| hot-shots                         | 17.1      | MIT                          | Gửi metric DogStatsD                          |
| winston                           | 3.19      | MIT                          | Ghi log                                       |
| dotenv                            | 16.6      | BSD-2-Clause                 | Đọc file `.env`                               |
| react, react-dom                  | 19.3      | MIT                          | Giao diện dashboard                           |
| lucide-react                      | 0.475     | ISC                          | Bộ biểu tượng                                 |

### 1.2. Công cụ phát triển (không chạy trong sản phẩm)

| Công cụ                                     | License                            | Dùng để                                 |
| ------------------------------------------- | ---------------------------------- | --------------------------------------- |
| TypeScript                                  | Apache-2.0                         | Ngôn ngữ và kiểm tra kiểu               |
| Vite, @vitejs/plugin-react                  | MIT                                | Build dashboard                         |
| tsx                                         | MIT                                | Chạy TypeScript khi phát triển          |
| Vitest                                      | MIT                                | Kiểm thử                                |
| Prettier                                    | MIT                                | Định dạng mã                            |
| concurrently                                | MIT                                | Chạy API, simulator, dashboard cùng lúc |
| GitHub Actions, Docker Compose              | Dịch vụ / Apache-2.0               | CI và chạy bằng container               |
| StarUML                                     | Phần mềm thương mại (bản dùng thử) | Vẽ 27 sơ đồ UML                         |
| Playwright (playwright-core), ffmpeg-static | Apache-2.0 / GPL (binary ffmpeg)   | Quay và dựng video demo                 |
| docx (npm), Microsoft Word                  | MIT / thương mại                   | Tạo báo cáo Word và xuất PDF            |
| python-pptx                                 | MIT                                | Tạo slide thuyết trình                  |

### 1.3. Dịch vụ bên ngoài

| Dịch vụ                                                  | Vai trò                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| MongoDB Atlas                                            | Lưu dữ liệu cảm biến (Time Series), thiết bị, ngưỡng, cảnh báo, sự cố |
| Datadog (us5)                                            | Metrics, log, dashboard và monitor                                    |
| Upstash Redis, Render Key Value hoặc Redis chạy trên máy | Hàng đợi BullMQ                                                       |
| Render                                                   | Chạy bản demo trực tuyến                                              |

### 1.4. Tài nguyên tham khảo

- **Mẫu cấu trúc file StarUML:** khi tạo file `docs/uml/SensorGuard.mdj` bằng script, nhóm tham khảo cấu trúc các thành phần hiển thị (view) trong một file StarUML mẫu (`Hackathon.mdj`) để file mở đúng trong StarUML. Toàn bộ nội dung sơ đồ (tác nhân, use case, luồng, lớp, trạng thái) do nhóm viết lại theo mã nguồn SensorGuard.
- Không sao chép mã nguồn của dự án khác vào repository.

## 2. Dữ liệu (dataset)

- **Không dùng dataset bên ngoài.** Mọi số đo cảm biến là dữ liệu mô phỏng.
- **Nguồn dữ liệu:** `packages/simulator` sinh số đo cho 5 thiết bị (2 động cơ, 1 bơm, 1 máy nén, 1 băng chuyền) mỗi 5 giây. Giá trị dao động quanh khoảng vận hành bình thường theo phân phối Gauss (biến đổi Box-Muller, lệch khoảng 15% biên độ), giới hạn trong khoảng vật lý của cảm biến.
- **Dữ liệu cấu hình:** danh sách thiết bị và ngưỡng cảnh báo trong `packages/api/scripts/seed.ts` do nhóm tự đặt cho mục đích demo.
- **Kịch bản demo:** một mẫu quá nhiệt cố định 92,4°C cho MOTOR-001 (`POST /api/demo/overheat`).
- **Không có dữ liệu cá nhân.** Dữ liệu cảm biến tự xóa sau 7 ngày (TTL của Time Series Collection).

## 3. Công cụ AI

SensorGuard **không chạy mô hình AI hay học máy nào trong sản phẩm**. Chẩn đoán nguyên nhân là luật mô phỏng; phát hiện sự cố dựa trên ngưỡng.

AI được dùng làm **công cụ hỗ trợ phát triển**:

| Công cụ                                                                             | Dùng cho                                                                                                                                     | Dấu vết                                     |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Claude Code (Anthropic, mô hình Claude Opus)                                        | Rà soát và cải tiến mã (giảm lệnh Redis, key thiết bị, test MongoDB thật, CI), sơ đồ UML, báo cáo, slide, kịch bản quay video demo, tài liệu | Các commit có dòng `Co-Authored-By: Claude` |
| Quy trình nhiều agent "AI-DEV-TEAM" với các mô hình Claude (Sonnet, Opus) và Gemini | Đặc tả, triển khai và rà soát ở giai đoạn đầu                                                                                                | `docs/archive/pipeline/`                    |
| Impeccable (bộ kỹ năng thiết kế giao diện)                                          | Rà soát và tinh chỉnh giao diện dashboard                                                                                                    | `.impeccable/`                              |

Nhóm chịu trách nhiệm toàn bộ nội dung: mọi thay đổi do AI đề xuất đều được kiểm tra bằng kiểu dữ liệu, kiểm thử tự động (78 ca và 4 ca trên MongoDB thật) và chạy demo thật trước khi đưa vào `main`.
