// 07 — first-person driving
// An endless procedurally generated highway, driven from the driver's seat.
// Three.js only; hand steering (C key) reuses ../../lib/tracker.js.
//
// Coordinates: the road is a centreline sampled every DS metres. Every moving
// thing lives in road space — s (distance along the road) and d (lateral offset,
// + = right). Positive curvature turns right. Traffic drives on the right.

import * as THREE from "three";

// ---------------------------------------------------------------- constants
const DS = 2;                    // metres between centreline samples
const CHUNK_PTS = 50;            // samples per chunk (100 m)
const CHUNK_LEN = DS * CHUNK_PTS;
const VIEW_BEHIND = 150;
const VIEW_AHEAD = 750;
const LANES_FWD = [1.75, 5.25];
const LANES_ONC = [-1.75, -5.25];
const ROAD_HALF = 8;             // asphalt incl. shoulders
const RAIL_D = 11;               // guardrail offset
const DRIVE_LIMIT = 10.3;        // how far the car can go before hitting the rail
const MAX_SPEED = 58;            // m/s (~210 km/h)
const EYE_HEIGHT = 1.15;

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (v, target, rate) => v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- track
const track = { x: [0], y: [0], z: [0], th: [0], k: [0] };
const curvatureAt = (s) =>
  (0.0045 * Math.sin(s / 260) + 0.0028 * Math.sin(s / 97 + 1.3) + 0.0014 * Math.sin(s / 41 + 0.4)) *
  (0.55 + 0.45 * Math.sin(s / 1300 + 2));
const elevationAt = (s) => 7 * Math.sin(s / 430) + 3 * Math.sin(s / 151 + 2) - 3;
track.y[0] = elevationAt(0);

function extendTrack(toS) {
  const t = track;
  while ((t.x.length - 1) * DS < toS) {
    const i = t.x.length;
    const k = curvatureAt((i - 0.5) * DS);
    const thMid = t.th[i - 1] + k * DS * 0.5;
    t.th.push(t.th[i - 1] + k * DS);
    t.k.push(k);
    t.x.push(t.x[i - 1] + Math.sin(thMid) * DS);
    t.z.push(t.z[i - 1] - Math.cos(thMid) * DS);
    t.y.push(elevationAt(i * DS));
  }
}

// Returns centreline position, heading, curvature and slope at distance s.
function sample(s, out = {}) {
  s = Math.max(0, s);
  extendTrack(s + DS * 2);
  const i = Math.floor(s / DS), f = s / DS - i, t = track;
  out.x = lerp(t.x[i], t.x[i + 1], f);
  out.y = lerp(t.y[i], t.y[i + 1], f);
  out.z = lerp(t.z[i], t.z[i + 1], f);
  out.th = lerp(t.th[i], t.th[i + 1], f);
  out.k = t.k[i + 1];
  out.slope = (t.y[i + 1] - t.y[i]) / DS;
  return out;
}
// World position of a road-space point.
function roadToWorld(s, d, h = 0, out = new THREE.Vector3()) {
  const p = sample(s, _tmpSample);
  return out.set(p.x + Math.cos(p.th) * d, p.y + h, p.z + Math.sin(p.th) * d);
}
const _tmpSample = {};

// Terrain cross-section (lateral offsets & heights relative to the road).
const TERRAIN_D = [-95, -60, -36, -21, -14, -11.5, -ROAD_HALF, ROAD_HALF, 11.5, 14, 21, 36, 60, 95];
function terrainHeights(s) {
  const n1 = Math.sin(s / 53) * Math.sin(s / 131 + 1.1);
  const n2 = Math.sin(s / 71 + 2.3) * Math.sin(s / 173 + 0.4);
  return TERRAIN_D.map((d) => {
    const a = Math.abs(d), side = d < 0 ? n1 : n2;
    if (a <= ROAD_HALF) return -0.02;
    if (a <= 11.5) return -0.06;
    if (a <= 14) return -0.7;
    if (a <= 21) return 0.4 + side * 0.8;
    if (a <= 36) return 3 + side * 3;
    if (a <= 60) return 10 + side * 7;
    return 24 + side * 12;
  });
}
function terrainHeightAt(s, d) {
  const hs = terrainHeights(s);
  for (let j = 0; j < TERRAIN_D.length - 1; j++) {
    if (d >= TERRAIN_D[j] && d <= TERRAIN_D[j + 1]) {
      const f = (d - TERRAIN_D[j]) / (TERRAIN_D[j + 1] - TERRAIN_D[j]);
      return lerp(hs[j], hs[j + 1], f);
    }
  }
  return hs[hs.length - 1];
}

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfd6ea, 80, 620);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 1500);
camera.rotation.order = "YXZ";
camera.layers.enable(1); // layer 1 = cockpit (hidden from the mirror camera)
scene.add(camera);

const rearCam = new THREE.PerspectiveCamera(32, 4, 0.5, 600);
rearCam.rotation.order = "YXZ";
scene.add(rearCam);
const mirrorTarget = new THREE.WebGLRenderTarget(512, 128);

