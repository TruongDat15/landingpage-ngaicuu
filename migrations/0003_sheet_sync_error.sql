-- Lý do đẩy sang Google Sheet thất bại.
--
-- Cột `synced` và `synced_at` đã có từ migration 0001, nhưng thiếu chỗ ghi
-- NGUYÊN NHÂN. Vòng debug Telegram cho thấy chỉ biết "thất bại" là không đủ —
-- phải biết vì sao mới sửa được mà không phải đoán.
ALTER TABLE orders ADD COLUMN sync_error TEXT;
