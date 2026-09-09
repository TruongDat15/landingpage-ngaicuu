-- Đơn hàng từ form trên landing page.
--
-- Đây là nguồn sự thật. Google Sheet (làm sau) chỉ là bản để xem và làm việc —
-- Sheet lỗi thì đơn vẫn còn ở đây, chỉ cần sync lại.
CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  name         TEXT    NOT NULL,
  phone        TEXT    NOT NULL,
  address      TEXT    NOT NULL,
  qty          INTEGER NOT NULL,

  -- Tổng do SERVER tính, không lấy từ client. Client sửa được mọi thứ nó gửi.
  unit_price   INTEGER NOT NULL,
  discount     INTEGER NOT NULL,
  total        INTEGER NOT NULL,

  -- Dùng để chặn spam và tra khi cần. Không log ra Workers Logs.
  ip           TEXT,
  country      TEXT,
  user_agent   TEXT,
  referer      TEXT,

  -- 0 = chưa đẩy sang Google Sheet. Cột này để dành cho bước sau.
  synced       INTEGER NOT NULL DEFAULT 0,
  synced_at    TEXT,

  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Xem đơn mới nhất trước.
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- Chặn bấm submit hai lần, và tra theo số điện thoại khi khách gọi lại.
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (phone, created_at DESC);

-- Đếm số đơn theo IP trong ít phút gần đây để chặn bot.
CREATE INDEX IF NOT EXISTS idx_orders_ip ON orders (ip, created_at DESC);

-- Tìm đơn chưa sync sang Sheet.
CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders (synced, created_at);