// Sky dome
const skyUniforms = {
  top: { value: new THREE.Color(0x3d7fd1) },
  bottom: { value: new THREE.Color(0xd8e6f2) },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1200, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = clamp(vP.y*1.6+0.08, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)), 1.0); }`,
  })
);
sky.renderOrder = -1;
scene.add(sky);

const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 8), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
scene.add(sunDisc);
const SUN_DIR = new THREE.Vector3(0.45, 0.55, -0.7).normalize();

const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a5a35, 1.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d8, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000),
  new THREE.MeshLambertMaterial({ color: 0x4f7a34 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// ---------------------------------------------------------------- textures
function makeRoadTexture() {
  const W = 512, H = 512, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#3b3d40"; g.fillRect(0, 0, W, H);
  const rnd = mulberry32(7);
  for (let i = 0; i < 9000; i++) {
    const v = 45 + rnd() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 3},${0.25 + rnd() * 0.35})`;
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // Tyre wear tracks
  g.fillStyle = "rgba(20,20,22,0.18)";
  const px = (d) => ((d + ROAD_HALF) / (ROAD_HALF * 2)) * W;
  for (const lane of [...LANES_FWD, ...LANES_ONC]) {
    g.fillRect(px(lane - 0.85), 0, px(0.45) - px(0), H);
    g.fillRect(px(lane + 0.4), 0, px(0.45) - px(0), H);
  }
  const line = (d, w, color, dashed) => {
    g.fillStyle = color;
    const x = px(d) - (w / (ROAD_HALF * 2)) * W * 0.5, ww = (w / (ROAD_HALF * 2)) * W;
    if (dashed) g.fillRect(x, 0, ww, H * 0.5);
    else g.fillRect(x, 0, ww, H);
  };
  line(-7.15, 0.18, "#e9e9e2", false);
  line(7.15, 0.18, "#e9e9e2", false);
  line(-3.5, 0.15, "#e9e9e2", true);
  line(3.5, 0.15, "#e9e9e2", true);
  line(-0.14, 0.13, "#f0b52a", false);
  line(0.14, 0.13, "#f0b52a", false);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const ROAD_TEX_LEN = 12; // metres covered by one texture repeat (6 m dash, 6 m gap)

// ---------------------------------------------------------------- shared materials / geometries
const MAT = {
  road: new THREE.MeshStandardMaterial({ map: makeRoadTexture(), roughness: 0.92 }),
  terrain: new THREE.MeshLambertMaterial({ vertexColors: true }),
  rail: new THREE.MeshStandardMaterial({ color: 0xb8bec4, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }),
  post: new THREE.MeshStandardMaterial({ color: 0x777b80, metalness: 0.5, roughness: 0.5 }),
  trunk: new THREE.MeshLambertMaterial({ color: 0x5a3d26 }),
  leaves: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  lampHead: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0.15 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1b2430, metalness: 0.4, roughness: 0.15 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
  tail: new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.6 }),
  head: new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xfff3d0, emissiveIntensity: 0.3 }),
  cargo: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.7 }),
};
const GEO = {
  trunk: new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6).translate(0, 1.2, 0),
  crown1: new THREE.ConeGeometry(2.0, 4.2, 7).translate(0, 4.0, 0),
  crown2: new THREE.ConeGeometry(1.4, 3.2, 7).translate(0, 6.0, 0),
  pole: new THREE.CylinderGeometry(0.09, 0.12, 8, 6).translate(0, 4, 0),
  arm: new THREE.BoxGeometry(0.1, 0.1, 2.2),
  lamp: new THREE.BoxGeometry(0.35, 0.15, 0.7),
  railPost: new THREE.BoxGeometry(0.12, 0.8, 0.12).translate(0, 0.4, 0),
};

// ---------------------------------------------------------------- chunks
const chunks = new Map();

