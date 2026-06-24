import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* ===================================================================
   THE MANSION — a walkable, blended Roman/Victorian building.
   Marble, fluted columns, round arches, coffered ceilings, crown
   molding, crystal chandeliers, velvet drapery, urns and frescoes.
   Real wall collision, cinematic interact-to-teleport, SSAO + bloom
   + depth-of-field post-processing, GLSL dust motes.
   =================================================================== */

/* ---------------- data ---------------- */
const ALL = globalThis.ROOMS;
const FINALE = ALL.find(r => r.finale);
const ROOMS = ALL.filter(r => !r.finale);
const ROOM_W = 8.6, ROOM_D = 7.2, H = 4.6, T = 0.2, DOOR_W = 2.9;
const PER_SIDE = 6, CORR = 6.4, BACK_GAP = 0.6;
const STRIP_PITCH = 2 * ROOM_D + CORR + BACK_GAP;
const BLOCK_W = PER_SIDE * ROOM_W, SPINE_W = 7.4;
const SPINE_X = -BLOCK_W / 2 - SPINE_W / 2, SPINE_WALL_X = -BLOCK_W / 2 - SPINE_W, RIGHT_X = BLOCK_W / 2 + 0.4;
const EYE = 1.65, PLAYER_R = 0.42, ACTIVATE = 4.4;
const stripCount = Math.ceil(ROOMS.length / (PER_SIDE * 2));
const colX = c => -BLOCK_W / 2 + ROOM_W / 2 + c * ROOM_W;
const visited = new Set();
const timeMats = [];   // materials whose shaders animate over time

/* ---------------- renderer ---------------- */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e2d4);
scene.fog = new THREE.Fog(0xe9e2d4, 40, 110);
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.05, 500);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xfff4e6, 0x47402f, 0.45));
const sun = new THREE.DirectionalLight(0xffe6bf, 1.1); sun.position.set(-34, 44, 16); scene.add(sun);
const fill = new THREE.DirectionalLight(0xc8d6ff, 0.18); fill.position.set(24, 18, -22); scene.add(fill);

/* ---------------- procedural textures ---------------- */
function hexRGB(h){ return [(h>>16)&255,(h>>8)&255,h&255]; }
function vhash(x,y){ const n = Math.sin(x*127.1 + y*311.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x,y){ const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=vhash(xi,yi),b=vhash(xi+1,yi),c=vhash(xi,yi+1),d=vhash(xi+1,yi+1);
  return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v; }
function fbm(x,y){ let s=0,a=0.5,f=1; for(let i=0;i<4;i++){ s+=a*vnoise(x*f,y*f); f*=2; a*=0.5; } return s; }
function marbleTexture(base, vein, scale, rep) {
  const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d"), id = g.createImageData(S, S), px = id.data;
  const bc = hexRGB(base), vc = hexRGB(vein);
  for (let y=0;y<S;y++) for (let x=0;x<S;x++){
    const nx=x/S*scale, ny=y/S*scale, turb=fbm(nx,ny);
    let m=Math.abs(Math.sin((nx+ny)*1.4 + turb*4.5)); const t=Math.pow(1-Math.min(1,m),1.6);
    const grain=(vhash(x*0.27,y*0.61)-0.5)*10, i=(y*S+x)*4;
    px[i]  =Math.max(0,Math.min(255, bc[0]+(vc[0]-bc[0])*t+grain));
    px[i+1]=Math.max(0,Math.min(255, bc[1]+(vc[1]-bc[1])*t+grain));
    px[i+2]=Math.max(0,Math.min(255, bc[2]+(vc[2]-bc[2])*t+grain)); px[i+3]=255;
  }
  g.putImageData(id,0,0);
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; if(rep)t.repeat.set(rep,rep); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function woodTexture(base, dark, rep){
  const S=256, cv=document.createElement("canvas"); cv.width=cv.height=S; const g=cv.getContext("2d");
  const id=g.createImageData(S,S),px=id.data,bc=hexRGB(base),dc=hexRGB(dark);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){ const grain=fbm(x/S*3, y/S*22)*0.7 + vnoise(x/S*40,y/S*4)*0.3;
    const t=Math.abs(Math.sin(y/S*22 + grain*5))*0.6, i=(y*S+x)*4;
    px[i]=bc[0]+(dc[0]-bc[0])*t; px[i+1]=bc[1]+(dc[1]-bc[1])*t; px[i+2]=bc[2]+(dc[2]-bc[2])*t; px[i+3]=255; }
  g.putImageData(id,0,0);
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; if(rep)t.repeat.set(rep,rep); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function damaskTexture(bg, fg){
  const S=256, cv=document.createElement("canvas"); cv.width=cv.height=S; const g=cv.getContext("2d");
  g.fillStyle=bg; g.fillRect(0,0,S,S); g.strokeStyle=fg; g.fillStyle=fg; g.globalAlpha=0.5; g.lineWidth=2;
  function motif(cx,cy,s){ g.beginPath(); for(let a=0;a<Math.PI*2;a+=0.1){ const r=s*(0.6+0.4*Math.sin(a*4)); g.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r*1.3); } g.closePath(); g.stroke();
    g.beginPath(); g.ellipse(cx,cy,s*0.18,s*0.3,0,0,7); g.fill(); }
  for(let yy=0;yy<=S;yy+=64) for(let xx=0;xx<=S;xx+=64){ motif(xx,yy,26); motif(xx+32,yy+32,26); }
  g.globalAlpha=1;
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t;
}
function frescoTexture(seed){
  const W=512,Hh=384, cv=document.createElement("canvas"); cv.width=W; cv.height=Hh; const g=cv.getContext("2d");
  const sky=g.createLinearGradient(0,0,0,Hh); sky.addColorStop(0,"#cdb892"); sky.addColorStop(0.5,"#b9a079"); sky.addColorStop(1,"#7c6a4e");
  g.fillStyle=sky; g.fillRect(0,0,W,Hh);
  // distant arches / ruins silhouette
  g.fillStyle="rgba(90,74,52,0.55)";
  let s=seed; const rnd=()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  for(let i=0;i<6;i++){ const x=rnd()*W, w=40+rnd()*70, h=80+rnd()*160; g.fillRect(x,Hh-h,w,h);
    g.beginPath(); g.arc(x+w/2,Hh-h,w/2,Math.PI,0); g.fill(); }
  // soft clouds
  g.fillStyle="rgba(240,230,210,0.25)"; for(let i=0;i<10;i++){ g.beginPath(); g.ellipse(rnd()*W,rnd()*Hh*0.4,40+rnd()*60,16+rnd()*20,0,0,7); g.fill(); }
  // age grain
  g.fillStyle="rgba(60,45,30,0.05)"; for(let i=0;i<2000;i++) g.fillRect(rnd()*W,rnd()*Hh,1,1);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* ---------------- materials ---------------- */
const floorMarble = marbleTexture(0xdcd2bd, 0x8f8060, 5, null);
const matFloor   = new THREE.MeshStandardMaterial({ map: floorMarble, roughness: 0.28, metalness: 0.0, envMapIntensity: 1.3 });
const matPlaster = new THREE.MeshStandardMaterial({ color: 0xece5d6, roughness: 0.95 });
const matWall2   = new THREE.MeshStandardMaterial({ map: damaskTexture("#b8a98c","#8c7a55"), roughness: 0.9 }); // damask accent
const matWood    = new THREE.MeshStandardMaterial({ map: woodTexture(0x5a3c26, 0x37230f, 2), roughness: 0.42, metalness: 0.05, envMapIntensity: 0.5 });
const matCeil    = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 1.0 });
const matBrass   = new THREE.MeshStandardMaterial({ color: 0xc79a52, roughness: 0.3, metalness: 1.0, envMapIntensity: 1.1 });
const matMarble  = new THREE.MeshStandardMaterial({ map: marbleTexture(0xe6ddca, 0x9a8a66, 3, null), roughness: 0.3, metalness: 0.0, envMapIntensity: 1.0 });
const matLight   = new THREE.MeshStandardMaterial({ color: 0xfff0d4, emissive: 0xfff0d4, emissiveIntensity: 1.0, roughness: 1 });
const matBulb    = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffcaa0, emissiveIntensity: 2.6, roughness: 1 });
const matGlass   = new THREE.MeshStandardMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0 });
const matVelvet  = new THREE.MeshStandardMaterial({ color: 0x6b1f24, roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide });
matVelvet.onBeforeCompile = (sh) => { sh.uniforms.uTime = { value: 0 };
  sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>",
    "#include <begin_vertex>\n float sway=smoothstep(0.0,3.6,position.y+1.8); transformed.z += sin(position.y*1.4 + uTime*1.3 + position.x*1.8)*0.16*sway; transformed.x += cos(position.y*0.9 + uTime*1.1)*0.05*sway;");
  matVelvet.userData.sh = sh; timeMats.push(matVelvet); };

