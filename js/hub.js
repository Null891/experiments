import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* ===================================================================
   THE MANSION — a walkable modern-Italian-minimalist building.
   Rooms are real enclosed spaces off gallery corridors; you physically
   walk through doorways (with collision) and approach each room's
   display to enter its experience.
   =================================================================== */

/* ---------------- data ---------------- */
const ALL = globalThis.ROOMS;
const FINALE = ALL.find(r => r.finale);
const ROOMS = ALL.filter(r => !r.finale);            // 74 experience rooms

/* ---------------- layout ---------------- */
const ROOM_W = 8.4, ROOM_D = 7.0, H = 4.2, T = 0.18, DOOR_W = 2.8;
const PER_SIDE = 6;                                   // rooms per side of a gallery
const CORR = 6.0;                                     // gallery corridor width
const BACK_GAP = 0.6;                                 // gap behind back-to-back rooms
const STRIP_PITCH = 2 * ROOM_D + CORR + BACK_GAP;
const BLOCK_W = PER_SIDE * ROOM_W;
const SPINE_W = 7.0;
const SPINE_X = -BLOCK_W / 2 - SPINE_W / 2;           // spine corridor centre (left side)
const SPINE_WALL_X = -BLOCK_W / 2 - SPINE_W;          // outer wall of spine
const RIGHT_X = BLOCK_W / 2 + 0.4;
const EYE = 1.65, PLAYER_R = 0.42;
const ACTIVATE = 4.2;
const stripCount = Math.ceil(ROOMS.length / (PER_SIDE * 2));
const colX = c => -BLOCK_W / 2 + ROOM_W / 2 + c * ROOM_W;
const visited = new Set();

/* ---------------- renderer ---------------- */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe7e1d6);
scene.fog = new THREE.Fog(0xe7e1d6, 36, 96);

const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.05, 400);

/* image-based lighting for soft realistic PBR */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scene.add(new THREE.HemisphereLight(0xfff6e8, 0x4a4034, 0.5));
const sun = new THREE.DirectionalLight(0xffe7c4, 0.75);
sun.position.set(-30, 40, 20); scene.add(sun);
const fill = new THREE.DirectionalLight(0xbfd0ff, 0.18);
fill.position.set(20, 20, -20); scene.add(fill);

/* ---------------- materials (Italian minimalist palette) ---------------- */
function speckle(base, spots, sc) {
  const s = 512, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) { g.fillStyle = spots[(Math.random()*spots.length)|0]; const r = Math.random()*2.2;
    g.globalAlpha = 0.5 + Math.random()*0.5; g.beginPath(); g.arc(Math.random()*s, Math.random()*s, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // faint veining
  g.strokeStyle = "rgba(150,135,110,0.12)"; g.lineWidth = 1;
  for (let i = 0; i < 24; i++) { g.beginPath(); let x = Math.random()*s, y = Math.random()*s; g.moveTo(x,y);
    for (let k=0;k<6;k++){ x += (Math.random()-.5)*120; y += (Math.random()-.5)*120; g.lineTo(x,y);} g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(sc, sc);
  t.colorSpace = THREE.SRGBColorSpace; return t;
}
const travertine = speckle("#cdc0a8", ["#bdae92","#d8ccb4","#c4b496","#e0d6bf"], 8);
const matFloor   = new THREE.MeshStandardMaterial({ map: travertine, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.7 });
const matPlaster = new THREE.MeshStandardMaterial({ color: 0xeae4d9, roughness: 0.96, metalness: 0.0 });
const matWood    = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.5 });
const matCeil    = new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: 1.0, metalness: 0.0 });
const matBrass   = new THREE.MeshStandardMaterial({ color: 0xc69a5a, roughness: 0.32, metalness: 1.0, envMapIntensity: 1.0 });
const matStone   = new THREE.MeshStandardMaterial({ map: speckle("#d9d2c4",["#cfc6b4","#e6dfce"],3), roughness: 0.55, metalness: 0.0 });
const matLight   = new THREE.MeshStandardMaterial({ color: 0xfff0d8, emissive: 0xfff0d8, emissiveIntensity: 1.1, roughness: 1 });
const matBench   = new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 0.7 });

/* ---------------- geometry collectors ---------------- */
const plasterGeos = [], woodGeos = [], plinthGeos = [], frameGeos = [], stripGeos = [], benchGeos = [];
const walls = [];   // collision AABBs {minx,maxx,minz,maxz}
const displays = []; // {mesh, room, pos, center, finale}