function buildRibbon(i0, i1, cols, heightsFn, colorFn) {
  const rows = i1 - i0 + 1, nc = cols.length;
  const pos = new Float32Array(rows * nc * 3);
  const col = colorFn ? new Float32Array(rows * nc * 3) : null;
  const uv = new Float32Array(rows * nc * 2);
  const c = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    const i = i0 + r, s = i * DS;
    const th = track.th[i], cx = Math.cos(th), sz = Math.sin(th);
    const hs = heightsFn(s);
    for (let j = 0; j < nc; j++) {
      const d = cols[j], k = (r * nc + j);
      pos[k * 3] = track.x[i] + cx * d;
      pos[k * 3 + 1] = track.y[i] + hs[j];
      pos[k * 3 + 2] = track.z[i] + sz * d;
      uv[k * 2] = (d - cols[0]) / (cols[nc - 1] - cols[0]);
      uv[k * 2 + 1] = s / ROAD_TEX_LEN;
      if (col) { colorFn(s, d, hs[j], c); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; }
    }
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++)
    for (let j = 0; j < nc - 1; j++) {
      const a = r * nc + j, b = a + 1, cc = a + nc, dd = cc + 1;
      idx.push(a, b, cc, b, dd, cc);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function terrainColor(s, d, h, out) {
  const a = Math.abs(d);
  if (a <= 11.6) return out.setRGB(0.42, 0.4, 0.36);           // gravel shoulder
  const n = 0.5 + 0.5 * Math.sin(s / 23 + d / 7) * Math.sin(s / 57 - d / 13);
  out.setRGB(0.22 + n * 0.1, 0.38 + n * 0.12, 0.14 + n * 0.05);
  if (h > 20) out.lerp(_rock, clamp((h - 20) / 18, 0, 0.6));
  return out;
}
const _rock = new THREE.Color(0.45, 0.43, 0.38);

function buildChunk(ci) {
  const i0 = ci * CHUNK_PTS, i1 = i0 + CHUNK_PTS;
  extendTrack(i1 * DS + DS);
  const group = new THREE.Group();
  const rnd = mulberry32(ci * 9973 + 17);

  const road = new THREE.Mesh(buildRibbon(i0, i1, [-ROAD_HALF, ROAD_HALF], () => [0, 0]), MAT.road);
  road.receiveShadow = true;
  group.add(road);

  const terrain = new THREE.Mesh(buildRibbon(i0, i1, TERRAIN_D, terrainHeights, terrainColor), MAT.terrain);
  terrain.receiveShadow = true;
  group.add(terrain);

  // Guardrails: two thin vertical ribbons per side.
  for (const side of [-1, 1]) {
    const d = RAIL_D * side;
    const g = buildRibbon(i0, i1, [d, d + 0.001 * side], () => [0.55, 0.55]);
    const p = g.attributes.position;
    for (let r = 0; r < p.count; r++) if (r % 2 === 1) p.setY(r, p.getY(r) + 0.32);
    // Reposition second column straight up (vertical strip) instead of sideways.
    for (let r = 0; r < p.count; r += 2) { p.setX(r + 1, p.getX(r)); p.setZ(r + 1, p.getZ(r)); }
    g.computeVertexNormals();
    const rail = new THREE.Mesh(g, MAT.rail);
    rail.castShadow = true;
    group.add(rail);
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // Rail posts every 4 m
  const nPosts = Math.floor(CHUNK_LEN / 4) * 2;
  const posts = new THREE.InstancedMesh(GEO.railPost, MAT.post, nPosts);
  let pi = 0;
  for (let k = 0; k < CHUNK_LEN / 4; k++) {
    const s = i0 * DS + k * 4;
    for (const side of [-1, 1]) {
      roadToWorld(s, (RAIL_D + 0.08) * side, 0, v);
      m.compose(v, q.identity(), sc.set(1, 1, 1));
      posts.setMatrixAt(pi++, m);
    }
  }
  group.add(posts);

  // Street lamps every 50 m, alternating sides
  const lampsPer = 2;
  const poles = new THREE.InstancedMesh(GEO.pole, MAT.post, lampsPer);
  const arms = new THREE.InstancedMesh(GEO.arm, MAT.post, lampsPer);
  const heads = new THREE.InstancedMesh(GEO.lamp, MAT.lampHead, lampsPer);
  for (let k = 0; k < lampsPer; k++) {
    const s = i0 * DS + k * 50 + 10, side = k % 2 === 0 ? 1 : -1;
    const p = sample(s);
    q.setFromAxisAngle(up, -p.th + Math.PI / 2);
    roadToWorld(s, (RAIL_D + 0.6) * side, 0, v);
    m.compose(v, q, sc.set(1, 1, 1)); poles.setMatrixAt(k, m);
    roadToWorld(s, (RAIL_D + 0.6 - 1.1) * side, 7.95, v);
    m.compose(v, q, sc.set(1, 1, 1)); arms.setMatrixAt(k, m);
    roadToWorld(s, (RAIL_D + 0.6 - 2.0) * side, 7.85, v);
    m.compose(v, q, sc.set(1, 1, 1)); heads.setMatrixAt(k, m);
  }
  poles.castShadow = true;
  group.add(poles, arms, heads);

  // Trees
  const nTrees = 46;
  const trunks = new THREE.InstancedMesh(GEO.trunk, MAT.trunk, nTrees);
  const c1 = new THREE.InstancedMesh(GEO.crown1, MAT.leaves, nTrees);
  const c2 = new THREE.InstancedMesh(GEO.crown2, MAT.leaves, nTrees);
  const color = new THREE.Color();
  for (let k = 0; k < nTrees; k++) {
    const s = i0 * DS + rnd() * CHUNK_LEN;
    const side = rnd() < 0.5 ? -1 : 1;
    const d = side * (15.5 + Math.pow(rnd(), 1.4) * 75);
    roadToWorld(s, d, terrainHeightAt(s, d) - 0.2, v);
    const size = 0.7 + rnd() * 0.8;
    q.setFromAxisAngle(up, rnd() * Math.PI * 2);
    m.compose(v, q, sc.set(size, size * (0.85 + rnd() * 0.4), size));
    trunks.setMatrixAt(k, m); c1.setMatrixAt(k, m); c2.setMatrixAt(k, m);
    color.setHSL(0.27 + rnd() * 0.08, 0.45 + rnd() * 0.2, 0.2 + rnd() * 0.1);
    c1.setColorAt(k, color); c2.setColorAt(k, color.offsetHSL(0, 0, 0.03));
  }
  for (const im of [trunks, c1, c2]) { im.castShadow = true; im.receiveShadow = true; }
  group.add(trunks, c1, c2);

  scene.add(group);
  chunks.set(ci, group);
}

function disposeChunk(ci) {
  const g = chunks.get(ci);
  g.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    else if (o.isMesh && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose();
  });
  scene.remove(g);
  chunks.delete(ci);
}

function updateChunks(s, budget = 1) {
  const first = Math.max(0, Math.floor((s - VIEW_BEHIND) / CHUNK_LEN));
  const last = Math.floor((s + VIEW_AHEAD) / CHUNK_LEN);
  for (const ci of [...chunks.keys()]) if (ci < first || ci > last) disposeChunk(ci);
  for (let ci = first; ci <= last && budget > 0; ci++) {
    if (!chunks.has(ci)) { buildChunk(ci); budget--; }
  }
}

// ---------------------------------------------------------------- cockpit
const cockpit = new THREE.Group();
camera.add(cockpit);
const PLAYER_COLOR = 0xc0392b;
const dashMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.85 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.6 });
const hoodMat = new THREE.MeshStandardMaterial({ color: PLAYER_COLOR, metalness: 0.25, roughness: 0.5 });
function cockpitBox(w, h, dpt, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  cockpit.add(mesh);
  return mesh;
}
cockpitBox(2.5, 0.4, 0.85, 0, -0.74, -0.98, dashMat);          // dashboard body
cockpitBox(2.5, 0.05, 0.7, 0, -0.53, -1.08, trimMat, 0.1);    // dash top
cockpitBox(0.46, 0.12, 0.16, 0, -0.5, -0.72, trimMat, -0.35); // instrument hood
cockpitBox(2.0, 0.08, 2.6, 0, -0.78, -2.65, hoodMat, 0.06);   // bonnet
cockpitBox(0.07, 1.3, 0.08, -1.15, 0.0, -1.0, dashMat, -0.6, 0, 0.1);  // A-pillars
cockpitBox(0.07, 1.3, 0.08, 1.15, 0.0, -1.0, dashMat, -0.6, 0, -0.1);
cockpitBox(2.5, 0.1, 0.8, 0, 0.62, -0.45, dashMat);             // roof edge
cockpitBox(0.12, 0.9, 1.8, -1.18, -0.6, -0.2, trimMat);         // doors
cockpitBox(0.12, 0.9, 1.8, 1.18, -0.6, -0.2, trimMat);