/* ---------------- geometry collectors ---------------- */
const G = { plaster:[], wall2:[], wood:[], ceil:[], brass:[], marble:[], light:[], bulb:[] };
const walls = [], displays = [], chandelierLights = [];
function box(arr, cx, cy, cz, sx, sy, sz, solid) { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(cx, cy, cz); arr.push(g);
  if (solid) walls.push({ minx:cx-sx/2, maxx:cx+sx/2, minz:cz-sz/2, maxz:cz+sz/2 }); }
function cyl(arr, cx, cy, cz, rt, rb, h, seg) { const g = new THREE.CylinderGeometry(rt, rb, h, seg||18); g.translate(cx, cy, cz); arr.push(g); }

/* fluted column (shaft + base + capital) into marble + brass */
function column(cx, cz, baseY, height, r) {
  cyl(G.marble, cx, baseY + height/2, cz, r, r, height, 20);
  cyl(G.marble, cx, baseY + 0.12, cz, r*1.5, r*1.7, 0.24, 20);   // base
  box(G.marble, cx, baseY + 0.02, cz, r*3.4, 0.05, r*3.4, false);
  cyl(G.brass,  cx, baseY + height - 0.14, cz, r*1.5, r*1.1, 0.28, 20); // capital
  box(G.brass,  cx, baseY + height + 0.02, cz, r*3.2, 0.12, r*3.2, false); // abacus
}
/* round arch (3D half-annulus) facing ±z */
function arch(cx, springY, cz, width, depth, arr) {
  const r = width/2, R = r + 0.32, sh = new THREE.Shape();
  sh.moveTo(-R, 0); sh.absarc(0, 0, R, Math.PI, 0, true); sh.lineTo(r, 0); sh.absarc(0, 0, r, 0, Math.PI, false); sh.lineTo(-R, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth/2);
  g.rotateY(0); g.translate(cx, springY, cz); arr.push(g);
  cyl(arr, cx, springY + R - 0.0, cz, 0.16, 0.16, depth, 8); // keystone-ish nub
}
/* coffered ceiling panel grid over an area */
function coffers(cx, cz, w, d, y) {
  const nx = Math.max(1, Math.round(w/2.2)), nz = Math.max(1, Math.round(d/2.2));
  const sx = w/nx, sz = d/nz;
  for (let i=0;i<=nx;i++) box(G.ceil, cx - w/2 + i*sx, y-0.12, cz, 0.12, 0.24, d, false);
  for (let j=0;j<=nz;j++) box(G.ceil, cx, y-0.12, cz - d/2 + j*sz, w, 0.24, 0.12, false);
  for (let i=0;i<nx;i++) for (let j=0;j<nz;j++) box(G.ceil, cx - w/2 + (i+0.5)*sx, y-0.22, cz - d/2 + (j+0.5)*sz, sx*0.62, 0.04, sz*0.62, false);
}
/* crystal chandelier */
function chandelier(cx, cz, withLight) {
  const y = H - 0.2;
  cyl(G.brass, cx, y, cz, 0.04, 0.04, 0.9, 6);                 // chain
  for (const rr of [0.55, 0.85]) { const seg = 36, g = new THREE.TorusGeometry(rr, 0.04, 8, seg); g.rotateX(Math.PI/2); g.translate(cx, y-0.5, cz); G.brass.push(g); }
  const arms = 8;
  for (let a=0;a<arms;a++){ const ang=a/arms*Math.PI*2, ax=cx+Math.cos(ang)*0.85, az=cz+Math.sin(ang)*0.85;
    const g=new THREE.SphereGeometry(0.07,10,10); g.translate(ax, y-0.46, az); G.bulb.push(g);
    const g2=new THREE.SphereGeometry(0.05,8,8); g2.translate(cx+Math.cos(ang)*0.55, y-0.5, cz+Math.sin(ang)*0.55); G.bulb.push(g2); }
  const cg=new THREE.OctahedronGeometry(0.16); cg.translate(cx, y-0.78, cz); G.bulb.push(cg);
  if (withLight) { const pl = new THREE.PointLight(0xffd9a0, 9, 16, 2); pl.position.set(cx, y-0.6, cz); scene.add(pl); chandelierLights.push(pl); }
}
/* classical urn (lathe) */
function urnMesh(cx, cz, topY) {
  const pts = [[0.0,0],[0.22,0],[0.26,0.05],[0.16,0.12],[0.12,0.22],[0.26,0.34],[0.32,0.5],[0.26,0.66],[0.14,0.78],[0.2,0.86],[0.26,0.92],[0.16,0.96],[0.12,1.0]].map(p=>new THREE.Vector2(p[0]*0.62, p[1]*0.62));
  const g = new THREE.LatheGeometry(pts, 24); const m = new THREE.Mesh(g, matMarble); m.position.set(cx, topY, cz); scene.add(m);
}

