// ECHO NOD — the six family characters, modelled in code.
// Each is a fuzzy bean with bead eyes, no mouth, stubby limbs, one prop.

import * as THREE from 'three';
import { makeFurMaterial, makeFurMesh, makeBodyGeometry, makeEllipsoidGeometry } from './fur.js';

export const CHARACTERS = {
  green:  { name: '연두', color: '#a9cf8b' },
  yellow: { name: '노랑', color: '#f6d07a' },
  purple: { name: '보라', color: '#c8a3e3' },
  blue:   { name: '파랑', color: '#90b1ea' },
  coral:  { name: '코랄', color: '#f3a48f' },
  cream:  { name: '크림', color: '#f4ead0' },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS);

const FUR_LEN = 0.042;

const mat = {
  eye: () => new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.12, metalness: 0.0 }),
  canvas: () => new THREE.MeshStandardMaterial({ color: 0xf3ecdc, roughness: 0.95 }),
  wood: () => new THREE.MeshStandardMaterial({ color: 0x8b5b3e, roughness: 0.75 }),
  plain: (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r }),
};

// ---- geometry helpers --------------------------------------------------

function roundedBox(w, h, d, r) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const bev = Math.min(d * 0.45, r * 0.8);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9,
    bevelSegments: 5, curveSegments: 10,
  });
  g.translate(0, 0, -(d - bev * 2) / 2);
  return g;
}

function tube(points, radius, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(curve, 48, radius, 10, closed);
}

function capTube(points, radius, material) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tube(points, radius), material));
  for (const p of [points[0], points[points.length - 1]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), material);
    cap.position.set(...p);
    g.add(cap);
  }
  return g;
}

// Finds points on the body surface by ray casting toward the vertical axis.
class Probe {
  constructor(geo) {
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    this.ray = new THREE.Raycaster();
  }
  // angle in degrees, 0 = straight ahead (+z), 90 = character's left (+x)
  at(angleDeg, y) {
    const a = THREE.MathUtils.degToRad(angleDeg);
    const origin = new THREE.Vector3(Math.sin(a) * 5, y, Math.cos(a) * 5);
    const dir = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));
    this.ray.set(origin, dir);
    const hit = this.ray.intersectObject(this.mesh)[0];
    if (!hit) return { point: new THREE.Vector3(0, y, 0), normal: dir.clone().negate() };
    return { point: hit.point.clone(), normal: hit.face.normal.clone().normalize() };
  }
  front(x, y) {
    this.ray.set(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
    const hit = this.ray.intersectObject(this.mesh)[0];
    return hit ? { point: hit.point.clone(), normal: hit.face.normal.clone().normalize() }
               : { point: new THREE.Vector3(x, y, 0.3), normal: new THREE.Vector3(0, 0, 1) };
  }
}

// ---- per-character definitions ----------------------------------------
// profile: [radius, height] from the bottom pole to the top pole.