// Rear-view mirror shows a render target; repeat.x = -1 mirrors it.
mirrorTarget.texture.wrapS = THREE.RepeatWrapping;
mirrorTarget.texture.repeat.x = -1;
const mirror = new THREE.Group();
mirror.position.set(0, 0.42, -0.78);
mirror.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.085, 0.03), dashMat));
const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), new THREE.MeshBasicMaterial({ map: mirrorTarget.texture, fog: false }));
mirrorGlass.position.z = 0.016;
mirror.add(mirrorGlass);
mirror.rotation.x = -0.05;
cockpit.add(mirror);

// Steering wheel
const wheelPivot = new THREE.Group();
wheelPivot.position.set(0, -0.44, -0.56);
wheelPivot.rotation.x = -0.35;
const wheel = new THREE.Group();
wheelPivot.add(wheel);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 10, 40), wheelMat));
const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.05, 16), trimMat);
hub.rotation.x = Math.PI / 2;
wheel.add(hub);
for (const a of [0, Math.PI, -Math.PI / 2]) {
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.028, 0.018), wheelMat);
  spoke.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0);
  spoke.rotation.z = a;
  wheel.add(spoke);
}
const topMark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
topMark.position.y = 0.19;
wheel.add(topMark);
cockpit.add(wheelPivot);
cockpit.traverse((o) => o.layers.set(1));

// Headlights (on at night)
const headlights = [];
for (const x of [-0.75, 0.75]) {
  const l = new THREE.SpotLight(0xfff2d6, 0, 140, 0.42, 0.55, 1.1);
  l.position.set(x, -0.7, -4.1);
  l.target.position.set(x * 1.5, -1.6, -40);
  camera.add(l, l.target);
  headlights.push(l);
}

// ---------------------------------------------------------------- traffic
const CAR_COLORS = [0xf5f5f5, 0x1d1f22, 0x9aa1a8, 0x2a62c9, 0xd23a2b, 0xe7b416, 0x2f8f5b, 0x5c3b8a, 0xffffff, 0x666b70];
const GEO_CAR = {
  body: new THREE.BoxGeometry(1.8, 0.62, 4.3).translate(0, 0.62, 0),
  cabin: new THREE.BoxGeometry(1.6, 0.55, 2.2).translate(0, 1.2, 0.25),
  wheel: new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14).rotateZ(Math.PI / 2),
  light: new THREE.BoxGeometry(0.42, 0.14, 0.05),
  truckCab: new THREE.BoxGeometry(2.4, 2.4, 2.2).translate(0, 1.6, -3.3),
  truckCargo: new THREE.BoxGeometry(2.5, 2.9, 6.4).translate(0, 2.0, 1.1),
  truckWin: new THREE.BoxGeometry(2.2, 0.8, 0.05),
};
function makeCarMesh(type, colorHex) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.45, roughness: 0.35 });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  let halfLen;
  if (type === "truck") {
    add(GEO_CAR.truckCab, paint);
    add(GEO_CAR.truckCargo, MAT.cargo);
    add(GEO_CAR.truckWin, MAT.glass, 0, 2.2, -4.41);
    for (const z of [-3.3, 1.0, 3.4]) for (const x of [-1.05, 1.05]) add(GEO_CAR.wheel, MAT.tyre, x, 0.45, z).scale.set(1, 1.3, 1.3);
    for (const x of [-0.9, 0.9]) { add(GEO_CAR.light, MAT.tail, x, 0.9, 4.31); add(GEO_CAR.light, MAT.head, x, 0.95, -4.41); }
    halfLen = 4.4;
  } else {
    add(GEO_CAR.body, paint);
    add(GEO_CAR.cabin, MAT.glass);
    for (const z of [-1.4, 1.4]) for (const x of [-0.84, 0.84]) add(GEO_CAR.wheel, MAT.tyre, x, 0.34, z);
    for (const x of [-0.6, 0.6]) { add(GEO_CAR.light, MAT.tail, x, 0.72, 2.16); add(GEO_CAR.light, MAT.head, x, 0.7, -2.16); }
    halfLen = 2.15;
  }
  g.rotation.order = "YXZ";
  return { mesh: g, halfLen, halfWid: type === "truck" ? 1.25 : 0.92, paint };
}

const cars = [];
const rnd = mulberry32(Date.now() & 0xffff);
function spawnCar(dir, sMin, sMax) {
  const lanes = dir > 0 ? LANES_FWD : LANES_ONC;
  for (let tries = 0; tries < 6; tries++) {
    const lane = lanes[Math.floor(rnd() * lanes.length)];
    const s = sMin + rnd() * (sMax - sMin);
    if (cars.some((c) => Math.abs(c.d - lane) < 2 && Math.abs(c.s - s) < 30)) continue;
    const truck = rnd() < 0.18;
    const car = makeCarMesh(truck ? "truck" : "car", CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)]);
    // Right lane cruises slower; trucks slowest.
    let kmh = dir > 0 ? (Math.abs(lane) > 3 ? 65 + rnd() * 25 : 85 + rnd() * 30) : 70 + rnd() * 30;
    if (truck) kmh = 55 + rnd() * 20;
    Object.assign(car, { dir, s, d: lane, targetD: lane, v: kmh / 3.6, cruise: kmh / 3.6, prevRel: null, hitCooldown: 0 });
    scene.add(car.mesh);
    cars.push(car);
    return;
  }
}
function removeCar(i) {
  const c = cars[i];
  scene.remove(c.mesh);
  c.paint.dispose();
  cars.splice(i, 1);
}

