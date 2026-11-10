const http = require("http");
const crypto = require("crypto");

const env = (name, fallback = "") => (process.env[name] || fallback).trim();

const PORT = Number(process.env.PORT) || 3000;
const WEBHOOK_URL = env("DISCORD_WEBHOOK_URL");
const SALES_WEBHOOK_URL = env("SALES_WEBHOOK_URL");
const ALLOWED_ORIGINS = env("ALLOWED_ORIGINS", "https://zerohub-shop.pages.dev,http://localhost:5510,http://127.0.0.1:5510")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SUPABASE_URL = env("SUPABASE_URL").replace(/\/+$/, "");
const SUPABASE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const GITHUB_TOKEN = env("GITHUB_TOKEN");
const GITHUB_REPO = env("GITHUB_REPO");
const GITHUB_BRANCH = env("GITHUB_BRANCH", "main");
const GITHUB_API = env("GITHUB_API", "https://api.github.com").replace(/\/+$/, "");
const SCRIPT_FILES = (() => {
  const defaults = {
    loader: "loader.lua",
    egg: "egg.lua",
    animezero: "animezero.lua",
    astd: "astd.lua",
    sta: "sta.lua",
    animeeyes: "animeeyes.lua",
    aotr: "aotr.lua",
  };
  try {
    return { ...defaults, ...JSON.parse(env("SCRIPT_FILES", "{}")) };
  } catch {
    return defaults;
  }
})();
const TRUEMONEY_PHONE = env("TRUEMONEY_PHONE").replace(/\D/g, "");
const ADMIN_TOKEN = env("ADMIN_TOKEN");
const SHOP_URL = env("SHOP_URL", "https://zerohub-shop.pages.dev");
const TRUEMONEY_BASE = env("TRUEMONEY_BASE", "https://gift.truemoney.com").replace(/\/+$/, "");
const TRUEMONEY_PROXY_SECRET = env("TRUEMONEY_PROXY_SECRET");
const SESSION_SECRET = env("SESSION_SECRET") || crypto.createHash("sha256").update(`zh-session:${SUPABASE_KEY}`).digest("hex");
const DISCORD_PUBLIC_KEY = env("DISCORD_PUBLIC_KEY");
const DISCORD_APP_ID = env("DISCORD_APP_ID");
const DISCORD_BOT_TOKEN = env("DISCORD_BOT_TOKEN");
const DISCORD_GUILD_ID = env("DISCORD_GUILD_ID");
const DISCORD_BUYER_ROLE_ID = env("DISCORD_BUYER_ROLE_ID");
const DISCORD_ADMIN_ROLE_IDS = env("DISCORD_ADMIN_ROLE_IDS").split(",").map((s) => s.trim()).filter(Boolean);
const DISCORD_ADMIN_IDS = env("DISCORD_ADMIN_IDS").split(",").map((s) => s.trim()).filter(Boolean);

const TOPICS = ["สคริปต์ใช้งานไม่ได้", "เสนอแมพใหม่", "เสนอฟีเจอร์", "อื่นๆ"];
const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DISCORD_API = "https://discord.com/api/v10";