const DEFS = {
  green: {
    // tall bean, wider at the hips
    body: { profile: [[0, 0], [0.28, 0.012], [0.41, 0.10], [0.455, 0.32], [0.44, 0.62], [0.40, 0.95], [0.345, 1.24], [0.27, 1.45], [0.15, 1.575], [0.05, 1.612], [0.0, 1.618]], sz: 0.84 },
    eyeY: 1.27, eyeX: 0.115, armY: 0.70, armAngle: 78,
    extras(ctx) {
      // canvas tote hanging from the crook of the right arm (viewer's left)
      const bag = new THREE.Group();
      bag.add(new THREE.Mesh(roundedBox(0.36, 0.34, 0.07, 0.045), mat.canvas()));
      bag.add(new THREE.Mesh(tube([[-0.13, 0.15, 0], [-0.14, 0.32, 0.01], [-0.05, 0.43, 0.03], [0.06, 0.40, 0.02], [0.13, 0.15, 0]], 0.02), mat.canvas()));
      bag.position.set(-0.47, 0.30, 0.30);
      bag.rotation.set(0.04, -0.55, 0.06);
      ctx.pivot.add(bag);
      ctx.arms.right.position.set(-0.40, 0.62, 0.26);
      ctx.arms.right.rotation.set(0.75, -0.2, -0.15);
    },
  },
  yellow: {
    // wide potato, bulging belly, gentle forward lean
    body: {
      profile: [[0, 0], [0.34, 0.012], [0.52, 0.12], [0.58, 0.36], [0.55, 0.64], [0.47, 0.92], [0.35, 1.15], [0.19, 1.28], [0.06, 1.315], [0.0, 1.32]], sz: 0.86,
      deform(p, u, v) { p.z += 0.05 * Math.sin(Math.PI * v) * Math.max(0, p.z); p.z += 0.04 * v * v; },
    },
    eyeY: 0.98, eyeX: 0.12, armY: 0.55, armAngle: 80,
    extras(ctx) {
      // cane in the character's right hand (viewer's left), hooked top
      ctx.pivot.add(capTube([[-0.44, 0.0, 0.40], [-0.43, 0.25, 0.40], [-0.42, 0.50, 0.38], [-0.40, 0.60, 0.36], [-0.33, 0.64, 0.34], [-0.29, 0.58, 0.33]], 0.026, mat.wood()));
      ctx.arms.right.position.set(-0.40, 0.58, 0.32);
      ctx.arms.right.rotation.set(0.9, 0, -0.2);
    },
  },
  purple: {
    body: { profile: [[0, 0], [0.32, 0.012], [0.50, 0.12], [0.55, 0.36], [0.52, 0.66], [0.45, 0.92], [0.33, 1.10], [0.17, 1.195], [0.05, 1.218], [0.0, 1.22]], sz: 0.88 },
    eyeY: 0.86, eyeX: 0.13, armY: 0.52, armAngle: 80,
    extras(ctx) {
      const bun = ctx.fur(makeEllipsoidGeometry(0.16, 0.14, 0.16), 0.8);
      bun.position.set(0, 1.27, -0.02);
      ctx.pivot.add(bun);
      // round glasses
      const metal = mat.plain(0xd8cfc4, 0.35);
      const lens = new THREE.TorusGeometry(0.072, 0.009, 8, 32);
      for (const s of [-1, 1]) {
        const e = ctx.eyes[s < 0 ? 0 : 1].position;
        const ring = new THREE.Mesh(lens, metal);
        ring.position.set(e.x, e.y, e.z + 0.015);
        ring.rotation.y = s * 0.28;
        ctx.pivot.add(ring);
      }
      const l = ctx.eyes[0].position, r = ctx.eyes[1].position;
      ctx.pivot.add(new THREE.Mesh(tube([[l.x + 0.07, l.y + 0.01, l.z + 0.02], [0, l.y + 0.03, l.z + 0.05], [r.x - 0.07, r.y + 0.01, r.z + 0.02]], 0.008), metal));
      // little handbag held low (viewer's left)
      const bag = new THREE.Group();
      bag.add(new THREE.Mesh(roundedBox(0.30, 0.24, 0.12, 0.05), mat.canvas()));
      bag.add(new THREE.Mesh(tube([[-0.08, 0.10, 0], [-0.07, 0.22, 0], [0, 0.27, 0], [0.07, 0.22, 0], [0.08, 0.10, 0]], 0.018), mat.canvas()));
      bag.position.set(-0.30, 0.26, 0.46);
      bag.rotation.y = -0.3;
      ctx.pivot.add(bag);
      ctx.arms.right.position.set(-0.32, 0.50, 0.36);
      ctx.arms.right.rotation.set(0.7, 0, -0.1);
    },
  },
  blue: {
    // penguin: narrow head, broad belly
    body: { profile: [[0, 0], [0.34, 0.012], [0.54, 0.14], [0.58, 0.40], [0.52, 0.72], [0.41, 1.02], [0.31, 1.26], [0.20, 1.41], [0.08, 1.472], [0.0, 1.48]], sz: 0.86 },
    eyeY: 1.18, eyeX: 0.105, armY: 0.66, armAngle: 82,
    extras(ctx) {
      const book = new THREE.Group();
      book.add(new THREE.Mesh(roundedBox(0.30, 0.38, 0.08, 0.025), mat.plain(0xb6e2d6, 0.8)));
      const pages = new THREE.Mesh(roundedBox(0.27, 0.35, 0.05, 0.015), mat.plain(0xfaf6ea, 0.9));
      pages.position.x = -0.02;
      book.add(pages);
      book.position.set(0.36, 0.56, 0.36);
      book.rotation.set(0.05, 0.45, -0.05);
      ctx.pivot.add(book);
      ctx.arms.left.position.set(0.36, 0.56, 0.34);
      ctx.arms.left.rotation.set(0.9, 0, 0.3);
    },
  },
  coral: {
    body: { profile: [[0, 0], [0.30, 0.012], [0.46, 0.12], [0.51, 0.34], [0.48, 0.60], [0.40, 0.83], [0.26, 0.97], [0.09, 1.025], [0.0, 1.03]], sz: 0.9 },
    eyeY: 0.68, eyeX: 0.12, armY: 0.40, armAngle: 82,
    extras(ctx) {
      const bun = ctx.fur(makeEllipsoidGeometry(0.17, 0.15, 0.17), 0.8);
      bun.position.set(0, 1.10, -0.02);
      ctx.pivot.add(bun);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 12), mat.plain(0xf08a6c, 0.6));
      const f = ctx.probe.front(0, 0.6);
      beak.position.copy(f.point).addScaledVector(f.normal, 0.045);
      beak.rotation.x = Math.PI / 2;
      ctx.pivot.add(beak);
      // pom-pom flower on a stick (viewer's right)
      ctx.pivot.add(capTube([[0.40, 0.10, 0.36], [0.41, 0.45, 0.38], [0.42, 0.78, 0.38]], 0.015, mat.wood()));
      const pom = ctx.fur(makeEllipsoidGeometry(0.09, 0.09, 0.09), 0.7, '#fbf3e3');
      pom.position.set(0.42, 0.84, 0.38);
      ctx.pivot.add(pom);
      ctx.arms.left.position.set(0.40, 0.40, 0.34);
      ctx.arms.left.rotation.set(0.9, 0, 0.2);
    },
  },
  cream: {
    // little bear
    body: { profile: [[0, 0], [0.32, 0.012], [0.50, 0.12], [0.55, 0.38], [0.52, 0.68], [0.45, 0.94], [0.33, 1.10], [0.16, 1.18], [0.05, 1.198], [0.0, 1.20]], sz: 0.88 },
    eyeY: 0.86, eyeX: 0.13, armY: 0.52, armAngle: 82,
    extras(ctx) {
      for (const s of [-1, 1]) {
        const ear = ctx.fur(makeEllipsoidGeometry(0.11, 0.11, 0.07), 0.7);
        ear.position.set(s * 0.30, 1.08, -0.02);
        ctx.pivot.add(ear);
        const blush = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), new THREE.MeshBasicMaterial({ color: 0xf6a6a0, transparent: true, opacity: 0.45, depthWrite: false }));
        const c = ctx.probe.front(s * 0.21, 0.77);
        blush.position.copy(c.point).addScaledVector(c.normal, FUR_LEN + 0.004);
        blush.lookAt(blush.position.clone().add(c.normal));
        ctx.pivot.add(blush);
      }
      const yellow = mat.plain(0xf1c457, 0.7);
      // strap from left shoulder across to the right hip
      ctx.pivot.add(new THREE.Mesh(tube([[0.40, 0.98, 0.08], [0.30, 0.86, 0.40], [0.0, 0.62, 0.52], [-0.30, 0.38, 0.47], [-0.42, 0.30, 0.30]], 0.022), yellow));
      const bag = new THREE.Mesh(roundedBox(0.26, 0.20, 0.09, 0.05), yellow);
      bag.position.set(-0.36, 0.26, 0.44);
      bag.rotation.y = -0.55;
      ctx.pivot.add(bag);
    },
  },
};

