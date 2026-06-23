import * as THREE from "three";

/* ============================ DATA ============================ */
const ALL = globalThis.ROOMS;
const FINALE = ALL.find(r => r.finale);
const ROOMS = ALL.filter(r => !r.finale);        // 74 experience rooms
const COLS = 10, ROWS = Math.ceil(ROOMS.length / COLS);
const SPACING = 11;
const HALF_W = (COLS - 1) * SPACING / 2;
const HALF_H = (ROWS - 1) * SPACING / 2;
const BOUND = 9;
const EYE = 1.7;
const ACTIVATE_DIST = 5.4;
const FINALE_Z = -(HALF_H + 20);                 // dais sits beyond the back row

const visited = new Set();

/* ============================ RENDERER ============================ */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060d, 0.014);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, EYE, HALF_H + 16);

/* gradient sky dome */
const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16),
  new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: {}, depthWrite: false,
    vertexShader: `varying vec3 v; void main(){ v=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 v; void main(){ float h=normalize(v).y*0.5+0.5;
      vec3 top=vec3(0.02,0.03,0.09), bot=vec3(0.06,0.05,0.12);
      gl_FragColor=vec4(mix(bot,top,h),1.0); }` }));
scene.add(sky);

/* stars */
(() => {
  const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3((Math.random()-.5),(Math.random()*.5+.1),(Math.random()-.5)).normalize().multiplyScalar(180+Math.random()*40); p.push(v.x, v.y, v.z); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb0ff, size: 0.7, transparent: true, opacity: 0.7 })));
})();

/* ============================ LIGHTING ============================ */
scene.add(new THREE.AmbientLight(0x39406a, 1.0));
const moon = new THREE.DirectionalLight(0x8aa0ff, 0.45); moon.position.set(20, 40, 10); scene.add(moon);

/* ============================ FLOOR + CEILING ============================ */
function gridTexture() {
  const s = 512, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = "#0a0c16"; g.fillRect(0, 0, s, s);
  g.strokeStyle = "rgba(120,150,255,0.16)"; g.lineWidth = 2;
  for (let i = 0; i <= s; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(50, 50);
  return t;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
  new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.82, metalness: 0.2 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(700, 700),
  new THREE.MeshStandardMaterial({ color: 0x070912, roughness: 1 }));
ceil.rotation.x = Math.PI / 2; ceil.position.y = 10; scene.add(ceil);

/* enclosing walls */
const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b0f1f, roughness: 1, side: THREE.DoubleSide });
[[0, HALF_H + BOUND + 8, 0], [0, FINALE_Z - 16, Math.PI],
 [HALF_W + BOUND + 8, 0, -Math.PI/2], [-(HALF_W + BOUND + 8), 0, Math.PI/2]].forEach(([x,z,r])=>{
  const w = new THREE.Mesh(new THREE.PlaneGeometry(460, 20), wallMat);
  w.position.set(x, 5, z); w.rotation.y = r; scene.add(w);
});

/* floating dust */
(() => {
  const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 600; i++) p.push((Math.random()-.5)*200, Math.random()*9, (Math.random()-.5)*200);
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  const dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x88aaff, size: 0.05, transparent: true, opacity: 0.5 }));
  scene.add(dust); window.__dust = dust;
})();

/* ============================ PORTAL SHADER ============================ */
const portalVert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const portalFrag = `varying vec2 vUv; uniform float uTime; uniform vec3 uColor;
  void main(){ vec2 p=vUv-0.5; float r=length(p); float a=atan(p.y,p.x);
    float swirl=sin(a*4.0+uTime*1.6-r*16.0); float rings=sin(r*26.0-uTime*2.2);
    float glow=smoothstep(0.5,0.06,r); float core=smoothstep(0.16,0.0,r);
    vec3 col=uColor*(0.45+0.55*swirl*0.5+0.35*rings); col+=uColor*core*1.7;
    float alpha=glow*(0.7+0.3*swirl); gl_FragColor=vec4(col,clamp(alpha,0.0,1.0)); }`;

