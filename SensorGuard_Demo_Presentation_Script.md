# 🏆 SensorGuard — Kịch Bản Demo & Thuyết Trình Hackathon (3 Phút)

> **Đề tài:** SensorGuard — Giám Sát Cảm Biến IoT Theo Thời Gian Thực  
> **Bộ công nghệ:** MongoDB Atlas (Time Series + `$setWindowFields`) · Datadog (Metrics & Logs) · Upstash Redis & BullMQ · Fastify Backend · React Dashboard

---

## ⏱️ PHÂN BỔ 3 PHÚT THUYẾT TRÌNH

### Phút 0:00 – 0:45: Giới Thiệu Bài Toán & Kiến Trúc
* **Lời nói:**
  > *"Kính thưa Ban Giám Khảo, trong các dây chuyền sản xuất công nghiệp, sự cố dừng máy đột ngột do động cơ quá nhiệt hoặc rung lắc gây thiệt hại hàng trăm triệu đồng mỗi giờ. Nhóm chúng em xây dựng **SensorGuard** — hệ thống giám sát và tự động phản ứng sự cố IoT theo thời gian thực.*
  >
  > *Điểm cốt lõi của SensorGuard:*
  > 1. *Dữ liệu cảm biến được nạp vào **MongoDB Atlas Time Series** với độ nén cao và khả năng phân tích chuỗi thời gian.*
  > 2. *Xử lý bất đồng bộ qua **BullMQ trên Upstash Redis** với 4 workers chuyên trách.*
  > 3. *Giám sát toàn diện và đồng bộ sự cố lên **Datadog**.*
  > 4. *Hệ thống tự động phát hiện, chẩn đoán nguyên nhân và tự động khắc phục (Auto-Remediation)."*

---

### Phút 0:45 – 2:00: Demo Thực Tế Trên Dashboard (Hành Động Trực Quan)
* **Thao tác:** Mở trình duyệt tại **`http://localhost:3000`**
1. **Chỉ vào 5 cỗ máy đang chạy:**
   > *"Trên Dashboard, BGK có thể thấy 5 thiết bị công nghiệp đang truyền dữ liệu telemetry trực tiếp mỗi 5 giây (Nhiệt độ, Rung chấn, Áp suất, RPM)."*
2. **Bấm nút đỏ: `Demo Quá Nhiệt (Overheat)`:**
   > *"Bây giờ, em sẽ giả lập một sự cố cọ xát ổ bi nghiêm trọng ở cỗ máy `MOTOR-001`."*
3. **Quan sát diễn biến thời gian thực:**
   - Nhiệt độ vọt lên **85°C ➜ 92°C**.
   - Cảnh báo chuyển sang màu đỏ **`CRITICAL`**.
   - Ngay lập tức, `AlertWorker` phát hiện vi phạm ngưỡng, gom cụm sự cố và tạo **Incident**.
4. **Chuyển sang Tab: `Nhật Ký Sự Cố & Phục Hồi`:**
   > *"Hệ thống không chỉ báo động mà còn tự động điều tra nguyên nhân (Root Cause): `Bearing lubrication degradation causing friction and heat buildup`.*
   > 
   > *Đồng thời, `RemediationWorker` kích hoạt hành động khắc phục: **Hạ tốc độ RPM xuống 50% và bật chu trình làm mát**."*
5. **Xem đường cong phục hồi:**
   > *"Chỉ sau ~25 giây, nhiệt độ hạ về mức an toàn (<65°C), sự cố chuyển sang trạng thái **✓ ĐÃ PHỤC HỒI (Resolved)** và cỗ máy quay trở lại trạng thái Online."*

---

### Phút 2:00 – 2:45: Điểm Sáng Kỹ Thuật MongoDB & Datadog
1. **MongoDB Time Series & `$setWindowFields`:**
   > *"Tại biểu đồ phân tích sâu của cỗ máy, đường nét đứt màu xanh neon không phải là đường vẽ đồ họa thông thường, mà được tính toán trực tiếp từ MongoDB thông qua toán tử `$setWindowFields` — tính trung bình trượt 5 phút (5-min Moving Average) để loại bỏ nhiễu cảm biến."*
2. **Datadog Observability:**
   > *"Toàn bộ chỉ số cảm biến, sự cố và thời gian phục hồi (Recovery Duration) được đồng bộ trực tiếp lên **Datadog** qua API Key của đội, cho phép đội ngũ vận hành theo dõi hạ tầng tập trung."*

---

### Phút 2:45 – 3:00: Kết Luận
> *"SensorGuard đã giải quyết trọn vẹn đề bài: **Phát hiện khi hệ thống có vấn đề ➜ Tìm ra nguyên nhân ➜ Chứng minh hệ thống đã phục hồi**. Em xin chân thành cảm ơn BGK và sẵn sàng lắng nghe câu hỏi!"*

---

## 🛠️ Hướng Dẫn Khởi Động Nhanh Khi Demo:
1. Mở trình duyệt vào: **`http://localhost:3000`**
2. Mở tab Datadog: **`https://app.datadoghq.com`** (mục Metrics Explorer hoặc Dashboards)
3. Sẵn sàng nút bấm **"Demo Quá Nhiệt"** để kích hoạt kịch bản trực tiếp.