// ---- Actor -------------------------------------------------------------

export class Actor {
  constructor(id, { shells = 24 } = {}) {
    this.id = id;
    const def = DEFS[id];
    const color = CHARACTERS[id].color;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    this.materials = [];

    const makeFur = (geo, shellScale = 1, hex = color) => {
      const m = makeFurMaterial(hex, { furLen: FUR_LEN });
      this.materials.push(m);
      return makeFurMesh(geo, m, Math.max(4, Math.round(shells * shellScale)));
    };

    const bodyGeo = makeBodyGeometry(def.body);
    this.pivot.add(makeFur(bodyGeo));
    const probe = new Probe(bodyGeo);

    // eyes — tiny glossy beads
    this.eyes = [];
    for (const s of [-1, 1]) {
      const { point, normal } = probe.front(s * def.eyeX, def.eyeY);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.031, 20, 16), mat.eye());
      eye.position.copy(point).addScaledVector(normal, FUR_LEN * 0.55);
      eye.scale.set(1, 1.08, 0.7);
      eye.lookAt(eye.position.clone().add(normal));
      this.pivot.add(eye);
      this.eyes.push(eye);
    }
    // alternative eyes: squint "> <" and closed "‿"
    this.squint = new THREE.Group();
    this.closed = new THREE.Group();
    const ink = mat.eye();
    this.eyes.forEach((eye, i) => {
      const s = i === 0 ? 1 : -1; // '>' on the viewer's left eye, '<' on the right
      const p = eye.position;
      const k = 0.032;
      this.squint.add(new THREE.Mesh(tube([[p.x - s * k, p.y + k, p.z], [p.x + s * k * 0.6, p.y, p.z + 0.006], [p.x - s * k, p.y - k, p.z]], 0.009), ink));
      this.closed.add(new THREE.Mesh(tube([[p.x - k, p.y + 0.006, p.z], [p.x, p.y - 0.014, p.z + 0.006], [p.x + k, p.y + 0.006, p.z]], 0.009), ink));
    });
    this.squint.visible = this.closed.visible = false;
    this.pivot.add(this.squint, this.closed);

    // arms — stubby nubs on each side
    this.arms = {};
    for (const [side, s] of [['left', 1], ['right', -1]]) {
      const arm = makeFur(makeEllipsoidGeometry(0.11, 0.19, 0.12), 0.75);
      const { point, normal } = probe.at(s * def.armAngle, def.armY);
      arm.position.copy(point).addScaledVector(normal, -0.02);
      arm.rotation.z = s * 0.38;
      arm.rotation.x = 0.1;
      this.pivot.add(arm);
      this.arms[side] = arm;
    }
    // feet
    for (const s of [-1, 1]) {
      const foot = makeFur(makeEllipsoidGeometry(0.12, 0.065, 0.15), 0.6);
      foot.position.set(s * 0.17, 0.05, 0.14);
      this.pivot.add(foot);
    }

    def.extras?.({ pivot: this.pivot, probe, arms: this.arms, eyes: this.eyes, fur: makeFur });

    const box = new THREE.Box3();
    this.pivot.updateMatrixWorld(true);
    this.pivot.traverse(o => {
      if (!o.isMesh) return;
      const g = o.userData.baseGeometry || o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      box.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld));
    });
    this.size = box.getSize(new THREE.Vector3());

    this.anim = null;
    this.loop = null;          // { name, every } — repeating gesture
    this.loopTimer = 0;
    this.expression = 'normal';
    this.nextBlink = 2 + Math.random() * 3;
    this.blinkT = -1;
    this.yaw = 0; this.yawTarget = 0;
    this.sitting = false;
    this.phase = Math.random() * 10;
  }

  // gestures: nod | shake | hop | wiggle
  play(name, onDone) { this.anim = { name, t: 0, onDone }; }
  repeat(name, every = 2.6) { this.loop = { name, every }; this.loopTimer = every * 0.4; }
  stopRepeat() { this.loop = null; }
  setExpression(e) {
    this.expression = e;
    const eyesOn = e === 'normal';
    this.eyes.forEach(m => (m.visible = eyesOn));
    this.squint.visible = e === 'squint';
    this.closed.visible = e === 'closed';
  }
  turnTo(rad) { this.yawTarget = rad; }

  update(t, dt) {
    const p = this.pivot;
    // breathing
    const b = Math.sin((t + this.phase) * 1.7);
    p.scale.set(1 - b * 0.006, 1 + b * 0.012, 1 - b * 0.006);
    let rx = 0, ry = 0, rz = 0, y = 0;

    // idle sway
    rz += Math.sin((t + this.phase) * 0.7) * 0.012;

    if (this.loop && !this.anim) {
      this.loopTimer -= dt;
      if (this.loopTimer <= 0) { this.play(this.loop.name); this.loopTimer = this.loop.every; }
    }
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      let dur = 1;
      if (a.name === 'nod') {
        dur = 1.3;
        const k = Math.min(a.t / dur, 1);
        rx += Math.sin(k * Math.PI * 2) ** 2 * 0.22 * (1 - k * 0.3);
      } else if (a.name === 'shake') {
        dur = 1.4;
        const k = Math.min(a.t / dur, 1);
        ry += Math.sin(k * Math.PI * 5) * 0.42 * Math.sin(k * Math.PI);
        rz += Math.sin(k * Math.PI * 5) * 0.03;
      } else if (a.name === 'hop') {
        dur = 0.7;
        const k = Math.min(a.t / dur, 1);
        y += Math.sin(k * Math.PI) * 0.12;
        p.scale.y *= 1 + Math.sin(k * Math.PI * 2) * 0.04;
      } else if (a.name === 'wiggle') {
        dur = 1.0;
        const k = Math.min(a.t / dur, 1);
        rz += Math.sin(k * Math.PI * 6) * 0.07 * (1 - k);
      }
      if (a.t >= dur) { this.anim = null; a.onDone?.(); }
    }

    // blink
    if (this.expression === 'normal') {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0 && this.blinkT < 0) { this.blinkT = 0; this.nextBlink = 2.5 + Math.random() * 3.5; }
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        const k = this.blinkT / 0.16;
        const sy = k < 1 ? 1 - Math.sin(k * Math.PI) * 0.92 : 1;
        this.eyes.forEach(e => (e.scale.y = 1.08 * sy));
        if (k >= 1) this.blinkT = -1;
      }
    }

    if (this.sitting) { y -= 0.04; p.scale.y *= 0.96; }
    this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * 5);
    p.rotation.set(rx, this.yaw + ry, rz);
    p.position.y = y;
  }

  dispose() {
    this.pivot.traverse(o => { if (o.isMesh) o.geometry.dispose?.(); });
    this.materials.forEach(m => m.dispose());
  }
}