/* display panel canvas */
function panelTexture(room, gold) {
  const w=1024,h=660,c=document.createElement("canvas"); c.width=w; c.height=h; const g=c.getContext("2d");
  g.fillStyle = gold ? "#20160a" : "#f6f1e6"; g.fillRect(0,0,w,h);
  g.strokeStyle = gold ? "#caa15a" : "#cdbf9f"; g.lineWidth=8; g.strokeRect(20,20,w-40,h-40);
  const ink = gold ? "#f0dcae" : "#2a241a", sub = gold ? "#c39a55" : "#998a6b";
  g.fillStyle=sub; g.font="500 30px 'Space Grotesk',sans-serif"; g.textAlign="center";
  g.fillText(gold ? "THE FINALE" : "ROOM "+String(room.id+1).padStart(2,"0"), w/2, 96);
  g.strokeStyle=room.color; g.lineWidth=5; g.beginPath(); g.moveTo(w/2-60,122); g.lineTo(w/2+60,122); g.stroke();
  g.fillStyle=ink; g.font="600 60px Georgia,serif";
  const wr=(text,maxw)=>{ const ws=text.split(" "); let l="",out=[]; for(const wd of ws){ const tt=l+wd+" "; if(g.measureText(tt).width>maxw&&l){out.push(l.trim());l=wd+" ";}else l=tt;} out.push(l.trim()); return out; };
  const lines=wr(room.name,w-160); let y0=250-(lines.length-1)*36; lines.forEach((l,i)=>g.fillText(l,w/2,y0+i*72));
  g.fillStyle=sub; g.font="italic 25px Georgia,serif"; const bls=wr(room.blurb||"",w-200).slice(0,2); bls.forEach((l,i)=>g.fillText(l,w/2,470+i*34));
  g.fillStyle=room.color; g.font="700 26px 'Space Grotesk',sans-serif"; g.fillText("ENTER  →", w/2, h-52);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* ---------------- build a room ---------------- */
const occupied = new Set();
function placeRoom(room, cx, cz, f, rowIdx, c) {
  occupied.add(rowIdx + "_" + c);
  const backZ = cz - f*ROOM_D/2, frontZ = cz + f*ROOM_D/2;
  // back wall = damask accent (Victorian) behind the display
  box(G.wall2, cx, H/2, backZ, ROOM_W, H, T, true);
  // wainscot (walnut) lower band on side + back walls
  box(G.wood, cx, 0.6, backZ + f*0.06, ROOM_W, 1.2, 0.06, false);
  // side walls
  box(G.plaster, cx + ROOM_W/2, H/2, cz, T, H, ROOM_D, true);
  if (!occupied.has(rowIdx + "_" + (c-1))) box(G.plaster, cx - ROOM_W/2, H/2, cz, T, H, ROOM_D, true);
  box(G.wood, cx + ROOM_W/2 - 0.05, 0.6, cz, 0.04, 1.2, ROOM_D, false);
  // front wall with doorway + arch + flanking columns
  const seg = (ROOM_W - DOOR_W) / 2;
  box(G.plaster, cx - (DOOR_W/2 + seg/2), H/2, frontZ, seg, H, T, true);
  box(G.plaster, cx + (DOOR_W/2 + seg/2), H/2, frontZ, seg, H, T, true);
  box(G.plaster, cx, H-0.55, frontZ, DOOR_W+0.7, 1.1, T, false);     // tympanum fill above arch
  arch(cx, 2.55, frontZ + f*0.06, DOOR_W, 0.18, G.marble);
  column(cx - DOOR_W/2 - 0.28, frontZ - f*0.18, 0, 2.55, 0.16);
  column(cx + DOOR_W/2 + 0.28, frontZ - f*0.18, 0, 2.55, 0.16);
  // coffered ceiling for the room
  coffers(cx, cz, ROOM_W-0.4, ROOM_D-0.4, H);
  // display on back wall + gilt frame + picture light
  const innerZ = backZ + f*(T/2 + 0.02);
  const tex = panelTexture(room, false);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.25), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  panel.position.set(cx, 1.95, innerZ); panel.rotation.y = f>0?0:Math.PI; scene.add(panel);
  box(G.brass, cx, 1.95, backZ + f*0.04, 3.78, 2.53, 0.07, false);
  box(G.light, cx, 3.35, backZ + f*0.55, 2.6, 0.06, 0.14, false);
  // pedestal + object variety
  const plinthZ = cz - f*(ROOM_D/2 - 2.0);
  cyl(G.marble, cx, 0.5, plinthZ, 0.5, 0.56, 1.0, 20);
  box(G.marble, cx, 1.02, plinthZ, 1.1, 0.06, 1.1, false);
  const kind = room.id % 4;
  if (kind===0) urnMesh(cx, plinthZ, 1.05);
  else if (kind===1) { const s=new THREE.Mesh(new THREE.SphereGeometry(0.3,28,28), matBrass); s.position.set(cx,1.36,plinthZ); scene.add(s); }
  else if (kind===2) { for(let b=0;b<4;b++){ const bk=new THREE.Mesh(new THREE.BoxGeometry(0.6-b*0.02,0.12,0.42), matWood); bk.position.set(cx,1.12+b*0.13,plinthZ); bk.rotation.y=(Math.random()-.5)*0.3; scene.add(bk);} }
  else { const t=new THREE.Mesh(new THREE.TorusKnotGeometry(0.2,0.07,80,12), matBrass); t.position.set(cx,1.42,plinthZ); scene.add(t); }
  // a small framed fresco on a side wall
  const fx = cx + (c%2? ROOM_W/2-0.12 : -ROOM_W/2+0.12), side = c%2?-1:1;
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.3), new THREE.MeshStandardMaterial({ map: frescoTexture(room.id*97+3), roughness:0.9 }));
  fr.position.set(fx, 2.4, cz); fr.rotation.y = side*Math.PI/2; scene.add(fr);
  box(G.brass, fx + side*0.02, 2.4, cz, 0.06, 1.5, 2.0, false);

  displays.push({ room, pos: new THREE.Vector3(cx,1.95,innerZ), center: new THREE.Vector3(cx,0,cz),
    door: { x: cx, z: frontZ + f*2.0, yaw: f>0?0:Math.PI }, finale: false });
}

