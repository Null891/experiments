/* Shared utilities for the experience pages. Loaded as a normal script. */
(function () {
  const TITLES = [
    "The Quiet Architecture of Forgetting",
    "We Built a Door and Could Not Stop Opening It",
    "Notes on Interfaces That Refuse to Behave",
    "A Field Guide to Vanishing Pages",
    "On the Pleasure of Difficult Websites",
    "The House That Reads You Back",
    "Everything Here Is About to Change",
    "How the Web Learned to Misbehave",
  ];
  const LEDES = [
    "There is a kind of website you do not browse so much as survive. This is one of them.",
    "Most pages want to be invisible. This one wants to be remembered, even if it has to fight you.",
    "Welcome. Stay as long as the page lets you. We make no promises about the text below.",
    "You arrived through a door in a 3D mansion. The page noticed. The page always notices.",
  ];
  const WORDS = ("the of and a to in is was that it for on are as with his they at be this from i have or by one had not but what all were when we there can an your which their said if do will each about how up out them then she many some so these would other into has more her two like him see time could no make than first been its who now people my made over did down only way find use may water long little very after words called just where most know get through back much before go good new write our used me man too any day same right look think also around another came come work three must because does part even place well such here take why things help put years different away again off went old number great tell men say small every found still between name should home big give air line set own under read last never us left end along while might next sound below saw something thought both few those always looked show large often together asked house world").split(" ");

  function lorem(words) {
    let out = [], n = words || (40 + (Math.random() * 80 | 0));
    for (let i = 0; i < n; i++) out.push(WORDS[(Math.random() * WORDS.length) | 0]);
    let s = out.join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  }
  function para(sentences) {
    let p = [], n = sentences || (3 + (Math.random() * 3 | 0));
    for (let i = 0; i < n; i++) p.push(lorem(8 + (Math.random() * 16 | 0)));
    return p.join(" ");
  }

  /* Build a believable fake-article DOM inside `el`. */
  function fakeArticle(el, opts = {}) {
    const title = opts.title || TITLES[(Math.random() * TITLES.length) | 0];
    const accent = opts.accent || "#3355ff";
    document.documentElement.style.setProperty("--accent", accent);
    const links = '<a href="#">Home</a><a href="#">Essays</a><a href="#">Lab</a><a href="#">Archive</a><a href="#">About</a>';
    let html = `
      <nav class="site"><span class="brand">${opts.brand || "MANSION / WING 7"}</span>
        <span class="links">${links}</span></nav>
      <h1 class="title">${title}</h1>
      <div class="byline">By the Resident Architect · ${1 + (Math.random() * 28 | 0)} min read · Room ${opts.room || ""}</div>
      <p class="lede">${opts.lede || LEDES[(Math.random() * LEDES.length) | 0]}</p>`;
    const blocks = opts.blocks || 7;
    for (let i = 0; i < blocks; i++) {
      html += `<p>${para()}</p>`;
      if (i === 1) html += `<blockquote>${lorem(18)}</blockquote>`;
      if (i === 3) html += `<h2>${lorem(4).replace(".", "")}</h2>`;
      if (i === 4) html += `<div class="card"><b>${lorem(5).replace(".", "")}</b><br>${para(2)}</div>`;
    }
    html += `<p><a class="btn" href="#next">Continue to the next page →</a></p>
      <footer class="site">© The 100-Room Mansion · This page is a controlled hallucination.</footer>`;
    el.innerHTML = html;
  }

  /* Paint a believable fake webpage directly onto a 2D canvas context.
     Used by effects that need real pixels to manipulate (shatter, zipper…). */
  function paintPage(ctx, w, h, opts = {}) {
    const accent = opts.accent || "#3355ff";
    const title = opts.title || TITLES[(Math.random() * TITLES.length) | 0];
    ctx.save();
    ctx.fillStyle = opts.bg || "#fbf9f3"; ctx.fillRect(0, 0, w, h);
    const pad = Math.max(40, w * 0.12);
    const cw = w - pad * 2;
    // top bar
    ctx.fillStyle = accent; ctx.font = "bold 15px Segoe UI, sans-serif"; ctx.textBaseline = "top";
    ctx.fillText((opts.brand || "MANSION / WING 7").toUpperCase(), pad, 34);
    ctx.fillStyle = "#14161d"; ctx.font = "600 14px Segoe UI, sans-serif";
    let nx = w - pad;
    ["About", "Archive", "Lab", "Essays", "Home"].forEach(t => { const m = ctx.measureText(t).width; nx -= m + 20; ctx.fillText(t, nx, 34); });
    ctx.strokeStyle = "#14161d"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad, 64); ctx.lineTo(w - pad, 64); ctx.stroke();
    // title
    ctx.fillStyle = "#14161d";
    let ty = 96; const fs = Math.min(52, cw / 12);
    ctx.font = `bold ${fs}px Georgia, serif`;
    ty = wrapCanvas(ctx, title, pad, ty, cw, fs * 1.08);
    ty += 8;
    ctx.fillStyle = "#5a5f6e"; ctx.font = "13px Segoe UI, sans-serif";
    ctx.fillText("By the Resident Architect · " + (3 + (Math.random() * 20 | 0)) + " min read", pad, ty); ty += 34;
    // body lines
    ctx.fillStyle = "#26282f";
    const rng = mulberry(opts.seed || 1);
    for (let i = 0; i < 60 && ty < h - 40; i++) {
      if (i > 0 && i % 9 === 0) { // subhead
        ctx.fillStyle = "#14161d"; ctx.font = "bold 24px Georgia, serif";
        ctx.fillRect(pad, ty + 6, cw * (0.4 + rng() * 0.3), 18); ty += 44; ctx.fillStyle = "#26282f"; continue;
      }
      const lw = cw * (0.7 + rng() * 0.3);
      ctx.fillStyle = "#2a2c34"; ctx.globalAlpha = 0.86;
      roundRectCv(ctx, pad, ty, lw, 11, 4); ctx.fill(); ctx.globalAlpha = 1;
      ty += 22;
      if (i % 5 === 4) ty += 14;
    }
    // button
    ctx.fillStyle = accent; roundRectCv(ctx, pad, Math.min(ty + 6, h - 60), 220, 44, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Segoe UI, sans-serif";
    ctx.fillText("Continue to the next page →", pad + 24, Math.min(ty + 20, h - 46));
    ctx.restore();
  }
  function wrapCanvas(ctx, text, x, y, maxW, lh) {
    const words = text.split(" "); let line = "";
    for (const wd of words) { const t = line + wd + " "; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line.trim(), x, y); line = wd + " "; y += lh; } else line = t; }
    ctx.fillText(line.trim(), x, y); return y + lh;
  }
  function roundRectCv(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function exitToMansion() { try { parent.postMessage({ type: "exit-room" }, "*"); } catch (e) {} }

  function query() {
    const q = {}; new URLSearchParams(location.search).forEach((v, k) => q[k] = v); return q;
  }

  window.MX = { lorem, para, fakeArticle, paintPage, exitToMansion, query, TITLES, WORDS, mulberry };
})();
