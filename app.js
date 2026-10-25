const NAV_LINKS = [
  { href: "index.html", label: "หน้าหลัก" },
  { href: "topup.html", label: "เติมเงิน" },
  { href: "shop.html", label: "ร้านค้า" },
  { href: "howto.html", label: "วิธีใช้" },
  { href: "contact.html", label: "ติดต่อ" },
];

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function currentPage() {
  const file = location.pathname.split("/").pop();
  return file === "" ? "index.html" : file;
}

function renderChrome() {
  const page = currentPage();
  const links = NAV_LINKS.map(
    (l) => `<li><a href="${l.href}" class="${l.href === page ? "active" : ""}">${l.label}</a></li>`
  ).join("");

  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div id="loader"><div class="loader-inner"><img src="logo.webp" alt=""></div></div>
    <canvas id="embers"></canvas>
    <div class="cursor-glow" id="cursorGlow"></div>
    <nav class="navbar" id="navbar">
      <div class="container">
        <a href="index.html" class="brand">
          <img src="logo-sm.webp" alt="ZeroHub">
          <div class="brand-text">ZERO <b>HUB</b><small>SCRIPT &amp; TOOLS</small></div>
        </a>
        <ul class="nav-links" id="navLinks">${links}</ul>
        <div class="nav-actions">
          <a href="login.html" class="btn btn-ghost">เข้าสู่ระบบ</a>
          <a href="register.html" class="btn btn-primary">สมัครสมาชิก</a>
          <button class="menu-toggle" id="menuToggle" aria-label="เมนู">☰</button>
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
            <a href="index.html" class="brand">
              <img src="logo-sm.webp" alt="">
              <div class="brand-text">ZERO <b>HUB</b><small>SCRIPT &amp; TOOLS</small></div>
            </a>
            <p>ศูนย์รวมสคริปต์ Roblox คุณภาพ อัปเดตไว ใช้งานง่าย ทั้งคอมและมือถือ</p>
          </div>
          <div>
            <h4>เมนู</h4>
            <ul>${NAV_LINKS.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join("")}</ul>
          </div>
          <div>
            <h4>บัญชี</h4>
            <ul>
              <li><a href="login.html">เข้าสู่ระบบ</a></li>
              <li><a href="register.html">สมัครสมาชิก</a></li>
              <li><a href="contact.html">แจ้งปัญหา</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ZeroHub. All rights reserved.</span>
          <span>Made with <span class="text-red">♥</span> for Roblox players</span>
        </div>
      </div>
    </footer>
    <button class="to-top" id="toTop" aria-label="กลับขึ้นด้านบน">↑</button>
    <div class="toast" id="toast"></div>`
  );

  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("navLinks").classList.toggle("open");
  });

  const hideLoader = () => document.getElementById("loader").classList.add("done");
  if (document.readyState === "complete") setTimeout(hideLoader, 300);
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
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
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
        showToast("✓ คัดลอกสคริปต์แล้ว");
      } catch {
        showToast("คัดลอกไม่สำเร็จ ลองกดค้างแล้วคัดลอกเอง");
      }
    });
  });
}

function setupDemoForms() {
  document.querySelectorAll("form[data-demo]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      showToast(form.dataset.demo);
    });
  });
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
  if (filters) {
    filters.addEventListener("choice", (e) => {
      document.querySelectorAll(".product").forEach((p) => {
        p.style.display = e.detail === "all" || p.dataset.cat === e.detail ? "" : "none";
      });
    });
  }
  document.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => showToast(`ตัวอย่าง: ซื้อ ${btn.dataset.buy} (ยังไม่มีระบบหลังบ้าน)`));
  });
}

function setupTopup() {
  const amounts = document.getElementById("amounts");
  if (!amounts) return;
  const custom = document.getElementById("customAmount");
  const update = (value) => {
    const n = Math.max(0, Number(value) || 0);
    document.getElementById("sumAmount").textContent = `${n.toLocaleString()} บาท`;
    document.getElementById("sumCredit").textContent = `${n.toLocaleString()} เครดิต`;
    document.getElementById("sumTotal").textContent = `฿${n.toLocaleString()}`;
  };
  amounts.addEventListener("choice", (e) => {
    custom.value = e.detail;
    update(e.detail);
  });
  custom.addEventListener("input", () => {
    amounts.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    update(custom.value);
  });
}

renderChrome();
setupScrollEffects();
setupEmbers();
setupCursorGlow();
setupCardSpotlight();
setupReveal();
setupTyped();
setupCopyButtons();
setupDemoForms();
setupChoiceGroups();
setupShopFilter();
setupTopup();
