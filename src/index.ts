/**
 * Worker cho landing page Thảm Ngải Cứu.
 *
 * Chỉ xử lý các path khai trong `assets.run_worker_first` (xem wrangler.jsonc).
 * Mọi path khác do asset Worker serve trực tiếp — miễn phí, không qua đây.
 *
 * Dữ liệu khách (tên, số điện thoại, địa chỉ) KHÔNG được log ra Workers Logs
 * và không bao giờ đi vào query string.
 */

const MAX_QTY = 3;

/** Chặn bot: tối đa N đơn từ cùng một IP trong khoảng thời gian dưới. */
const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_MINUTES = 10;

/** Bấm submit hai lần trên mobile rất thường gặp — coi là cùng một đơn. */
const DEDUPE_MINUTES = 3;

type OrderInput = {
  name: string;
  phone: string;
  address: string;
  qty: number;
  clientTotal: number | null;
};

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...fields }));
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

const fail = (status: number, code: string, message: string) =>
  json({ ok: false, error: { code, message } }, status);

// ------------------------------------------------------------------ giá

/**
 * Bảng giá lấy từ `vars` trong wrangler.jsonc.
 *
 * LƯU Ý: public/script.js có bản sao của bảng giá này để hiển thị trước khi
 * submit. Sửa giá thì phải sửa CẢ HAI. Nếu lệch, Worker vẫn lưu đúng giá của
 * mình và ghi log `price_mismatch` để bạn phát hiện.
 */
function priceFor(env: Env, qty: number) {
  const unitPrice = Number(env.UNIT_PRICE);

  let discounts: Record<string, number> = {};
  try {
    discounts = JSON.parse(String(env.QTY_DISCOUNTS)) as Record<string, number>;
  } catch {
    discounts = {};
  }

  const discount = Number(discounts[String(qty)] ?? 0);
  return { unitPrice, discount, total: unitPrice * qty - discount };
}

// ------------------------------------------------------------ validate

function normalizePhone(raw: string): string | null {
  // Bỏ khoảng trắng, dấu chấm, gạch ngang mà người dùng hay gõ.
  let p = raw.replace(/[\s.\-()]/g, "");

  // +84 / 84 -> 0
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("84") && p.length === 11) p = "0" + p.slice(2);

  // Số di động VN: 10 chữ số, bắt đầu 0, chữ số thứ hai là 3/5/7/8/9.
  return /^0[35789]\d{8}$/.test(p) ? p : null;
}

function parseOrder(
  payload: unknown,
): { ok: true; value: OrderInput } | { ok: false; code: string; message: string } {
  const p =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  if (!p) return { ok: false, code: "invalid_body", message: "Dữ liệu không hợp lệ." };

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = str(p.name);
  if (name.length < 2 || name.length > 100) {
    return { ok: false, code: "invalid_name", message: "Vui lòng nhập họ tên." };
  }

  const phone = normalizePhone(str(p.phone));
  if (!phone) {
    return {
      ok: false,
      code: "invalid_phone",
      message: "Số điện thoại không hợp lệ. Vui lòng nhập số di động 10 chữ số.",
    };
  }

  const address = str(p.address);
  if (address.length < 8 || address.length > 300) {
    return {
      ok: false,
      code: "invalid_address",
      message: "Vui lòng nhập địa chỉ nhận hàng đầy đủ.",
    };
  }

  const qty = Number(p.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
    return { ok: false, code: "invalid_qty", message: "Số lượng không hợp lệ." };
  }

  const clientTotalRaw = Number(p.clientTotal);
  const clientTotal = Number.isFinite(clientTotalRaw) ? clientTotalRaw : null;

  return { ok: true, value: { name, phone, address, qty, clientTotal } };
}

// ------------------------------------------------------------- handler

async function handleOrder(request: Request, env: Env): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail(400, "invalid_json", "Dữ liệu không hợp lệ.");
  }

  const parsed = parseOrder(payload);
  if (!parsed.ok) {
    log("order.rejected", { code: parsed.code });
    return fail(400, parsed.code, parsed.message);
  }

  const order = parsed.value;
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  const country = (request.cf?.country as string | undefined) ?? "";

  // Chặn bot theo IP.
  if (ip) {
    const recent = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM orders
        WHERE ip = ?1 AND created_at > datetime('now', ?2)`,
    )
      .bind(ip, `-${RATE_LIMIT_MINUTES} minutes`)
      .first<{ n: number }>();

    if ((recent?.n ?? 0) >= RATE_LIMIT_COUNT) {
      log("order.rate_limited", { country });
      return fail(
        429,
        "rate_limited",
        "Bạn đã gửi quá nhiều đơn. Vui lòng thử lại sau ít phút.",
      );
    }
  }

  // Bấm submit hai lần -> trả về đơn đã có, không tạo đơn thứ hai.
  const dupe = await env.DB.prepare(
    `SELECT id FROM orders
      WHERE phone = ?1 AND qty = ?2 AND created_at > datetime('now', ?3)
      ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(order.phone, order.qty, `-${DEDUPE_MINUTES} minutes`)
    .first<{ id: string }>();

  if (dupe) {
    log("order.duplicate_ignored", { id: dupe.id });
    return json({ ok: true, id: dupe.id, duplicate: true });
  }

  const { unitPrice, discount, total } = priceFor(env, order.qty);

  // Giá client hiển thị lệch giá server -> vẫn lưu giá server, nhưng ghi log
  // để phát hiện script.js và wrangler.jsonc không còn khớp nhau.
  if (order.clientTotal !== null && order.clientTotal !== total) {
    console.error(
      JSON.stringify({
        event: "price_mismatch",
        qty: order.qty,
        server_total: total,
        client_total: order.clientTotal,
      }),
    );
  }

  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO orders
       (id, name, phone, address, qty, unit_price, discount, total,
        ip, country, user_agent, referer)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  )
    .bind(
      id,
      order.name,
      order.phone,
      order.address,
      order.qty,
      unitPrice,
      discount,
      total,
      ip,
      country,
      (request.headers.get("user-agent") ?? "").slice(0, 300),
      (request.headers.get("referer") ?? "").slice(0, 300),
    )
    .run();

  // Không log tên / số điện thoại / địa chỉ — đây là dữ liệu cá nhân.
  log("order.created", { id, qty: order.qty, total, country });

  return json({ ok: true, id }, 201);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/order") {
      if (request.method !== "POST") {
        return fail(405, "method_not_allowed", "Chỉ nhận POST.");
      }
      return handleOrder(request, env);
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, ts: new Date().toISOString() });
    }

    // Path không khớp -> để asset Worker xử lý (serve file tĩnh).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