function box(arr, cx, cy, cz, sx, sy, sz, solid) {
  const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(cx, cy, cz); arr.push(g);
  if (solid) walls.push({ minx: cx-sx/2, maxx: cx+sx/2, minz: cz-sz/2, maxz: cz+sz/2 });
}

/* display panel canvas (restrained, gallery-label style) */
function panelTexture(room, gold) {
  const w = 1024, h = 660, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = gold ? "#1c1a14" : "#f5f1e8"; g.fillRect(0, 0, w, h);
  const ink = gold ? "#f0e2bf" : "#2a2620", sub = gold ? "#bda268" : "#9a8b6f";
  g.fillStyle = sub; g.font = "500 30px 'Space Grotesk',sans-serif"; g.textAlign = "center";
  g.fillText(gold ? "THE FINALE" : "ROOM " + String(room.id + 1).padStart(2, "0"), w/2, 96);
  g.strokeStyle = room.color; g.lineWidth = 5; g.beginPath(); g.moveTo(w/2-60, 122); g.lineTo(w/2+60, 122); g.stroke();
  g.fillStyle = ink; g.font = "600 62px Georgia,serif";
  const words = room.name.split(" "); let line = "", yy = 250; const lines = [];
  for (const wd of words) { const tt = line + wd + " "; if (g.measureText(tt).width > w-140 && line) { lines.push(line.trim()); line = wd + " "; } else line = tt; }
  lines.push(line.trim());
  const startY = 250 - (lines.length-1)*38; lines.forEach((l,i)=>g.fillText(l, w/2, startY + i*74));
  g.fillStyle = sub; g.font = "italic 26px Georgia,serif";
  const blurb = room.blurb || ""; let bl = "", by = 470; const bls = [];
  for (const wd of blurb.split(" ")) { const tt = bl + wd + " "; if (g.measureText(tt).width > w-160 && bl) { bls.push(bl.trim()); bl = wd + " "; } else bl = tt; if (bls.length>=2) break; }
  if (bls.length<2) bls.push(bl.trim());
  bls.slice(0,2).forEach((l,i)=>g.fillText(l, w/2, by + i*34));
  g.fillStyle = room.color; g.font = "700 26px 'Space Grotesk',sans-serif";
  g.fillText("ENTER  →", w/2, h-46);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* build one room */
const occupied = new Set();
function placeRoom(room, cx, cz, f, rowIdx, c) {
  occupied.add(rowIdx + "_" + c);
  const backZ = cz - f * ROOM_D/2, frontZ = cz + f * ROOM_D/2;
  // back wall = walnut accent (behind the display)
  box(woodGeos, cx, H/2, backZ, ROOM_W, H, T, true);
  // right wall always; left only if no left neighbour
  box(plasterGeos, cx + ROOM_W/2, H/2, cz, T, H, ROOM_D, true);
  if (!occupied.has(rowIdx + "_" + (c-1))) box(plasterGeos, cx - ROOM_W/2, H/2, cz, T, H, ROOM_D, true);
  // front wall with doorway gap
  const seg = (ROOM_W - DOOR_W) / 2;
  box(plasterGeos, cx - (DOOR_W/2 + seg/2), H/2, frontZ, seg, H, T, true);
  box(plasterGeos, cx + (DOOR_W/2 + seg/2), H/2, frontZ, seg, H, T, true);
  box(plasterGeos, cx, H - 0.45, frontZ, DOOR_W, 0.9, T, false); // lintel over door (no collision)

  // display on the back wall
  const innerZ = backZ + f * (T/2 + 0.02);
  const tex = panelTexture(room, false);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.25), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  panel.position.set(cx, 1.95, innerZ); panel.rotation.y = f > 0 ? 0 : Math.PI; scene.add(panel);
  box(frameGeos, cx, 1.95, backZ + f*0.03, 3.74, 2.49, 0.06, false); // brass frame
  box(stripGeos, cx, 3.45, backZ + f*0.5, 2.6, 0.06, 0.12, false);   // picture light
  // plinth + brass object
  const plinthZ = cz - f*(ROOM_D/2 - 1.9);
  box(plinthGeos, cx, 0.45, plinthZ, 1.2, 0.9, 0.9, false);
  if ((room.id % 3) === 0) { const sph = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), matBrass); sph.position.set(cx, 1.18, plinthZ); scene.add(sph); }
  else if ((room.id % 3) === 1) { const tor = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 16, 40), matBrass); tor.position.set(cx, 1.2, plinthZ); tor.rotation.x = 1; scene.add(tor); }

  displays.push({ room, pos: new THREE.Vector3(cx, 1.95, innerZ), center: new THREE.Vector3(cx, 0, cz), door: { x: cx, z: frontZ + f*1.7, yaw: f > 0 ? 0 : Math.PI }, finale: false });
}

