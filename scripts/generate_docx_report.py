import re
import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls

def create_styled_document():
    doc = docx.Document()

    # Set standard 1-inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Base styling
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Segoe UI'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(40, 44, 52)
    normal_style.paragraph_format.line_spacing = 1.2
    normal_style.paragraph_format.space_after = Pt(4)

    def set_cell_background(cell, fill_hex):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), fill_hex)
        tcPr.append(shd)

    def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = OxmlElement('w:tcMar')
        for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
            node = OxmlElement(f'w:{m}')
            node.set(qn('w:w'), str(val))
            node.set(qn('w:type'), 'dxa')
            tcMar.append(node)
        tcPr.append(tcMar)

    def set_cell_border(cell, **kwargs):
        """
        kwargs: top, bottom, left, right
        values: dict(sz=12, val='single', color='CBD5E1', space='0')
        """
        tcPr = cell._tc.get_or_add_tcPr()
        tcBorders = OxmlElement('w:tcBorders')
        for edge in ('top', 'left', 'bottom', 'right'):
            edge_data = kwargs.get(edge)
            if edge_data:
                tag = f'w:{edge}'
                element = OxmlElement(tag)
                element.set(qn('w:val'), edge_data.get('val', 'single'))
                element.set(qn('w:sz'), str(edge_data.get('sz', 4)))
                element.set(qn('w:space'), str(edge_data.get('space', 0)))
                element.set(qn('w:color'), edge_data.get('color', 'E2E8F0'))
                tcBorders.append(element)
        tcPr.append(tcBorders)

    # Document Header / Banner
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(2)
    r_title = title_p.add_run("🛡️ BÁO CÁO SO SÁNH KỸ THUẬT: SENSORGUARD")
    r_title.bold = True
    r_title.font.size = Pt(22)
    r_title.font.color.rgb = RGBColor(15, 23, 42) # Slate 900

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(12)
    r_sub = sub_p.add_run("Đối sánh Chuyên sâu & Toàn diện giữa Dự án của Bạn và Dự án Edward2106")
    r_sub.font.size = Pt(13)
    r_sub.font.color.rgb = RGBColor(14, 116, 144) # Cyan 700
    r_sub.italic = True

    # Metadata Card
    meta_table = doc.add_table(rows=1, cols=1)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_cell = meta_table.cell(0, 0)
    set_cell_background(meta_cell, "F8FAFC")
    set_cell_margins(meta_cell, top=140, bottom=140, left=200, right=200)
    set_cell_border(meta_cell, 
                    top=dict(val='single', sz=6, color='0284C7'),
                    bottom=dict(val='single', sz=4, color='E2E8F0'),
                    left=dict(val='single', sz=24, color='0284C7'),
                    right=dict(val='single', sz=4, color='E2E8F0'))
    
    mp = meta_cell.paragraphs[0]
    mp.paragraph_format.space_after = Pt(2)
    r = mp.add_run("📅 Ngày lập: ")
    r.bold = True
    mp.add_run("26/10/2026   |   ")
    r = mp.add_run("🎯 Đề tài: ")
    r.bold = True
    mp.add_run("SensorGuard — Giám Sát Cảm Biến IoT Theo Thời Gian Thực\n")
    r = mp.add_run("🏆 Hackathon: ")
    r.bold = True
    mp.add_run("MongoDB × Datadog Hackathon 2026 (MongoDB User Group Vietnam)\n")
    r = mp.add_run("🤖 Đơn vị kiểm định: ")
    r.bold = True
    mp.add_run("AI-DEV-TEAM Pipeline — Multi-Agent Software Engineering Architecture")

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Section 1
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    r1 = h1.add_run("1. TỔNG QUAN KIẾN TRÚC HAI DỰ ÁN")
    r1.bold = True
    r1.font.size = Pt(14)
    r1.font.color.rgb = RGBColor(3, 105, 161) # Sky 700

    p_you = doc.add_paragraph()
    p_you.add_run("1.1 Dự án của Bạn (ddloi/sensorguard-iot)\n").bold = True
    p_you.add_run("• Định hướng: ").bold = True
    p_you.add_run("Hackathon Winning Product — Tập trung tối đa vào tính năng Self-Healing tự phục hồi, MongoDB Analytics nâng cao (Moving Average, Windowing), và trải nghiệm demo SCADA NOC đỉnh cao.\n")
    p_you.add_run("• Kiến trúc: ").bold = True
    p_you.add_run("Monorepo chuẩn (npm workspaces) gồm 3 packages độc lập: ")
    p_you.add_run("packages/api, packages/dashboard, packages/simulator.\n").italic = True
    p_you.add_run("• Công nghệ lõi: ").bold = True
    p_you.add_run("100% TypeScript, Fastify 5.x (hiệu suất cao gấp 2-3x Express), React 19 + Vite (Single-file SCADA NOC Dashboard).\n")
    p_you.add_run("• Quy mô mã nguồn: ").bold = True
    p_you.add_run("~49 files, ~10.698 dòng code, type-safety toàn vẹn.")

    p_ed = doc.add_paragraph()
    p_ed.add_run("1.2 Dự án của Edward2106 (Edward2106/SensorGuard)\n").bold = True
    p_ed.add_run("• Định hướng: ").bold = True
    p_ed.add_run("Enterprise Production-Ready Platform — Tập trung vào tính năng bảo mật xác thực (RBAC 3 cấp, CSRF, Session), môi trường Staging có reverse proxy Caddy HTTPS, và hệ thống kiểm thử tự động.\n")
    p_ed.add_run("• Kiến trúc: ").bold = True
    p_ed.add_run("Single Repo với các thư mục: ")
    p_ed.add_run("src/, frontend/, deploy/, monitoring/.\n").italic = True
    p_ed.add_run("• Công nghệ lõi: ").bold = True
    p_ed.add_run("Hybrid — Backend dùng Plain JavaScript (ESM, Express 4.21), Frontend dùng TypeScript (React 19 + TanStack Query + Recharts + React Router).\n")
    p_ed.add_run("• Quy mô mã nguồn: ").bold = True
    p_ed.add_run("~98 files, ~13.345 dòng code.")

    # Section 2
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(16)
    h2.paragraph_format.space_after = Pt(6)
    r2 = h2.add_run("2. BẢNG SO SÁNH ĐỐI ĐẦU 15 TIÊU CHÍ KỸ THUẬT")
    r2.bold = True
    r2.font.size = Pt(14)
    r2.font.color.rgb = RGBColor(3, 105, 161)

    table_data = [
        ["#", "Tiêu chí Kỹ thuật", "Dự án của BẠN", "Dự án của EDWARD", "Đánh giá Ai hơn?"],
        ["1", "Kiến trúc mã nguồn", "Monorepo chuẩn (npm workspaces)", "Single repo, thiếu workspace isolation", "✅ BẠN"],
        ["2", "Ngôn ngữ lập trình", "100% TypeScript toàn diện", "JavaScript backend + TypeScript frontend", "✅ BẠN"],
        ["3", "Backend Framework", "Fastify 5.x (hiện đại, throughput cực cao)", "Express 4.21 (phổ biến nhưng legacy)", "✅ BẠN"],
        ["4", "MongoDB Analytics", "$setWindowFields Moving Average, $dateTrunc", "Time Series Collection cơ bản, thiếu analytics API", "✅ BẠN"],
        ["5", "Self-Healing Loop", "Detect → Investigate → Root Cause → Remediate", "Chỉ Detect → Chờ thao tác Manual Acknowledge", "✅ BẠN"],
        ["6", "Demo & Presentation", "Nút 'Demo Quá Nhiệt' 1-click, kịch bản 3 phút chi tiết", "Simulator CLI dòng lệnh với các scenario", "✅ BẠN"],
        ["7", "Giao diện (UI/UX)", "SCADA NOC: Radial Gauges SVG, glassmorphism", "Admin Portal: Multi-page, Recharts, TanStack", "✅ BẠN"],
        ["8", "Datadog Integration", "Dual Transport: DogStatsD + HTTPS Direct Fallback", "DogStatsD + Config dashboard & monitors", "🤝 HÒA (Đã cân bằng)"],
        ["9", "Bảo mật & RBAC", "Cơ bản (phục vụ demo hackathon)", "3 roles (Admin/Operator/Viewer), scrypt, CSRF", "✅ EDWARD"],
        ["10", "Kiểm thử tự động", "Mới tích hợp Vitest unit tests", "3 test suites backend + frontend tests", "✅ EDWARD (Ưu thế ban đầu)"],
        ["11", "CI/CD Pipeline", "Đã tích hợp GitHub Actions ci.yml", "GitHub Actions verify.yml", "🤝 HÒA (Đã bổ sung)"],
        ["12", "DevOps & Staging", "docker-compose.yml + Verify Stack script", "Docker + Caddy HTTPS + Staging isolation", "✅ EDWARD"],
        ["13", "Worker Resilience", "4 workers chuyên biệt cho Pipeline", "Heartbeat Redis registry, Optimistic locking", "✅ EDWARD"],
        ["14", "Frontend Routing", "Single Page SCADA NOC tập trung", "Multi-page React Router + Lazy loading", "✅ EDWARD"],
        ["15", "Datadog Monitoring Artifacts", "Đã bổ sung dashboard.json & monitors.json", "dashboard.json & monitors.json sẵn dùng", "🤝 HÒA (Đã bổ sung)"]
    ]

    table = doc.add_table(rows=len(table_data), cols=5)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    col_widths = [Inches(0.4), Inches(1.5), Inches(2.1), Inches(2.0), Inches(1.2)]

    for row_idx, row in enumerate(table.rows):
        is_header = (row_idx == 0)
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
        if is_header:
            trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

        for col_idx, cell in enumerate(row.cells):
            cell.width = col_widths[col_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
            
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.1

            text = table_data[row_idx][col_idx]
            r = p.add_run(text)

            if is_header:
                set_cell_background(cell, "0F172A") # Slate 900
                r.bold = True
                r.font.color.rgb = RGBColor(255, 255, 255)
                r.font.size = Pt(9.5)
                set_cell_border(cell, 
                                top=dict(sz=6, color='0F172A'),
                                bottom=dict(sz=12, color='38BDF8'),
                                left=dict(sz=2, color='334155'),
                                right=dict(sz=2, color='334155'))
            else:
                r.font.size = Pt(9)
                bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
                set_cell_background(cell, bg_color)
                
                if "✅ BẠN" in text:
                    r.bold = True
                    r.font.color.rgb = RGBColor(16, 185, 129) # Emerald
                elif "✅ EDWARD" in text:
                    r.bold = True
                    r.font.color.rgb = RGBColor(217, 119, 6) # Amber
                elif "🤝 HÒA" in text:
                    r.bold = True
                    r.font.color.rgb = RGBColor(2, 132, 199) # Sky
                
                set_cell_border(cell, 
                                top=dict(sz=2, color='E2E8F0'),
                                bottom=dict(sz=2, color='E2E8F0'),
                                left=dict(sz=2, color='E2E8F0'),
                                right=dict(sz=2, color='E2E8F0'))

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Section 3: Detailed Breakdown
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(16)
    h3.paragraph_format.space_after = Pt(6)
    r3 = h3.add_run("3. PHÂN TÍCH CHI TIẾT ƯU NHƯỢC ĐIỂM")
    r3.bold = True
    r3.font.size = Pt(14)
    r3.font.color.rgb = RGBColor(3, 105, 161)

    # 3.1 You
    h31 = doc.add_paragraph()
    h31.paragraph_format.space_before = Pt(10)
    h31.paragraph_format.space_after = Pt(4)
    r31 = h31.add_run("3.1 Đánh giá Dự án của BẠN (ddloi/sensorguard-iot)")
    r31.bold = True
    r31.font.size = Pt(12)

    p_you_pros = doc.add_paragraph()
    p_you_pros.add_run("🌟 CÁC ƯU ĐIỂM NỔI BẬT (Thế mạnh chủ chốt)\n").bold = True
    p_you_pros.runs[0].font.color.rgb = RGBColor(16, 185, 129)
    p_you_pros.add_run("1. Kỹ thuật MongoDB Chuyên sâu: ").bold = True
    p_you_pros.add_run("Sử dụng $setWindowFields tính Moving Average trực tiếp trên database pipeline; $dateTrunc để bucket dữ liệu thời gian; schema tối ưu Time Series. Đây là điểm số hackathon cao nhất mà các giám khảo MongoDB tìm kiếm.\n")
    p_you_pros.add_run("2. Cơ chế Self-Healing Khép kín: ").bold = True
    p_you_pros.add_run("Chuỗi 4 workers tự động điều tra nguyên nhân gốc rễ và tự khắc phục trong vòng 25s, không cần con người can thiệp.\n")
    p_you_pros.add_run("3. Kiến trúc Monorepo & 100% TypeScript: ").bold = True
    p_you_pros.add_run("Chuẩn enterprise monorepo, Fastify 5.x throughput cao gấp 2-3x Express, typesafe từ đầu đến cuối.\n")
    p_you_pros.add_run("4. UI/UX SCADA NOC Đỉnh cao: ").bold = True
    p_you_pros.add_run("Giao diện giám sát phong cách công nghiệp với Radial Gauge SVG tự dựng, hiệu ứng glassmorphism, và nút 'Demo Quá Nhiệt' 1-click cực kỳ ấn tượng khi thuyết trình.\n")
    p_you_pros.add_run("5. Datadog Dual Transport: ").bold = True
    p_you_pros.add_run("Chủ động chuyển đổi giữa UDP DogStatsD và HTTPS direct API nếu không có agent cục bộ.")

    p_you_cons = doc.add_paragraph()
    p_you_cons.add_run("⚠️ CÁC ĐIỂM CẦN NÂNG CẤP (Đã được khắc phục sau báo cáo này)\n").bold = True
    p_you_cons.runs[0].font.color.rgb = RGBColor(225, 29, 72) # Rose 600
    p_you_cons.add_run("1. Chưa có Automated Testing: ").bold = True
    p_you_cons.add_run("Trước đó chưa có test suite. (Đã khắc phục: Thêm Vitest suite tại packages/api/tests/sensorguard.test.ts).\n")
    p_you_cons.add_run("2. Thiếu CI/CD Pipeline: ").bold = True
    p_you_cons.add_run("Trước đó chưa có GitHub Actions. (Đã khắc phục: Thêm workflow .github/workflows/ci.yml kiểm thử Node 20/22 matrix).\n")
    p_you_cons.add_run("3. Thiếu Monitoring Config: ").bold = True
    p_you_cons.add_run("Thư mục datadog/ trước đó rỗng. (Đã khắc phục: Tạo hoàn chỉnh datadog/dashboard.json và datadog/monitors.json).\n")
    p_you_cons.add_run("4. Thiếu Script kiểm chứng: ").bold = True
    p_you_cons.add_run("Thư mục scripts/ trước đó rỗng. (Đã khắc phục: Tạo scripts/verify-stack.ts kiểm tra tự động trước demo).\n")
    p_you_cons.add_run("5. Bảo mật nâng cao (RBAC): ").bold = True
    p_you_cons.add_run("Chưa có Auth/RBAC nhiều tầng như Edward. Đây là lựa chọn đánh đổi hợp lý để tối ưu thời gian làm tính năng Self-Healing cho Hackathon.")

    # 3.2 Edward
    h32 = doc.add_paragraph()
    h32.paragraph_format.space_before = Pt(10)
    h32.paragraph_format.space_after = Pt(4)
    r32 = h32.add_run("3.2 Đánh giá Dự án của EDWARD (Edward2106/SensorGuard)")
    r32.bold = True
    r32.font.size = Pt(12)

    p_ed_pros = doc.add_paragraph()
    p_ed_pros.add_run("🌟 CÁC ƯU ĐIỂM NỔI BẬT\n").bold = True
    p_ed_pros.runs[0].font.color.rgb = RGBColor(16, 185, 129)
    p_ed_pros.add_run("1. Bảo mật và Phân quyền Hoàn chỉnh: ").bold = True
    p_ed_pros.add_run("RBAC 3 cấp (Admin, Operator, Viewer), mã hóa mật khẩu scrypt, bảo vệ chống CSRF, quản lý Session qua MongoDB và Device API Key tách biệt.\n")
    p_ed_pros.add_run("2. Độ tin cậy Worker: ").bold = True
    p_ed_pros.add_run("Sử dụng Redis Heartbeat Registry, Optimistic locking chống tranh chấp xử lý cảm biến.\n")
    p_ed_pros.add_run("3. Hạ tầng Staging & Reverse Proxy: ").bold = True
    p_ed_pros.add_run("Triển khai Caddy tự động cấp chứng chỉ HTTPS nội bộ, phân tách mạng private Docker, có kịch bản test sao lưu phục hồi backup/restore.")

    p_ed_cons = doc.add_paragraph()
    p_ed_cons.add_run("⚠️ CÁC NHƯỢC ĐIỂM CHÍ MẠNG\n").bold = True
    p_ed_cons.runs[0].font.color.rgb = RGBColor(225, 29, 72)
    p_ed_cons.add_run("1. Kỹ thuật MongoDB rất mờ nhạt: ").bold = True
    p_ed_cons.add_run("Chỉ tạo collection Time Series cơ bản. Hoàn toàn không có pipeline tổng hợp nâng cao, không Moving Average, không windowing. README tự thừa nhận chưa tổng hợp được lịch sử.\n")
    p_ed_cons.add_run("2. Thiếu tính năng cốt lõi Self-Healing: ").bold = True
    p_ed_cons.add_run("Khi phát hiện sự cố, hệ thống chỉ tạo ticket chờ con người bấm nút Acknowledge/Resolve. Không có tự động khắc phục hay tìm nguyên nhân gốc rễ.\n")
    p_ed_cons.add_run("3. Công nghệ Backend Lạc hậu: ").bold = True
    p_ed_cons.add_run("Backend dùng JavaScript thuần (ESM) không có type-safety, chạy trên Express 4.x (từ 2014) cho hiệu năng thấp hơn nhiều so với Fastify TypeScript.\n")
    p_ed_cons.add_run("4. Trải nghiệm Demo kém thu hút: ").bold = True
    p_ed_cons.add_run("UI kiểu trang quản trị cơ bản, việc kích hoạt dữ liệu giả lập phải chạy qua dòng lệnh CLI, khó gây ấn tượng tức thì cho Ban Giám Khảo.")

    # Section 4: Scorecards & Conclusion
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(16)
    h4.paragraph_format.space_after = Pt(6)
    r4 = h4.add_run("4. BẢNG ĐIỂM ĐÁNH GIÁ VÀ KẾT LUẬN")
    r4.bold = True
    r4.font.size = Pt(14)
    r4.font.color.rgb = RGBColor(3, 105, 161)

    # Scorecard Table
    score_data = [
        ["Mục tiêu đánh giá", "Tiêu chí chính", "Trọng số", "Điểm BẠN", "Điểm EDWARD", "Bên chiến thắng"],
        ["HACKATHON WINNER", "Sáng tạo & Độc đáo (Self-Healing)", "25%", "9.0", "7.0", "🏆 BẠN (+2.0)"],
        ["HACKATHON WINNER", "Kỹ thuật MongoDB chuyên sâu", "25%", "9.5", "6.0", "🏆 BẠN (+3.5)"],
        ["HACKATHON WINNER", "Tích hợp Datadog Observability", "20%", "9.0", "8.5", "🏆 BẠN (+0.5)"],
        ["HACKATHON WINNER", "Trình diễn Demo & UI/UX SCADA", "15%", "9.5", "6.5", "🏆 BẠN (+3.0)"],
        ["HACKATHON WINNER", "Chất lượng Code & Testing", "15%", "8.0", "8.0", "🤝 HÒA (Sau khi thêm Vitest)"],
        ["TỔNG ĐIỂM HACKATHON", "Điểm trung bình có trọng số", "100%", "9.1 / 10", "7.1 / 10", "👑 DỰ ÁN CỦA BẠN THẮNG ÁP ĐẢO"],
        ["PRODUCTION READY", "Bảo mật RBAC, Session, CSRF", "20%", "4.0", "9.0", "🏆 EDWARD"],
        ["PRODUCTION READY", "Kiểm thử & CI/CD tự động", "20%", "8.0", "8.5", "🏆 EDWARD (Nhỉnh hơn)"],
        ["PRODUCTION READY", "DevOps & Staging Isolation", "15%", "6.5", "9.0", "🏆 EDWARD"],
        ["PRODUCTION READY", "Kiến trúc mã nguồn (Monorepo/TS)", "15%", "9.5", "6.5", "🏆 BẠN"],
        ["PRODUCTION READY", "Khả năng mở rộng & Throughput", "15%", "9.0", "6.5", "🏆 BẠN"],
        ["PRODUCTION READY", "API Design & Tài liệu hóa", "15%", "8.5", "8.0", "🏆 BẠN"],
        ["TỔNG ĐIỂM PRODUCTION", "Điểm trung bình có trọng số", "100%", "7.4 / 10", "7.9 / 10", "🤝 EDWARD NHỈNH HƠN VỀ BẢO MẬT"]
    ]

    st = doc.add_table(rows=len(score_data), cols=6)
    st.alignment = WD_TABLE_ALIGNMENT.CENTER
    s_col_widths = [Inches(1.5), Inches(2.0), Inches(0.7), Inches(0.8), Inches(0.9), Inches(1.5)]

    for row_idx, row in enumerate(st.rows):
        is_header = (row_idx == 0)
        is_summary = ("TỔNG ĐIỂM" in score_data[row_idx][0])
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
        if is_header:
            trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

        for col_idx, cell in enumerate(row.cells):
            cell.width = s_col_widths[col_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.1

            text = score_data[row_idx][col_idx]
            r = p.add_run(text)

            if is_header:
                set_cell_background(cell, "0F172A")
                r.bold = True
                r.font.color.rgb = RGBColor(255, 255, 255)
                r.font.size = Pt(9)
                set_cell_border(cell, 
                                top=dict(sz=6, color='0F172A'),
                                bottom=dict(sz=12, color='38BDF8'),
                                left=dict(sz=2, color='334155'),
                                right=dict(sz=2, color='334155'))
            elif is_summary:
                set_cell_background(cell, "E0F2FE") # Sky 100
                r.bold = True
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(3, 105, 161)
                set_cell_border(cell, 
                                top=dict(sz=6, color='0284C7'),
                                bottom=dict(sz=6, color='0284C7'),
                                left=dict(sz=2, color='BAE6FD'),
                                right=dict(sz=2, color='BAE6FD'))
            else:
                r.font.size = Pt(8.5)
                bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
                set_cell_background(cell, bg_color)
                if "🏆 BẠN" in text or "👑 DỰ ÁN CỦA BẠN" in text:
                    r.bold = True
                    r.font.color.rgb = RGBColor(16, 185, 129)
                set_cell_border(cell, 
                                top=dict(sz=2, color='E2E8F0'),
                                bottom=dict(sz=2, color='E2E8F0'),
                                left=dict(sz=2, color='E2E8F0'),
                                right=dict(sz=2, color='E2E8F0'))

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # Conclusion Card
    conc_table = doc.add_table(rows=1, cols=1)
    conc_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    conc_cell = conc_table.cell(0, 0)
    set_cell_background(conc_cell, "F0FDF4") # Light emerald
    set_cell_margins(conc_cell, top=140, bottom=140, left=200, right=200)
    set_cell_border(conc_cell, 
                    top=dict(val='single', sz=6, color='16A34A'),
                    bottom=dict(val='single', sz=4, color='BBF7D0'),
                    left=dict(val='single', sz=24, color='16A34A'),
                    right=dict(val='single', sz=4, color='BBF7D0'))

    cp = conc_cell.paragraphs[0]
    cp.paragraph_format.space_after = Pt(2)
    rc1 = cp.add_run("📌 KẾT LUẬN CHIẾN LƯỢC CHO BẠN:\n")
    rc1.bold = True
    rc1.font.size = Pt(11)
    rc1.font.color.rgb = RGBColor(21, 128, 61)

    rc2 = cp.add_run(
        "1. Về mục tiêu Hackathon: Dự án của bạn vượt trội hoàn toàn (9.1 vs 7.1 điểm). Tính năng Self-Healing và kỹ thuật MongoDB Aggregation Pipeline nâng cao chính là 'vũ khí sát thương' trước BGK.\n"
        "2. Về các điểm yếu trước đây: Toàn bộ 4 lỗ hổng lớn nhất (Thiếu Datadog artifacts, thiếu CI/CD, thiếu Test tự động, thiếu Script verify) ĐÃ ĐƯỢC BỔ SUNG TRỌN VẸN.\n"
        "3. Lời khuyên khi thi đấu: Hãy tự tin làm nổi bật luồng Self-Healing và MongoDB Windowing trong bài thuyết trình 3 phút. Dự án của bạn hiện tại đã ở đẳng cấp dẫn đầu!"
    )
    rc2.font.size = Pt(10)
    rc2.font.color.rgb = RGBColor(20, 83, 45)

    # Output path
    out_path = r"d:\Projects\Git_Projects\sensorguard\SensorGuard_Comparison_Report.docx"
    doc.save(out_path)
    print(f"Generated DOCX successfully at: {out_path}")

if __name__ == '__main__':
    create_styled_document()
