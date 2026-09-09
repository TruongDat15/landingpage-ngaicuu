/**
 * Bắt request mà Worker gửi tới Telegram, để xem tin nhắn đơn hàng trông thế
 * nào mà không cần bot thật.
 *
 *   node scripts/catch-telegram.mjs
 *
 * `.env` phải có TELEGRAM_API_BASE="http://127.0.0.1:8899"
 *
 * Thêm `--fail 403` để giả lập Telegram trả lỗi, kiểm tra Worker có ghi
 * notify_error vào D1 hay không.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.CATCH_PORT ?? 8899);
const args = process.argv.slice(2);
const failIdx = args.indexOf("--fail");
const failStatus = failIdx >= 0 ? Number(args[failIdx + 1]) : 0;

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    // Không in URL: token nằm trong đường dẫn.
    const path = req.url?.replace(/\/bot[^/]+\//, "/bot<TOKEN>/") ?? "";
    console.log(`\n=== ${new Date().toISOString()} ${req.method} ${path}`);

    if (failStatus) {
      res.writeHead(failStatus, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error_code: failStatus,
          description: "forbidden: bot was blocked by the user",
        }),
      );
      console.log(`(gia lap loi HTTP ${failStatus})`);
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));

    try {
      const body = JSON.parse(raw);
      console.log(`chat_id: ${body.chat_id}   parse_mode: ${body.parse_mode}`);
      console.log("--- tin nhắn ---");
      console.log(body.text);
      console.log("--- hết ---");
    } catch {
      console.log(raw);
    }
  });
}).listen(PORT, "127.0.0.1", () =>
  console.log(`bat Telegram tai http://127.0.0.1:${PORT}`),
);