/* ---- lay out the rooms ---- */
let idx = 0;
let minZ = 0, maxZ = 0;
for (let s = 0; s < stripCount; s++) {
  const Cz = s * STRIP_PITCH;
  for (let c = 0; c < PER_SIDE && idx < ROOMS.length; c++) placeRoom(ROOMS[idx++], colX(c), Cz - CORR/2 - ROOM_D/2, +1, s*2, c);
  for (let c = 0; c < PER_SIDE && idx < ROOMS.length; c++) placeRoom(ROOMS[idx++], colX(c), Cz + CORR/2 + ROOM_D/2, -1, s*2+1, c);
  minZ = Math.min(minZ, Cz - CORR/2 - ROOM_D);
  maxZ = Math.max(maxZ, Cz + CORR/2 + ROOM_D);
}

/* ---- finale: a grand room at the end of the spine ---- */
const FIN_Z = maxZ + 11, FIN_W = 16, FIN_D = 13;
(function buildFinale() {
  const cx = SPINE_X, cz = FIN_Z, f = -1;                 // door faces -z (back toward spine)
  box(woodGeos, cx, H/2+0.4, cz + FIN_D/2, FIN_W, H+0.8, T, true);     // far wall
  box(plasterGeos, cx - FIN_W/2, H/2+0.4, cz, T, H+0.8, FIN_D, true);
  box(plasterGeos, cx + FIN_W/2, H/2+0.4, cz, T, H+0.8, FIN_D, true);
  const seg = (FIN_W - 4) / 2;
  box(plasterGeos, cx - (2+seg/2), H/2+0.4, cz - FIN_D/2, seg, H+0.8, T, true);
  box(plasterGeos, cx + (2+seg/2), H/2+0.4, cz - FIN_D/2, seg, H+0.8, T, true);
  // gold dais
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.5, 48), matStone); dais.position.set(cx, 0.25, cz+1.5); scene.add(dais);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.06, 16, 64), matBrass); ring.position.set(cx, 0.52, cz+1.5); ring.rotation.x = Math.PI/2; scene.add(ring);
  // big gold-accented display
  const tex = panelTexture(FINALE, true);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.3), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  panel.position.set(cx, 2.4, cz + FIN_D/2 - 0.12); panel.rotation.y = Math.PI; scene.add(panel);
  box(frameGeos, cx, 2.4, cz + FIN_D/2 - 0.05, 5.5, 3.6, 0.08, false);
  const fl = new THREE.PointLight(0xffcf7a, 6, 18, 2); fl.position.set(cx, 4, cz+1.5); scene.add(fl);
  // a soft beam
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3.0, H+0.8, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.set(cx, (H)/2+0.4, cz+1.5); scene.add(beam); window.__beam = beam;
  displays.push({ room: FINALE, pos: new THREE.Vector3(cx, 2.4, cz + FIN_D/2 - 0.12), center: new THREE.Vector3(cx, 0, cz),
    door: { x: cx, z: cz - FIN_D/2 - 2.5, yaw: Math.PI }, finale: true });
  maxZ = cz + FIN_D/2;
})();

/* ---- perimeter shell, spine, floors, ceiling, windows ---- */
const padZ0 = minZ - 3, padZ1 = maxZ + 3;
const totalZ = padZ1 - padZ0, midZ = (padZ0 + padZ1) / 2;
const xMin = SPINE_WALL_X, xMax = RIGHT_X;
// perimeter walls
box(plasterGeos, xMin - 0.0, H/2, midZ, T, H, totalZ, true);          // left (spine outer) — windows added as decor
box(plasterGeos, xMax, H/2, midZ, T, H, totalZ, true);               // right
box(plasterGeos, (xMin+xMax)/2, H/2, padZ0, (xMax-xMin), H, T, true);// near end
box(plasterGeos, (xMin+xMax)/2, H/2, padZ1, (xMax-xMin), H, T, true);// far end

// floor + ceiling spanning the whole footprint
const floorW = xMax - xMin + 1;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorW, totalZ + 2), matFloor);
floor.rotation.x = -Math.PI/2; floor.position.set((xMin+xMax)/2, 0, midZ);
matFloor.map.repeat.set(floorW/3, (totalZ)/3); scene.add(floor);
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(floorW, totalZ + 2), matCeil);
ceiling.rotation.x = Math.PI/2; ceiling.position.set((xMin+xMax)/2, H, midZ); scene.add(ceiling);