/* ---- lay out rooms ---- */
let idx=0, minZ=0, maxZ=0;
for (let s=0;s<stripCount;s++){
  const Cz = s*STRIP_PITCH;
  for (let cc=0; cc<PER_SIDE && idx<ROOMS.length; cc++) placeRoom(ROOMS[idx++], colX(cc), Cz - CORR/2 - ROOM_D/2, +1, s*2, cc);
  for (let cc=0; cc<PER_SIDE && idx<ROOMS.length; cc++) placeRoom(ROOMS[idx++], colX(cc), Cz + CORR/2 + ROOM_D/2, -1, s*2+1, cc);
  // gallery: coffered ceiling + chandeliers + crown/baseboard
  coffers((SPINE_X+RIGHT_X)/2 + 1, Cz, BLOCK_W + SPINE_W, CORR, H);
  for (const gx of [-BLOCK_W/4, BLOCK_W/4]) chandelier(gx, Cz, true);
  minZ = Math.min(minZ, Cz - CORR/2 - ROOM_D); maxZ = Math.max(maxZ, Cz + CORR/2 + ROOM_D);
}

/* ---- finale: grand domed chamber ---- */
const FIN_Z = maxZ + 12, FIN_W = 17, FIN_D = 14;
(function finale(){
  const cx=SPINE_X, cz=FIN_Z;
  box(G.wall2, cx, H/2+0.6, cz+FIN_D/2, FIN_W, H+1.2, T, true);
  box(G.plaster, cx-FIN_W/2, H/2+0.6, cz, T, H+1.2, FIN_D, true);
  box(G.plaster, cx+FIN_W/2, H/2+0.6, cz, T, H+1.2, FIN_D, true);
  const seg=(FIN_W-4)/2;
  box(G.plaster, cx-(2+seg/2), H/2+0.6, cz-FIN_D/2, seg, H+1.2, T, true);
  box(G.plaster, cx+(2+seg/2), H/2+0.6, cz-FIN_D/2, seg, H+1.2, T, true);
  arch(cx, 2.7, cz-FIN_D/2+0.06, 4, 0.2, G.marble);
  for (const sx of [-1,1]) { column(cx + sx*4.4, cz-2, 0, 3.8, 0.28); column(cx + sx*4.4, cz+4, 0, 3.8, 0.28); }
  coffers(cx, cz, FIN_W-1, FIN_D-1, H+1.2);
  chandelier(cx, cz-1, true);
  // gold dais + ring
  const dais=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.7,0.5,48), matMarble); dais.position.set(cx,0.25,cz+1.6); scene.add(dais);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.5,0.07,16,64), matBrass); ring.position.set(cx,0.55,cz+1.6); ring.rotation.x=Math.PI/2; scene.add(ring);
  urnMesh(cx, cz+1.6, 0.5);
  const tex=panelTexture(FINALE,true);
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(5.4,3.4), new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));
  panel.position.set(cx,2.5,cz+FIN_D/2-0.12); panel.rotation.y=Math.PI; scene.add(panel);
  box(G.brass, cx,2.5,cz+FIN_D/2-0.04, 5.7,3.7,0.09, false);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.7,3.2,H+1.2,24,1,true), new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:0.05,side:THREE.DoubleSide,depthWrite:false}));
  beam.position.set(cx,(H+1.2)/2,cz+1.6); scene.add(beam); window.__beam=beam;
  displays.push({ room:FINALE, pos:new THREE.Vector3(cx,2.5,cz+FIN_D/2-0.12), center:new THREE.Vector3(cx,0,cz),
    door:{x:cx, z:cz-FIN_D/2-2.6, yaw:Math.PI}, finale:true });
  maxZ = cz+FIN_D/2;
})();