function updateTraffic(dt) {
  const ps = player.s;
  const fwd = cars.filter((c) => c.dir > 0).length;
  const onc = cars.length - fwd;
  if (fwd < 13) spawnCar(1, ps + 250, ps + 700);
  if (onc < 9) spawnCar(-1, ps + 450, ps + 750);

  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (c.dir > 0) {
      // Car following + lane changes
      let target = c.cruise, blocked = false;
      for (const o of cars) {
        if (o === c || o.dir < 0 || Math.abs(o.d - c.d) > 2) continue;
        const gap = o.s - c.s - o.halfLen - c.halfLen;
        if (gap > 0 && gap < 35) { target = Math.min(target, o.v - (35 - gap) * 0.15); blocked = true; }
      }
      const pg = ps - c.s - 2.1 - c.halfLen;
      if (Math.abs(player.d - c.d) < 2.2 && pg > -1 && pg < 30) { target = Math.min(target, player.vs - (30 - pg) * 0.2); blocked = true; }
      if (blocked && c.d === c.targetD && rnd() < dt * 0.8) {
        const other = LANES_FWD.find((l) => l !== c.d);
        const free = !cars.some((o) => o !== c && Math.abs(o.d - other) < 2 && Math.abs(o.s - c.s) < 22) &&
          !(Math.abs(player.d - other) < 2.5 && Math.abs(ps - c.s) < 20);
        if (free) c.targetD = other;
      }
      c.v = approach(c.v, Math.max(0, target), (target < c.v ? 9 : 2.5) * dt);
      c.d = approach(c.d, c.targetD, 1.6 * dt);
      if (Math.abs(c.d - c.targetD) < 0.01) c.d = c.targetD;
      c.s += c.v * dt;
    } else {
      if (c.hitCooldown <= 0) c.v = approach(c.v, c.cruise, 3 * dt); // recover after a crash
      c.s -= c.v * dt;
    }

    const rel = c.s - ps;
    if (rel > VIEW_AHEAD + 100 || rel < -VIEW_BEHIND) { removeCar(i); continue; }

    // Pose
    const p = sample(c.s);
    roadToWorld(c.s, c.d, 0, c.mesh.position);
    c.mesh.rotation.y = -p.th + (c.dir < 0 ? Math.PI : 0) + (c.targetD - c.d) * 0.06 * c.dir;
    c.mesh.rotation.x = Math.atan(p.slope) * c.dir;

    // Collisions & events
    c.hitCooldown -= dt;
    const dd = Math.abs(c.d - player.d);
    if (Math.abs(rel) < c.halfLen + 2.15 && dd < c.halfWid + 0.92 && c.hitCooldown <= 0 && state !== "menu") {
      collide(c, rel);
    }
    if (c.prevRel !== null && c.prevRel > 0 && rel <= 0 && state === "play") {
      if (c.dir > 0 && player.vs > 0 && c.hitCooldown <= 0) addBonus(50, "추월!", () => stats.overtakes++);
      else if (c.dir < 0 && dd < 3.4 && c.hitCooldown <= 0 && player.vs > 15) addBonus(100, "아슬아슬!");
    }
    c.prevRel = rel;
  }
}

function collide(c, rel) {
  const carVs = c.v * c.dir;
  const impact = Math.abs(player.vs - carVs) * 3.6; // km/h
  c.hitCooldown = 1.5;
  c.v = c.dir > 0 ? Math.max(0, c.v * 0.7) : 0;
  // Momentum: player picks up most of the other car's velocity.
  player.v = lerp(player.vs, carVs, 0.75) / Math.max(0.3, Math.cos(player.psi));
  if (c.dir < 0) player.v = Math.min(player.v, -2);
  // Separate along the road.
  const overlap = c.halfLen + 2.15 - Math.abs(rel);
  player.s -= Math.sign(rel || 1) * (overlap + 0.2);
  player.d += Math.sign(player.d - c.d || 1) * 0.4;
  player.psi *= 0.4;
  shake = Math.min(1.5, 0.3 + impact / 80);
  sfx.crash(Math.min(1, impact / 100));
  if (state !== "play") return;
  const dmg = clamp(impact * 0.55, 4, 100);
  player.damage = Math.min(100, player.damage + dmg);
  toast(`충돌! -${Math.round(dmg)}%`, "#f87171");
  if (player.damage >= 100) gameOver();
}

// ---------------------------------------------------------------- player
const player = {};
const stats = {};
let state = "menu", shake = 0, night = false;
function resetGame() {
  for (let i = cars.length - 1; i >= 0; i--) removeCar(i);
  Object.assign(player, { s: 60, d: 5.25, psi: 0, v: 0, vs: 0, steer: 0, damage: 0, rpm: 900, gear: 1, latAcc: 0, accel: 0 });
  Object.assign(stats, { distance: 0, score: 0, overtakes: 0 });
  for (let k = 0; k < 8; k++) spawnCar(1, 140, 700);
  for (let k = 0; k < 6; k++) spawnCar(-1, 200, 750);
  updateChunks(player.s, 99);
}

const keys = new Set();
const hand = { active: false, steer: 0, throttle: 0, tracked: false };