// recessed ceiling light strips running along each gallery
for (let s = 0; s < stripCount; s++) box(stripGeos, (xMin+xMax)/2, H-0.04, s*STRIP_PITCH, BLOCK_W + SPINE_W, 0.06, 0.4, false);
// spine light strip
box(stripGeos, SPINE_X, H-0.04, midZ, 0.4, 0.06, totalZ-2, false);

// tall windows + warm sky beyond on the spine's outer wall
const skyGeoZ = totalZ - 4;
const skyMat = new THREE.MeshBasicMaterial({ color: 0xd9c198 });
const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(skyGeoZ, H-0.6), skyMat);
skyPlane.rotation.y = Math.PI/2; skyPlane.position.set(xMin - 0.3, (H)/2, midZ); scene.add(skyPlane);
// brass window mullions in front of the sky
for (let z = padZ0+2; z <= padZ1-2; z += 2.2) box(frameGeos, xMin + 0.05, H/2, z, 0.08, H-0.6, 0.1, false);
box(frameGeos, xMin + 0.05, H-0.55, midZ, 0.12, 0.12, skyGeoZ, false);
box(frameGeos, xMin + 0.05, 0.35, midZ, 0.12, 0.12, skyGeoZ, false);

// a long bench down the spine
box(benchGeos, SPINE_X, 0.25, midZ, 0.9, 0.5, 6, false);

/* ---- merge static geometry into few draw calls ---- */
function addMerged(geos, mat) { if (!geos.length) return; const m = new THREE.Mesh(mergeGeometries(geos), mat); scene.add(m); }
addMerged(plasterGeos, matPlaster);
addMerged(woodGeos, matWood);
addMerged(plinthGeos, matStone);
addMerged(frameGeos, matBrass);
addMerged(stripGeos, matLight);
addMerged(benchGeos, matBench);

/* ============================ INPUT ============================ */
const keys = {};
let yaw = -Math.PI / 2 - 0.5, pitch = -0.04, locked = false;  // gallery mouth, angled down the hall toward the rooms
const SENS = 0.0022;
camera.position.set(SPINE_X + 0.5, EYE, 1.2);
addEventListener("keydown", e => {
  if (e.code === "Tab") { e.preventDefault(); toggleDirectory(); return; }
  if (e.code === "Escape") {
    if (overlay.classList.contains("show")) { e.preventDefault(); closeOverlay(); return; }
    if (directory.classList.contains("show")) { e.preventDefault(); toggleDirectory(false); return; }
  }
  if (directory.classList.contains("show")) return;
  keys[e.code] = true;
  if (e.code === "KeyE") tryEnter();
  if (e.code === "KeyM") toggleMap();
});
addEventListener("keyup", e => keys[e.code] = false);
canvas.addEventListener("click", () => { if (!overlay.classList.contains("show")) canvas.requestPointerLock(); });
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === canvas; document.body.classList.toggle("locked", locked); });
document.addEventListener("mousemove", e => { if (!locked) return; yaw -= e.movementX*SENS; pitch -= e.movementY*SENS; pitch = Math.max(-1.2, Math.min(1.2, pitch)); });
canvas.addEventListener("mousedown", e => { if (locked && e.button === 0) tryEnter(); });

/* ============================ MOVEMENT + COLLISION ============================ */
const vel = new THREE.Vector3();
const clock = new THREE.Clock();
let near = null;
function collide(px, pz) {
  for (let pass = 0; pass < 2; pass++) for (const w of walls) {
    const cx = Math.max(w.minx, Math.min(px, w.maxx)), cz = Math.max(w.minz, Math.min(pz, w.maxz));
    let dx = px - cx, dz = pz - cz, d2 = dx*dx + dz*dz;
    if (d2 < PLAYER_R*PLAYER_R) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); const push = PLAYER_R - d; px += dx/d*push; pz += dz/d*push; }
      else { const l = px-w.minx, r = w.maxx-px, t = pz-w.minz, b = w.maxz-pz, m = Math.min(l,r,t,b);
        if (m===l) px = w.minx-PLAYER_R; else if (m===r) px = w.maxx+PLAYER_R; else if (m===t) pz = w.minz-PLAYER_R; else pz = w.maxz+PLAYER_R; }
    }
  }
  return [px, pz];
}
function updateMovement(dt) {
  const dir = new THREE.Vector3();
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  if (keys.KeyW || keys.ArrowUp) dir.add(fwd);
  if (keys.KeyS || keys.ArrowDown) dir.sub(fwd);
  if (keys.KeyD || keys.ArrowRight) dir.add(right);
  if (keys.KeyA || keys.ArrowLeft) dir.sub(right);
  dir.y = 0; if (dir.lengthSq() > 0) dir.normalize();
  const speed = (keys.ShiftLeft || keys.ShiftRight) ? 11 : 6.2;
  vel.lerp(dir.multiplyScalar(speed), 1 - Math.pow(0.0001, dt));
  let nx = camera.position.x + vel.x*dt, nz = camera.position.z + vel.z*dt;
  [nx, nz] = collide(nx, nz);
  camera.position.set(nx, EYE, nz);
  camera.rotation.set(pitch, yaw, 0, "YXZ");
}