/* ---- shell / floor / ceiling / spine / windows / drapery ---- */
const padZ0 = minZ-3, padZ1 = maxZ+3, totalZ = padZ1-padZ0, midZ=(padZ0+padZ1)/2;
const xMin=SPINE_WALL_X, xMax=RIGHT_X;
box(G.plaster, xMin, H/2+0.4, midZ, T, H+0.8, totalZ, true);
box(G.plaster, xMax, H/2+0.4, midZ, T, H+0.8, totalZ, true);
box(G.plaster, (xMin+xMax)/2, H/2+0.4, padZ0, (xMax-xMin), H+0.8, T, true);
box(G.plaster, (xMin+xMax)/2, H/2+0.4, padZ1, (xMax-xMin), H+0.8, T, true);
const floorW = xMax-xMin+1;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(floorW, totalZ+2), matFloor);
floor.rotation.x=-Math.PI/2; floor.position.set((xMin+xMax)/2,0,midZ); floorMarble.repeat.set(floorW/4,totalZ/4); scene.add(floor);
// marble inlay strips on the floor down the spine
const inlay=new THREE.Mesh(new THREE.PlaneGeometry(0.4,totalZ-2), matBrass); inlay.rotation.x=-Math.PI/2; inlay.position.set(SPINE_X,0.011,midZ); scene.add(inlay);
const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(floorW,totalZ+2), matCeil); ceiling.rotation.x=Math.PI/2; ceiling.position.set((xMin+xMax)/2,H+0.8,midZ); scene.add(ceiling);
coffers(SPINE_X, midZ, SPINE_W-0.5, totalZ-2, H+0.8);
// spine chandeliers + bench + runner
for (let z=padZ0+8; z<padZ1-6; z+=11) chandelier(SPINE_X, z, true);
box(G.wood, SPINE_X, 0.28, midZ, 1.0, 0.56, 6.2, false);
// windows + warm sky + drapery on the outer (left) wall
const skyZ=totalZ-4;
const skyPlane=new THREE.Mesh(new THREE.PlaneGeometry(skyZ,H), new THREE.MeshBasicMaterial({color:0xcdb488})); skyPlane.rotation.y=Math.PI/2; skyPlane.position.set(xMin-0.25,H/2,midZ); scene.add(skyPlane);
for (let z=padZ0+2; z<=padZ1-2; z+=2.4) box(G.brass, xMin+0.06, H/2, z, 0.07, H-0.4, 0.09, false);
box(G.brass, xMin+0.06, H-0.4, midZ, 0.1, 0.1, skyZ, false);
box(G.brass, xMin+0.06, 0.4, midZ, 0.1, 0.1, skyZ, false);
for (let z=padZ0+5; z<padZ1-4; z+=8) { for (const off of [-1.2,1.2]) {
  const drape=new THREE.Mesh(new THREE.PlaneGeometry(1.3,H-0.4,8,16), matVelvet); drape.rotation.y=Math.PI/2; drape.position.set(xMin+0.25,(H-0.4)/2,z+off); scene.add(drape);
} }

/* ---- merge static geometry (normalise to non-indexed, position/normal/uv only) ---- */
function merge(arr, mat){
  if(!arr.length) return;
  const norm = arr.map(g0 => {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", g.attributes.position);
    if (g.attributes.normal) ng.setAttribute("normal", g.attributes.normal);
    ng.setAttribute("uv", g.attributes.uv || new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2), 2));
    return ng;
  });
  norm.forEach(g => { if (!g.attributes.normal) g.computeVertexNormals(); });
  const merged = mergeGeometries(norm, false);
  if (merged) scene.add(new THREE.Mesh(merged, mat));
}
merge(G.plaster, matPlaster); merge(G.wall2, matWall2); merge(G.wood, matWood); merge(G.ceil, matCeil);
merge(G.brass, matBrass); merge(G.marble, matMarble); merge(G.light, matLight); merge(G.bulb, matBulb);

/* ---- GLSL dust motes ---- */
(function dust(){
  const N=900, pos=new Float32Array(N*3), a=new Float32Array(N);
  for(let i=0;i<N;i++){ pos[i*3]=xMin+Math.random()*(xMax-xMin); pos[i*3+1]=0.3+Math.random()*(H+0.3); pos[i*3+2]=padZ0+Math.random()*totalZ; a[i]=Math.random(); }
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setAttribute("a",new THREE.BufferAttribute(a,1));
  const m=new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, uniforms:{uTime:{value:0}},
    vertexShader:`uniform float uTime; attribute float a; varying float vA; void main(){ vA=a; vec3 p=position;
      p.y+=sin(uTime*0.18+a*30.0)*0.45; p.x+=cos(uTime*0.13+a*22.0)*0.35;
      vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=(1.6+a*2.4)*(10.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying float vA; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5)discard; gl_FragColor=vec4(1.0,0.95,0.82,(0.5-d)*0.5*(0.3+vA*0.5)); }` });
  const pts=new THREE.Points(g,m); pts.frustumCulled=false; scene.add(pts); m.userData.isDust=true; timeMats.push(m);
})();

