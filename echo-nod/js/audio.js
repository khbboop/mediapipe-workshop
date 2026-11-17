// A quiet stand-in for real playback: each song id becomes its own soft,
// slowly arpeggiated chord. Enough to make "play / pause" feel real.

let ctx = null;
let voice = null;
let currentId = null;
const listeners = new Set();

function seedOf(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => fn(currentId)); }

export function playing() { return currentId; }

export function toggle(id) { currentId === id ? stop() : play(id); }

export function play(id) {
  stop(true);
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume?.();
  } catch (e) { return; }
  const seed = seedOf(id);
  const root = 174.6 * Math.pow(2, (seed % 7) / 12);
  const minor = seed % 3 === 0;
  const steps = minor ? [0, 3, 7, 10, 14, 7] : [0, 4, 7, 11, 14, 7];
  const master = ctx.createGain();
  master.gain.value = 0;
  master.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.6);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1400;
  master.connect(lp).connect(ctx.destination);

  // soft pad underneath
  const pads = [0, 7].map(st => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = root / 2 * Math.pow(2, st / 12);
    const g = ctx.createGain(); g.gain.value = 0.35;
    o.connect(g).connect(master); o.start();
    return o;
  });

  let i = 0;
  const beat = 0.42 + (seed % 5) * 0.04;
  const tick = () => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = root * Math.pow(2, steps[i % steps.length] / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + beat * 2.4);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + beat * 2.5);
    i++;
  };
  tick();
  const timer = setInterval(tick, beat * 1000);
  voice = { master, pads, timer };
  currentId = id;
  emit();
}

export function stop(silent = false) {
  if (voice && ctx) {
    const { master, pads, timer } = voice;
    clearInterval(timer);
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.35);
    pads.forEach(o => o.stop(t + 0.4));
  }
  voice = null;
  const had = currentId;
  currentId = null;
  if (had && !silent) emit();
}