const frameMat = new THREE.MeshStandardMaterial({ color: 0x121627, roughness: 0.45, metalness: 0.7 });
const pillarGeo = new THREE.BoxGeometry(0.32, 4.4, 0.32);
const lintelGeo = new THREE.BoxGeometry(3.0, 0.32, 0.32);
const planeGeo = new THREE.PlaneGeometry(2.4, 3.7);

const portals = [];

function makeLabel(room, gold) {
  const w = 512, h = 168, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(6,8,16,0.6)"; roundRect(g, 4, 4, w-8, h-8, 18); g.fill();
  g.strokeStyle = room.color; g.lineWidth = gold ? 5 : 3; roundRect(g, 4, 4, w-8, h-8, 18); g.stroke();
  g.fillStyle = room.color; g.font = "bold 28px Segoe UI, sans-serif"; g.textAlign = "center";
  g.fillText(gold ? "✦ THE FINALE ✦" : "#" + String(room.id + 1).padStart(2, "0"), w/2, 46);
  g.fillStyle = "#f2f5ff"; g.font = "bold 34px Segoe UI, sans-serif";
  wrapText(g, room.name, w/2, 92, w-60, 38);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.set(gold ? 6.2 : 4.6, gold ? 2.0 : 1.5, 1);
  return spr;
}
function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function wrapText(g,text,x,y,maxW,lh){const words=text.split(" ");let line="",yy=y;for(const wd of words){const t=line+wd+" ";if(g.measureText(t).width>maxW&&line){g.fillText(line.trim(),x,yy);line=wd+" ";yy+=lh;}else line=t;}g.fillText(line.trim(),x,yy);}

function buildPortal(room, x, z, opts = {}) {
  const color = new THREE.Color(room.color);
  const grp = new THREE.Group(); grp.position.set(x, opts.y || 0, z);
  if (opts.rotation !== undefined) grp.rotation.y = opts.rotation;
  const s = opts.scale || 1; grp.scale.setScalar(s);

  const lp = new THREE.Mesh(pillarGeo, frameMat); lp.position.set(-1.36, 2.2, 0);
  const rp = new THREE.Mesh(pillarGeo, frameMat); rp.position.set(1.36, 2.2, 0);
  const lt = new THREE.Mesh(lintelGeo, frameMat); lt.position.set(0, 4.25, 0);
  grp.add(lp, rp, lt);

  const mat = new THREE.ShaderMaterial({ vertexShader: portalVert, fragmentShader: portalFrag,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: Math.random()*10 }, uColor: { value: color.clone() } } });
  const plane = new THREE.Mesh(planeGeo, mat); plane.position.set(0, 2.1, 0.02); grp.add(plane);

  const light = new THREE.PointLight(color.getHex(), opts.finale ? 2.2 : 0.9, opts.finale ? 16 : 9, 2);
  light.position.set(0, 2.2, 0.6); grp.add(light);

  const label = makeLabel(room, opts.finale); label.position.set(0, opts.finale ? 6.0 : 5.4, 0); grp.add(label);

  scene.add(grp);
  portals.push({ plane, mat, pos: new THREE.Vector3(x, 0, z), room, light, group: grp, finale: !!opts.finale, baseScale: s });
  return grp;
}

/* ---- grid of experience rooms ---- */
ROOMS.forEach((room, i) => {
  const col = i % COLS, row = (i / COLS) | 0;
  buildPortal(room, -HALF_W + col * SPACING, -HALF_H + row * SPACING, { rotation: row % 2 === 0 ? 0 : Math.PI });
});

/* ---- the finale dais ---- */
(() => {
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 48),
    new THREE.MeshStandardMaterial({ color: 0x1a150a, metalness: 0.6, roughness: 0.4, emissive: 0x3a2a00, emissiveIntensity: 0.4 }));
  dais.position.set(0, 0.6, FINALE_Z); scene.add(dais);
  buildPortal(FINALE, 0, FINALE_Z, { y: 1.2, scale: 1.7, finale: true });
  // beam of light
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.5, 16, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.set(0, 9, FINALE_Z); scene.add(beam); window.__beam = beam;
})();