/* ============================ INPUT ============================ */
const keys={}; let yaw=-Math.PI/2-0.5, pitch=-0.04, locked=false; const SENS=0.0022;
camera.position.set(SPINE_X+0.6, EYE, 1.4);
addEventListener("keydown", e => {
  if (e.code==="Tab"){ e.preventDefault(); toggleDirectory(); return; }
  if (e.code==="Escape"){ if(overlay.classList.contains("show")){e.preventDefault();closeOverlay();return;} if(directory.classList.contains("show")){e.preventDefault();toggleDirectory(false);return;} }
  if (directory.classList.contains("show")) return;
  keys[e.code]=true; if(e.code==="KeyE") tryEnter(); if(e.code==="KeyM") toggleMap();
});
addEventListener("keyup", e => keys[e.code]=false);
canvas.addEventListener("click", () => { if(!overlay.classList.contains("show") && !flying) canvas.requestPointerLock(); });
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement===canvas; document.body.classList.toggle("locked", locked); });
document.addEventListener("mousemove", e => { if(!locked) return; yaw-=e.movementX*SENS; pitch-=e.movementY*SENS; pitch=Math.max(-1.2,Math.min(1.2,pitch)); });
canvas.addEventListener("mousedown", e => { if(locked && e.button===0) tryEnter(); });

/* ============================ MOVEMENT + COLLISION ============================ */
const vel=new THREE.Vector3(); const clock=new THREE.Clock(); let near=null;

/* ---- footsteps on marble + a low ambient room tone (created on first gesture) ---- */
let audio=null, bobPhase=0;
function initAudio(){ if(audio)return; try{
  const c=new (window.AudioContext||window.webkitAudioContext)(); const master=c.createGain(); master.gain.value=0.5; master.connect(c.destination);
  const drone=c.createOscillator(); drone.type="sine"; drone.frequency.value=46; const dg=c.createGain(); dg.gain.value=0.0001;
  drone.connect(dg).connect(master); drone.start(); dg.gain.exponentialRampToValueAtTime(0.05, c.currentTime+4);
  const len=Math.floor(c.sampleRate*2), ab=c.createBuffer(1,len,c.sampleRate), ad=ab.getChannelData(0);
  for(let i=0;i<len;i++) ad[i]=(Math.random()*2-1); const air=c.createBufferSource(); air.buffer=ab; air.loop=true;
  const af=c.createBiquadFilter(); af.type="bandpass"; af.frequency.value=480; af.Q.value=0.4; const ag=c.createGain(); ag.gain.value=0.018;
  air.connect(af).connect(ag).connect(master); air.start(); audio={c,master};
}catch(e){ audio=null; } }
function footstep(amp){ if(!audio)return; const c=audio.c;
  const len=Math.floor(c.sampleRate*0.09), b=c.createBuffer(1,len,c.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.5);
  const n=c.createBufferSource(); n.buffer=b; const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=820+Math.random()*360;
  const g=c.createGain(); g.gain.value=0.09*Math.min(1,amp+0.3); n.connect(f).connect(g).connect(audio.master); n.start();
  const tk=c.createOscillator(); tk.type="triangle"; tk.frequency.value=2300+Math.random()*700; const tg=c.createGain();
  tg.gain.setValueAtTime(0.025*amp, c.currentTime); tg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+0.05);
  tk.connect(tg).connect(audio.master); tk.start(); tk.stop(c.currentTime+0.06); }
function collide(px,pz){ for(let p=0;p<2;p++) for(const w of walls){
  const cx=Math.max(w.minx,Math.min(px,w.maxx)), cz=Math.max(w.minz,Math.min(pz,w.maxz));
  let dx=px-cx,dz=pz-cz,d2=dx*dx+dz*dz;
  if(d2<PLAYER_R*PLAYER_R){ if(d2>1e-6){const d=Math.sqrt(d2),pu=PLAYER_R-d; px+=dx/d*pu; pz+=dz/d*pu;}
    else{ const l=px-w.minx,r=w.maxx-px,t=pz-w.minz,b=w.maxz-pz,m=Math.min(l,r,t,b);
      if(m===l)px=w.minx-PLAYER_R; else if(m===r)px=w.maxx+PLAYER_R; else if(m===t)pz=w.minz-PLAYER_R; else pz=w.maxz+PLAYER_R; } } }
  return [px,pz]; }
function updateMovement(dt){
  const dir=new THREE.Vector3(), fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)), right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  if(keys.KeyW||keys.ArrowUp)dir.add(fwd); if(keys.KeyS||keys.ArrowDown)dir.sub(fwd);
  if(keys.KeyD||keys.ArrowRight)dir.add(right); if(keys.KeyA||keys.ArrowLeft)dir.sub(right);
  dir.y=0; if(dir.lengthSq()>0)dir.normalize();
  const speed=(keys.ShiftLeft||keys.ShiftRight)?10.5:6;
  vel.lerp(dir.multiplyScalar(speed), 1-Math.pow(0.0001,dt));
  let nx=camera.position.x+vel.x*dt, nz=camera.position.z+vel.z*dt; [nx,nz]=collide(nx,nz);
  // head-bob, footsteps, and idle breathing sway for an embodied first-person feel
  const sp=Math.hypot(vel.x,vel.z), amp=Math.min(1,sp/5.5);
  if(sp>0.5){ const prev=bobPhase; bobPhase+=sp*dt*1.85; if(Math.floor(bobPhase/Math.PI)!==Math.floor(prev/Math.PI)) footstep(amp); }
  const bobY=Math.sin(bobPhase*2)*0.045*amp, roll=Math.sin(bobPhase)*0.015*amp, idle=1-amp, T=clock.elapsedTime;
  camera.position.set(nx, EYE+bobY, nz);
  camera.rotation.set(pitch+Math.sin(T*0.8)*0.004*idle, yaw+Math.cos(T*0.6)*0.004*idle, roll, "YXZ");
}

