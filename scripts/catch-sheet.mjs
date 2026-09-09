/**
 * Giả lập Apps Script Web App, để test luồng đẩy Sheet mà không ghi vào
 * Sheet thật.
 *
 *   node scripts/catch-sheet.mjs                  # trả ok
 *   node scripts/catch-sheet.mjs --forbidden      # giả lập secret sai
 *   node scripts/catch-sheet.mjs --duplicate      # giả lập đơn đã có
 *   node scripts/catch-sheet.mjs --html           # giả lập chưa deploy đúng
 *                                                 (trả HTML thay vì JSON)
 *
 * `.env` phải có SHEET_WEBHOOK_URL="http://127.0.0.1:8898/exec"
 */
import { createServer } from "node:http";

const PORT = Number(process.env.CATCH_PORT ?? 8898);
const args = process.argv.slice(2);
const has = (f) => args.includes(f);

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    console.log(`\n=== ${new Date().toISOString()} ${req.method} ${req.url}`);

    if (has("--html")) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body>Sign in to continue</body></html>");
      console.log("(gia lap tra HTML - chua deploy dung)");
      return;
    }

    let body = {};
    try {
      body = JSON.parse(raw);
      // Không in secret ra log.
      const { secret, ...safe } = body;
      console.log("payload:", JSON.stringify(safe, null, 1));
      console.log("co secret:", secret ? "co (" + secret.length + " ky tu)" : "KHONG");
    } catch {
      console.log("raw:", raw.slice(0, 200));
    }

    res.writeHead(200, { "content-type": "application/json" });

    if (has("--forbidden")) {
      res.end(JSON.stringify({ ok: false, error: "forbidden" }));
      console.log("-> tra forbidden");
    } else if (has("--duplicate")) {
      res.end(JSON.stringify({ ok: true, duplicate: true }));
      console.log("-> tra duplicate");
    } else {
      res.end(JSON.stringify({ ok: true, row: 2 }));
      console.log("-> tra ok");
    }
  });
}).listen(PORT, "127.0.0.1", () =>
  console.log(`gia lap Apps Script tai http://127.0.0.1:${PORT}/exec`),
);
