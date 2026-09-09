/**
 * Bắn thông báo đơn hàng mới về Telegram.
 *
 * Nguyên tắc: KHÔNG BAO GIỜ làm mất đơn. Đơn đã lưu vào D1 trước khi gọi hàm
 * này, và hàm này không throw ra ngoài — lỗi được trả về dưới dạng kết quả để
 * ghi vào D1, không phá luồng.
 *
 * Token nằm trong ĐƯỜNG DẪN URL của Telegram (không phải header), nên
 * `observability.redact_query_string` không che được. Vì vậy tuyệt đối không
 * log URL — chỉ log status code.
 */

const TIMEOUT_MS = 10_000;

export type OrderNotification = {
  id: string;
  name: string;
  phone: string;
  address: string;
  qty: number;
  total: number;
};

export type NotifyResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * parse_mode HTML của Telegram sẽ hiểu `<` `>` `&` là markup. Tên hoặc địa chỉ
 * khách có ký tự đó sẽ làm tin nhắn lỗi hoặc chèn được tag lạ — phải escape.
 */
function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const vnd = (n: number) =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";

/** Giờ Việt Nam (UTC+7); Worker chạy ở UTC. */
function nowVN(): string {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function buildMessage(o: OrderNotification): string {
  // Số điện thoại để dạng text trơn: Telegram tự nhận dạng và cho bấm gọi
  // trên điện thoại. `tel:` trong <a href> không được Telegram cho phép.
  return [
    "🛒 <b>ĐƠN HÀNG MỚI</b>",
    "",
    `👤 <b>${escapeHtml(o.name)}</b>`,
    `📞 ${escapeHtml(o.phone)}`,
    `📍 ${escapeHtml(o.address)}`,
    "",
    `📦 Số lượng: <b>${o.qty}</b> thảm`,
    `💰 Tổng tiền: <b>${vnd(o.total)}</b>`,
    "",
    `🕒 ${nowVN()}`,
    `<code>${o.id.slice(0, 8)}</code>`,
  ].join("\n");
}

export async function notifyOrder(
  env: Env,
  order: OrderNotification,
): Promise<NotifyResult> {
  // .trim() vì dán token vào `wrangler secret put` rất dễ lẫn khoảng trắng
  // hoặc ký tự xuống dòng — token có dư một space là Telegram trả 404.
  const token = String(env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = String(env.TELEGRAM_CHAT_ID ?? "").trim();

  if (!token || !chatId) {
    return { ok: false, reason: "chưa cấu hình TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID" };
  }

  // Base URL để test local trỏ về server giả được, không gọi Telegram thật.
  const base = String(env.TELEGRAM_API_BASE || "https://api.telegram.org");

  let res: Response;
  try {
    res = await fetch(`${base}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(order),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  if (res.ok) return { ok: true };

  // Telegram trả JSON kèm `description` giải thích lỗi — hữu ích hơn status
  // code trơn. Thêm gợi ý cho hai mã hay gặp nhất để lần sau đọc là biết
  // ngay phải sửa gì, không phải đi đoán.
  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { description?: string };
    if (body?.description) detail += `: ${body.description}`;
  } catch {
    // body không phải JSON -> giữ nguyên status code
  }

  if (res.status === 404) {
    detail += " — TELEGRAM_BOT_TOKEN sai hoặc đã bị revoke";
  } else if (res.status === 400) {
    detail += " — TELEGRAM_CHAT_ID sai (group phải giữ dấu -)";
  } else if (res.status === 403) {
    detail += " — người nhận chưa bấm Start hoặc đã block bot";
  }

  return { ok: false, reason: detail };
}