/* ============================ INTERACTION ============================ */
const prompt=document.getElementById("prompt");
function updateNearest(){
  let best=null,bd=ACTIVATE; for(const d of displays){ const dist=camera.position.distanceTo(d.pos); if(dist<bd){bd=dist;best=d;} }
  if(best!==near){ near=best;
    if(near){ document.documentElement.style.setProperty("--accent",near.room.color);
      prompt.querySelector(".pname").textContent = near.finale?`✦ ${near.room.name}`:`#${String(near.room.id+1).padStart(2,"0")} · ${near.room.name}`;
      prompt.querySelector(".pblurb").textContent = near.room.blurb; prompt.classList.add("show");
    } else { prompt.classList.remove("show"); document.documentElement.style.setProperty("--accent","#c69a5a"); } }
}

/* ============================ OVERLAY + cinematic teleport ============================ */
const overlay=document.getElementById("overlay"), frame=document.getElementById("expframe"), reveal=document.getElementById("reveal");
document.getElementById("backBtn").addEventListener("click", closeOverlay);
addEventListener("message", e=>{ if(e.data&&e.data.type==="exit-room") closeOverlay(); });
let flying=false;
function openRoom(d){
  const room=d.room; if(!room.finale){ visited.add(room.id); updateCounter(); }
  reveal.style.transition="opacity .3s"; reveal.style.background=`radial-gradient(circle, ${room.color}, #000 72%)`; reveal.style.opacity="1";
  const loadbar=document.getElementById("loadbar");
  setTimeout(()=>{ let params=room.params||""; if(room.finale)params=`seen=${visited.size}`;
    document.documentElement.style.setProperty("--accent",room.color);
    loadbar.classList.add("go"); loadbar.style.width="70%";
    frame.onload=()=>{ loadbar.style.width="100%"; setTimeout(()=>{loadbar.classList.remove("go");loadbar.style.width="0";},350); };
    frame.src=`experiences/${room.page}`+(params?`?${params}`:"");
    document.getElementById("overlayTitle").textContent = room.finale?`✦ ${room.name}`:`#${String(room.id+1).padStart(2,"0")} · ${room.name}`;
    overlay.classList.add("show"); reveal.style.opacity="0"; flying=false;
  },320);
}
function flyToAndEnter(d){
  if(flying||overlay.classList.contains("show")) return; flying=true; document.exitPointerLock();
  prompt.classList.remove("show");
  const start=camera.position.clone(), startQ=camera.quaternion.clone();
  const target=new THREE.Vector3(d.center.x, EYE, d.center.z + (d.door.z>d.center.z?1:-1)*1.2);
  const look=new THREE.Vector3(d.pos.x, d.pos.y, d.pos.z);
  const tmp=new THREE.Object3D(); tmp.position.copy(target); tmp.lookAt(look); const endQ=tmp.quaternion.clone();
  const t0=performance.now(), dur=820;
  (function step(){ const k=Math.min(1,(performance.now()-t0)/dur), e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    camera.position.lerpVectors(start,target,e); camera.quaternion.slerpQuaternions(startQ,endQ,e);
    if(k<1) requestAnimationFrame(step); else openRoom(d);
  })();
}
function tryEnter(){ if(near) flyToAndEnter(near); }
function closeOverlay(){ overlay.classList.remove("show"); frame.src="about:blank"; reveal.style.opacity="0"; }

/* ============================ MINIMAP ============================ */
const mm=document.getElementById("minimap"), mg=mm.getContext("2d"), mmWrap=document.getElementById("minimapWrap"); let mapOn=true;
function toggleMap(){ mapOn=!mapOn; mmWrap.style.display=mapOn?"block":"none"; }
const PB={x0:xMin-2,x1:xMax+2,z0:padZ0-2,z1:padZ1+2};
function planScale(){ return Math.min((mm.width-16)/(PB.x1-PB.x0),(mm.height-16)/(PB.z1-PB.z0)); }
function toMM(x,z){ const s=planScale(); return {x:8+(x-PB.x0)*s,y:8+(z-PB.z0)*s}; }
function teleportToDisplay(d){ camera.position.set(d.door.x,EYE,d.door.z); yaw=d.door.yaw; pitch=0; vel.set(0,0,0); }
function drawMap(){ if(!mapOn)return; const W=mm.width, Hh=mm.height; mg.clearRect(0,0,W,Hh); const s=planScale();
  // faint blueprint grid
  mg.strokeStyle="rgba(198,154,90,0.07)"; mg.lineWidth=1;
  for(let gx=0;gx<=W;gx+=15){ mg.beginPath(); mg.moveTo(gx,0); mg.lineTo(gx,Hh); mg.stroke(); }
  for(let gy=0;gy<=Hh;gy+=15){ mg.beginPath(); mg.moveTo(0,gy); mg.lineTo(W,gy); mg.stroke(); }
  // rooms as architectural outlines
  for(const d of displays){ const w=(d.finale?16:ROOM_W)*s, h=(d.finale?14:ROOM_D)*s;
    const a=toMM(d.center.x-(d.finale?8:ROOM_W/2), d.center.z-(d.finale?7:ROOM_D/2));
    const seen=visited.has(d.room.id);
    if(d===near) mg.fillStyle="rgba(198,154,90,0.5)";
    else if(d.finale) mg.fillStyle="rgba(255,210,120,0.22)";
    else if(seen) mg.fillStyle="rgba(230,212,170,0.13)";
    else mg.fillStyle="rgba(0,0,0,0)";
    mg.fillRect(a.x,a.y,w,h);
    mg.strokeStyle=d.finale?"rgba(255,216,120,0.85)":(seen?"rgba(232,214,176,0.6)":"rgba(198,154,90,0.42)");
    mg.lineWidth=d===near?1.5:0.8; mg.strokeRect(a.x,a.y,w,h);
  }
  // player position + view cone
  const p=toMM(camera.position.x,camera.position.z);
  mg.fillStyle="rgba(255,238,196,0.16)"; mg.beginPath(); mg.moveTo(p.x,p.y);
  mg.lineTo(p.x+Math.sin(yaw+0.42)*17, p.y+Math.cos(yaw+0.42)*17);
  mg.lineTo(p.x+Math.sin(yaw-0.42)*17, p.y+Math.cos(yaw-0.42)*17); mg.closePath(); mg.fill();
  mg.fillStyle="#f6efdc"; mg.beginPath(); mg.arc(p.x,p.y,2.6,0,7); mg.fill();
  mg.strokeStyle="#c69a5a"; mg.lineWidth=1; mg.stroke();
}
mm.addEventListener("click", e=>{ const r=mm.getBoundingClientRect(), mx=(e.clientX-r.left)*(mm.width/r.width), my=(e.clientY-r.top)*(mm.height/r.height), s=planScale();
  const wx=(mx-8)/s+PB.x0, wz=(my-8)/s+PB.z0; let best=null,bdd=1e9; for(const d of displays){ const dd=Math.hypot(d.center.x-wx,d.center.z-wz); if(dd<bdd){bdd=dd;best=d;} } if(best) teleportToDisplay(best); });