const GEARS = [0, 32, 58, 88, 122, 160, 215];
function updatePlayer(dt) {
  const p = sample(player.s);
  const kmh = Math.abs(player.v) * 3.6;
  const up = keys.has("KeyW") || keys.has("ArrowUp");
  const down = keys.has("KeyS") || keys.has("ArrowDown");
  const left = keys.has("KeyA") || keys.has("ArrowLeft");
  const right = keys.has("KeyD") || keys.has("ArrowRight");
  const handbrake = keys.has("Space");
  const alive = state === "play";

  // Steering
  let steerTarget = (right ? 1 : 0) - (left ? 1 : 0);
  if (hand.active && hand.tracked && !left && !right) steerTarget = hand.steer;
  if (!alive) steerTarget = 0;
  const steerRate = (steerTarget === 0 || Math.sign(steerTarget) !== Math.sign(player.steer)) ? 4.5 : 2.6;
  player.steer = hand.active && hand.tracked && !left && !right
    ? lerp(player.steer, steerTarget, 1 - Math.exp(-10 * dt))
    : approach(player.steer, steerTarget, steerRate * dt);

  // Longitudinal
  const offroad = Math.abs(player.d) > ROAD_HALF;
  let throttle = up ? 1 : 0;
  if (hand.active && hand.tracked && !down) throttle = Math.max(throttle, hand.throttle);
  if (!alive) throttle = 0;
  let a = 0;
  if (throttle > 0) {
    if (player.v >= -0.5) a += throttle * 8.0 * (1 - Math.pow(Math.max(0, player.v) / MAX_SPEED, 2)) * (1 - player.damage / 250);
    else a += 12; // braking out of reverse
  }
  if (down && alive) {
    if (player.v > 0.5) a -= 13;
    else a -= player.v > -7 ? 4 : 0; // reverse
  }
  if (handbrake) a -= Math.sign(player.v) * 9;
  a -= Math.sign(player.v) * (0.25 + 0.00055 * player.v * player.v);   // drag + rolling
  if (offroad) a -= Math.sign(player.v) * (1.5 + Math.abs(player.v) * 0.06);
  if (!alive) a -= Math.sign(player.v) * 6;
  const prevV = player.v;
  player.v += a * dt;
  if (prevV * player.v < 0) player.v = 0; // braking/drag stops the car, never flips direction
  player.accel = lerp(player.accel, (player.v - prevV) / dt, 1 - Math.exp(-6 * dt));

  // Lateral (kinematic bicycle model with a grip limit)
  const v = player.v;
  const maxDelta = 0.5 / (1 + Math.pow(Math.abs(v) / 11, 1.3));
  let yawRate = (v * Math.tan(player.steer * maxDelta)) / 2.7;
  const grip = (offroad ? 7 : 13) * (handbrake ? 0.75 : 1);
  if (Math.abs(v) > 1) yawRate = clamp(yawRate, -grip / Math.abs(v), grip / Math.abs(v));
  if (handbrake && Math.abs(v) > 8) yawRate *= 1.5;
  player.latAcc = lerp(player.latAcc, yawRate * v, 1 - Math.exp(-5 * dt));

  const denom = Math.max(0.5, 1 - p.k * player.d);
  const sDot = (v * Math.cos(player.psi)) / denom;
  player.psi += (yawRate - p.k * sDot) * dt;
  player.psi = clamp(player.psi, -1.3, 1.3);
  player.s += sDot * dt;
  player.d += v * Math.sin(player.psi) * dt;
  player.vs = sDot;
  if (player.s < 5) { player.s = 5; player.v = Math.max(0, player.v); }

  // Guardrail
  if (Math.abs(player.d) > DRIVE_LIMIT) {
    const side = Math.sign(player.d);
    player.d = side * DRIVE_LIMIT;
    const lat = v * Math.sin(player.psi) * side;
    if (lat > 0) {
      player.psi = -player.psi * 0.25;
      player.v *= 0.88;
      if (lat > 4 && alive) {
        const dmg = Math.round(lat * 2.2);
        player.damage = Math.min(100, player.damage + dmg);
        shake = Math.min(1.2, lat / 12);
        sfx.crash(Math.min(1, lat / 15));
        toast(`가드레일 충돌! -${dmg}%`, "#f87171");
        if (player.damage >= 100) gameOver();
      } else player.v *= 0.995;
    }
  }
  if (offroad && Math.abs(v) > 3) shake = Math.max(shake, Math.min(0.12, Math.abs(v) * 0.004));

  // Engine RPM / gear
  if (player.v < -0.3) { player.gear = -1; player.rpm = 1200 + kmh * 120; }
  else {
    let g = 1;
    while (g < GEARS.length - 1 && kmh > GEARS[g]) g++;
    player.gear = g;
    const lo = GEARS[g - 1] * 0.7, hi = GEARS[g];
    const target = 900 + clamp((kmh - lo) / (hi - lo), 0, 1) * 5600 + throttle * 400;
    player.rpm = lerp(player.rpm, kmh < 3 ? 900 + throttle * 2200 : target, 1 - Math.exp(-8 * dt));
  }

  if (alive && sDot > 0) {
    stats.distance += sDot * dt;
    stats.score += sDot * dt * (kmh > 100 ? 2 : 1);
  }
}

// ---------------------------------------------------------------- camera
const _camPos = new THREE.Vector3();
let bob = 0;
function updateCamera(dt) {
  const p = sample(player.s);
  roadToWorld(player.s, player.d, EYE_HEIGHT, _camPos);
  bob += dt * (6 + Math.abs(player.v) * 0.4);
  const sh = shake;
  shake = Math.max(0, shake - dt * 2.2);
  const jx = (Math.random() - 0.5) * 0.06 * sh, jy = (Math.random() - 0.5) * 0.06 * sh;
  camera.position.set(_camPos.x + jx, _camPos.y + jy + Math.sin(bob) * 0.004, _camPos.z);
  const thCar = p.th + player.psi;
  camera.rotation.y = -thCar;
  camera.rotation.x = Math.atan(p.slope * Math.cos(player.psi)) - player.accel * 0.004 + jy * 0.3;
  camera.rotation.z = clamp(player.latAcc * 0.006, -0.06, 0.06) + jx * 0.4;
  wheel.rotation.z = -player.steer * 2.4;

  // Mirror camera: at roof height, facing backwards.
  rearCam.position.copy(camera.position);
  rearCam.position.y += 0.15;
  rearCam.rotation.set(-camera.rotation.x * 0.5 - 0.02, camera.rotation.y + Math.PI, 0);

  sky.position.copy(camera.position);
  sunDisc.position.copy(camera.position).addScaledVector(SUN_DIR_ACTIVE, 1000);
  ground.position.set(camera.position.x, -14, camera.position.z);

  const ahead = roadToWorld(player.s + 30, 0, 0);
  sun.target.position.copy(ahead);
  sun.position.copy(ahead).addScaledVector(night ? MOON_DIR : SUN_DIR, 200);
}
const MOON_DIR = new THREE.Vector3(-0.4, 0.7, 0.5).normalize();