/* ============================ INTERACTION ============================ */
const prompt = document.getElementById("prompt");
function updateNearest() {
  let best = null, bestD = ACTIVATE;
  for (const d of displays) {
    const dist = camera.position.distanceTo(d.pos);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  if (best !== near) {
    near = best;
    if (near) {
      document.documentElement.style.setProperty("--accent", near.room.color);
      prompt.querySelector(".pname").textContent = near.finale ? `✦ ${near.room.name}` : `#${String(near.room.id+1).padStart(2,"0")} · ${near.room.name}`;
      prompt.querySelector(".pblurb").textContent = near.room.blurb;
      prompt.classList.add("show");
    } else { prompt.classList.remove("show"); document.documentElement.style.setProperty("--accent", "#c69a5a"); }
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
    let params = room.params || ""; if (room.finale) params = `seen=${visited.size}`;
    document.documentElement.style.setProperty("--accent", room.color);
    loadbar.classList.add("go"); loadbar.style.width = "70%";
    frame.onload = () => { loadbar.style.width = "100%"; setTimeout(() => { loadbar.classList.remove("go"); loadbar.style.width = "0"; }, 350); };
    frame.src = `experiences/${room.page}` + (params ? `?${params}` : "");
    document.getElementById("overlayTitle").textContent = room.finale ? `✦ ${room.name}` : `#${String(room.id+1).padStart(2,"0")} · ${room.name}`;
    overlay.classList.add("show"); reveal.style.opacity = "0";
  }, 360);
}
function closeOverlay() { overlay.classList.remove("show"); frame.src = "about:blank"; reveal.style.opacity = "0"; }

/* ============================ MINIMAP (floor plan) ============================ */
const mm = document.getElementById("minimap"), mg = mm.getContext("2d");
const mmWrap = document.getElementById("minimapWrap");
let mapOn = true;
function toggleMap() { mapOn = !mapOn; mmWrap.style.display = mapOn ? "block" : "none"; }
const PB = { x0: xMin-2, x1: xMax+2, z0: padZ0-2, z1: padZ1+2 };
function planScale() { return Math.min((mm.width-16)/(PB.x1-PB.x0), (mm.height-16)/(PB.z1-PB.z0)); }
function toMM(x, z) { const s = planScale(); return { x: 8 + (x-PB.x0)*s, y: 8 + (z-PB.z0)*s }; }
function teleportToDisplay(d) {
  camera.position.set(d.door.x, EYE, d.door.z); yaw = d.door.yaw; pitch = 0; vel.set(0,0,0);
}
function drawMap() {
  if (!mapOn) return;
  mg.clearRect(0, 0, mm.width, mm.height);
  const s = planScale();
  mg.fillStyle = "rgba(40,36,30,0.35)"; mg.fillRect(toMM(PB.x0,PB.z0).x, toMM(PB.x0,PB.z0).y, (PB.x1-PB.x0)*s, (PB.z1-PB.z0)*s);
  for (const d of displays) {
    const a = toMM(d.center.x - (d.finale?8:ROOM_W/2), d.center.z - (d.finale?6.5:ROOM_D/2));
    const w = (d.finale?16:ROOM_W)*s, h = (d.finale?13:ROOM_D)*s;
    const seen = visited.has(d.room.id);
    mg.fillStyle = d.finale ? "rgba(255,210,120,0.5)" : (seen ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.10)");
    mg.fillRect(a.x, a.y, w, h);
    mg.fillStyle = d.room.color; mg.globalAlpha = (d === near) ? 1 : 0.85;
    const cc = toMM(d.center.x, d.center.z); mg.beginPath(); mg.arc(cc.x, cc.y, d===near?3.4:2, 0, 7); mg.fill(); mg.globalAlpha = 1;
  }
  const p = toMM(camera.position.x, camera.position.z);
  mg.fillStyle = "#c69a5a";
  mg.beginPath();
  mg.moveTo(p.x + Math.sin(yaw)*6, p.y + Math.cos(yaw)*6);
  mg.lineTo(p.x + Math.sin(yaw+2.4)*4.5, p.y + Math.cos(yaw+2.4)*4.5);
  mg.lineTo(p.x + Math.sin(yaw-2.4)*4.5, p.y + Math.cos(yaw-2.4)*4.5);
  mg.closePath(); mg.fill();
}
mm.addEventListener("click", e => {
  const r = mm.getBoundingClientRect();
  const mx = (e.clientX-r.left)*(mm.width/r.width), my = (e.clientY-r.top)*(mm.height/r.height);
  const s = planScale(); const wx = (mx-8)/s + PB.x0, wz = (my-8)/s + PB.z0;
  let best = null, bd = 1e9; for (const d of displays) { const dd = Math.hypot(d.center.x-wx, d.center.z-wz); if (dd<bd){bd=dd;best=d;} }
  if (best) teleportToDisplay(best);
});

