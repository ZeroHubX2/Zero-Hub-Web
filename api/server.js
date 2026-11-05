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
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
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

function formatLeft(k) {
  if (k.hours === null) return "ถาวร";
  if (!k.activated_at) return `${fmtHours(k.hours)} (เริ่มนับเมื่อใช้ครั้งแรก)`;
  const left = new Date(k.expires_at).getTime() - Date.now();
  if (left <= 0) return "หมดอายุแล้ว";
  return `เหลือ ${fmtHours(left / 3600000)}`;
}

function fmtHours(h) {
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

async function truemoney(code, action) {
  const base = `${TRUEMONEY_BASE}/campaign/vouchers/${q(code)}`;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    Origin: "https://gift.truemoney.com",
    Referer: `https://gift.truemoney.com/campaign/?v=${code}`,
  };
  const r =
    action === "verify"
      ? await fetch(`${base}/verify?mobile=${TRUEMONEY_PHONE}`, { headers, signal: AbortSignal.timeout(15000) })
      : await fetch(`${base}/redeem`, {
          method: "POST",
          headers,
          body: JSON.stringify({ mobile: TRUEMONEY_PHONE, voucher_hash: code }),
          signal: AbortSignal.timeout(20000),
        });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`truemoney ${action} http ${r.status}`);
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
  const [k] = await db(`keys?select=*&id=eq.${r.key_id}`);
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
async function handleStats(req, res, cors) {
  if (!statsCache || Date.now() - statsCache.at > 60 * 1000) {
    const [r] = await db("rpc/shop_stats", { method: "POST", body: {} });
    statsCache = {
      at: Date.now(),
      data: { members: Number(r.members), sold: Number(r.sold), active: Number(r.active), games: Object.keys(SCRIPT_FILES).length - 1 },
    };
  }
  send(res, 200, { ok: true, ...statsCache.data }, cors);
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
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const conds = [];
    const t = term.replace(/[^0-9A-Za-z\-]/g, "");
    if (t) conds.push(`or(key.ilike.*${t}*,discord_id.eq.${t},note.ilike.*${t}*)`);
    const now = `"${new Date().toISOString()}"`;
    if (filter === "active") conds.push("revoked.is.false", `or(expires_at.is.null,expires_at.gt.${now})`);
    if (filter === "expired") conds.push(`expires_at.lt.${now}`);
    if (filter === "revoked") conds.push("revoked.is.true");
    if (filter === "unused") conds.push("activated_at.is.null");
    let qs = `keys?select=*&order=created_at.desc&limit=${limit}`;
    if (conds.length) qs += `&and=${q(`(${conds.join(",")})`)}`;
    const [keys, tiers] = await Promise.all([db(qs), getTiers(true)]);
    return send(res, 200, { ok: true, keys, tiers }, cors);
  }
  if (req.method === "GET" && path === "/api/admin/tiers") {
    return send(res, 200, { ok: true, tiers: await getTiers(true) }, cors);
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
  if (path === "/api/admin/users") {
    const rows = await db("rpc/shop_find_users", { method: "POST", body: { p_q: clean(body.q, 80) } });
    return send(res, 200, { ok: true, users: rows }, cors);
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
  const key = normKey(body.key);
  const k = await getKey(key);
  if (!k) return send(res, 404, { ok: false, error: "ไม่พบคีย์" }, cors);
  if (path === "/api/admin/keys/revoke") return send(res, 200, { ok: true, key: await updateKey(key, { revoked: body.revoked !== false }) }, cors);
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
    return send(res, 200, { ok: true }, cors);
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

function keyLine(k) {
  const state = k.revoked ? "⛔ ระงับ" : k.expires_at && new Date(k.expires_at) <= new Date() ? "⌛ หมดอายุ" : "✅";
  const who = k.discord_id ? ` <@${k.discord_id}>` : "";
  return `${state} \`${k.key}\` · ${k.tier} · ${formatLeft(k)} · HWID ${k.hwid ? "ผูกแล้ว" : "ว่าง"}${who}`;
}

async function runCommand(name, opts, member, user) {
  const uid = (member && member.user && member.user.id) || (user && user.id);
  const admin = discordIsAdmin(member);
  const adminOnly = ["genkey", "keys", "revokekey", "extendkey"];
  if (adminOnly.includes(name) && !admin) return { content: "คำสั่งนี้สำหรับแอดมินเท่านั้น" };

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
    return { content: `${revoked ? "ระงับ" : "ยกเลิกการระงับ"}คีย์ \`${k.key}\` แล้ว` };
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
    if (!k || k.revoked) return { content: k ? KEY_STATUS_TEXT.revoked : KEY_STATUS_TEXT.invalid };
    if (k.discord_id && k.discord_id !== uid) return { content: "คีย์นี้ผูกกับบัญชี Discord อื่นแล้ว" };
    if (!k.discord_id) await updateKey(k.key, { discord_id: uid });
    const ok = await grantBuyerRole(uid);
    return { content: `ผูกคีย์กับบัญชีของคุณแล้ว (${formatLeft(k)})${ok ? "\nได้รับยศ Buyer แล้ว" : "\nให้ยศไม่สำเร็จ แจ้งแอดมิน"}` };
  }
  if (name === "mykey") {
    const keys = await db(`keys?select=*&discord_id=eq.${q(uid)}&order=created_at.desc&limit=10`);
    if (!keys.length) return { content: `คุณยังไม่มีคีย์ที่ผูกกับบัญชี ซื้อได้ที่ ${SHOP_URL} แล้วใช้ /redeem` };
    return { content: keys.map(keyLine).join("\n") };
  }
  if (name === "resethwid") {
    let k;
    if (opts.key) {
      k = await getKey(normKey(opts.key));
      if (k && k.discord_id && k.discord_id !== uid && !admin) return { content: "คีย์นี้ผูกกับบัญชี Discord อื่น" };
    } else {
      const keys = await db(`keys?select=*&discord_id=eq.${q(uid)}&revoked=eq.false&hwid=not.is.null&order=created_at.desc`);
      if (keys.length > 1) return { content: "คุณมีหลายคีย์ ระบุคีย์ด้วย /resethwid key:" };
      k = keys[0];
    }
    if (!k) return { content: "ไม่พบคีย์ที่ต้องรีเซ็ต" };
    const r = await resetHwid(k.key, admin && !!opts.key && k.discord_id !== uid);
    if (r.status === "cooldown") {
      return { content: `รีเซ็ต HWID ได้วันละครั้ง ครั้งถัดไป <t:${Math.floor(new Date(r.next_reset_at).getTime() / 1000)}:R>` };
    }
    if (r.status !== "ok") return { content: KEY_STATUS_TEXT[r.status] || r.status };
    return { content: `รีเซ็ต HWID คีย์ \`${k.key}\` แล้ว รันสคริปต์บนเครื่องใหม่ได้เลย` };
  }
  return { content: "ไม่รู้จักคำสั่งนี้" };
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
  if (body.type !== 2) return send(res, 400, { error: "unsupported" });
  send(res, 200, { type: 5, data: { flags: 64 } });
  const name = body.data && body.data.name;
  try {
    const out = await runCommand(name, optionsOf(body.data), body.member, body.user);
    await finishInteraction(body.token, out);
  } catch (err) {
    console.error("command failed:", name, err.message);
    await finishInteraction(body.token, { content: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" }).catch(() => {});
  }
}

async function route(req, res) {
  const cors = corsHeaders(req.headers.origin || "");
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const m = req.method;

  if (m === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }
  if (m === "GET" && path === "/") return send(res, 200, { ok: true, service: "zerohub-api" }, cors);
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
  .listen(PORT, () => console.log(`ZeroHub API on :${PORT}`));