/* ============================ INPUT ============================ */
const keys = {};
let yaw = 0, pitch = 0, locked = false;
const SENS = 0.0022;
addEventListener("keydown", e => {
  if (e.code === "Tab") { e.preventDefault(); toggleDirectory(); return; }
  if (e.code === "Escape") {
    if (overlay.classList.contains("show")) { e.preventDefault(); closeOverlay(); return; }
    if (directory.classList.contains("show")) { e.preventDefault(); toggleDirectory(false); return; }
  }
  if (directory.classList.contains("show")) return;   // let the search box have the keyboard
  keys[e.code] = true;
  if (e.code === "KeyE") tryEnter();
  if (e.code === "KeyM") toggleMap();
});
addEventListener("keyup", e => keys[e.code] = false);
canvas.addEventListener("click", () => { if (!overlay.classList.contains("show")) canvas.requestPointerLock(); });
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === canvas; document.body.classList.toggle("locked", locked); });
document.addEventListener("mousemove", e => { if (!locked) return; yaw -= e.movementX*SENS; pitch -= e.movementY*SENS; pitch = Math.max(-1.2, Math.min(1.2, pitch)); });
canvas.addEventListener("mousedown", e => { if (locked && e.button === 0) tryEnter(); });

/* ============================ MOVEMENT ============================ */
const vel = new THREE.Vector3();
const clock = new THREE.Clock();
let near = null;
function updateMovement(dt) {
  const dir = new THREE.Vector3();
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  if (keys.KeyW || keys.ArrowUp) dir.add(fwd);
  if (keys.KeyS || keys.ArrowDown) dir.sub(fwd);
  if (keys.KeyD || keys.ArrowRight) dir.add(right);
  if (keys.KeyA || keys.ArrowLeft) dir.sub(right);
  dir.y = 0; if (dir.lengthSq() > 0) dir.normalize();
  const speed = (keys.ShiftLeft || keys.ShiftRight) ? 22 : 11;
  vel.lerp(dir.multiplyScalar(speed), 1 - Math.pow(0.0001, dt));
  camera.position.addScaledVector(vel, dt);
  const bx = HALF_W + BOUND, bzF = HALF_H + BOUND, bzB = -(FINALE_Z) + 8;
  camera.position.x = Math.max(-bx, Math.min(bx, camera.position.x));
  camera.position.z = Math.max(-bzB, Math.min(bzF, camera.position.z));
  camera.position.y = EYE;
  camera.rotation.set(pitch, yaw, 0, "YXZ");
}

/* ============================ INTERACTION ============================ */
const prompt = document.getElementById("prompt");
function updateNearest() {
  let best = null, bestD = ACTIVATE_DIST;
  for (const p of portals) {
    const reach = p.finale ? ACTIVATE_DIST + 2.5 : ACTIVATE_DIST;
    const d = Math.hypot(camera.position.x - p.pos.x, camera.position.z - p.pos.z);
    p.light.intensity = THREE.MathUtils.lerp(p.light.intensity, d < 14 ? (p.finale ? 2.6 : 1.6) : (p.finale ? 2.0 : 0.7), 0.1);
    if (d < reach && d < bestD + (p.finale ? 2.5 : 0)) { bestD = d; best = p; }
  }
  if (best !== near) {
    near = best;
    if (near) {
      document.documentElement.style.setProperty("--accent", near.room.color);
      prompt.querySelector(".pname").textContent = near.finale ? `✦ ${near.room.name}` : `#${String(near.room.id+1).padStart(2,"0")} · ${near.room.name}`;
      prompt.querySelector(".pblurb").textContent = near.room.blurb;
      prompt.classList.add("show");
    } else { prompt.classList.remove("show"); document.documentElement.style.setProperty("--accent", "#7af0ff"); }
  }
  for (const p of portals) {
    const want = (p === near ? 1.06 : 1.0) * p.baseScale;
    p.group.scale.setScalar(THREE.MathUtils.lerp(p.group.scale.x, want, 0.15));
  }
}

/* ============================ OVERLAY ============================ */
const overlay = document.getElementById("overlay");
const frame = document.getElementById("expframe");
const reveal = document.getElementById("reveal");
document.getElementById("backBtn").addEventListener("click", closeOverlay);
addEventListener("message", e => { if (e.data && e.data.type === "exit-room") closeOverlay(); });

