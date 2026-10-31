# 🧭 SENSORGUARD — LIVING ARCHITECTURE & PROJECT STATE
> **Mục đích:** File trạng thái duy nhất (Single Source of Truth) lưu giữ toàn bộ kiến trúc và tiến độ dự án. Mỗi khi chuyển model AI (Sonnet, Opus, Gemini...), model chỉ cần đọc file này là nắm bắt 100% ngữ cảnh mà không cần đọc lại toàn bộ log hay code.
> **Cập nhật lần cuối:** 2026-10-24 (Hackathon MUG VN 2026)

---

## 1. 🏗️ TỔNG QUAN KIẾN TRÚC HỆ THỐNG (EVENT-DRIVEN IOT)
```
[IoT Simulator (5 Devices)]
       │ (HTTP POST /api/ingest mỗi 5s)
       ▼
[Fastify API (:3001)] ──► [MongoDB Atlas Time Series: `sensor_data`]
       │
       ├──► [Datadog Cloud (US1)]: Custom Metrics (StatsD/HTTP) + Logs
       │
       └──► [Upstash Redis (BullMQ)]:
              ├── queue: `threshold-check` ──► ThresholdWorker (So sánh ngưỡng 80/85°C)
              ├── queue: `alert-process`   ──► AlertWorker (Tạo Alert, Incident)
              ├── queue: `remediation`     ──► RemediationWorker (Tự động hạ tải, làm mát)
              └── queue: `device-health`   ──► DeviceHealthWorker (Quét heartbeat 30s/lần)
                               ▲
[React Dashboard (:3000)] ─────┘ (Fetch /api/analytics + /api/incidents)
```

---

## 2. 🔌 PORTS & SERVICES RUNNING STATUS
| Service | Thư mục | Port / Endpoint | Trạng thái |
|---|---|---|---|
| **Fastify API** | `packages/api` | `http://localhost:3001` | 🟢 Online (port 3001) |
| **Web Dashboard** | `packages/dashboard` | `http://localhost:3000` | 🟢 Online (SCADA/NOC Control Center, Dark-first + Light) |
| **IoT Simulator** | `packages/simulator` | Phát 5 thiết bị / 5s | 🟢 Online daemon |
| **MongoDB Atlas** | Cloud AWS Singapore | Cluster: `sensorguard` | 🟢 Connected (Time Series) |
| **Upstash Redis** | Cloud AWS Singapore | TLS `rediss://...` | 🟢 Connected (BullMQ) |
| **Datadog** | Cloud US1 (`datadoghq.com`) | API Key: Configured via `.env` | 🟢 Validated & Ingesting |

---

## 3. 💾 CƠ SỞ DỮ LIỆU & DATA MODELS
- **MongoDB Database:** `sensorguard`
  1. `sensor_data`: Time Series collection (`timeField: 'timestamp'`, `metaField: 'metadata'`, `granularity: 'seconds'`).
  2. `devices`: 5 thiết bị công nghiệp (`MOTOR-001`, `MOTOR-002`, `PUMP-001`, `COMP-001`, `CONV-001`).
  3. `thresholds`: 11 cấu hình ngưỡng cảnh báo cho Motor, Pump, Compressor, Conveyor.
  4. `alerts`: Cảnh báo active/resolved khi vượt ngưỡng.
  5. `incidents`: Quản lý vòng đời sự cố (Timeline: Anomaly ➜ Alert ➜ Investigation ➜ Remediation ➜ Resolved).

---

## 4. 📊 MONGODB $SETWINDOWFIELDS (ĐIỂM NHẤN KỸ THUẬT CHO BGK)
- **API Endpoint:** `/api/analytics/timeseries?deviceId=MOTOR-001&sensorType=temperature`
- **Cơ chế:** Sử dụng toán tử `$setWindowFields` của MongoDB để tính **5-minute Moving Average** theo thời gian thực trên Time Series collection. Loại bỏ nhiễu cảm biến và phát hiện xu hướng quá nhiệt bền vững.

---

## 5. 🎯 KỊCH BẢN DEMO ĐÃ ĐƯỢC CHỨNG MINH 100%
- **Đề bài:** *"Phát hiện khi hệ thống IoT có vấn đề, tìm ra nguyên nhân và chứng minh hệ thống đã phục hồi."*
- **Kịch bản Overheat:**
  1. `MOTOR-001` nhiệt độ tăng từ 64°C ➜ 94.21°C.
  2. `ThresholdWorker` bắt vi phạm (>85°C) ➜ `AlertWorker` tạo Incident `CRITICAL`.
  3. Root Cause: *"Bearing lubrication degradation causing friction and heat buildup"*.
  4. `RemediationWorker` kích hoạt: *"Hạ RPM 50% và bật chu trình làm mát"*.
  5. Nhiệt độ hạ về 64.49°C ➜ Incident chuyển `resolved` trong **26 giây** (Chứng minh phục hồi).

---

## 6. 🚀 HƯỚNG DẪN LỆNH NHANH (QUICK RUN COMMANDS)
```bash
# Seed dữ liệu mẫu vào MongoDB:
npm run seed

# Khởi động riêng lẻ từng service nếu cần:
npm run dev:api         # Chạy Backend Fastify (port 3001)
npm run dev:simulator   # Chạy phát dữ liệu cảm biến
npm run dev:dashboard   # Chạy Frontend Dashboard (port 3000)

# Kích hoạt kịch bản quá nhiệt qua dòng lệnh (hoặc bấm nút trên Dashboard):
npm run dev:scenario -w packages/simulator
```
