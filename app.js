const NAV_LINKS = [
  { href: "./", label: "หน้าหลัก", icon: "house" },
  { href: "scripts", label: "สคริปต์", icon: "code" },
  { href: "howto", label: "วิธีใช้", icon: "book-open" },
  { href: "contact", label: "ติดต่อ", icon: "headset" },
];

const DISCORD_URL = "https://discord.gg/CYxyhhBNba";
const CONTACT_API = "https://zerohub-contact.onrender.com/api/contact";
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function cleanPath(pathname) {
  return pathname.replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "");
}

if (cleanPath(location.pathname) !== location.pathname) {
  history.replaceState(history.state, "", cleanPath(location.pathname) + location.search + location.hash);
}

function currentPage() {
  const file = location.pathname.split("/").pop();
  return file === "" ? "./" : file;
}

function renderChrome() {
  const page = currentPage();
  const links = NAV_LINKS.map(
    (l) => `<li><a href="${l.href}" class="${l.href === page ? "active" : ""}"><i class="fa-solid fa-${l.icon}"></i>${l.label}</a></li>`
  ).join("");

  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div id="loader"><div class="loader-inner"><img src="logo.webp" alt=""></div></div>
    <div class="page-bar" id="pageBar"></div>
    <canvas id="embers"></canvas>
    <div class="cursor-glow" id="cursorGlow"></div>
    <nav class="navbar" id="navbar">
      <div class="container">
        <a href="./" class="brand">
          <img src="logo-sm.webp" alt="ZeroHub">
          <div class="brand-text">ZERO <b>HUB</b><small>SCRIPT &amp; TOOLS</small></div>
        </a>
        <ul class="nav-links" id="navLinks">${links}<li class="mobile-only auth-guest"><a href="login"><i class="fa-solid fa-right-to-bracket"></i>เข้าสู่ระบบ</a></li><li class="mobile-only auth-user" hidden><a href="#" data-logout><i class="fa-solid fa-right-from-bracket"></i>ออกจากระบบ</a></li><li class="mobile-only"><a href="${DISCORD_URL}" target="_blank" rel="noopener"><i class="fa-brands fa-discord"></i>Discord</a></li></ul>
        <div class="nav-actions">
          <a href="${DISCORD_URL}" target="_blank" rel="noopener" class="btn btn-ghost nav-discord" aria-label="Discord"><i class="fa-brands fa-discord"></i></a>
          <a href="login" class="btn btn-ghost auth-guest"><i class="fa-solid fa-right-to-bracket"></i>เข้าสู่ระบบ</a>
          <a href="register" class="btn btn-primary auth-guest"><i class="fa-solid fa-user-plus"></i>สมัครสมาชิก</a>
          <span class="nav-user auth-user" hidden><i class="fa-solid fa-circle-user"></i><b id="navUserName"></b></span>
          <button class="btn btn-ghost auth-user nav-logout" type="button" data-logout hidden aria-label="ออกจากระบบ"><i class="fa-solid fa-right-from-bracket"></i></button>
          <button class="menu-toggle" id="menuToggle" aria-label="เมนู"><i class="fa-solid fa-bars"></i></button>
        </div>
      </div>
    </nav>`
  );

  document.body.insertAdjacentHTML(
    "beforeend",
    `<footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <a href="./" class="brand">
              <img src="logo-sm.webp" alt="">
              <div class="brand-text">ZERO <b>HUB</b><small>SCRIPT &amp; TOOLS</small></div>
            </a>
            <p>ศูนย์รวมสคริปต์ Roblox คุณภาพ อัปเดตไว ใช้งานง่าย ทั้งคอมและมือถือ</p>
          </div>
          <div>
            <h4>เมนู</h4>
            <ul>${NAV_LINKS.map((l) => `<li><a href="${l.href}"><i class="fa-solid fa-${l.icon}"></i>${l.label}</a></li>`).join("")}</ul>
          </div>
          <div>
            <h4>บัญชี</h4>
            <ul>
              <li><a href="login"><i class="fa-solid fa-right-to-bracket"></i>เข้าสู่ระบบ</a></li>
              <li><a href="register"><i class="fa-solid fa-user-plus"></i>สมัครสมาชิก</a></li>
              <li><a href="${DISCORD_URL}" target="_blank" rel="noopener"><i class="fa-brands fa-discord"></i>Discord</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ZeroHub. All rights reserved.</span>
          <span>Made with <i class="fa-solid fa-heart text-red"></i> for Roblox players</span>
        </div>
      </div>
    </footer>
    <button class="to-top" id="toTop" aria-label="กลับขึ้นด้านบน"><i class="fa-solid fa-arrow-up"></i></button>
    <div class="toast" id="toast"></div>`
  );

  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("navLinks").classList.toggle("open");
  });

  const hideLoader = () => document.getElementById("loader").classList.add("done");
  let seen = false;
  try {
    seen = sessionStorage.getItem("zh-seen") === "1";
    sessionStorage.setItem("zh-seen", "1");
  } catch {}
  if (seen) hideLoader();
  else if (document.readyState === "complete") setTimeout(hideLoader, 300);
  else window.addEventListener("load", () => setTimeout(hideLoader, 300));
  setTimeout(hideLoader, 1500);
}

function setupScrollEffects() {
  const navbar = document.getElementById("navbar");
  const toTop = document.getElementById("toTop");
  const onScroll = () => {
    navbar.classList.toggle("scrolled", scrollY > 20);
    toTop.classList.toggle("show", scrollY > 500);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toTop.addEventListener("click", () => scrollTo({ top: 0 }));
}

function setupEmbers() {
  const canvas = document.getElementById("embers");
  const ctx = canvas.getContext("2d");
  let w, h, parts;
  const resize = () => {
    w = canvas.width = innerWidth;
    h = canvas.height = innerHeight;
    const count = Math.min(70, Math.floor(w / 18));
    parts = Array.from({ length: count }, () => spawn(true));
  };
  const spawn = (anywhere) => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    r: Math.random() * 2.2 + 0.6,
    vy: Math.random() * 0.6 + 0.25,
    vx: (Math.random() - 0.5) * 0.3,
    a: Math.random() * 0.6 + 0.3,
    white: Math.random() < 0.18,
    t: Math.random() * 100,
  });
  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.t += 0.02;
      p.y -= p.vy;
      p.x += p.vx + Math.sin(p.t) * 0.25;
      if (p.y < -10) parts[i] = spawn(false);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.white ? `rgba(255,255,255,${p.a})` : `rgba(255,40,40,${p.a})`;
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.white ? "#fff" : "#ff1e1e";
      ctx.fill();
    }
    requestAnimationFrame(tick);
  };
  addEventListener("resize", resize);
  resize();
  if (!reduceMotion) tick();
}

function setupCursorGlow() {
  const glow = document.getElementById("cursorGlow");
  let tx = innerWidth / 2, ty = innerHeight / 3, x = tx, y = ty;
  addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  const loop = () => {
    x += (tx - x) * 0.12;
    y += (ty - y) * 0.12;
    glow.style.left = `${x}px`;
    glow.style.top = `${y}px`;
    requestAnimationFrame(loop);
  };
  if (!reduceMotion) loop();
}

function setupCardSpotlight() {
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
}

function countUp(el) {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  const start = performance.now();
  const dur = 1600;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const v = Math.floor(target * (1 - Math.pow(1 - t, 3)));
    el.innerHTML = `${v.toLocaleString()}<em>${suffix}</em>`;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setupReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        e.target.querySelectorAll("[data-count]").forEach(countUp);
        if (e.target.matches("[data-count]")) countUp(e.target);
        io.unobserve(e.target);
      });
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll(".reveal, .stats").forEach((el) => io.observe(el));
}

function setupTyped() {
  const el = document.getElementById("typed");
  if (!el) return;
  const words = JSON.parse(el.dataset.words);
  const text = el.querySelector(".text");
  let wi = 0, ci = 0, deleting = false;
  const tick = () => {
    if (!text.isConnected) return;
    const word = words[wi];
    ci += deleting ? -1 : 1;
    text.textContent = word.slice(0, ci);
    let delay = deleting ? 40 : 85;
    if (!deleting && ci === word.length) { deleting = true; delay = 1600; }
    else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; delay = 300; }
    setTimeout(tick, delay);
  };
  if (reduceMotion) text.textContent = words[0];
  else tick();
}

let toastTimer;
function showToast(message, icon = "circle-info") {
  const toast = document.getElementById("toast");
  const i = document.createElement("i");
  i.className = `fa-solid fa-${icon}`;
  toast.replaceChildren(i, document.createTextNode(message));
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setupCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = document.getElementById(btn.dataset.copy).textContent;
      try {
        await navigator.clipboard.writeText(text);
        showToast("คัดลอกสคริปต์แล้ว", "circle-check");
      } catch {
        showToast("คัดลอกไม่สำเร็จ ลองกดค้างแล้วคัดลอกเอง", "triangle-exclamation");
      }
    });
  });
}

let supabasePromise;
function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return Promise.resolve(null);
  if (!supabasePromise) {
    supabasePromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
      s.onload = () => resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
      s.onerror = () => {
        supabasePromise = null;
        reject(new Error("โหลดระบบสมาชิกไม่สำเร็จ ลองรีเฟรชหน้า"));
      };
      document.head.appendChild(s);
    });
  }
  return supabasePromise;
}

const AUTH_ERRORS = {
  "Invalid login credentials": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "Email not confirmed": "ยังไม่ได้ยืนยันอีเมล เช็กกล่องจดหมายก่อนนะ",
  "User already registered": "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน",
  "Password should be at least 6 characters.": "รหัสผ่านสั้นเกินไป",
};
function authError(err) {
  const msg = (err && err.message) || "";
  if (AUTH_ERRORS[msg]) return AUTH_ERRORS[msg];
  if (/rate limit/i.test(msg)) return "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  if (/provider is not enabled/i.test(msg)) return "ยังไม่ได้เปิดล็อกอินด้วย Discord";
  return msg || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}

function setBusy(btn, busy, text) {
  const label = btn.querySelector("span");
  if (!btn.dataset.label) btn.dataset.label = label.textContent;
  btn.classList.toggle("loading", busy);
  label.textContent = busy ? text : btn.dataset.label;
}

function renderAuthState(user) {
  const name = user ? (user.user_metadata && (user.user_metadata.username || user.user_metadata.full_name)) || user.email.split("@")[0] : "";
  document.querySelectorAll(".auth-guest").forEach((el) => (el.hidden = !!user));
  document.querySelectorAll(".auth-user").forEach((el) => (el.hidden = !user));
  document.getElementById("navUserName").textContent = name;
}

function setupAuth() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-logout]");
    if (!btn) return;
    e.preventDefault();
    const sb = await getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    document.getElementById("navLinks").classList.remove("open");
    showToast("ออกจากระบบแล้ว", "circle-check");
  });
  getSupabase()
    .then((sb) => {
      if (!sb) return;
      sb.auth.getSession().then(({ data }) => renderAuthState(data.session && data.session.user));
      sb.auth.onAuthStateChange((_event, session) => renderAuthState(session && session.user));
    })
    .catch(() => {});
}

async function requireSupabase() {
  try {
    const sb = await getSupabase();
    if (!sb) showToast("ระบบสมาชิกยังไม่เปิดใช้งาน", "circle-info");
    return sb;
  } catch (err) {
    showToast(err.message, "triangle-exclamation");
    return null;
  }
}

function setupAuthForms() {
  const login = document.getElementById("loginForm");
  if (login) {
    login.addEventListener("submit", async (e) => {
      e.preventDefault();
      const { email, password } = Object.fromEntries(new FormData(login));
      if (!email.trim() || !password) return showToast("กรอกอีเมลและรหัสผ่าน", "triangle-exclamation");
      const sb = await requireSupabase();
      if (!sb) return;
      const btn = login.querySelector("button[type=submit]");
      setBusy(btn, true, "กำลังเข้าสู่ระบบ...");
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(btn, false);
      if (error) return showToast(authError(error), "triangle-exclamation");
      showToast("เข้าสู่ระบบสำเร็จ", "circle-check");
      navigate(new URL("./", location.href).href);
    });
    document.getElementById("forgotLink").addEventListener("click", async (e) => {
      e.preventDefault();
      const email = login.email.value.trim();
      if (!email) return showToast("กรอกอีเมลก่อน แล้วกดลืมรหัสผ่านอีกครั้ง", "circle-info");
      const sb = await requireSupabase();
      if (!sb) return;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL("./", location.href).href });
      showToast(error ? authError(error) : "ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว", error ? "triangle-exclamation" : "circle-check");
    });
    document.getElementById("discordLogin").addEventListener("click", async () => {
      const sb = await requireSupabase();
      if (!sb) return;
      const { error } = await sb.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: new URL("./", location.href).href } });
      if (error) showToast(authError(error), "triangle-exclamation");
    });
  }

  const register = document.getElementById("registerForm");
  if (register) {
    register.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(register));
      const username = (f.username || "").trim();
      if (!username || !f.email.trim()) return showToast("กรอกชื่อผู้ใช้และอีเมล", "triangle-exclamation");
      if (f.password.length < 8) return showToast("รหัสผ่านต้องมีอย่างน้อย 8 ตัว", "triangle-exclamation");
      if (f.password !== f.confirm) return showToast("รหัสผ่านทั้งสองช่องไม่ตรงกัน", "triangle-exclamation");
      if (!f.agree) return showToast("กรุณายอมรับเงื่อนไขการใช้งาน", "triangle-exclamation");
      const sb = await requireSupabase();
      if (!sb) return;
      const btn = register.querySelector("button[type=submit]");
      setBusy(btn, true, "กำลังสร้างบัญชี...");
      const { data, error } = await sb.auth.signUp({
        email: f.email.trim(),
        password: f.password,
        options: { data: { username }, emailRedirectTo: new URL("./", location.href).href },
      });
      setBusy(btn, false);
      if (error) return showToast(authError(error), "triangle-exclamation");
      register.reset();
      if (data.session) {
        showToast("สมัครสมาชิกสำเร็จ", "circle-check");
        navigate(new URL("./", location.href).href);
      } else {
        showToast("สมัครสำเร็จ เช็กอีเมลเพื่อยืนยันบัญชี", "envelope");
      }
    });
  }
}

function setupChoiceGroups() {
  document.querySelectorAll("[data-group]").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      group.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      group.dispatchEvent(new CustomEvent("choice", { detail: btn.dataset.value }));
    });
  });
}

function setupShopFilter() {
  const filters = document.getElementById("shopFilters");
  if (!filters) return;
  filters.addEventListener("choice", (e) => {
    document.querySelectorAll(".product").forEach((p) => {
      p.style.display = e.detail === "all" || p.dataset.cat === e.detail ? "" : "none";
    });
  });
}

function setupContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.name.trim() || data.message.trim().length < 5) {
      showToast("กรอกชื่อและข้อความอย่างน้อย 5 ตัวอักษร", "triangle-exclamation");
      return;
    }
    if (!CONTACT_API) {
      showToast("ระบบส่งข้อความยังไม่เปิดใช้งาน ทักใน Discord ได้เลย", "circle-info");
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    const label = btn.querySelector("span");
    btn.classList.add("loading");
    label.textContent = "กำลังส่ง...";
    try {
      const r = await fetch(CONTACT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(60000),
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok || !res.ok) throw new Error(res.error || "ส่งไม่สำเร็จ ลองใหม่ภายหลัง");
      form.reset();
      showToast("ส่งข้อความแล้ว ทีมงานจะตอบใน Discord", "circle-check");
    } catch (err) {
      showToast(err.name === "TimeoutError" ? "เซิร์ฟเวอร์ตอบช้า ลองใหม่อีกครั้ง" : err.message, "triangle-exclamation");
    } finally {
      btn.classList.remove("loading");
      label.textContent = "ส่งข้อความ";
    }
  });
}

function initPage() {
  setupContactForm();
  setupCardSpotlight();
  setupReveal();
  setupTyped();
  setupCopyButtons();
  setupAuthForms();
  setupChoiceGroups();
  setupShopFilter();
}

const pageCache = new Map();

function fetchPage(url) {
  const key = url.split("#")[0];
  if (!pageCache.has(key)) {
    const req = fetch(key).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    });
    req.catch(() => pageCache.delete(key));
    pageCache.set(key, req);
  }
  return pageCache.get(key);
}

function isInternalPage(a) {
  if (!a || a.target || a.hasAttribute("download")) return false;
  const raw = a.getAttribute("href") || "";
  if (raw === "" || raw.startsWith("#")) return false;
  const url = new URL(a.href, location.href);
  const last = url.pathname.split("/").pop();
  return url.origin === location.origin && (!last.includes(".") || last.endsWith(".html"));
}

function updateActiveNav() {
  const page = currentPage();
  document.querySelectorAll("#navLinks a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === page);
  });
  document.getElementById("navLinks").classList.remove("open");
}

let navToken = 0;
async function navigate(url, push = true) {
  const token = ++navToken;
  const main = document.querySelector("main");
  const bar = document.getElementById("pageBar");
  bar.className = "page-bar loading";
  main.classList.add("page-leave");
  try {
    const [html] = await Promise.all([fetchPage(url), new Promise((r) => setTimeout(r, 160))]);
    if (token !== navToken) return;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const next = doc.querySelector("main");
    if (!next) throw new Error("no main");
    document.title = doc.title;
    if (push) {
      const u = new URL(url);
      history.pushState({}, "", cleanPath(u.pathname) + u.search + u.hash);
    }
    main.className = `${next.className} page-in`;
    main.innerHTML = next.innerHTML;
    window.scrollTo({ top: 0, behavior: "instant" });
    updateActiveNav();
    initPage();
    main.addEventListener("animationend", () => main.classList.remove("page-in"), { once: true });
  } catch {
    location.href = url;
  } finally {
    if (token === navToken) {
      bar.className = "page-bar done";
    }
  }
}

function setupRouter() {
  history.scrollRestoration = "manual";
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!isInternalPage(a)) return;
    e.preventDefault();
    if (a.href === location.href) {
      window.scrollTo({ top: 0 });
      document.getElementById("navLinks").classList.remove("open");
      return;
    }
    navigate(a.href);
  });
  const prefetch = (e) => {
    const a = e.target.closest && e.target.closest("a");
    if (isInternalPage(a)) fetchPage(a.href).catch(() => {});
  };
  document.addEventListener("pointerover", prefetch, { passive: true });
  document.addEventListener("touchstart", prefetch, { passive: true });
  addEventListener("popstate", () => navigate(location.href, false));
  const warm = () => {
    ["./", "scripts", "howto", "contact", "login", "register"].forEach((p) =>
      fetchPage(new URL(p, location.href).href).catch(() => {})
    );
    ["mascot.webp", "mascot-2.webp", "logo.webp"].forEach((src) => { new Image().src = src; });
  };
  if ("requestIdleCallback" in window) requestIdleCallback(warm);
  else setTimeout(warm, 1200);
}

renderChrome();
setupScrollEffects();
setupEmbers();
setupCursorGlow();
setupRouter();
setupAuth();
initPage();