// ---------------------------------------------------------------- day / night
function setNight(on) {
  night = on;
  if (on) {
    skyUniforms.top.value.set(0x02040b); skyUniforms.bottom.value.set(0x0e1626);
    scene.fog.color.set(0x070b14); scene.fog.near = 30; scene.fog.far = 420;
    hemi.intensity = 0.12; sun.intensity = 0.25; sun.color.set(0x8fa8ff);
    sunDisc.material.color.set(0xd8e2ff); sunDisc.scale.setScalar(0.5);
    headlights.forEach((l) => (l.intensity = 120));
    MAT.lampHead.emissiveIntensity = 3; MAT.tail.emissiveIntensity = 3; MAT.head.emissiveIntensity = 3;
    ground.material.color.set(0x1a2614);
  } else {
    skyUniforms.top.value.set(0x3d7fd1); skyUniforms.bottom.value.set(0xd8e6f2);
    scene.fog.color.set(0xbfd6ea); scene.fog.near = 80; scene.fog.far = 620;
    hemi.intensity = 1.3; sun.intensity = 2.6; sun.color.set(0xfff1d8);
    sunDisc.material.color.set(0xfff4d6); sunDisc.scale.setScalar(1);
    headlights.forEach((l) => (l.intensity = 0));
    MAT.lampHead.emissiveIntensity = 0.15; MAT.tail.emissiveIntensity = 0.6; MAT.head.emissiveIntensity = 0.3;
    ground.material.color.set(0x4f7a34);
  }
  sunDisc.position.copy(camera.position).addScaledVector(on ? MOON_DIR : SUN_DIR, 1000);
  SUN_DIR_ACTIVE = on ? MOON_DIR : SUN_DIR;
  updateModeLabel();
}
let SUN_DIR_ACTIVE = SUN_DIR;

// ---------------------------------------------------------------- audio
const sfx = (() => {
  let ctx = null, master, engGain, osc1, osc2, filter, windGain, windFilter, muted = false;
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 600; filter.Q.value = 4;
    engGain = ctx.createGain(); engGain.gain.value = 0.0;
    osc1 = ctx.createOscillator(); osc1.type = "sawtooth";
    osc2 = ctx.createOscillator(); osc2.type = "square";
    osc1.connect(filter); osc2.connect(filter); filter.connect(engGain); engGain.connect(master);
    osc1.start(); osc2.start();
    // wind / road noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = "bandpass"; windFilter.frequency.value = 500; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    noise.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
    noise.start();
    sfx.noiseBuf = buf;
  }
  return {
    init,
    get muted() { return muted; },
    toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.6; updateModeLabel(); },
    update(rpm, throttle, speed, offroad) {
      if (!ctx) return;
      const t = ctx.currentTime, f = (rpm / 60) * 2;
      osc1.frequency.setTargetAtTime(f, t, 0.03);
      osc2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
      filter.frequency.setTargetAtTime(300 + rpm * 0.25 + throttle * 600, t, 0.05);
      engGain.gain.setTargetAtTime(state === "play" ? 0.07 + throttle * 0.06 : 0.04, t, 0.08);
      windGain.gain.setTargetAtTime(Math.min(0.25, speed * speed * 0.00008) + (offroad ? 0.12 : 0), t, 0.1);
      windFilter.frequency.setTargetAtTime(offroad ? 180 : 400 + speed * 12, t, 0.1);
    },
    crash(strength) {
      if (!ctx) return;
      const src = ctx.createBufferSource(); src.buffer = sfx.noiseBuf;
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 900;
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.9 * strength + 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      src.connect(lp); lp.connect(g); g.connect(master);
      src.start(t); src.stop(t + 0.7);
    },
  };
})();

// ---------------------------------------------------------------- HUD
const $ = (id) => document.getElementById(id);
const gaugeCtx = $("gaugeCanvas").getContext("2d");
const mapCtx = $("minimap").getContext("2d");
let toastTimer = 0;
function toast(text, color = "#fde047") {
  const el = $("toast");
  el.textContent = text; el.style.color = color; el.style.opacity = 1;
  toastTimer = 1.3;
}
function addBonus(pts, label, fn) {
  stats.score += pts;
  if (fn) fn();
  toast(`${label} +${pts}`);
}
function updateModeLabel() {
  const parts = [night ? "🌙 밤" : "☀️ 낮", sfx.muted ? "🔇" : "🔊"];
  if (hand.active) parts.push(hand.tracked ? "✋ 손 핸들: 인식됨" : "✋ 손 핸들: 두 손을 보여주세요");
  $("mode").textContent = parts.join("   ");
}

function drawGauge() {
  const g = gaugeCtx, W = 260, H = 150, cx = W / 2, cy = 112, R = 100;
  g.clearRect(0, 0, W, H);
  const a0 = Math.PI * 0.85, a1 = Math.PI * 2.15;
  g.lineCap = "round";
  g.lineWidth = 10; g.strokeStyle = "rgba(0,0,0,0.45)";
  g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
  const rpmFrac = clamp(player.rpm / 7000, 0, 1);
  g.strokeStyle = rpmFrac > 0.85 ? "#f87171" : "#f59e0b";
  g.lineWidth = 6;
  g.beginPath(); g.arc(cx, cy, R, a0, a0 + (a1 - a0) * rpmFrac); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.8)"; g.font = "11px sans-serif"; g.textAlign = "center";
  for (let k = 0; k <= 240; k += 40) {
    const a = a0 + (a1 - a0) * (k / 240);
    g.fillText(k, cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22) + 4);
  }
  const kmh = Math.abs(player.v) * 3.6;
  const a = a0 + (a1 - a0) * clamp(kmh / 240, 0, 1);
  g.strokeStyle = "#fff"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 40), cy + Math.sin(a) * (R - 40)); g.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); g.stroke();
}