/* ============================ ROOM DIRECTORY ============================ */
const directory = document.getElementById("directory");
const dirList = document.getElementById("dirList");
const dirSearch = document.getElementById("dirSearch");
document.getElementById("dirBtn").addEventListener("click", () => toggleDirectory());
function buildDirectory(filter = "") {
  const f = filter.trim().toLowerCase(); dirList.innerHTML = "";
  const rows = ALL.filter(r => !f || r.name.toLowerCase().includes(f) || (r.blurb||"").toLowerCase().includes(f));
  if (!rows.length) { dirList.innerHTML = `<div class="dir-empty">No rooms match “${filter}”.</div>`; return; }
  for (const r of rows) {
    const card = document.createElement("div");
    card.className = "dir-card" + (r.finale ? " finale" : "");
    card.innerHTML = `<span class="dot" style="color:${r.color}"></span><div class="meta">
      <div class="rn">${r.finale ? "✦ FINALE" : "#"+String(r.id+1).padStart(2,"0")}${visited.has(r.id)?" · visited ✓":""}</div>
      <div class="rt">${r.name}</div><div class="rb">${r.blurb||""}</div></div>`;
    card.addEventListener("click", () => { const d = displays.find(dd => dd.room.id === r.id); if (d) teleportToDisplay(d); toggleDirectory(false); canvas.requestPointerLock(); });
    dirList.appendChild(card);
  }
}
function toggleDirectory(force) {
  const show = force === undefined ? !directory.classList.contains("show") : force;
  directory.classList.toggle("show", show);
  if (show) { document.exitPointerLock(); buildDirectory(dirSearch.value); setTimeout(() => dirSearch.focus(), 30); }
}
dirSearch.addEventListener("input", () => buildDirectory(dirSearch.value));
dirSearch.addEventListener("keydown", e => { if (e.code === "Enter") { const fc = dirList.querySelector(".dir-card"); if (fc) fc.click(); } e.stopPropagation(); });
directory.addEventListener("click", e => { if (e.target === directory) toggleDirectory(false); });

/* ============================ HUD ============================ */
function updateCounter() {
  document.getElementById("counter").innerHTML =
    `${ROOMS.length} ROOMS · EXPLORED <span class="pct">${visited.size}/${ROOMS.length}</span>` +
    (visited.size === ROOMS.length ? ` · <span class="pct">✦ THE FINALE AWAITS</span>` : "");
}
updateCounter();
document.getElementById("enterBtn").addEventListener("click", () => { document.getElementById("splash").style.display = "none"; canvas.requestPointerLock(); });

/* ============================ BLOOM (subtle) ============================ */
let composer = null;
try {
  const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
  const { RenderPass } = await import("three/addons/postprocessing/RenderPass.js");
  const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.55, 0.92));
} catch (e) { composer = null; }

/* ============================ LOOP ============================ */
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (window.__beam) window.__beam.material.opacity = 0.045 + Math.sin(clock.elapsedTime*1.5)*0.02 + (visited.size===ROOMS.length?0.06:0);
  if (locked) updateMovement(dt);
  updateNearest();
  drawMap();
  if (composer) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
addEventListener("resize", () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); if (composer) composer.setSize(innerWidth, innerHeight);
});
