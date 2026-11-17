// ECHO NOD — shell-fur rendering.
//
// A surface is drawn N times ("shells"), each pushed a little further out
// along its normal. A strand-height texture decides, per pixel, whether a
// strand reaches that shell. Short, dense strands + darker roots + a soft rim
// light give the plush, felted look of the reference renders.

import * as THREE from 'three';

let strandTexture = null;

// Tileable strand-height map. R = strand height (0..1), G = per-strand tint.
function getStrandTexture() {
  if (strandTexture) return strandTexture;
  const N = 256;
  const height = new Float32Array(N * N);
  const tint = new Float32Array(N * N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const COUNT = 11000;
  for (let s = 0; s < COUNT; s++) {
    const cx = rnd() * N, cy = rnd() * N;
    const r = 1.1 + rnd() * 1.2;
    const h = 0.45 + rnd() * 0.55;
    const t = rnd();
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const px = Math.floor(cx + dx), py = Math.floor(cy + dy);
        const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy) / r;
        if (d >= 1) continue;
        const v = h * (1 - d * d);
        const i = ((py % N + N) % N) * N + ((px % N + N) % N);
        if (v > height[i]) { height[i] = v; tint[i] = t; }
      }
    }
  }
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    data[i * 4] = Math.round(height[i] * 255);
    data[i * 4 + 1] = Math.round(tint[i] * 255);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  strandTexture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  strandTexture.wrapS = strandTexture.wrapT = THREE.RepeatWrapping;
  strandTexture.magFilter = THREE.LinearFilter;
  strandTexture.minFilter = THREE.LinearMipmapLinearFilter;
  strandTexture.generateMipmaps = true;
  strandTexture.needsUpdate = true;
  return strandTexture;
}

export const LIGHT_DIR = new THREE.Vector3(-0.45, 0.75, 0.6).normalize();

const vertexShader = /* glsl */ `
  attribute float layer;
  uniform float furLen;
  uniform vec3 gravity;
  varying vec3 vObjPos;
  varying vec3 vObjNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying float vLayer;
  void main() {
    vec3 n = normalize(normal);
    vec3 p = position + n * furLen * layer + gravity * furLen * layer * layer;
    vObjPos = position;
    vObjNormal = n;
    vLayer = layer;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * n);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D strands;
  uniform vec3 color;
  uniform vec3 lightDir;
  uniform float texScale;
  uniform float rim;
  uniform float density;
  varying vec3 vObjPos;
  varying vec3 vObjNormal;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  varying float vLayer;

  void main() {
    vec3 w = pow(abs(vObjNormal), vec3(6.0));
    w /= (w.x + w.y + w.z);
    vec3 p = vObjPos * texScale;
    vec4 s = texture2D(strands, p.yz) * w.x
           + texture2D(strands, p.zx + 0.37) * w.y
           + texture2D(strands, p.xy + 0.71) * w.z;
    float h = s.r * density;
    if (vLayer > 0.001 && h < vLayer) discard;

    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDir);
    float ndl = dot(N, lightDir);
    float wrapLight = clamp((ndl + 0.7) / 1.7, 0.0, 1.0);
    float ao = mix(0.60, 1.0, pow(vLayer, 0.8));
    vec3 c = color * (0.74 + 0.42 * wrapLight) * ao;
    c *= 0.95 + 0.10 * s.g;
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
    c += fres * rim * mix(vec3(1.0), color, 0.35) * (0.35 + 0.65 * vLayer);
    // soft cool fill from below so the underside isn't muddy
    c += color * 0.06 * clamp(-N.y, 0.0, 1.0);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

export function makeFurMaterial(hex, { furLen = 0.042, texScale = 1.7, rim = 0.42, density = 1.0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      strands: { value: getStrandTexture() },
      color: { value: new THREE.Color(hex) },
      lightDir: { value: LIGHT_DIR.clone() },
      furLen: { value: furLen },
      gravity: { value: new THREE.Vector3(0, -0.35, 0) },
      texScale: { value: texScale },
      rim: { value: rim },
      density: { value: density },
    },
    vertexShader,
    fragmentShader,
  });
}

// Draw `geo` as `shells` stacked shells (instanced).
export function makeFurMesh(geo, material, shells) {
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = geo.index;
  ig.setAttribute('position', geo.getAttribute('position'));
  ig.setAttribute('normal', geo.getAttribute('normal'));
  const n = Math.max(2, shells);
  const layers = new Float32Array(n);
  for (let i = 0; i < n; i++) layers[i] = i / (n - 1);
  ig.setAttribute('layer', new THREE.InstancedBufferAttribute(layers, 1));
  ig.instanceCount = n;
  ig.boundingSphere = geo.boundingSphere || (geo.computeBoundingSphere(), geo.boundingSphere);
  const mesh = new THREE.Mesh(ig, material);
  mesh.frustumCulled = false;
  mesh.userData.baseGeometry = geo;
  return mesh;
}

// Build a closed surface from fn(u, v, out) — u wraps around, v goes from
// bottom pole (0) to top pole (1). Normals come from finite differences, so
// arbitrary deformations stay smooth and seamless.
export function makeSurface(fn, segU = 72, segV = 56) {
  const pos = [], nor = [], idx = [];
  const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const du = new THREE.Vector3(), dv = new THREE.Vector3(), n = new THREE.Vector3();
  const e = 1e-3;
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      fn(u, v, p);
      pos.push(p.x, p.y, p.z);
      if (j === 0 || j === segV) {
        // pole: average direction from centre of mass is fine — use axis
        n.set(0, j === 0 ? -1 : 1, 0);
      } else {
        const vv = Math.min(Math.max(v, 3 * e), 1 - 3 * e);
        fn(u + e, vv, a); fn(u - e, vv, b); du.subVectors(a, b);
        fn(u, vv + e, a); fn(u, vv - e, b); dv.subVectors(a, b);
        n.crossVectors(du, dv).normalize();
      }
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a0 = j * (segU + 1) + i, b0 = a0 + segU + 1;
      idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// Lathe-like body from a (radius, height) profile, with optional
// front/back squash and a deform hook.
export function makeBodyGeometry({ profile, sx = 1, sz = 0.86, deform }) {
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
  curve.arcLengthDivisions = 400;
  const q = new THREE.Vector2();
  return makeSurface((u, v, out) => {
    curve.getPointAt(Math.min(Math.max(v, 0), 1), q);
    const r = Math.max(q.x, 0);
    const th = u * Math.PI * 2;
    out.set(Math.sin(th) * r * sx, q.y, Math.cos(th) * r * sz);
    if (deform) deform(out, u, v);
  });
}

export function makeEllipsoidGeometry(rx, ry, rz, deform) {
  return makeSurface((u, v, out) => {
    const th = u * Math.PI * 2, ph = v * Math.PI;
    const r = Math.sin(ph);
    out.set(Math.sin(th) * r * rx, -Math.cos(ph) * ry, Math.cos(th) * r * rz);
    if (deform) deform(out, u, v);
  }, 40, 28);
}
