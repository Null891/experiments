/* Headless smoke test: serve the project, load every page, collect JS errors. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(p => fs.existsSync(p));

const ROOT = path.resolve(__dirname, "..");
const PORT = 8099;
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".svg":"image/svg+xml" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
});

// sample params for the procedural engine
const SAMPLE = "seed=12345&effect=plasma&color=%2354a0ff&name=Test%20Chamber";

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: "new", executablePath: CHROME,
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

  const expDir = path.join(ROOT, "experiences");
  const files = fs.readdirSync(expDir).filter(f => f.endsWith(".html") && !f.startsWith("_"));
  const targets = [{ name: "index.html (3D hub)", url: `http://localhost:${PORT}/index.html` }];
  for (const f of files) {
    const params = f === "procedural.html" ? `?${SAMPLE}` : "";
    targets.push({ name: "experiences/" + f, url: `http://localhost:${PORT}/experiences/${f}${params}` });
  }

  let pass = 0, fails = [];
  for (const t of targets) {
    const page = await browser.newPage();
    const errs = [];
    page.on("pageerror", e => errs.push("JS: " + e.message.split("\n")[0]));
    page.on("console", m => { if (m.type() === "error") {
      const txt = m.text();
      // ignore expected network noise (external CDNs/APIs) — we only care about our code
      if (/Failed to load resource|net::ERR|qrng\.anu|unpkg\.com.*404|CORS|status of 4|status of 5/i.test(txt)) return;
      errs.push("console.error: " + txt.split("\n")[0]);
    }});
    try {
      await page.goto(t.url, { waitUntil: "load", timeout: 15000 });
      await new Promise(r => setTimeout(r, 1600));        // let animations/timers run
      // nudge interaction-driven pages
      await page.mouse.move(200, 200); await page.mouse.move(400, 350);
      await new Promise(r => setTimeout(r, 400));
    } catch (e) { errs.push("LOAD: " + e.message.split("\n")[0]); }
    await page.close();
    if (errs.length) fails.push({ name: t.name, errs: [...new Set(errs)] });
    else { pass++; }
    process.stdout.write(errs.length ? "X" : ".");
  }
  console.log(`\n\n=== ${pass}/${targets.length} pages clean ===`);
  if (fails.length) { console.log("\nPages with errors:"); for (const f of fails) { console.log("\n• " + f.name); f.errs.slice(0,4).forEach(e => console.log("    " + e)); } }
  await browser.close();
  server.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