function tryEnter() {
  if (!near || overlay.classList.contains("show")) return;
  const room = near.room;
  if (!room.finale) { visited.add(room.id); updateCounter(); }
  reveal.style.transition = "opacity .35s";
  reveal.style.background = `radial-gradient(circle, ${room.color}, #000 70%)`;
  reveal.style.opacity = "1";
  document.exitPointerLock();
  const loadbar = document.getElementById("loadbar");
  setTimeout(() => {
    let params = room.params || "";
    if (room.finale) params = `seen=${visited.size}`;
    document.documentElement.style.setProperty("--accent", room.color);
    loadbar.classList.add("go"); loadbar.style.width = "70%";
    frame.onload = () => { loadbar.style.width = "100%"; setTimeout(() => { loadbar.classList.remove("go"); loadbar.style.width = "0"; }, 350); };
    frame.src = `experiences/${room.page}` + (params ? `?${params}` : "");
    document.getElementById("overlayTitle").textContent = room.finale ? `✦ ${room.name}` : `#${String(room.id+1).padStart(2,"0")} · ${room.name}`;
    overlay.classList.add("show");
    reveal.style.opacity = "0";
  }, 360);
}
function closeOverlay() { overlay.classList.remove("show"); frame.src = "about:blank"; reveal.style.opacity = "0"; }

/* ============================ MINIMAP (with click-to-teleport) ============================ */
const mm = document.getElementById("minimap"), mg = mm.getContext("2d");
const mmWrap = document.getElementById("minimapWrap");
let mapOn = true;
function toggleMap() { mapOn = !mapOn; mmWrap.style.display = mapOn ? "block" : "none"; }
function teleportTo(p) {
  const dir = new THREE.Vector3(-p.pos.x, 0, -p.pos.z); if (dir.lengthSq() < 0.01) dir.set(0, 0, 1); dir.normalize();
  camera.position.set(p.pos.x + dir.x * 6, EYE, p.pos.z + dir.z * 6);
  yaw = Math.atan2(camera.position.x - p.pos.x, camera.position.z - p.pos.z); pitch = 0;
}
const MM_PAD = 12;
function mmScale() { const W = mm.width, H = mm.height; return { sx:(W-MM_PAD*2)/(HALF_W*2+8), sy:(H-MM_PAD*2)/((HALF_H+ (-FINALE_Z))+8) }; }
function toMM(x, z) { const {sx,sy} = mmScale(); return { x: MM_PAD+(x+HALF_W+4)*sx, y: MM_PAD+(z+(-FINALE_Z)+4)*sy }; }
function fromMM(px, pz) { const {sx,sy} = mmScale(); return { x:(px-MM_PAD)/sx - HALF_W - 4, z:(pz-MM_PAD)/sy - (-FINALE_Z) - 4 }; }
function drawMap() {
  if (!mapOn) return;
  mg.clearRect(0, 0, mm.width, mm.height);
  for (const p of portals) {
    const q = toMM(p.pos.x, p.pos.z);
    if (p.finale) { mg.fillStyle = "#ffd86b"; mg.beginPath(); mg.arc(q.x, q.y, 4.5, 0, 7); mg.fill();
      mg.strokeStyle = "#fff7d8"; mg.beginPath(); mg.arc(q.x, q.y, 7, 0, 7); mg.stroke(); continue; }
    const seen = visited.has(p.room.id);
    mg.fillStyle = p === near ? "#ffffff" : p.room.color;
    mg.globalAlpha = seen ? 1 : 0.45;
    mg.beginPath(); mg.arc(q.x, q.y, p === near ? 4 : 2.4, 0, 7); mg.fill();
    if (seen) { mg.globalAlpha = 0.9; mg.strokeStyle = "#fff"; mg.lineWidth = 0.6; mg.stroke(); }
  }
  mg.globalAlpha = 1;
  const pp = toMM(camera.position.x, camera.position.z);
  mg.fillStyle = "#7af0ff";
  mg.beginPath();
  mg.moveTo(pp.x + Math.sin(yaw)*7, pp.y + Math.cos(yaw)*7);
  mg.lineTo(pp.x + Math.sin(yaw+2.4)*5, pp.y + Math.cos(yaw+2.4)*5);
  mg.lineTo(pp.x + Math.sin(yaw-2.4)*5, pp.y + Math.cos(yaw-2.4)*5);
  mg.closePath(); mg.fill();
}
mm.addEventListener("click", e => {
  const r = mm.getBoundingClientRect();
  const px = (e.clientX - r.left) * (mm.width / r.width);
  const pz = (e.clientY - r.top) * (mm.height / r.height);
  const w = fromMM(px, pz);
  let best = null, bd = 1e9;
  for (const p of portals) { const d = Math.hypot(p.pos.x - w.x, p.pos.z - w.z); if (d < bd) { bd = d; best = p; } }
  if (best) teleportTo(best);
});

