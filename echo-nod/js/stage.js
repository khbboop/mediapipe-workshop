// ECHO NOD — one WebGL canvas laid over the whole app.
// Screens place empty "slot" elements in the layout; every frame each actor
// is drawn into its slot's rectangle. The canvas sits above the cards, so a
// character can rise past a card's edge, while the canvas ignores pointer
// events so taps go to the slot underneath.

import * as THREE from 'three';
import { Actor } from './characters.js';
import { LIGHT_DIR } from './fur.js';

export class Stage {
  constructor(container) {
    this.container = container;
    this.entries = new Set();
    this.ok = true;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
    } catch (e) {
      console.warn('WebGL unavailable', e);
      this.ok = false;
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    r.autoClear = false;
    r.domElement.className = 'stage-canvas';
    container.appendChild(r.domElement);
    this.clock = new THREE.Clock();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  // slot: element; id: character id; opts: { shells, fill, align }
  add(slot, id, opts = {}) {
    if (!this.ok) { slot.classList.add('no-webgl', `c-${id}`); return null; }
    const actor = new Actor(id, { shells: opts.shells ?? 24 });
    const scene = new THREE.Scene();
    scene.add(actor.root);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d0c4, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.copy(LIGHT_DIR).multiplyScalar(5);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
    const entry = { slot, actor, scene, camera, fill: opts.fill ?? 0.9, yawBias: opts.yaw ?? 0 };
    actor.yaw = actor.yawTarget = entry.yawBias;
    this.entries.add(entry);
    return actor;
  }

  remove(actor) {
    for (const e of this.entries) if (e.actor === actor) { this.entries.delete(e); actor.dispose(); }
  }

  clear() {
    for (const e of this.entries) e.actor.dispose();
    this.entries.clear();
  }

  // Remove actors whose slots have left the document.
  prune() {
    for (const e of [...this.entries]) if (!e.slot.isConnected) { this.entries.delete(e); e.actor.dispose(); }
  }

  frame() {
    requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const r = this.renderer;
    const box = this.container.getBoundingClientRect();
    const W = Math.round(box.width), H = Math.round(box.height);
    const cur = r.getSize(new THREE.Vector2());
    if (cur.x !== W || cur.y !== H) r.setSize(W, H, true);

    r.setScissorTest(false);
    r.clear();
    r.setScissorTest(true);
    for (const e of this.entries) {
      if (!e.slot.isConnected) continue;
      const rect = e.slot.getBoundingClientRect();
      const x = rect.left - box.left, y = rect.top - box.top;
      const w = rect.width, h = rect.height;
      if (w < 2 || h < 2 || x > W || y > H || x + w < 0 || y + h < 0) continue;
      const opacity = parseFloat(getComputedStyle(e.slot).opacity);
      if (opacity < 0.02) continue;
      e.actor.update(t, dt);
      this.frameCamera(e, w / h);
      const gy = H - (y + h);
      r.setViewport(x, gy, w, h);
      r.setScissor(x, gy, w, h);
      r.render(e.scene, e.camera);
    }
  }

  // Feet sit just above the slot's bottom edge; the character fills `fill`
  // of the slot height (or less, if it would be too wide).
  frameCamera(e, aspect) {
    const cam = e.camera;
    const { size } = e.actor;
    const fovR = THREE.MathUtils.degToRad(cam.fov);
    const maxDim = Math.max(size.x, size.z) * 1.08;
    let visH = size.y / e.fill;
    if (maxDim / (visH * aspect) > e.fill) visH = maxDim / (e.fill * aspect);
    const dist = visH / 2 / Math.tan(fovR / 2);
    const pad = visH * 0.035;
    const cy = visH / 2 - pad;
    const tilt = 0.08;
    cam.aspect = aspect;
    cam.position.set(0, cy + dist * Math.sin(tilt), dist * Math.cos(tilt));
    cam.lookAt(0, cy, 0);
    cam.updateProjectionMatrix();
  }
}
