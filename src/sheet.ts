/**
 * Đẩy đơn hàng sang Google Sheet qua Apps Script Web App.
 *
 * Nguyên tắc giống Telegram: KHÔNG BAO GIỜ làm mất đơn. Đơn đã nằm trong D1
 * trước khi gọi hàm này, và hàm này không throw ra ngoài.
 *
 * Apps Script Web App phải để "Anyone" mới gọi được, nên `secret` trong
 * payload là thứ duy nhất chặn người lạ ghi vào Sheet của khách.
 */

const TIMEOUT_MS = 15_000;

export type SheetRow = {
  id: string;
  createdAtIso: string;
  name: string;
  phone: string;
  address: string;
  qty: number;
  total: number;
};

export type SyncResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; reason: string };

export async function syncToSheet(
  env: Env,
  row: SheetRow,
): Promise<SyncResult> {
  // .trim() vì dán vào `wrangler secret put` rất dễ lẫn khoảng trắng.
  const url = String(env.SHEET_WEBHOOK_URL ?? "").trim();
  const secret = String(env.SHEET_SECRET ?? "").trim();

  if (!url || !secret) {
    return { ok: false, reason: "chưa cấu hình SHEET_WEBHOOK_URL/SHEET_SECRET" };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret,
        order_id: row.id,
        created_at_iso: row.createdAtIso,
        name: row.name,
        phone: row.phone,
        address: row.address,
        qty: row.qty,
        total: row.total,
      }),
      // Apps Script trả 302 sang googleusercontent.com rồi mới ra body.
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  const text = (await res.text()).slice(0, 500);

  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status}: ${text}` };
  }

  // Apps Script luôn trả HTTP 200 kể cả khi từ chối — giống API topproxy.
  // Phải đọc field `ok` trong body, không được tin status code.
  let body: { ok?: boolean; error?: string; duplicate?: boolean };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    // Không phải JSON thường là dấu hiệu chưa deploy đúng, hoặc URL trỏ vào
    // trang đăng nhập Google (khi "Who has access" không phải Anyone).
    return {
      ok: false,
      reason: `response không phải JSON — kiểm tra Deploy phải là Web app, "Who has access: Anyone". Nhận được: ${text.slice(0, 120)}`,
    };
  }

  if (body.ok !== true) {
    const reason = body.error ?? "Apps Script trả ok=false";
    return {
      ok: false,
      reason:
        reason === "forbidden"
          ? "forbidden — SHEET_SECRET không khớp var SECRET trong Apps Script"
          : reason,
    };
  }

  return { ok: true, duplicate: body.duplicate === true };
}