/* ============================ ROOM DIRECTORY (command palette) ============================ */
const directory = document.getElementById("directory");
const dirList = document.getElementById("dirList");
const dirSearch = document.getElementById("dirSearch");
document.getElementById("dirBtn").addEventListener("click", () => toggleDirectory());
function buildDirectory(filter = "") {
  const f = filter.trim().toLowerCase();
  dirList.innerHTML = "";
  const rows = ALL.filter(r => !f || r.name.toLowerCase().includes(f) || (r.blurb || "").toLowerCase().includes(f));
  if (!rows.length) { dirList.innerHTML = `<div class="dir-empty">No rooms match “${filter}”.</div>`; return; }
  for (const r of rows) {
    const card = document.createElement("div");
    card.className = "dir-card" + (r.finale ? " finale" : "");
    card.innerHTML = `<span class="dot" style="color:${r.color}"></span><div class="meta">
      <div class="rn">${r.finale ? "✦ FINALE" : "#" + String(r.id + 1).padStart(2, "0")}${visited.has(r.id) ? " · visited ✓" : ""}</div>
      <div class="rt">${r.name}</div><div class="rb">${r.blurb || ""}</div></div>`;
    card.addEventListener("click", () => {
      const p = portals.find(pp => pp.room.id === r.id);
      if (p) teleportTo(p);
      toggleDirectory(false);
      canvas.requestPointerLock();
    });
    dirList.appendChild(card);
  }
}
function toggleDirectory(force) {
  const show = force === undefined ? !directory.classList.contains("show") : force;
  directory.classList.toggle("show", show);
  if (show) { document.exitPointerLock(); buildDirectory(dirSearch.value); setTimeout(() => dirSearch.focus(), 30); }
}
dirSearch.addEventListener("input", () => buildDirectory(dirSearch.value));
dirSearch.addEventListener("keydown", e => {
  if (e.code === "Enter") { const first = dirList.querySelector(".dir-card"); if (first) first.click(); }
  e.stopPropagation();
});
directory.addEventListener("click", e => { if (e.target === directory) toggleDirectory(false); });

/* ============================ HUD ============================ */
function updateCounter() {
  document.getElementById("counter").innerHTML =
    `${ROOMS.length} EXPERIENCES · EXPLORED <span class="pct">${visited.size}/${ROOMS.length}</span>` +
    (visited.size === ROOMS.length ? ` · <span class="pct">✦ THE FINALE AWAKENS</span>` : "");
}
updateCounter();
document.getElementById("enterBtn").addEventListener("click", () => { document.getElementById("splash").style.display = "none"; canvas.requestPointerLock(); });

/* ============================ BLOOM (optional) ============================ */
let composer = null;
try {
  const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
  const { RenderPass } = await import("three/addons/postprocessing/RenderPass.js");
  const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.55));
} catch (e) { composer = null; }

/* ============================ LOOP ============================ */
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  for (const p of portals) p.mat.uniforms.uTime.value = t + p.pos.x;
  const allSeen = visited.size === ROOMS.length;
  if (window.__beam) { window.__beam.material.opacity = 0.05 + Math.sin(t*1.5)*0.02 + (allSeen ? 0.08 : 0); window.__beam.rotation.y += dt*0.2; }
  if (window.__dust) window.__dust.rotation.y += dt * 0.01;
  if (locked) updateMovement(dt);
  updateNearest();
  drawMap();
  if (composer) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
});