/* ============================ DIRECTORY ============================ */
const directory=document.getElementById("directory"), dirList=document.getElementById("dirList"), dirSearch=document.getElementById("dirSearch");
document.getElementById("dirBtn").addEventListener("click", ()=>toggleDirectory());
function buildDirectory(filter=""){ const f=filter.trim().toLowerCase(); dirList.innerHTML="";
  const rows=ALL.filter(r=>!f||r.name.toLowerCase().includes(f)||(r.blurb||"").toLowerCase().includes(f));
  if(!rows.length){ dirList.innerHTML=`<div class="dir-empty">No rooms match “${filter}”.</div>`; return; }
  for(const r of rows){ const card=document.createElement("div"); card.className="dir-card"+(r.finale?" finale":"");
    card.innerHTML=`<span class="dot" style="color:${r.color}"></span><div class="meta"><div class="rn">${r.finale?"✦ FINALE":"#"+String(r.id+1).padStart(2,"0")}${visited.has(r.id)?" · visited ✓":""}</div><div class="rt">${r.name}</div><div class="rb">${r.blurb||""}</div></div>`;
    card.addEventListener("click", ()=>{ const d=displays.find(dd=>dd.room.id===r.id); if(d) teleportToDisplay(d); toggleDirectory(false); canvas.requestPointerLock(); }); dirList.appendChild(card); }
}
function toggleDirectory(force){ const show=force===undefined?!directory.classList.contains("show"):force; directory.classList.toggle("show",show);
  if(show){ document.exitPointerLock(); buildDirectory(dirSearch.value); setTimeout(()=>dirSearch.focus(),30); } }
dirSearch.addEventListener("input", ()=>buildDirectory(dirSearch.value));
dirSearch.addEventListener("keydown", e=>{ if(e.code==="Enter"){ const fc=dirList.querySelector(".dir-card"); if(fc)fc.click(); } e.stopPropagation(); });
directory.addEventListener("click", e=>{ if(e.target===directory) toggleDirectory(false); });

/* ============================ HUD ============================ */
function updateCounter(){ document.getElementById("counter").innerHTML=`${ROOMS.length} ROOMS · EXPLORED <span class="pct">${visited.size}/${ROOMS.length}</span>`+(visited.size===ROOMS.length?` · <span class="pct">✦ THE FINALE AWAITS</span>`:""); }
updateCounter();
document.getElementById("enterBtn").addEventListener("click", ()=>{ document.getElementById("splash").style.display="none"; initAudio(); canvas.requestPointerLock(); });

/* ============================ POST-PROCESSING ============================ */
let composer=null;
try {
  const { EffectComposer } = await import("three/addons/postprocessing/EffectComposer.js");
  const { RenderPass } = await import("three/addons/postprocessing/RenderPass.js");
  const { UnrealBloomPass } = await import("three/addons/postprocessing/UnrealBloomPass.js");
  const { OutputPass } = await import("three/addons/postprocessing/OutputPass.js");
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  try { const { SSAOPass } = await import("three/addons/postprocessing/SSAOPass.js");
    const ssao = new SSAOPass(scene, camera, innerWidth, innerHeight); ssao.kernelRadius = 0.7; ssao.minDistance = 0.002; ssao.maxDistance = 0.08; composer.addPass(ssao); } catch(e){}
  try { const { BokehPass } = await import("three/addons/postprocessing/BokehPass.js");
    composer.addPass(new BokehPass(scene, camera, { focus: 8.0, aperture: 0.00018, maxblur: 0.006 })); } catch(e){}
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.6, 0.9));
  try { const { SMAAPass } = await import("three/addons/postprocessing/SMAAPass.js"); composer.addPass(new SMAAPass(innerWidth, innerHeight)); } catch(e){}
  composer.addPass(new OutputPass());
} catch(e) { composer = null; }

/* scene is built + post-processing ready — light the chandeliers, open the doors */
{ const _eb=document.getElementById("enterBtn"); if(_eb){ _eb.disabled=false; _eb.classList.add("ready"); _eb.innerHTML="Enter the Mansion"; } }

/* ============================ LOOP ============================ */
function loop(){
  const dt=Math.min(clock.getDelta(),0.05), t=clock.elapsedTime;
  for(const m of timeMats){ const sh=m.userData.sh; if(sh&&sh.uniforms.uTime) sh.uniforms.uTime.value=t; if(m.uniforms&&m.uniforms.uTime) m.uniforms.uTime.value=t; }
  if(window.__beam) window.__beam.material.opacity=0.045+Math.sin(t*1.5)*0.02+(visited.size===ROOMS.length?0.06:0);
  if(locked) updateMovement(dt);
  updateNearest(); document.body.classList.toggle("near", !!near); drawMap();
  if(composer) composer.render(); else renderer.render(scene,camera);
  requestAnimationFrame(loop);
}
loop();
addEventListener("resize", ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); if(composer)composer.setSize(innerWidth,innerHeight); });