function drawMinimap() {
  const g = mapCtx, S = 180, C = S / 2, scale = C / 320;
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.clip();
  const me = sample(player.s);
  const ox = me.x + Math.cos(me.th) * player.d, oz = me.z + Math.sin(me.th) * player.d;
  const th = me.th + player.psi, ct = Math.cos(th), st = Math.sin(th);
  const toScreen = (x, z) => {
    const dx = x - ox, dz = z - oz;
    return [C + (dx * ct + dz * st) * scale, C - (dx * st - dz * ct) * scale];
  };
  g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 5; g.lineJoin = "round";
  g.beginPath();
  for (let s = Math.max(0, player.s - 200); s < player.s + 420; s += 6) {
    const p = sample(s), [x, y] = toScreen(p.x, p.z);
    if (s === Math.max(0, player.s - 200)) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  for (const c of cars) {
    const w = roadToWorld(c.s, c.d, 0, _mm);
    const [x, y] = toScreen(w.x, w.z);
    g.fillStyle = c.dir > 0 ? "#fde047" : "#f87171";
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = "#38bdf8";
  g.beginPath(); g.moveTo(C, C - 7); g.lineTo(C - 5, C + 5); g.lineTo(C + 5, C + 5); g.closePath(); g.fill();
  g.restore();
}
const _mm = new THREE.Vector3();

function updateHUD(dt) {
  const kmh = Math.abs(player.v) * 3.6;
  $("speed").textContent = Math.round(kmh);
  $("gear").textContent = player.gear < 0 ? "R" : (kmh < 1 && !keys.has("KeyW") && !keys.has("ArrowUp") ? "N" : "D" + player.gear);
  $("dist").textContent = (stats.distance / 1000).toFixed(2);
  $("pts").textContent = Math.floor(stats.score).toLocaleString();
  $("overtakes").textContent = stats.overtakes;
  const hp = 100 - player.damage;
  const fill = $("damageFill");
  fill.style.width = hp + "%";
  fill.style.background = hp > 60 ? "#4ade80" : hp > 30 ? "#facc15" : "#f87171";
  drawGauge();
  drawMinimap();
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $("toast").style.opacity = 0; }
}

// ---------------------------------------------------------------- game flow
function startGame() {
  sfx.init();
  resetGame();
  state = "play";
  $("overlay").classList.add("hidden");
  renderer.domElement.focus();
}
function gameOver() {
  state = "over";
  setTimeout(() => {
    $("title").textContent = "게임 오버";
    $("subtitle").innerHTML = `주행 거리 <b>${(stats.distance / 1000).toFixed(2)} km</b> · 점수 <b>${Math.floor(stats.score).toLocaleString()}</b> · 추월 <b>${stats.overtakes}</b>`;
    $("startBtn").textContent = "다시 달리기";
    $("overlay").classList.remove("hidden");
  }, 1200);
}
$("startBtn").addEventListener("click", startGame);

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "KeyN") setNight(!night);
  if (e.code === "KeyM") sfx.toggle();
  if (e.code === "KeyR" && state !== "menu") startGame();
  if (e.code === "KeyC") toggleHandSteering();
  if (e.code === "Enter" && state !== "play") startGame();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- hand steering (optional)
let tracker = null;
async function toggleHandSteering() {
  if (hand.active) {
    hand.active = false;
    if (tracker?.video) tracker.video.style.display = "none";
    updateModeLabel();
    return;
  }
  hand.active = true;
  updateModeLabel();
  if (tracker) { tracker.video.style.display = "block"; return; }
  try {
    toast("카메라 불러오는 중…", "#93c5fd");
    const { Tracker } = await import("../../lib/tracker.js");
    tracker = new Tracker({ face: false, hands: true, maxHands: 2, smoothing: 0.4 });
    tracker.onUpdate(({ hands }) => {
      const wasTracked = hand.tracked;
      if (hands.length >= 2) {
        const [a, b] = hands.map((h) => h.point(0)).sort((p, q) => p.x - q.x); // wrists, left→right on screen
        const angle = Math.atan2(b.y - a.y, b.x - a.x);  // right hand lower → clockwise → steer right
        hand.steer = clamp(angle / 0.65, -1, 1);
        hand.throttle = 0.85;
        hand.tracked = true;
      } else {
        hand.tracked = false;
        hand.throttle = 0;
      }
      if (wasTracked !== hand.tracked) updateModeLabel();
    });
    await tracker.start();
    tracker.video.id = "camPreview";
    tracker.video.style.display = hand.active ? "block" : "none";
    toast("두 손으로 핸들을 잡으세요", "#93c5fd");
  } catch (err) {
    console.error(err);
    hand.active = false;
    tracker = null;
    toast("카메라를 사용할 수 없어요", "#f87171");
    updateModeLabel();
  }
}

// ---------------------------------------------------------------- main loop
resetGame();
setNight(false);
updateModeLabel();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state !== "menu") {
    // Fixed sub-steps keep the physics stable at low frame rates.
    const steps = Math.ceil(dt / (1 / 120));
    for (let k = 0; k < steps; k++) {
      updatePlayer(dt / steps);
    }
    updateTraffic(dt);
  } else {
    // Attract mode: gently roll forward behind the menu.
    player.s += 12 * dt; player.v = 12; player.vs = 12;
    updateTraffic(dt);
  }
  updateChunks(player.s);
  updateCamera(dt);
  const throttleNow = (keys.has("KeyW") || keys.has("ArrowUp") || (hand.active && hand.tracked)) ? 1 : 0;
  sfx.update(player.rpm, throttleNow, Math.abs(player.v), Math.abs(player.d) > ROAD_HALF);
  updateHUD(dt);

  // Rear-view mirror pass, then main pass.
  mirrorGlass.visible = false;
  renderer.setRenderTarget(mirrorTarget);
  renderer.render(scene, rearCam);
  renderer.setRenderTarget(null);
  mirrorGlass.visible = true;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Exposed for debugging in the console.
window.__drive = { player, cars, stats, setNight };
