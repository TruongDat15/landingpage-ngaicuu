# Landing page Thảm Ngải Cứu Dưỡng Sinh

Landing page bán thảm nhiệt ngải cứu — ưu đãi 389.000đ, tặng combo quà 150.000đ.
HTML/CSS/JS thuần, không cần build, không phụ thuộc framework.

## Cấu trúc

```
index.html      # toàn bộ nội dung trang
styles.css      # style (biến màu ở :root)
script.js       # CONFIG giá/suất còn lại + xử lý form
images/         # banner-gia, bo-san-pham, thanh-phan, cach-dung
```

## Chạy thử

Mở `index.html` bằng trình duyệt, hoặc:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Deploy GitHub Pages

1. Commit toàn bộ file lên nhánh `main` (giữ nguyên cấu trúc, `index.html` ở root).
2. **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / `/ (root)` → **Save**.
3. Sau 1–2 phút: https://truongdat15.github.io/landingpage-ngaicuu/

Nếu dùng tên miền riêng: **Settings → Pages → Custom domain**, rồi trỏ CNAME về `truongdat15.github.io`.

## Cần sửa trước khi chạy quảng cáo

| Việc | Ở đâu |
| --- | --- |
| Số điện thoại (đang là `0900000000`) | `index.html` — 2 chỗ `href="tel:..."` |
| Giá, mức giảm theo số lượng, số suất còn lại | `script.js` → `CONFIG` |
| Nhận đơn thật (server / Google Sheet / CRM) | `script.js` → chỗ `// TODO` trong `submit` |
| Màu thương hiệu | `styles.css` → `:root` (`--green`, `--red`, `--cream`) |

## Ghi chú

Form hiện chỉ hiện thông báo thành công phía client — chưa gửi dữ liệu đi đâu. Nối endpoint tại chỗ `TODO` trước khi chạy traffic.

Sản phẩm hỗ trợ chăm sóc sức khỏe, không phải thuốc và không thay thế thuốc chữa bệnh.
