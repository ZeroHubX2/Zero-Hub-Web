const http = require("http");

const PORT = Number(process.env.PORT) || 3000;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://zerohub-oczq.onrender.com,http://localhost:5500")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const TOPICS = ["สคริปต์ใช้งานไม่ได้", "เสนอแมพใหม่", "เสนอฟีเจอร์", "อื่นๆ"];
const LIMIT = 3;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (typeof fwd === "string" ? fwd.split(",")[0] : req.socket.remoteAddress || "").trim();
}

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= LIMIT) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) {
    if (list.every((t) => now - t >= WINDOW_MS)) hits.delete(ip);
  }
}, WINDOW_MS).unref();

function readJson(req, maxBytes = 8 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error("too_large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("bad_json"));
      }
    });
    req.on("error", reject);
  });
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function handleContact(req, res, cors) {
  if (!WEBHOOK_URL) return send(res, 503, { ok: false, error: "ยังไม่ได้ตั้งค่า webhook" }, cors);
  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { ok: false, error: "ข้อมูลไม่ถูกต้อง" }, cors);
  }
  if (clean(body.website, 100)) return send(res, 200, { ok: true }, cors);

  const name = clean(body.name, 50);
  const topic = TOPICS.includes(body.topic) ? body.topic : "อื่นๆ";
  const message = clean(body.message, 1000);
  if (!name || message.length < 5) {
    return send(res, 400, { ok: false, error: "กรอกชื่อและข้อความอย่างน้อย 5 ตัวอักษร" }, cors);
  }
  if (rateLimited(clientIp(req))) {
    return send(res, 429, { ok: false, error: "ส่งบ่อยเกินไป ลองใหม่ในอีก 10 นาที" }, cors);
  }

  const payload = {
    username: "ZeroHub Website",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `ข้อความใหม่จากเว็บ: ${topic}`,
        color: 0xff1e1e,
        fields: [
          { name: "ชื่อ", value: name, inline: true },
          { name: "หัวข้อ", value: topic, inline: true },
          { name: "ข้อความ", value: message },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const r = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`discord ${r.status}`);
  } catch (err) {
    console.error("webhook failed:", err.message);
    return send(res, 502, { ok: false, error: "ส่งไม่สำเร็จ ลองใหม่ภายหลัง" }, cors);
  }
  send(res, 200, { ok: true }, cors);
}

http
  .createServer((req, res) => {
    const cors = corsHeaders(req.headers.origin || "");
    const path = (req.url || "/").split("?")[0];

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    if (req.method === "GET" && path === "/") return send(res, 200, { ok: true, service: "zerohub-api" }, cors);
    if (req.method === "POST" && path === "/api/contact") return handleContact(req, res, cors);
    send(res, 404, { ok: false, error: "not found" }, cors);
  })
  .listen(PORT, () => console.log(`ZeroHub API on :${PORT}`));