const limiters = [];
function limiter(limit, windowMs) {
  const hits = new Map();
  limiters.push({ hits, windowMs });
  return (id) => {
    const now = Date.now();
    const list = (hits.get(id) || []).filter((t) => now - t < windowMs);
    if (list.length >= limit) {
      hits.set(id, list);
      return true;
    }
    list.push(now);
    hits.set(id, list);
    return false;
  };
}
setInterval(() => {
  const now = Date.now();
  for (const { hits, windowMs } of limiters) {
    for (const [id, list] of hits) {
      if (list.every((t) => now - t >= windowMs)) hits.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

const contactLimited = limiter(3, 10 * 60 * 1000);
const loaderLimited = limiter(60, 10 * 60 * 1000);
const webKeyLimited = limiter(30, 10 * 60 * 1000);
const redeemLimited = limiter(6, 10 * 60 * 1000);
const sessionLimited = limiter(120, 10 * 60 * 1000);
const userLimited = limiter(60, 10 * 60 * 1000);
const adminFailLimited = limiter(10, 15 * 60 * 1000);

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(text);
}

function isBrowser(req) {
  const h = req.headers;
  if (!/Mozilla\//.test(String(h["user-agent"] || ""))) return false;
  if (h["sec-fetch-dest"] || h["sec-fetch-mode"] || h["sec-ch-ua"]) return true;
  return /text\/html/i.test(String(h.accept || ""));
}

const DENIED_PAGE = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Zero Hub | Access Denied</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font-family:Kanit,system-ui,sans-serif;color:#fff;display:grid;place-items:center;padding:16px;
background:radial-gradient(ellipse 60% 45% at 50% 40%,rgba(200,15,45,.28),transparent 70%),#070707}
.box{width:100%;max-width:440px;text-align:center;padding:36px 28px;border-radius:20px;background:#121212;
border:1px solid #2a2a2a;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,42,75,.08)}
img{width:96px;height:96px;border-radius:50%;box-shadow:0 0 34px rgba(255,42,75,.35)}
h1{margin:18px 0 2px;font-size:30px;letter-spacing:4px;font-weight:700}h1 b{color:#ff2a4b}
.sub{color:#8f8f8f;font-size:12px;letter-spacing:4px}
.tag{display:inline-block;margin:22px 0 12px;padding:5px 14px;border-radius:999px;font-size:12px;letter-spacing:2px;
color:#ff6b80;border:1px solid rgba(255,42,75,.45);background:rgba(255,42,75,.08)}
h2{margin:0 0 8px;font-size:22px}p{margin:0;color:#b5b5b5;font-size:14.5px;line-height:1.6}
a.btn{display:inline-block;margin-top:22px;padding:11px 22px;border-radius:12px;color:#fff;text-decoration:none;
background:linear-gradient(135deg,#ff2a4b,#a50d27);box-shadow:0 6px 26px rgba(255,42,75,.35)}
.foot{margin-top:26px;padding-top:16px;border-top:1px solid #2a2a2a;color:#5f5f5f;font-size:11px;letter-spacing:3px}
</style></head><body><div class="box">
<img src="https://zerohub-shop.pages.dev/logo.webp" alt="Zero Hub">
<h1>ZERO <b>HUB</b></h1><div class="sub">SCRIPT PROTECTION SYSTEM</div>
<div class="tag">403 · ACCESS RESTRICTED</div>
<h2>ไม่อนุญาตให้ดูโค้ด</h2>
<p>ลิงก์นี้ใช้รันใน executor เท่านั้น เปิดดูผ่านเบราว์เซอร์ไม่ได้<br>รับสคริปต์และคีย์ได้ที่ร้าน Zero Hub</p>
<a class="btn" href="https://zerohub-shop.pages.dev/howto">ไปที่ร้าน Zero Hub</a>
<div class="foot">ZERO HUB © 2026 · ALL RIGHTS RESERVED</div>
</div></body></html>`;

function denyBrowser(req, res) {
  if (!isBrowser(req)) return false;
  res.writeHead(403, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  res.end(DENIED_PAGE);
  return true;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (typeof fwd === "string" ? fwd.split(",")[0] : req.socket.remoteAddress || "").trim();
}

function readRaw(req, maxBytes = 8 * 1024) {
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
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(req, maxBytes) {
  const raw = await readRaw(req, maxBytes);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("bad_json");
  }
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normKey(value) {
  return clean(value, 40).toUpperCase();
}

function normHwid(value) {
  return clean(value, 128);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function signSession(keyId, hwid) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(`${keyId}.${hwid}`).digest("base64url");
}

function newKey() {
  let s = "";
  for (let i = 0; i < 16; i++) {
    if (i && i % 4 === 0) s += "-";
    s += KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)];
  }
  return `ZH-${s}`;
}

class DbError extends Error {}

async function db(path, { method = "GET", body, prefer } = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new DbError("database not configured");
  const headers = SUPABASE_KEY.startsWith("sb_") ? { apikey: SUPABASE_KEY } : { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const err = new DbError((data && (data.message || data.hint)) || `db ${r.status}`);
    err.status = r.status;
    err.code = data && data.code;
    throw err;
  }
  return data;
}

const q = encodeURIComponent;

async function dbPage(path, size, page) {
  const headers = SUPABASE_KEY.startsWith("sb_") ? { apikey: SUPABASE_KEY } : { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  headers.Prefer = "count=exact";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}&limit=${size}&offset=${(page - 1) * size}`, { headers, signal: AbortSignal.timeout(15000) });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok && r.status !== 416) {
    const err = new DbError((data && (data.message || data.hint)) || `db ${r.status}`);
    err.status = r.status;
    err.code = data && data.code;
    throw err;
  }
  const m = String(r.headers.get("content-range") || "").match(/\/(\d+)$/);
  const rows = r.ok ? data : [];
  return { rows, total: m ? Number(m[1]) : (page - 1) * size + rows.length };
}

const pageArgs = (url) => {
  const size = [20, 50, 100].includes(Number(url.searchParams.get("size"))) ? Number(url.searchParams.get("size")) : 20;
  const page = Math.min(100000, Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1)));
  return { size, page };
};

async function getTiers(all = false) {
  return db(`key_tiers?select=*&order=sort_order.asc${all ? "" : "&is_active=eq.true"}`);
}

async function getTier(id) {
  const rows = await db(`key_tiers?select=*&id=eq.${q(id)}&is_active=eq.true`);
  return rows[0] || null;
}

async function getKey(key) {
  const rows = await db(`keys?select=*&key=eq.${q(key)}`);
  return rows[0] || null;
}

async function createKeys(tier, count, fields = {}) {
  const rows = Array.from({ length: count }, () => ({ key: newKey(), tier: tier.id, hours: tier.hours, ...fields }));
  return db("keys", { method: "POST", body: rows, prefer: "return=representation" });
}

async function updateKey(key, patch) {
  const rows = await db(`keys?key=eq.${q(key)}`, { method: "PATCH", body: patch, prefer: "return=representation" });
  return rows[0] || null;
}

async function useKey(key, hwid) {
  const rows = await db("rpc/key_use", { method: "POST", body: { p_key: key, p_hwid: hwid } });
  return rows[0] || { status: "invalid" };
}

async function resetHwid(key, force = false) {
  const rows = await db("rpc/key_reset_hwid", { method: "POST", body: { p_key: key, p_force: force } });
  return rows[0] || { status: "invalid" };
}

async function extendKey(k, hours) {
  const ms = hours * 3600 * 1000;
  if (k.hours === null && !k.expires_at) return k;
  if (!k.activated_at) return updateKey(k.key, { hours: Math.max(1, Math.round((k.hours || 0) + hours)) });
  const base = Math.max(Date.now(), new Date(k.expires_at).getTime());
  return updateKey(k.key, { expires_at: new Date(base + ms).toISOString() });
}

const KEY_STATUS_TEXT = {
  invalid: "คีย์ไม่ถูกต้อง",
  revoked: "คีย์นี้ถูกระงับแล้ว",
  hwid: "คีย์นี้ผูกกับเครื่องอื่นอยู่ รีเซ็ต HWID ได้ที่หน้า คีย์ของฉัน บนเว็บ หรือ /resethwid ใน Discord",
  expired: "คีย์หมดอายุแล้ว",
  cooldown: "รีเซ็ต HWID ได้วันละครั้ง",
};

function keyView(k, tierName) {
  const now = Date.now();
  const expired = !!k.expires_at && new Date(k.expires_at).getTime() <= now;
  const resetAt = k.hwid_reset_at ? new Date(k.hwid_reset_at).getTime() + 24 * 3600 * 1000 : 0;
  return {
    key: k.key,
    tier: k.tier,
    tier_name: tierName || k.tier,
    lifetime: k.hours === null,
    hours: k.hours,
    activated: !!k.activated_at,
    expires_at: k.expires_at,
    expired,
    revoked: k.revoked,
    hwid_bound: !!k.hwid,
    next_reset_at: resetAt > now ? new Date(resetAt).toISOString() : null,
    discord_linked: !!k.discord_id,
  };
}

const T = (L, th, en) => (L === "en" ? en : th);

const KEY_STATUS_EN = {
  invalid: "Invalid key",
  revoked: "This key has been revoked",
  hwid: "This key is locked to another device. Reset HWID on My Keys on the website or with /resethwid on Discord",
  expired: "This key has expired",
  cooldown: "HWID can be reset once a day",
};
const statusText = (L, s) => (L === "en" ? KEY_STATUS_EN : KEY_STATUS_TEXT)[s] || s;

function formatLeft(k, L) {
  if (k.hours === null) return T(L, "ถาวร", "Lifetime");
  if (!k.activated_at) return T(L, `${fmtHours(k.hours)} (เริ่มนับเมื่อใช้ครั้งแรก)`, `${fmtHours(k.hours, L)} (starts on first use)`);
  const left = new Date(k.expires_at).getTime() - Date.now();
  if (left <= 0) return T(L, "หมดอายุแล้ว", "Expired");
  return T(L, `เหลือ ${fmtHours(left / 3600000)}`, `${fmtHours(left / 3600000, L)} left`);
}

function fmtHours(h, L) {
  if (L === "en") {
    if (h >= 48) return `${Math.floor(h / 24)} days ${Math.floor(h % 24)} h`;
    if (h >= 1) return `${Math.floor(h)} h`;
    return `${Math.max(1, Math.floor(h * 60))} min`;
  }
  if (h >= 48) return `${Math.floor(h / 24)} วัน ${Math.floor(h % 24)} ชม.`;
  if (h >= 1) return `${Math.floor(h)} ชม.`;
  return `${Math.max(1, Math.floor(h * 60))} นาที`;
}

const scriptCache = new Map();
function fetchRepoFile(path) {
  const hit = scriptCache.get(path);
  if (hit && Date.now() - hit.at < 60 * 1000) return hit.promise;
  const promise = (async () => {
    if (!GITHUB_TOKEN || !GITHUB_REPO) throw new Error("script storage not configured");
    const url = `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path.split("/").map(q).join("/")}?ref=${q(GITHUB_BRANCH)}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.raw",
        "User-Agent": "zerohub-api",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`github ${r.status}`);
    return r.text();
  })();
  scriptCache.set(path, { at: Date.now(), promise });
  promise.catch(() => scriptCache.delete(path));
  return promise;
}

async function postWebhook(url, payload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed_mentions: { parse: [] }, ...payload }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error("webhook failed:", err.message);
  }
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
  if (contactLimited(clientIp(req))) {
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

async function handleKeyCheck(req, res, url) {
  if (loaderLimited(clientIp(req))) return send(res, 200, { ok: false, status: "rate", error: "เรียกบ่อยเกินไป รอสักครู่" });
  const key = normKey(url.searchParams.get("key"));
  const hwid = normHwid(url.searchParams.get("hwid"));
  if (!key || hwid.length < 4) return send(res, 200, { ok: false, status: "invalid", error: KEY_STATUS_TEXT.invalid });
  const r = await useKey(key, hwid);
  if (r.status !== "ok") return send(res, 200, { ok: false, status: r.status, error: KEY_STATUS_TEXT[r.status] || r.status });
  send(res, 200, { ok: true, status: "ok", tier: r.tier, expires_at: r.expires_at, lifetime: !r.expires_at });
}

async function handleKeyScript(req, res, url) {
  if (denyBrowser(req, res)) return;
  if (loaderLimited(clientIp(req))) return sendText(res, 200, "ZHERR:เรียกบ่อยเกินไป รอสักครู่");
  const key = normKey(url.searchParams.get("key"));
  const hwid = normHwid(url.searchParams.get("hwid"));
  const game = clean(url.searchParams.get("game"), 40).toLowerCase();
  const file = game !== "loader" && Object.prototype.hasOwnProperty.call(SCRIPT_FILES, game) ? SCRIPT_FILES[game] : null;
  if (!file) return sendText(res, 200, "ZHERR:ไม่รองรับเกมนี้");
  if (!key || hwid.length < 4) return sendText(res, 200, `ZHERR:${KEY_STATUS_TEXT.invalid}`);
  const r = await useKey(key, hwid);
  if (r.status !== "ok") return sendText(res, 200, `ZHERR:${KEY_STATUS_TEXT[r.status] || r.status}`);
  try {
    const src = await fetchRepoFile(file);
    const k = await getKey(key);
    sendText(res, 200, `--ZHS:${k.id}.${signSession(k.id, hwid)}\n${src}`);
  } catch (err) {
    console.error("script fetch failed:", game, err.message);
    sendText(res, 200, "ZHERR:โหลดสคริปต์ไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
}

async function handleKeySession(req, res, url) {
  if (sessionLimited(clientIp(req))) return send(res, 200, { ok: null, status: "rate" });
  const token = clean(url.searchParams.get("t"), 200);
  const hwid = normHwid(url.searchParams.get("hwid"));
  const m = token.match(/^(\d{1,15})\.([A-Za-z0-9_-]{43})$/);
  if (!m || hwid.length < 4 || !safeEqual(m[2], signSession(m[1], hwid))) {
    return send(res, 200, { ok: false, status: "session", error: "ต้องรันผ่าน Zero Hub Loader พร้อมคีย์ของตัวเองเท่านั้น" });
  }
  const [k] = await db(`keys?select=*&id=eq.${m[1]}`);
  let status = "ok";
  if (!k) status = "invalid";
  else if (k.revoked) status = "revoked";
  else if (k.hwid !== hwid) status = "hwid";
  else if (k.expires_at && new Date(k.expires_at).getTime() <= Date.now()) status = "expired";
  if (status !== "ok") return send(res, 200, { ok: false, status, error: KEY_STATUS_TEXT[status] });
  send(res, 200, { ok: true, status, expires_at: k.expires_at, lifetime: k.hours === null });
}

async function handleLoader(req, res) {
  if (denyBrowser(req, res)) return;
  try {
    sendText(res, 200, await fetchRepoFile(SCRIPT_FILES.loader));
  } catch (err) {
    console.error("loader fetch failed:", err.message);
    sendText(res, 200, 'warn("[Zero Hub] loader unavailable, try again later")');
  }
}

async function handleTiers(req, res, cors) {
  const tiers = await getTiers();
  send(res, 200, { ok: true, tiers: tiers.map(({ id, name, price, hours }) => ({ id, name, price, hours })) }, cors);
}

async function handleKeyInfo(req, res, cors) {
  if (webKeyLimited(clientIp(req))) return send(res, 429, { ok: false, error: "ลองบ่อยเกินไป รอสักครู่" }, cors);
  const body = await readJson(req);
  const k = await getKey(normKey(body.key));
  if (!k) return send(res, 404, { ok: false, error: KEY_STATUS_TEXT.invalid }, cors);
  const tier = (await getTiers(true)).find((t) => t.id === k.tier);
  send(res, 200, { ok: true, key: keyView(k, tier && tier.name) }, cors);
}

async function handleKeyReset(req, res, cors) {
  if (webKeyLimited(clientIp(req))) return send(res, 429, { ok: false, error: "ลองบ่อยเกินไป รอสักครู่" }, cors);
  const body = await readJson(req);
  const r = await resetHwid(normKey(body.key));
  if (r.status !== "ok") {
    return send(res, 400, { ok: false, status: r.status, error: KEY_STATUS_TEXT[r.status] || r.status, next_reset_at: r.next_reset_at }, cors);
  }
  send(res, 200, { ok: true, next_reset_at: r.next_reset_at }, cors);
}

const VOUCHER_ERRORS = {
  VOUCHER_OUT_OF_STOCK: "ซองนี้ถูกรับไปหมดแล้ว",
  VOUCHER_NOT_FOUND: "ไม่พบซองนี้ ตรวจลิงก์อีกครั้ง",
  VOUCHER_EXPIRED: "ซองหมดอายุแล้ว",
  TARGET_USER_REDEEMED: "ซองนี้ถูกใช้ไปแล้ว",
  CANNOT_GET_OWN_VOUCHER: "ไม่สามารถรับซองของตัวเองได้",
  TARGET_USER_NOT_FOUND: "เบอร์รับเงินของร้านไม่ถูกต้อง แจ้งแอดมิน",
};

function parseVoucher(input) {
  const s = clean(input, 300);
  const m = s.match(/[?&]v=([0-9A-Za-z]+)/);
  const code = m ? m[1] : s;
  return /^[0-9A-Za-z]{10,64}$/.test(code) ? code : "";
}

let browserClient = null;
function browserFetch() {
  if (browserClient === null) {
    try {
      const { Impit } = require("impit");
      const client = new Impit({ browser: "chrome", timeout: 20000 });
      browserClient = (url, opts) => client.fetch(url, opts);
    } catch (err) {
      console.error("impit unavailable, using plain fetch:", err.message);
      browserClient = (url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
    }
  }
  return browserClient;
}

async function truemoney(code, action) {
  const base = `${TRUEMONEY_BASE}/campaign/vouchers/${q(code)}`;
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
    Origin: "https://gift.truemoney.com",
    Referer: `https://gift.truemoney.com/campaign/?v=${code}`,
  };
  if (TRUEMONEY_PROXY_SECRET) headers["x-zh-secret"] = TRUEMONEY_PROXY_SECRET;
  const go = browserFetch();
  const r =
    action === "verify"
      ? await go(`${base}/verify?mobile=${TRUEMONEY_PHONE}`, { headers })
      : await go(`${base}/redeem`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ mobile: TRUEMONEY_PHONE, voucher_hash: code }),
        });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`truemoney ${action} http ${r.status} via ${TRUEMONEY_BASE.replace(/^https?:\/\//, "")}: ${text.replace(/\s+/g, " ").slice(0, 80)}`);
  }
  const status = (data.status && data.status.code) || "UNKNOWN";
  return { status, data: data.data || {} };
}

async function claimVoucher(code, uid, ip) {
  try {
    await db("vouchers", { method: "POST", body: { hash: code, user_id: uid, ip }, prefer: "return=minimal" });
    return { ok: true };
  } catch (err) {
    if (err.code !== "23505") throw err;
  }
  const rows = await db(`vouchers?hash=eq.${q(code)}&status=eq.failed`, {
    method: "PATCH",
    body: { status: "pending", user_id: uid, ip, error: "" },
    prefer: "return=representation",
  });
  if (rows.length) return { ok: true };
  const [v] = await db(`vouchers?select=status&hash=eq.${q(code)}`);
  return { ok: false, error: v && v.status === "redeemed" ? "ซองนี้ถูกใช้เติมเงินไปแล้ว" : "ซองนี้กำลังดำเนินการอยู่ รอสักครู่" };
}

async function authUser(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token || token.length > 4096 || !SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch {
    return null;
  }
}

function userName(u) {
  const m = u.user_metadata || {};
  return clean(m.username || m.full_name || m.name || (u.email || "").split("@")[0], 40);
}

function discordIdOf(u) {
  const ident = (u.identities || []).find((i) => i.provider === "discord");
  const id = String((ident && (ident.id || (ident.identity_data && ident.identity_data.sub))) || "");
  return /^\d{15,25}$/.test(id) ? id : null;
}

async function walletAdd(uid, amount, kind, note, ref) {
  const rows = await db("rpc/wallet_add", { method: "POST", body: { p_user: uid, p_amount: amount, p_kind: kind, p_note: note, p_ref: ref } });
  return rows[0] || { status: "error" };
}

async function getBalance(uid) {
  const [w] = await db(`wallets?select=balance,total_topup&user_id=eq.${q(uid)}`);
  return { balance: w ? Number(w.balance) : 0, total_topup: w ? Number(w.total_topup) : 0 };
}

async function withUser(req, res, cors) {
  if (userLimited(clientIp(req))) {
    send(res, 429, { ok: false, error: "ลองบ่อยเกินไป รอสักครู่" }, cors);
    return null;
  }
  const u = await authUser(req);
  if (!u) send(res, 401, { ok: false, error: "กรุณาเข้าสู่ระบบใหม่อีกครั้ง" }, cors);
  return u;
}

async function handleMe(req, res, cors) {
  const u = await withUser(req, res, cors);
  if (!u) return;
  const did = discordIdOf(u);
  if (did) {
    await db(`keys?discord_id=eq.${q(did)}&user_id=is.null`, { method: "PATCH", body: { user_id: u.id }, prefer: "return=minimal" }).catch(() => null);
  }
  const [wallet, keys, tx, tiers] = await Promise.all([
    getBalance(u.id),
    db(`keys?select=*&user_id=eq.${q(u.id)}&order=created_at.desc&limit=100`),
    db(`wallet_tx?select=amount,balance_after,kind,note,created_at&user_id=eq.${q(u.id)}&order=created_at.desc&limit=30`),
    getTiers(true),
  ]);
  const tierName = (id) => (tiers.find((t) => t.id === id) || {}).name;
  send(
    res,
    200,
    {
      ok: true,
      user: { id: u.id, email: u.email, username: userName(u) },
      ...wallet,
      keys: keys.map((k) => keyView(k, tierName(k.tier))),
      tx: tx.map((t) => ({ ...t, amount: Number(t.amount), balance_after: Number(t.balance_after) })),
    },
    cors
  );
}

async function handleTopup(req, res, cors) {
  const u = await withUser(req, res, cors);
  if (!u) return;
  const ip = clientIp(req);
  if (redeemLimited(ip)) return send(res, 429, { ok: false, error: "ลองบ่อยเกินไป รอ 10 นาทีแล้วลองใหม่" }, cors);
  if (!TRUEMONEY_PHONE) return send(res, 503, { ok: false, error: "ระบบเติมเงินอัตโนมัติยังไม่เปิด ติดต่อแอดมินใน Discord" }, cors);
  const body = await readJson(req);
  const code = parseVoucher(body.voucher);
  if (!code) return send(res, 400, { ok: false, error: "ลิงก์ซองอั่งเปาไม่ถูกต้อง" }, cors);

  const claim = await claimVoucher(code, u.id, ip);
  if (!claim.ok) return send(res, 409, { ok: false, error: claim.error }, cors);
  const fail = async (error, status = 400, note = error) => {
    await db(`vouchers?hash=eq.${q(code)}`, { method: "PATCH", body: { status: "failed", error: note.slice(0, 300) } }).catch(() => {});
    return send(res, status, { ok: false, error }, cors);
  };

  let verify;
  try {
    verify = await truemoney(code, "verify");
  } catch (err) {
    console.error("truemoney verify:", err.message);
    return fail("ระบบอั่งเปาไม่ตอบสนอง ลองใหม่อีกครั้ง หรือติดต่อแอดมิน", 502, err.message);
  }
  if (verify.status !== "SUCCESS") return fail(VOUCHER_ERRORS[verify.status] || `ใช้ซองไม่ได้ (${verify.status})`, 400, verify.status);
  const v = verify.data.voucher || {};
  const amount = Number(v.amount_baht);
  if (Number(v.member) !== 1) return fail("ต้องสร้างซองแบบผู้รับ 1 คนเท่านั้น", 400, `member ${v.member}`);
  if (!(amount > 0)) return fail("ยอดในซองไม่ถูกต้อง", 400, `amount ${amount}`);

  let redeem;
  try {
    redeem = await truemoney(code, "redeem");
  } catch (err) {
    console.error("truemoney redeem:", err.message);
    return fail("รับซองไม่สำเร็จ ลองใหม่อีกครั้ง หรือติดต่อแอดมิน", 502, err.message);
  }
  if (redeem.status !== "SUCCESS") return fail(VOUCHER_ERRORS[redeem.status] || `รับซองไม่สำเร็จ (${redeem.status})`, 400, redeem.status);
  const got = Number((redeem.data.my_ticket && redeem.data.my_ticket.amount_baht) || (redeem.data.voucher && redeem.data.voucher.amount_baht) || amount);

  let w;
  try {
    w = await walletAdd(u.id, got, "topup", `TrueMoney อั่งเปา ${got} บาท`, code);
    if (w.status !== "ok") throw new Error(w.status);
    await db(`vouchers?hash=eq.${q(code)}`, { method: "PATCH", body: { status: "redeemed", amount: got, redeemed_at: new Date().toISOString() } });
  } catch (err) {
    console.error("wallet credit after redeem failed:", code, err.message);
    await db(`vouchers?hash=eq.${q(code)}`, { method: "PATCH", body: { status: "redeemed", amount: got, error: "credit_failed" } }).catch(() => {});
    postWebhook(SALES_WEBHOOK_URL, { content: `⚠️ รับเงิน ${got} บาทแล้วแต่เติมพอยต์ไม่สำเร็จ ซอง \`${code}\` ผู้ใช้ ${u.email}` });
    return send(res, 500, { ok: false, error: `รับเงินแล้วแต่เติมพอยต์ไม่สำเร็จ แจ้งแอดมินพร้อมรหัสซอง ${code}` }, cors);
  }

  postWebhook(SALES_WEBHOOK_URL, {
    username: "ZeroHub Shop",
    embeds: [
      {
        title: "เติมพอยต์ (TrueMoney)",
        color: 0xf5b82e,
        fields: [
          { name: "ผู้ใช้", value: `${userName(u)} (${u.email})` },
          { name: "ยอด", value: `${got} บาท`, inline: true },
          { name: "คงเหลือ", value: `${Number(w.balance)} พอยต์`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
  send(res, 200, { ok: true, amount: got, balance: Number(w.balance) }, cors);
}

const PROMO_TEXT = {
  invalid: "ไม่พบโค้ดนี้",
  inactive: "โค้ดนี้ปิดใช้งานแล้ว",
  expired: "โค้ดนี้หมดอายุแล้ว",
  used_up: "โค้ดนี้ถูกใช้ครบจำนวนแล้ว",
  already: "คุณใช้โค้ดนี้ไปแล้ว",
};
const normCode = (v) => String(v || "").trim().toUpperCase().replace(/\s+/g, "");
const validCode = (c) => /^[A-Z0-9_-]{3,32}$/.test(c);

async function handlePromoRedeem(req, res, cors) {
  const u = await withUser(req, res, cors);
  if (!u) return;
  if (webKeyLimited(clientIp(req))) return send(res, 429, { ok: false, error: "ลองบ่อยเกินไป รอสักครู่" }, cors);
  const body = await readJson(req);
  const code = normCode(body.code);
  if (!validCode(code)) return send(res, 400, { ok: false, error: PROMO_TEXT.invalid }, cors);
  const promoDiscord = discordIdOf(u);
  if (!promoDiscord) return send(res, 403, { ok: false, status: "discord", error: "โค้ดใช้ได้เฉพาะบัญชีที่ล็อกอินด้วย Discord" }, cors);
  if (DISCORD_BOT_TOKEN && DISCORD_GUILD_ID) {
    try {
      await discordApi(`/guilds/${DISCORD_GUILD_ID}/members/${promoDiscord}`, "GET");
    } catch (err) {
      if (/discord 404/.test(err.message)) return send(res, 403, { ok: false, status: "guild", error: "ต้องเข้าเซิร์ฟ Discord Zero Hub ก่อนถึงจะใช้โค้ดได้" }, cors);
      console.error("promo guild check failed:", err.message);
    }
  }
  let r;
  for (let i = 0; i < 3; i++) {
    try {
      [r] = await db("rpc/promo_redeem", { method: "POST", body: { p_code: code, p_user: u.id, p_key: newKey() } });
      break;
    } catch (err) {
      if (err.code !== "23505" || i === 2) throw err;
    }
  }
  if (!r || r.status !== "ok") return send(res, 400, { ok: false, status: r && r.status, error: PROMO_TEXT[r && r.status] || PROMO_TEXT.invalid }, cors);
  const who = `${userName(u)} (${u.email})`;
  if (r.kind === "points") {
    postWebhook(SALES_WEBHOOK_URL, {
      username: "ZeroHub Shop",
      embeds: [{ title: "🎁 ใช้โค้ดรับพอยต์", color: 0xff2a4b, fields: [{ name: "ผู้ใช้", value: who }, { name: "โค้ด", value: code, inline: true }, { name: "พอยต์", value: String(Number(r.points)), inline: true }], timestamp: new Date().toISOString() }],
    });
    return send(res, 200, { ok: true, kind: "points", points: Number(r.points), balance: Number(r.balance) }, cors);
  }
  let [k] = await db(`keys?select=*&id=eq.${r.key_id}`);
  const discordId = discordIdOf(u);
  if (discordId) {
    k = (await updateKey(k.key, { discord_id: discordId }).catch(() => null)) || k;
    grantBuyerRole(discordId).catch(() => {});
  }
  const tier = await getTier(k.tier);
  postWebhook(SALES_WEBHOOK_URL, {
    username: "ZeroHub Shop",
    embeds: [{ title: r.kind === "random" ? "🎲 สุ่มคีย์จากโค้ด" : "🎁 ใช้โค้ดรับคีย์ฟรี", color: 0xff2a4b, fields: [{ name: "ผู้ใช้", value: who }, { name: "โค้ด", value: code, inline: true }, { name: "แพ็กเกจ", value: tier ? tier.name : k.tier, inline: true }, { name: "คีย์", value: `||${k.key}||`, inline: true }], timestamp: new Date().toISOString() }],
  });
  return send(res, 200, { ok: true, kind: "key", random: r.kind === "random", key: keyView(k, tier && tier.name) }, cors);
}

async function handleBuy(req, res, cors) {
  const u = await withUser(req, res, cors);
  if (!u) return;
  const body = await readJson(req);
  const tierId = clean(body.tier, 20);
  let r;
  for (let i = 0; i < 3; i++) {
    try {
      [r] = await db("rpc/shop_buy", { method: "POST", body: { p_user: u.id, p_tier: tierId, p_key: newKey() } });
      break;
    } catch (err) {
      if (err.code !== "23505" || i === 2) throw err;
    }
  }
  if (!r || r.status === "tier") return send(res, 400, { ok: false, error: "แพ็กเกจนี้ปิดขายอยู่" }, cors);
  if (r.status === "funds") {
    return send(res, 400, { ok: false, status: "funds", error: "พอยต์ไม่พอ เติมเงินก่อนแล้วลองใหม่", balance: Number(r.balance) }, cors);
  }
  let [k] = await db(`keys?select=*&id=eq.${r.key_id}`);
  const discordId = discordIdOf(u);
  if (discordId) {
    k = (await updateKey(k.key, { discord_id: discordId }).catch(() => null)) || k;
    grantBuyerRole(discordId).catch(() => {});
  }
  const tier = await getTier(tierId);
  postWebhook(SALES_WEBHOOK_URL, {
    username: "ZeroHub Shop",
    embeds: [
      {
        title: "ขายคีย์ใหม่",
        color: 0x3ee08f,
        fields: [
          { name: "ผู้ใช้", value: `${userName(u)} (${u.email})` },
          { name: "แพ็กเกจ", value: `${tier ? tier.name : tierId} (${tier ? tier.price : "?"} พอยต์)`, inline: true },
          { name: "คีย์", value: `||${k.key}||`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
  send(res, 200, { ok: true, key: keyView(k, tier && tier.name), balance: Number(r.balance) }, cors);
}

async function handleClaim(req, res, cors) {
  const u = await withUser(req, res, cors);
  if (!u) return;
  const body = await readJson(req);
  const k = await getKey(normKey(body.key));
  if (!k) return send(res, 404, { ok: false, error: KEY_STATUS_TEXT.invalid }, cors);
  if (k.user_id && k.user_id !== u.id) return send(res, 409, { ok: false, error: "คีย์นี้อยู่ในบัญชีอื่นแล้ว" }, cors);
  if (!k.user_id) await updateKey(k.key, { user_id: u.id });
  send(res, 200, { ok: true }, cors);
}

async function handleUserReset(req, res, cors) {
  const u = await withUser(req, res, cors);
  if (!u) return;
  const body = await readJson(req);
  const k = await getKey(normKey(body.key));
  if (!k || k.user_id !== u.id) return send(res, 404, { ok: false, error: "ไม่พบคีย์นี้ในบัญชีของคุณ" }, cors);
  const r = await resetHwid(k.key);
  if (r.status !== "ok") {
    return send(res, 400, { ok: false, status: r.status, error: KEY_STATUS_TEXT[r.status] || r.status, next_reset_at: r.next_reset_at }, cors);
  }
  send(res, 200, { ok: true, next_reset_at: r.next_reset_at }, cors);
}

let statsCache = null;
async function getStats() {
  if (!statsCache || Date.now() - statsCache.at > 60 * 1000) {
    const [r] = await db("rpc/shop_stats", { method: "POST", body: {} });
    statsCache = {
      at: Date.now(),
      data: { members: Number(r.members), sold: Number(r.sold), active: Number(r.active), games: Object.keys(SCRIPT_FILES).length - 1 },
    };
  }
  return statsCache.data;
}

async function handleStats(req, res, cors) {
  send(res, 200, { ok: true, ...(await getStats()) }, cors);
}

const BKK_MS = 7 * 3600e3;
const DAY_MS = 86400e3;
const SALE_METHODS = { bank: "โอนธนาคาร", truemoney: "TrueMoney (โอนตรง)", other: "อื่น ๆ" };
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(`${s}T00:00:00+07:00`));
const bkkYmd = (d = new Date()) => new Date(new Date(d).getTime() + BKK_MS).toISOString().slice(0, 10);
const ymdStart = (ymd) => new Date(`${ymd}T00:00:00+07:00`);
const addDays = (ymd, n) => bkkYmd(ymdStart(ymd).getTime() + n * DAY_MS);
const money = (n) => Math.round(Number(n || 0) * 100) / 100;
const baht = (n) => money(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

function salesRange(period, month, from, to) {
  const today = bkkYmd();
  const m = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const first = `${m[1]}-${m[2]}-01`;
    const next = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1)).toISOString().slice(0, 10);
    return { from: first, to: addDays(next, -1), label: `เดือน ${m[2]}/${m[1]}` };
  }
  if (isYmd(from) || isYmd(to)) {
    let a = isYmd(from) ? from : to;
    let b = isYmd(to) ? to : from;
    if (a > b) [a, b] = [b, a];
    return { from: a, to: b, label: a === b ? `วันที่ ${a}` : `${a} ถึง ${b}` };
  }
  const monthStart = today.slice(0, 8) + "01";
  if (period === "yesterday") return { from: addDays(today, -1), to: addDays(today, -1), label: "เมื่อวาน" };
  if (period === "7d") return { from: addDays(today, -6), to: today, label: "7 วันล่าสุด" };
  if (period === "30d") return { from: addDays(today, -29), to: today, label: "30 วันล่าสุด" };
  if (period === "month") return { from: monthStart, to: today, label: "เดือนนี้" };
  if (period === "lastmonth") {
    const end = addDays(monthStart, -1);
    return { from: end.slice(0, 8) + "01", to: end, label: "เดือนที่แล้ว" };
  }
  if (period === "all") return { from: "2026-01-01", to: today, label: "ทั้งหมด" };
  return { from: today, to: today, label: "วันนี้" };
}

async function dbAll(path) {
  const out = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const rows = await db(`${path}&limit=1000&offset=${offset}`);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function salesReport(range) {
  const start = ymdStart(range.from).toISOString();
  const end = ymdStart(addDays(range.to, 1)).toISOString();
  const span = (col) => `and=${q(`(${col}.gte."${start}",${col}.lt."${end}")`)}`;
  const [topups, bills, keys] = await Promise.all([
    dbAll(`wallet_tx?select=amount,created_at&kind=eq.topup&${span("created_at")}&order=created_at.asc`),
    dbAll(`sales?select=*&${span("sold_at")}&order=sold_at.desc`),
    dbAll(`keys?select=tier,source,created_at&${span("created_at")}&order=created_at.asc`),
  ]);
  const days = new Map();
  const dayRow = (ymd) => {
    if (!days.has(ymd)) days.set(ymd, { day: ymd, truemoney: 0, truemoney_n: 0, manual: 0, manual_n: 0, total: 0 });
    return days.get(ymd);
  };
  for (let d = range.from; d <= range.to && days.size < 4000; d = addDays(d, 1)) dayRow(d);
  const r = { ...range, total: 0, truemoney: { sum: 0, n: 0 }, manual: { sum: 0, n: 0 }, methods: {}, keys: { shop: 0, admin: 0, discord: 0, promo: 0, total: 0, tiers: {} } };
  for (const t of topups) {
    const a = money(t.amount);
    const row = dayRow(bkkYmd(t.created_at));
    row.truemoney += a;
    row.truemoney_n++;
    r.truemoney.sum += a;
    r.truemoney.n++;
  }
  for (const b of bills) {
    const a = money(b.amount);
    const row = dayRow(bkkYmd(b.sold_at));
    row.manual += a;
    row.manual_n++;
    r.manual.sum += a;
    r.manual.n++;
    const m = (r.methods[b.method] = r.methods[b.method] || { sum: 0, n: 0 });
    m.sum += a;
    m.n++;
  }
  for (const k of keys) {
    r.keys[k.source] = (r.keys[k.source] || 0) + 1;
    r.keys.total++;
    if (k.source !== "promo") r.keys.tiers[k.tier] = (r.keys.tiers[k.tier] || 0) + 1;
  }
  r.days = [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1)).map((d) => ({ ...d, truemoney: money(d.truemoney), manual: money(d.manual), total: money(d.truemoney + d.manual) }));
  const months = new Map();
  for (const d of r.days) {
    const mk = d.day.slice(0, 7);
    const mo = months.get(mk) || { month: mk, truemoney: 0, manual: 0, total: 0, n: 0 };
    mo.truemoney = money(mo.truemoney + d.truemoney);
    mo.manual = money(mo.manual + d.manual);
    mo.total = money(mo.total + d.total);
    mo.n += d.truemoney_n + d.manual_n;
    months.set(mk, mo);
  }
  r.months = [...months.values()];
  r.truemoney.sum = money(r.truemoney.sum);
  r.manual.sum = money(r.manual.sum);
  for (const m of Object.values(r.methods)) m.sum = money(m.sum);
  r.total = money(r.truemoney.sum + r.manual.sum);
  const best = r.days.reduce((a, d) => (d.total > (a ? a.total : 0) ? d : a), null);
  r.best_day = best;
  r.bills = bills.slice(0, 300);
  return r;
}

async function addSale(fields) {
  const amount = money(fields.amount);
  if (!(amount > 0 && amount <= 1000000)) throw Object.assign(new Error("ยอดเงินไม่ถูกต้อง"), { user: true });
  const row = {
    amount,
    method: SALE_METHODS[fields.method] ? fields.method : "bank",
    buyer: clean(fields.buyer, 100),
    discord_id: clean(fields.discord_id, 25).replace(/\D/g, "") || null,
    note: clean(fields.note, 200),
    created_by: clean(fields.created_by, 60),
  };
  if (fields.date) {
    if (!isYmd(fields.date)) throw Object.assign(new Error("วันที่ต้องเป็นแบบ ปปปป-ดด-วว เช่น 2026-11-09"), { user: true });
    if (fields.date > bkkYmd()) throw Object.assign(new Error("ลงบิลวันในอนาคตไม่ได้"), { user: true });
    row.sold_at = fields.date === bkkYmd() ? new Date().toISOString() : new Date(ymdStart(fields.date).getTime() + 12 * 3600e3).toISOString();
  }
  const [made] = await db("sales", { method: "POST", body: row, prefer: "return=representation" });
  return made;
}

function salesText(r, { daily = true } = {}) {
  const lines = [`📊 **ยอดขาย ${r.label}**  (${r.from === r.to ? r.from : `${r.from} → ${r.to}`})`, `💰 รวม **${baht(r.total)} บาท**`];
  lines.push(`• TrueMoney อั่งเปา (เว็บ): ${baht(r.truemoney.sum)} บาท (${r.truemoney.n} ครั้ง)`);
  for (const [k, label] of Object.entries(SALE_METHODS)) {
    const m = r.methods[k];
    if (m) lines.push(`• ${label} (ลงบิล): ${baht(m.sum)} บาท (${m.n} บิล)`);
  }
  if (!r.manual.n) lines.push("• ลงบิลโอนเอง: 0 บาท");
  const k = r.keys;
  lines.push(`🔑 คีย์ออก ${k.total} คีย์ · ซื้อบนเว็บ ${k.shop || 0} · แอดมิน ${k.admin || 0} · บอท ${k.discord || 0} · โค้ดฟรี ${k.promo || 0}`);
  if (r.days.length > 1 && r.best_day && r.best_day.total > 0) lines.push(`🏆 วันที่ขายดีสุด ${r.best_day.day} · ${baht(r.best_day.total)} บาท`);
  if (daily && r.days.length > 1) {
    const many = r.days.length > 31;
    lines.push("", many ? "**รายเดือน**" : "**รายวัน**");
    const rows = many
      ? r.months.map((m) => `\`${m.month}\` ${baht(m.total)} บาท`)
      : r.days.filter((d) => d.total > 0 || r.days.length <= 7).map((d) => `\`${d.day.slice(8)}/${d.day.slice(5, 7)}\` ${baht(d.total)} บาท${d.manual ? ` (บิล ${baht(d.manual)})` : ""}`);
    lines.push(...(rows.length ? rows : ["ยังไม่มียอด"]));
  }
  let out = lines.join("\n");
  if (out.length > 1950) out = out.slice(0, 1940) + "\n…";
  return out;
}

async function dailySummaryTick() {
  if (!SALES_WEBHOOK_URL) return;
  const nowBkk = new Date(Date.now() + BKK_MS);
  if (nowBkk.getUTCHours() !== 0) return;
  const day = addDays(bkkYmd(), -1);
  const [meta] = await db("shop_meta?select=v&k=eq.daily_summary");
  if (meta && meta.v >= day) return;
  await db("shop_meta", { method: "POST", body: { k: "daily_summary", v: day }, prefer: "resolution=merge-duplicates" });
  const [d, mtd] = await Promise.all([salesReport({ from: day, to: day, label: `วันที่ ${day}` }), salesReport({ from: day.slice(0, 8) + "01", to: day, label: `เดือน ${day.slice(5, 7)}/${day.slice(0, 4)} ถึงวันที่ ${day.slice(8)}` })]);
  await postWebhook(SALES_WEBHOOK_URL, {
    username: "ZeroHub Shop",
    embeds: [
      { title: "🌙 สรุปยอดประจำวัน", color: 0xff2a4b, description: salesText(d, { daily: false }) },
      { color: 0xf5b82e, description: salesText(mtd, { daily: false }) },
    ],
  });
}

function isAdmin(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  return !!ADMIN_TOKEN && ADMIN_TOKEN.length >= 16 && safeEqual(token, ADMIN_TOKEN);
}

async function handleAdmin(req, res, cors, path, url) {
  const ip = clientIp(req);
  if (!isAdmin(req)) {
    if (adminFailLimited(ip)) return send(res, 429, { ok: false, error: "ลองบ่อยเกินไป" }, cors);
    return send(res, 401, { ok: false, error: "รหัสแอดมินไม่ถูกต้อง" }, cors);
  }
  if (req.method === "GET" && path === "/api/admin/keys") {
    const term = clean(url.searchParams.get("q"), 60);
    const filter = url.searchParams.get("filter") || "all";
    const { size, page } = pageArgs(url);
    const conds = [];
    const t = term.replace(/[^0-9A-Za-z\-]/g, "");
    if (t) conds.push(`or(key.ilike.*${t}*,discord_id.eq.${t},note.ilike.*${t}*)`);
    const now = `"${new Date().toISOString()}"`;
    if (filter === "active") conds.push("revoked.is.false", `or(expires_at.is.null,expires_at.gt.${now})`);
    if (filter === "expired") conds.push(`expires_at.lt.${now}`);
    if (filter === "revoked") conds.push("revoked.is.true");
    if (filter === "unused") conds.push("activated_at.is.null");
    let qs = `keys?select=*&order=created_at.desc,id.desc`;
    if (conds.length) qs += `&and=${q(`(${conds.join(",")})`)}`;
    const [{ rows: keys, total }, tiers] = await Promise.all([dbPage(qs, size, page), getTiers(true)]);
    return send(res, 200, { ok: true, keys, tiers, total, page, size }, cors);
  }
  if (req.method === "GET" && path === "/api/admin/promos") {
    const [promos, prizes] = await Promise.all([
      db("promo_codes?select=*&order=created_at.desc&limit=200"),
      db("promo_prizes?select=*&limit=2000"),
    ]);
    for (const pr of promos) pr.prizes = prizes.filter((z) => z.code === pr.code);
    return send(res, 200, { ok: true, promos }, cors);
  }
  if (req.method === "GET" && path === "/api/admin/tiers") {
    return send(res, 200, { ok: true, tiers: await getTiers(true) }, cors);
  }
  if (req.method === "GET" && path === "/api/admin/diag") {
    const t0 = Date.now();
    try {
      const r = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }, signal: AbortSignal.timeout(10000) });
      const text = (await r.text()).slice(0, 300);
      return send(res, 200, { ok: true, status: r.status, ms: Date.now() - t0, retry_after: r.headers.get("retry-after"), global: r.headers.get("x-ratelimit-global"), scope: r.headers.get("x-ratelimit-scope"), cf: r.headers.get("cf-ray"), body: r.status === 200 ? "ok" : text }, cors);
    } catch (err) {
      return send(res, 200, { ok: false, ms: Date.now() - t0, error: err.message }, cors);
    }
  }
  if (req.method === "GET" && path === "/api/admin/sales") {
    const p = url.searchParams;
    const range = salesRange(p.get("period"), p.get("month"), p.get("from"), p.get("to"));
    return send(res, 200, { ok: true, report: await salesReport(range), methods: SALE_METHODS }, cors);
  }
  if (req.method !== "POST") return send(res, 404, { ok: false, error: "not found" }, cors);
  const body = await readJson(req);
  if (path === "/api/admin/keys") {
    const tier = await getTier(clean(body.tier, 20));
    if (!tier) return send(res, 400, { ok: false, error: "ไม่พบแพ็กเกจ" }, cors);
    const count = Math.min(50, Math.max(1, Number(body.count) || 1));
    const discordId = clean(body.discord_id, 25).replace(/\D/g, "") || null;
    const keys = await createKeys(tier, count, { source: "admin", note: clean(body.note, 200), discord_id: discordId });
    if (discordId) grantBuyerRole(discordId).catch(() => {});
    return send(res, 200, { ok: true, keys }, cors);
  }
  if (path === "/api/admin/sales") {
    try {
      const sale = await addSale({ ...body, created_by: "เว็บแอดมิน" });
      return send(res, 200, { ok: true, sale }, cors);
    } catch (err) {
      if (err.user) return send(res, 400, { ok: false, error: err.message }, cors);
      throw err;
    }
  }
  if (path === "/api/admin/sales/delete") {
    const id = Math.floor(Number(body.id));
    if (!(id > 0)) return send(res, 400, { ok: false, error: "ไม่พบบิล" }, cors);
    const rows = await db(`sales?id=eq.${id}`, { method: "DELETE", prefer: "return=representation" });
    return send(res, rows.length ? 200 : 404, { ok: !!rows.length, error: rows.length ? undefined : "ไม่พบบิล" }, cors);
  }
  if (path === "/api/admin/users") {
    const size = [20, 50, 100].includes(Number(body.size)) ? Number(body.size) : 20;
    const page = Math.min(100000, Math.max(1, Math.floor(Number(body.page)) || 1));
    const p_q = clean(body.q, 80);
    try {
      const rows = await db("rpc/shop_find_users_page", { method: "POST", body: { p_q, p_limit: size, p_offset: (page - 1) * size } });
      const total = rows.length ? Number(rows[0].total) : (page - 1) * size;
      return send(res, 200, { ok: true, users: rows, total, page, size }, cors);
    } catch (err) {
      if (err.code !== "PGRST202" && err.status !== 404) throw err;
      const all = await db("rpc/shop_find_users", { method: "POST", body: { p_q } });
      return send(res, 200, { ok: true, users: all.slice((page - 1) * size, page * size), total: all.length, page, size }, cors);
    }
  }
  if (path === "/api/admin/wallet") {
    const uid = clean(body.user_id, 40);
    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!/^[0-9a-f-]{36}$/i.test(uid)) return send(res, 400, { ok: false, error: "ไม่พบผู้ใช้" }, cors);
    if (!amount || Math.abs(amount) > 100000) return send(res, 400, { ok: false, error: "จำนวนพอยต์ไม่ถูกต้อง" }, cors);
    const r = await walletAdd(uid, amount, "admin", clean(body.note, 200) || "แอดมินปรับพอยต์", "");
    if (r.status === "funds") return send(res, 400, { ok: false, error: "พอยต์คงเหลือไม่พอให้หัก" }, cors);
    return send(res, 200, { ok: true, balance: Number(r.balance) }, cors);
  }
  if (path === "/api/admin/tiers") {
    const id = clean(body.id, 20);
    const patch = {};
    if (body.price !== undefined) patch.price = Math.max(0, Math.round(Number(body.price) || 0));
    if (body.is_active !== undefined) patch.is_active = !!body.is_active;
    if (body.name !== undefined) patch.name = clean(body.name, 40);
    const rows = await db(`key_tiers?id=eq.${q(id)}`, { method: "PATCH", body: patch, prefer: "return=representation" });
    return send(res, rows.length ? 200 : 404, { ok: !!rows.length, tier: rows[0] }, cors);
  }
  if (path === "/api/admin/promos") {
    let code = normCode(body.code);
    if (!code) code = "ZH" + crypto.randomBytes(4).toString("hex").toUpperCase();
    if (!validCode(code)) return send(res, 400, { ok: false, error: "โค้ดใช้ได้เฉพาะ A-Z 0-9 - _ ยาว 3-32 ตัว" }, cors);
    const kind = ["key", "random"].includes(body.kind) ? body.kind : "points";
    const row = { code, kind, max_uses: Math.min(100000, Math.max(1, Math.floor(Number(body.max_uses) || 1))), note: clean(body.note, 200) };
    let prizes = [];
    if (kind === "random") {
      const all = await getTiers(true);
      for (const z of Array.isArray(body.prizes) ? body.prizes : []) {
        const tier = all.find((t) => t.id === z.tier);
        const qty = Math.floor(Number(z.qty));
        const weight = Math.round(Number(z.weight) * 1000) / 1000;
        if (tier && weight > 0) prizes.push({ code, tier: tier.id, qty: qty > 0 ? Math.min(qty, 100000) : null, weight: Math.min(weight, 100000) });
      }
      if (!prizes.length) return send(res, 400, { ok: false, error: "ใส่โอกาส % มากกว่า 0 อย่างน้อย 1 แพ็ก" }, cors);
      row.max_uses = prizes.some((z) => z.qty === null) ? 1000000 : prizes.reduce((a, z) => a + z.qty, 0);
    } else if (kind === "points") {
      const pts = Math.round(Number(body.points) * 100) / 100;
      if (!(pts > 0 && pts <= 100000)) return send(res, 400, { ok: false, error: "จำนวนพอยต์ไม่ถูกต้อง" }, cors);
      row.points = pts;
    } else {
      const tier = await getTier(clean(body.tier, 20));
      if (!tier) return send(res, 400, { ok: false, error: "ไม่พบแพ็กเกจ" }, cors);
      row.tier = tier.id;
    }
    const until = body.expires_at ? new Date(body.expires_at) : null;
    const days = Number(body.expires_days);
    if (until && !isNaN(until)) {
      if (until.getTime() <= Date.now()) return send(res, 400, { ok: false, error: "เวลาหมดอายุต้องอยู่ในอนาคต" }, cors);
      row.expires_at = until.toISOString();
    } else if (days > 0) row.expires_at = new Date(Date.now() + Math.min(days, 3650) * 86400000).toISOString();
    try {
      const [made] = await db("promo_codes", { method: "POST", body: row, prefer: "return=representation" });
      if (prizes.length) {
        try {
          made.prizes = await db("promo_prizes", { method: "POST", body: prizes, prefer: "return=representation" });
        } catch (err) {
          await db(`promo_codes?code=eq.${q(code)}`, { method: "DELETE" }).catch(() => {});
          throw err;
        }
      }
      return send(res, 200, { ok: true, promo: made }, cors);
    } catch (err) {
      if (err.code === "23505" || err.status === 409) return send(res, 409, { ok: false, error: "โค้ดนี้มีอยู่แล้ว" }, cors);
      throw err;
    }
  }
  if (path === "/api/admin/promos/toggle") {
    const rows = await db(`promo_codes?code=eq.${q(normCode(body.code))}`, { method: "PATCH", body: { active: !!body.active }, prefer: "return=representation" });
    return send(res, rows.length ? 200 : 404, { ok: !!rows.length, promo: rows[0] }, cors);
  }
  if (path === "/api/admin/promos/delete") {
    await db(`promo_codes?code=eq.${q(normCode(body.code))}`, { method: "DELETE" });
    return send(res, 200, { ok: true }, cors);
  }
  const key = normKey(body.key);
  const k = await getKey(key);
  if (!k) return send(res, 404, { ok: false, error: "ไม่พบคีย์" }, cors);
  if (path === "/api/admin/keys/revoke") {
    const updated = await updateKey(key, { revoked: body.revoked !== false });
    if (k.discord_id) await syncBuyerRole(k.discord_id).catch(() => null);
    return send(res, 200, { ok: true, key: updated }, cors);
  }
  if (path === "/api/admin/keys/extend") {
    const hours = Number(body.hours);
    if (!(hours > 0 && hours <= 24 * 3650)) return send(res, 400, { ok: false, error: "จำนวนชั่วโมงไม่ถูกต้อง" }, cors);
    return send(res, 200, { ok: true, key: await extendKey(k, hours) }, cors);
  }
  if (path === "/api/admin/keys/resethwid") {
    await resetHwid(key, true);
    return send(res, 200, { ok: true, key: await getKey(key) }, cors);
  }
  if (path === "/api/admin/keys/link") {
    const discordId = clean(body.discord_id, 25).replace(/\D/g, "") || null;
    const updated = await updateKey(key, { discord_id: discordId });
    if (discordId) grantBuyerRole(discordId).catch(() => {});
    return send(res, 200, { ok: true, key: updated }, cors);
  }
  if (path === "/api/admin/keys/note") return send(res, 200, { ok: true, key: await updateKey(key, { note: clean(body.note, 200) }) }, cors);
  if (path === "/api/admin/keys/delete") {
    await db(`keys?key=eq.${q(key)}`, { method: "DELETE" });
    const role = k.discord_id ? await syncBuyerRole(k.discord_id).catch(() => null) : null;
    return send(res, 200, { ok: true, role }, cors);
  }
  send(res, 404, { ok: false, error: "not found" }, cors);
}

let discordKeyObject = null;
function verifyDiscord(req, raw) {
  if (!DISCORD_PUBLIC_KEY) return false;
  const sig = req.headers["x-signature-ed25519"];
  const ts = req.headers["x-signature-timestamp"];
  if (typeof sig !== "string" || typeof ts !== "string" || !/^[0-9a-f]{128}$/i.test(sig)) return false;
  try {
    if (!discordKeyObject) {
      discordKeyObject = crypto.createPublicKey({
        key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(DISCORD_PUBLIC_KEY, "hex")]),
        format: "der",
        type: "spki",
      });
    }
    return crypto.verify(null, Buffer.from(ts + raw), discordKeyObject, Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

async function discordApi(path, method, body) {
  const r = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      "X-Audit-Log-Reason": "ZeroHub key",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`discord ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function hasBuyerRole(userId) {
  try {
    const m = await discordApi(`/guilds/${DISCORD_GUILD_ID}/members/${userId}`, "GET");
    return (m.roles || []).includes(DISCORD_BUYER_ROLE_ID);
  } catch (err) {
    if (/discord 404/.test(err.message)) return false;
    throw err;
  }
}

async function removeBuyerRole(id) {
  if (!(await hasBuyerRole(id))) return false;
  await discordApi(`/guilds/${DISCORD_GUILD_ID}/members/${id}/roles/${DISCORD_BUYER_ROLE_ID}`, "DELETE");
  postWebhook(SALES_WEBHOOK_URL, { username: "ZeroHub Shop", content: `🔻 ถอดยศ Buyer จาก <@${id}> แล้ว (ไม่มีคีย์ที่ใช้งานได้เหลือ)` });
  return true;
}

async function grantBuyerRole(userId) {
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !DISCORD_BUYER_ROLE_ID) return false;
  try {
    await discordApi(`/guilds/${DISCORD_GUILD_ID}/members/${userId}/roles/${DISCORD_BUYER_ROLE_ID}`, "PUT");
    return true;
  } catch (err) {
    console.error("grant role failed:", err.message);
    return false;
  }
}

async function syncBuyerRole(discordId) {
  const id = String(discordId || "");
  if (!/^\d{15,25}$/.test(id) || !DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !DISCORD_BUYER_ROLE_ID) return null;
  const rows = await db(`keys?select=revoked,expires_at&discord_id=eq.${q(id)}`);
  const now = Date.now();
  const hasValid = rows.some((k) => !k.revoked && (!k.expires_at || new Date(k.expires_at).getTime() > now));
  if (hasValid) return (await grantBuyerRole(id)) ? "kept" : null;
  try {
    return (await removeBuyerRole(id)) ? "removed" : "none";
  } catch (err) {
    if (!/discord 404/.test(err.message)) console.error("sync buyer role failed:", id, err.message);
    return null;
  }
}

async function sweepBuyerRoles() {
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !DISCORD_BUYER_ROLE_ID || !SUPABASE_URL) return;
  let rows;
  try {
    rows = await db("keys?select=discord_id,revoked,expires_at&discord_id=not.is.null&limit=10000");
  } catch (err) {
    return console.error("buyer sweep: read keys failed:", err.message);
  }
  const now = Date.now();
  const valid = new Set();
  const seen = new Set();
  for (const k of rows) {
    const id = String(k.discord_id);
    seen.add(id);
    if (!k.revoked && (!k.expires_at || new Date(k.expires_at).getTime() > now)) valid.add(id);
  }
  for (const id of seen) {
    if (valid.has(id) || !/^\d{15,25}$/.test(id)) continue;
    try {
      if (await removeBuyerRole(id)) console.log("buyer sweep: removed role from", id);
    } catch (err) {
      console.error("buyer sweep: remove failed:", id, err.message);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
}

function discordIsAdmin(member) {
  if (!member) return false;
  const uid = member.user && member.user.id;
  if (uid && DISCORD_ADMIN_IDS.includes(uid)) return true;
  if ((member.roles || []).some((r) => DISCORD_ADMIN_ROLE_IDS.includes(r))) return true;
  try {
    return (BigInt(member.permissions || "0") & 8n) === 8n;
  } catch {
    return false;
  }
}

function optionsOf(data) {
  const out = {};
  for (const o of (data && data.options) || []) out[o.name] = o.value;
  return out;
}

function keyLine(k, L) {
  const state = k.revoked ? T(L, "⛔ ระงับ", "⛔ Revoked") : k.expires_at && new Date(k.expires_at) <= new Date() ? T(L, "⌛ หมดอายุ", "⌛ Expired") : "✅";
  const who = k.discord_id ? ` <@${k.discord_id}>` : "";
  return `${state} \`${k.key}\` · ${k.tier} · ${formatLeft(k, L)} · HWID ${k.hwid ? T(L, "ผูกแล้ว", "locked") : T(L, "ว่าง", "free")}${who}`;
}

const langOf = (body) => (String((body && body.locale) || "").toLowerCase().startsWith("th") ? "th" : "en");

async function runCommand(name, opts, member, user, L = "th") {
  const uid = (member && member.user && member.user.id) || (user && user.id);
  const admin = discordIsAdmin(member);
  const adminOnly = ["genkey", "keys", "revokekey", "extendkey", "deletekey", "sales", "addsale", "delsale", "bills"];
  if (adminOnly.includes(name) && !admin) return { content: T(L, "คำสั่งนี้สำหรับแอดมินเท่านั้น", "This command is for admins only") };

  if (name === "sales") {
    const range = salesRange(opts.period, opts.month, opts.from, opts.to);
    return { content: salesText(await salesReport(range)) };
  }
  if (name === "addsale") {
    let sale;
    try {
      sale = await addSale({ amount: opts.amount, method: opts.method, discord_id: opts.user || "", buyer: opts.name || "", note: opts.note || "", date: opts.date || "", created_by: `discord:${uid}` });
    } catch (err) {
      if (err.user) return { content: err.message };
      throw err;
    }
    const today = await salesReport(salesRange("today"));
    const who = sale.discord_id ? ` จาก <@${sale.discord_id}>` : sale.buyer ? ` จาก ${sale.buyer}` : "";
    return { content: `✅ ลงบิล #${sale.id} แล้ว: **${baht(sale.amount)} บาท** (${SALE_METHODS[sale.method]})${who}\nวันที่ ${bkkYmd(sale.sold_at)}${sale.note ? ` · ${sale.note}` : ""}\n\nยอดรวมวันนี้ตอนนี้ ${baht(today.total)} บาท\nลงผิด? ใช้ /delsale id:${sale.id}` };
  }
  if (name === "delsale") {
    const id = Math.floor(Number(opts.id));
    const rows = id > 0 ? await db(`sales?id=eq.${id}`, { method: "DELETE", prefer: "return=representation" }) : [];
    if (!rows.length) return { content: `ไม่พบบิล #${opts.id}` };
    return { content: `🗑️ ลบบิล #${id} (${baht(rows[0].amount)} บาท) แล้ว` };
  }
  if (name === "bills") {
    const range = salesRange(opts.period || "7d", opts.month);
    const r = await salesReport(range);
    if (!r.bills.length) return { content: `ไม่มีบิลที่ลงเองใน${r.label}` };
    const rows = r.bills.slice(0, 25).map((b) => `#${b.id} · ${bkkYmd(b.sold_at)} · **${baht(b.amount)}** · ${SALE_METHODS[b.method] || b.method}${b.discord_id ? ` · <@${b.discord_id}>` : b.buyer ? ` · ${b.buyer}` : ""}${b.note ? ` · ${b.note}` : ""}`);
    return { content: `🧾 บิลที่ลงเอง ${r.label} (${r.bills.length} บิล รวม ${baht(r.manual.sum)} บาท)\n${rows.join("\n")}`.slice(0, 1950) };
  }

  if (name === "genkey") {
    const tier = await getTier(opts.tier);
    if (!tier) return { content: "ไม่พบแพ็กเกจนี้ หรือแพ็กเกจถูกปิดอยู่" };
    const count = Math.min(20, Math.max(1, Number(opts.count) || 1));
    const target = opts.user || null;
    const keys = await createKeys(tier, count, { source: "discord", note: clean(opts.note || "", 200) || `gen by ${uid}`, discord_id: target });
    let roleText = "";
    if (target) roleText = (await grantBuyerRole(target)) ? `\nให้ยศ Buyer กับ <@${target}> แล้ว` : `\nให้ยศ Buyer กับ <@${target}> ไม่สำเร็จ`;
    return { content: `สร้างคีย์ ${tier.name} ${count} คีย์${target ? ` ให้ <@${target}>` : ""}\n${keys.map((k) => `\`${k.key}\``).join("\n")}${roleText}` };
  }
  if (name === "keys") {
    let qs = "keys?select=*&order=created_at.desc&limit=15";
    if (opts.user) qs += `&discord_id=eq.${q(opts.user)}`;
    if (opts.key) qs += `&key=ilike.*${q(normKey(opts.key).replace(/[^0-9A-Z\-]/g, ""))}*`;
    const keys = await db(qs);
    if (!keys.length) return { content: "ไม่พบคีย์" };
    return { content: keys.map(keyLine).join("\n").slice(0, 1900) };
  }
  if (name === "revokekey") {
    const k = await getKey(normKey(opts.key));
    if (!k) return { content: "ไม่พบคีย์" };
    const revoked = opts.undo !== true;
    await updateKey(k.key, { revoked });
    const role = k.discord_id ? await syncBuyerRole(k.discord_id).catch(() => null) : null;
    const roleText = role === "removed" ? `\nถอดยศ Buyer จาก <@${k.discord_id}> แล้ว` : role === "kept" && !revoked ? `\nให้ยศ Buyer กับ <@${k.discord_id}> แล้ว` : "";
    return { content: `${revoked ? "ระงับ" : "ยกเลิกการระงับ"}คีย์ \`${k.key}\` แล้ว${roleText}` };
  }
  if (name === "deletekey") {
    const k = await getKey(normKey(opts.key));
    if (!k) return { content: "ไม่พบคีย์" };
    await db(`keys?key=eq.${q(k.key)}`, { method: "DELETE" });
    const role = k.discord_id ? await syncBuyerRole(k.discord_id).catch(() => null) : null;
    const roleText = role === "removed" ? `\nถอดยศ Buyer จาก <@${k.discord_id}> แล้ว` : role === "kept" ? `\n<@${k.discord_id}> ยังมีคีย์อื่นที่ใช้ได้ ยศ Buyer ยังอยู่` : "";
    return { content: `ลบคีย์ \`${k.key}\` ถาวรแล้ว${roleText}` };
  }
  if (name === "extendkey") {
    const k = await getKey(normKey(opts.key));
    if (!k) return { content: "ไม่พบคีย์" };
    const days = Number(opts.days);
    if (!(days > 0 && days <= 3650)) return { content: "จำนวนวันไม่ถูกต้อง" };
    if (k.hours === null) return { content: "คีย์นี้เป็นแบบถาวรอยู่แล้ว" };
    const updated = await extendKey(k, days * 24);
    return { content: `ต่อเวลาคีย์ \`${k.key}\` แล้ว: ${formatLeft(updated)}` };
  }
  if (name === "redeem") {
    const k = await getKey(normKey(opts.key));
    if (!k || k.revoked) return { content: statusText(L, k ? "revoked" : "invalid") };
    if (k.discord_id && k.discord_id !== uid) return { content: T(L, "คีย์นี้ผูกกับบัญชี Discord อื่นแล้ว", "This key is already linked to another Discord account") };
    if (!k.discord_id) await updateKey(k.key, { discord_id: uid });
    const ok = await grantBuyerRole(uid);
    return {
      content: T(
        L,
        `ผูกคีย์กับบัญชีของคุณแล้ว (${formatLeft(k)})${ok ? "\nได้รับยศ Buyer แล้ว" : "\nให้ยศไม่สำเร็จ แจ้งแอดมิน"}`,
        `Key linked to your account (${formatLeft(k, L)})${ok ? "\nYou got the Buyer role" : "\nCouldn't give the role, please tell an admin"}`
      ),
    };
  }
  if (name === "mykey") {
    const keys = await db(`keys?select=*&discord_id=eq.${q(uid)}&order=created_at.desc&limit=10`);
    if (!keys.length) return { content: T(L, `คุณยังไม่มีคีย์ที่ผูกกับบัญชี ซื้อได้ที่ ${SHOP_URL} แล้วใช้ /redeem`, `You have no key linked yet. Buy one at ${SHOP_URL} then use /redeem`) };
    return { content: keys.map((k) => keyLine(k, L)).join("\n") };
  }
  if (name === "resethwid") {
    let k;
    if (opts.key) {
      k = await getKey(normKey(opts.key));
      if (k && k.discord_id && k.discord_id !== uid && !admin) return { content: T(L, "คีย์นี้ผูกกับบัญชี Discord อื่น", "This key belongs to another Discord account") };
    } else {
      const keys = await db(`keys?select=*&discord_id=eq.${q(uid)}&revoked=eq.false&hwid=not.is.null&order=created_at.desc`);
      if (keys.length > 1) return { content: T(L, "คุณมีหลายคีย์ ระบุคีย์ด้วย /resethwid key:", "You have several keys. Enter the key you want to reset") };
      k = keys[0];
    }
    if (!k) return { content: T(L, "ไม่พบคีย์ที่ต้องรีเซ็ต", "No key to reset") };
    const r = await resetHwid(k.key, admin && !!opts.key && k.discord_id !== uid);
    if (r.status === "cooldown") {
      const ts = Math.floor(new Date(r.next_reset_at).getTime() / 1000);
      return { content: T(L, `รีเซ็ต HWID ได้วันละครั้ง ครั้งถัดไป <t:${ts}:R>`, `HWID can be reset once a day. Next reset <t:${ts}:R>`) };
    }
    if (r.status !== "ok") return { content: statusText(L, r.status) };
    return { content: T(L, `รีเซ็ต HWID คีย์ \`${k.key}\` แล้ว รันสคริปต์บนเครื่องใหม่ได้เลย`, `HWID reset for \`${k.key}\`. Run the script on your new device.`) };
  }
  return { content: T(L, "ไม่รู้จักคำสั่งนี้", "Unknown command") };
}

async function finishInteraction(token, payload) {
  const r = await fetch(`${DISCORD_API}/webhooks/${DISCORD_APP_ID}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...payload }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) console.error("interaction followup failed:", r.status, await r.text());
}

async function handleInteraction(req, res) {
  let raw;
  try {
    raw = await readRaw(req, 64 * 1024);
  } catch {
    return send(res, 400, { error: "bad body" });
  }
  if (!verifyDiscord(req, raw)) return sendText(res, 401, "invalid request signature");
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return send(res, 400, { error: "bad json" });
  }
  if (body.type === 1) return send(res, 200, { type: 1 });
  if (body.type === 3) return handlePanelButton(res, body);
  if (body.type === 5) return handlePanelModal(res, body);
  if (body.type !== 2) return send(res, 400, { error: "unsupported" });
  const name = body.data && body.data.name;
  if (name === "panel") return handlePanelCommand(res, body);
  await deferred(res, body, () => runCommand(name, optionsOf(body.data), body.member, body.user, langOf(body)), name);
}

async function deferred(res, body, work, label) {
  send(res, 200, { type: 5, data: { flags: 64 } });
  try {
    await finishInteraction(body.token, await work());
  } catch (err) {
    console.error("interaction failed:", label, err.message);
    await finishInteraction(body.token, { content: T(langOf(body), "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง", "Something went wrong, please try again") }).catch(() => {});
  }
}

const PUBLIC_URL = env("PUBLIC_URL", "https://zerohub-contact.onrender.com").replace(/\/+$/, "");
const DISCORD_INVITE = env("DISCORD_INVITE", "https://discord.gg/CYxyhhBNba");
const LOADSTRING = `loadstring(game:HttpGet("${PUBLIC_URL}/api/script/ZeroHub"))()`;
const PANEL_COLOR = 0xff2a4b;
const PANEL_GAMES = [
  ["🥚", "Break and Steal an Egg"],
  ["⚡", "Anime Zero"],
  ["🏰", "All Star Tower Defense"],
  ["☣️", "Survive the Apocalypse"],
  ["👁️", "Anime Eyes"],
  ["⚔️", "Attack on Titan Revolution"],
];

function btn(label, emoji, style, id) {
  const b = { type: 2, style, label, emoji: { name: emoji } };
  if (style === 5) b.url = id;
  else b.custom_id = id;
  return b;
}

const TIER_ICONS = { "24h": "⚡", "3d": "🔥", "7d": "👑", lifetime: "♾️" };
const TIER_EN = { "24h": "1 Day", "3d": "3 Days", "7d": "7 Days", lifetime: "Lifetime" };
const tierName = (t, L) => (L === "en" ? TIER_EN[t.id] || t.name : t.name);
const text = (content) => ({ type: 10, content });
const line = (big) => ({ type: 14, divider: true, spacing: big ? 2 : 1 });
const row = (...components) => ({ type: 1, components });

async function priceLines(L) {
  try {
    return (await getTiers()).map((t) => `${TIER_ICONS[t.id] || "🔑"} **${tierName(t, L)}** — \`${t.price} ${T(L, "บาท", "THB")}\``).join("\n");
  } catch {
    return T(L, `ดูราคาได้ที่ ${SHOP_URL}`, `See prices at ${SHOP_URL}`);
  }
}

async function panelMessage() {
  let tiers = [];
  try {
    tiers = await getTiers();
  } catch {}
  const priceText = tiers.length
    ? tiers.map((t) => `${TIER_ICONS[t.id] || "🔑"} ${t.name} **\`${t.price}฿\`**`).join("  ·  ")
    : `ดูราคาได้ที่ ${SHOP_URL}`;
  const priceTextEn = tiers.length ? tiers.map((t) => `${TIER_EN[t.id] || t.name} ${t.price}฿`).join(" · ") : "";
  return {
    flags: 1 << 15,
    components: [
      {
        type: 17,
        accent_color: PANEL_COLOR,
        components: [
          {
            type: 9,
            components: [
              text("# ZERO HUB"),
              text("**Script & Tools** — คีย์เดียว เล่นได้ทุกเกม · One key, every game\n-# ได้คีย์ทันที 24 ชม. · Instant delivery 24/7"),
            ],
            accessory: { type: 11, media: { url: `${PUBLIC_URL}/assets/panel-logo.png?v=2` } },
          },
          line(true),
          text(`**💳 แพ็กเกจคีย์ · Key Plans**\n${priceText}${priceTextEn ? `\n-# 🇬🇧 ${priceTextEn}` : ""}\n-# ⏱️ เวลาเริ่มนับตอนใส่คีย์ครั้งแรก · Time starts on first use`),
          row(btn("ซื้อคีย์ · Buy", "🛒", 3, "zh:prices"), btn("แลกคีย์ · Redeem", "🎟️", 1, "zh:redeem"), btn("รับสคริปต์ · Script", "⚙️", 2, "zh:script")),
          line(),
          text("**🧰 จัดการคีย์ของคุณ · Manage your key**"),
          row(btn("คีย์ของฉัน · My Keys", "📋", 2, "zh:info"), btn("ย้ายเครื่อง · HWID", "🔄", 2, "zh:reset"), btn("เกม · Games", "🎮", 2, "zh:games")),
          { type: 12, items: [{ media: { url: `${PUBLIC_URL}/assets/panel-banner.gif?v=4` } }] },
          text("-# 🔐 ทุกปุ่มตอบกลับให้เห็นเฉพาะคุณ · Replies are only visible to you\n-# 🌐 ตอบเป็นภาษาไทยหรืออังกฤษตามภาษาที่ตั้งใน Discord · Replies follow your Discord language"),
          row(btn("เว็บร้าน · Shop", "🌐", 5, SHOP_URL), btn("Discord", "💬", 5, DISCORD_INVITE)),
        ],
      },
    ],
  };
}

function ephemeralEmbed(embed) {
  const parts = [text(`### ${embed.title}`), line(), text(embed.description)];
  if (embed.buttons) parts.push(row(...embed.buttons));
  return { type: 4, data: { flags: 64 | (1 << 15), components: [{ type: 17, accent_color: PANEL_COLOR, components: parts }] } };
}

function keyModal(id, title, required, L) {
  return {
    type: 9,
    data: {
      custom_id: id,
      title,
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "key",
              label: required ? T(L, "คีย์ของคุณ", "Your key") : T(L, "คีย์ (เว้นว่างได้ถ้ามีคีย์เดียว)", "Key (leave empty if you have only one)"),
              style: 1,
              min_length: required ? 8 : 0,
              max_length: 40,
              required,
              placeholder: "ZH-XXXX-XXXX-XXXX-XXXX",
            },
          ],
        },
      ],
    },
  };
}

async function handlePanelCommand(res, body) {
  if (!discordIsAdmin(body.member)) return send(res, 200, { type: 4, data: { flags: 64, content: "คำสั่งนี้สำหรับแอดมินเท่านั้น" } });
  await deferred(
    res,
    body,
    async () => {
      try {
        await discordApi(`/channels/${body.channel_id}/messages`, "POST", await panelMessage());
        return { content: "โพสต์แผงคีย์ในห้องนี้แล้ว ✅" };
      } catch (err) {
        console.error("panel post failed:", err.message);
        if (/discord 403/.test(err.message)) return { content: "โพสต์ไม่สำเร็จ ให้บอทมีสิทธิ์ ดูช่อง / ส่งข้อความ / ฝังลิงก์ ในห้องนี้ แล้วลองใหม่" };
        return { content: `โพสต์ไม่สำเร็จ: \`${err.message.slice(0, 300)}\`` };
      }
    },
    "panel"
  );
}

async function handlePanelButton(res, body) {
  const id = body.data && body.data.custom_id;
  const L = langOf(body);
  if (id === "zh:redeem") return send(res, 200, keyModal("zh:redeem_modal", T(L, "แลกคีย์", "Redeem Key"), true, L));
  if (id === "zh:reset") return send(res, 200, keyModal("zh:reset_modal", T(L, "ย้ายเครื่อง (รีเซ็ต HWID)", "Reset HWID"), false, L));
  if (id === "zh:script") {
    setTimeout(() => {
      fetch(`${DISCORD_API}/webhooks/${DISCORD_APP_ID}/${body.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags: 64, content: LOADSTRING, allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(10000),
      })
        .then(async (r) => r.ok || console.error("script followup failed:", r.status, await r.text()))
        .catch((err) => console.error("script followup failed:", err.message));
    }, 700);
    return send(
      res,
      200,
      ephemeralEmbed({
        title: "📜 Zero Hub Loader",
        description: [
          T(L, "ใช้สคริปต์นี้ตัวเดียวทุกเกม", "One loader for every game"),
          "```lua",
          LOADSTRING,
          "```",
          T(
            L,
            "**วิธีใช้:** เข้าเกมที่รองรับ → รันใน executor → ใส่คีย์ในหน้าต่างโหลดเดอร์ (ใส่ครั้งเดียว ครั้งต่อไปจำให้เอง)",
            "**How to use:** join a supported game → run it in your executor → enter your key in the loader window (only once, it is remembered)"
          ),
          T(L, `ยังไม่มีคีย์? ซื้อได้ที่ [zerohub-shop.pages.dev](${SHOP_URL})`, `No key yet? Buy one at [zerohub-shop.pages.dev](${SHOP_URL})`),
          T(
            L,
            "-# 📱 มือถือ: กดค้างที่ข้อความสคริปต์ด้านล่าง → คัดลอกข้อความ ได้สคริปต์ล้วนๆ ไม่ต้องลบอะไร",
            "-# 📱 Mobile: long-press the script message below → Copy Text. You get only the script, nothing to delete."
          ),
        ].join("\n"),
      })
    );
  }
  if (id === "zh:prices") {
    return send(
      res,
      200,
      ephemeralEmbed({
        title: T(L, "🛒 ซื้อคีย์", "🛒 Buy a Key"),
        description: [
          await priceLines(L),
          "",
          T(
            L,
            "**วิธีซื้อ:** สมัครที่เว็บ (ล็อกอินด้วย Discord ได้) → เติมพอยต์ด้วยซองอั่งเปา TrueMoney → เลือกแพ็กเกจ → ได้คีย์ทันที",
            "**How to buy:** sign up on the website (Discord login works) → top up points with a TrueMoney gift voucher → pick a plan → get your key instantly"
          ),
          T(
            L,
            "-# 🎮 คีย์เดียวใช้ได้ทุกเกม · ⏱️ เวลาเริ่มนับตอนใช้ครั้งแรก · ซื้อผ่านเว็บด้วยบัญชี Discord ได้ยศ Buyer อัตโนมัติ",
            "-# 🎮 One key, every game · ⏱️ Time starts on first use · Buying with your Discord account gives you the Buyer role automatically"
          ),
        ].join("\n"),
        buttons: [btn(T(L, "ไปที่ร้านค้า", "Open Shop"), "🛒", 5, `${SHOP_URL}/shop`), btn(T(L, "เติมเงิน", "Top up"), "💰", 5, `${SHOP_URL}/topup`)],
      })
    );
  }
  if (id === "zh:games") {
    return send(
      res,
      200,
      ephemeralEmbed({
        title: T(L, "🗺️ เกมที่รองรับ", "🗺️ Supported Games"),
        description:
          PANEL_GAMES.map(([e, n]) => `${e} **${n}**`).join("\n") +
          T(L, "\n\nคีย์เดียวใช้ได้ทุกเกม รวมถึงเกมที่จะเพิ่มในอนาคต", "\n\nOne key works for every game, including games added later"),
      })
    );
  }
  if (id === "zh:info") return deferred(res, body, () => runCommand("mykey", {}, body.member, body.user, L), "panel-info");
  send(res, 200, { type: 4, data: { flags: 64, content: T(L, "ปุ่มนี้หมดอายุแล้ว ลองใหม่อีกครั้ง", "This button has expired, try again") } });
}

function modalValue(body) {
  for (const row of (body.data && body.data.components) || []) {
    for (const c of row.components || []) if (c.custom_id === "key") return String(c.value || "").trim();
  }
  return "";
}

async function handlePanelModal(res, body) {
  const id = body.data && body.data.custom_id;
  const key = modalValue(body);
  const L = langOf(body);
  if (id === "zh:redeem_modal") return deferred(res, body, () => runCommand("redeem", { key }, body.member, body.user, L), "panel-redeem");
  if (id === "zh:reset_modal") {
    return deferred(res, body, () => runCommand("resethwid", key ? { key } : {}, body.member, body.user, L), "panel-reset");
  }
  send(res, 200, { type: 4, data: { flags: 64, content: T(L, "ไม่รู้จักฟอร์มนี้", "Unknown form") } });
}

const BOOTED_AT = Date.now();
let presenceIdx = 0;
async function presenceData() {
  let s = null;
  try {
    s = await getStats();
  } catch {}
  const states = [
    s ? `🔑 คีย์ใช้งานอยู่ ${s.active} คีย์` : null,
    `🟢 ออนไลน์มาแล้ว ${fmtHours((Date.now() - BOOTED_AT) / 3600000)}`,
    s ? `👥 สมาชิก ${s.members} คน · ขายแล้ว ${s.sold} คีย์` : null,
    "🛒 zerohub-shop.pages.dev",
  ].filter(Boolean);
  const state = states[presenceIdx++ % states.length];
  return { since: null, activities: [{ name: "Custom Status", type: 4, state }], status: "online", afk: false };
}

function startGateway() {
  if (!DISCORD_BOT_TOKEN) return;
  if (typeof WebSocket !== "function") return console.error("gateway: this Node version has no WebSocket, bot will show offline");
  let ws = null;
  let beat = null;
  let seq = null;
  let acked = true;
  let retry = 0;
  const sendOp = (op, d) => ws && ws.readyState === 1 && ws.send(JSON.stringify({ op, d }));
  const connect = () => {
    ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
    ws.onmessage = async (ev) => {
      let p;
      try {
        p = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (p.s != null) seq = p.s;
      if (p.op === 10) {
        clearInterval(beat);
        acked = true;
        beat = setInterval(() => {
          if (!acked) return ws.close(4000);
          acked = false;
          sendOp(1, seq);
        }, p.d.heartbeat_interval);
        sendOp(2, {
          token: DISCORD_BOT_TOKEN,
          intents: 0,
          properties: { os: "linux", browser: "zerohub", device: "zerohub" },
          presence: await presenceData(),
        });
      } else if (p.op === 11) acked = true;
      else if (p.op === 1) sendOp(1, seq);
      else if (p.op === 7 || p.op === 9) ws.close(4000);
      else if (p.op === 0 && p.t === "READY") {
        retry = 0;
        console.log("gateway: bot online");
      }
    };
    ws.onclose = (ev) => {
      clearInterval(beat);
      if ([4004, 4010, 4011, 4012, 4013, 4014].includes(ev.code)) return console.error("gateway: stopped, code", ev.code);
      setTimeout(connect, Math.min(60000, 5000 * ++retry));
    };
    ws.onerror = () => {};
  };
  connect();
  setInterval(async () => sendOp(3, await presenceData()), 60 * 1000).unref();
}

const ASSETS = ["panel-banner.png", "panel-banner.gif", "panel-logo.png"];
const assetCache = new Map();
function handleAsset(req, res, name) {
  if (!ASSETS.includes(name)) return send(res, 404, { ok: false });
  if (!assetCache.has(name)) {
    try {
      assetCache.set(name, require("fs").readFileSync(require("path").join(__dirname, name)));
    } catch {
      return send(res, 404, { ok: false });
    }
  }
  res.writeHead(200, { "Content-Type": name.endsWith(".gif") ? "image/gif" : "image/png", "Cache-Control": "public, max-age=86400" });
  res.end(assetCache.get(name));
}

async function route(req, res) {
  const cors = corsHeaders(req.headers.origin || "");
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const m = req.method === "HEAD" ? "GET" : req.method;

  if (m === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }
  if (m === "GET" && path === "/") return send(res, 200, { ok: true, service: "zerohub-api", build: "diag-1" }, cors);
  if (m === "GET" && path.startsWith("/assets/")) return handleAsset(req, res, path.slice(8));
  if (m === "POST" && path === "/api/contact") return handleContact(req, res, cors);
  if (m === "GET" && path === "/api/script/ZeroHub") return handleLoader(req, res);
  if (m === "GET" && path === "/api/key/check") return handleKeyCheck(req, res, url);
  if (m === "GET" && path === "/api/key/script") return handleKeyScript(req, res, url);
  if (m === "GET" && path === "/api/key/session") return handleKeySession(req, res, url);
  if (m === "GET" && path === "/api/key/tiers") return handleTiers(req, res, cors);
  if (m === "GET" && path === "/api/stats") return handleStats(req, res, cors);
  if (m === "POST" && path === "/api/key/info") return handleKeyInfo(req, res, cors);
  if (m === "POST" && path === "/api/key/resethwid") return handleKeyReset(req, res, cors);
  if (m === "GET" && path === "/api/me") return handleMe(req, res, cors);
  if (m === "POST" && path === "/api/me/claim") return handleClaim(req, res, cors);
  if (m === "POST" && path === "/api/me/resethwid") return handleUserReset(req, res, cors);
  if (m === "POST" && path === "/api/wallet/topup") return handleTopup(req, res, cors);
  if (m === "POST" && path === "/api/shop/buy") return handleBuy(req, res, cors);
  if (m === "POST" && path === "/api/promo/redeem") return handlePromoRedeem(req, res, cors);
  if (m === "POST" && path === "/api/discord/interactions") return handleInteraction(req, res);
  if (path.startsWith("/api/admin/")) return handleAdmin(req, res, cors, path, url);
  send(res, 404, { ok: false, error: "not found" }, cors);
}

http
  .createServer((req, res) => {
    route(req, res).catch((err) => {
      const cors = corsHeaders(req.headers.origin || "");
      const bad = err && (err.message === "bad_json" || err.message === "too_large");
      if (!bad) console.error("request failed:", req.method, req.url && req.url.split("?")[0], err && err.message);
      if (res.headersSent) return res.end();
      send(res, bad ? 400 : 500, { ok: false, error: bad ? "ข้อมูลไม่ถูกต้อง" : "เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง" }, cors);
    });
  })
  .listen(PORT, () => {
    console.log(`ZeroHub API on :${PORT}`);
    startGateway();
    setTimeout(() => sweepBuyerRoles().catch(() => {}), 2 * 60 * 1000).unref();
    setInterval(() => sweepBuyerRoles().catch(() => {}), 15 * 60 * 1000).unref();
    setInterval(() => dailySummaryTick().catch((err) => console.error("daily summary:", err.message)), 5 * 60 * 1000).unref();
  });
