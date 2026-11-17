// One owner colour per screen; every layer is a lighter or deeper tone of it.

export function parse(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
export function toHex(rgb) {
  return '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const A = parse(a), B = parse(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}
export function rgba(hex, a) {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
export function average(hexes) {
  const all = hexes.map(parse);
  return toHex([0, 1, 2].map(i => all.reduce((s, c) => s + c[i], 0) / all.length));
}

const PAPER = '#fffcf6';
const INK = '#2f2a25';

export function theme(hex) {
  return {
    '--c': hex,
    '--bg': mix(hex, PAPER, 0.78),
    '--bg2': mix(hex, PAPER, 0.9),
    '--card': rgba(mix(hex, '#ffffff', 0.5), 0.5),
    '--tone': mix(hex, PAPER, 0.55),
    '--tone-2': mix(hex, PAPER, 0.35),
    '--deep': mix(hex, INK, 0.5),
    '--ink': mix(hex, INK, 0.84),
    '--mute': rgba(mix(hex, INK, 0.62), 0.62),
    '--line': rgba(mix(hex, INK, 0.55), 0.26),
    '--shadow': rgba(mix(hex, INK, 0.45), 0.22),
    '--glow': rgba(hex, 0.55),
  };
}

export function applyTheme(el, hex) {
  for (const [k, v] of Object.entries(theme(hex))) el.style.setProperty(k, v);
}
