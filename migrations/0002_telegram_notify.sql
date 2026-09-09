-- Theo dõi việc bắn thông báo Telegram.
--
-- Tách khỏi cột `synced` (dành cho Google Sheet) vì hai kênh độc lập: Telegram
-- lỗi không có nghĩa Sheet lỗi. Có cột này thì biết đơn nào chưa báo được để
-- gửi lại, thay vì mất im lặng.
ALTER TABLE orders ADD COLUMN notified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN notified_at TEXT;
ALTER TABLE orders ADD COLUMN notify_error TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_notified ON orders (notified, created_at);
