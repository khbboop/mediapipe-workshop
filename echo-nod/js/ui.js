// Small DOM helpers shared by every screen.

import { CHARACTERS } from './characters.js';
import { rgba, mix } from './color.js';
import * as audio from './audio.js';
import { SONGS } from './data.js';

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const wait = ms => new Promise(r => setTimeout(r, ms));

// Korean particle: 엄마가 / 동생이, 엄마와 / 동생과, 엄마를 / 동생을
export function josa(word, withFinal, withoutFinal) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return word + withoutFinal;
  return word + ((c - 0xac00) % 28 ? withFinal : withoutFinal);
}

// A character slot: an empty box in the layout the stage draws into.
export function slot(app, charId, { cls = '', shells = 22, fill = 0.92, onTap, label } = {}) {
  const el = h('div', { class: `slot ${cls}`, role: onTap ? 'button' : null, tabindex: onTap ? '0' : null, 'aria-label': label || CHARACTERS[charId].name });
  if (onTap) {
    el.addEventListener('click', onTap);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') onTap(e); });
  }
  const actor = app.stage.add(el, charId, { shells: app.lowPower ? Math.round(shells * 0.6) : shells, fill });
  if (!actor) el.style.setProperty('--fallback', CHARACTERS[charId].color);
  return { el, actor };
}

// Soft blurred colour field — overlapping blobs, one per colour.
// spread 0 = fully mixed in the centre, 1 = barely touching.
export function blend(colors, { spread = 0.35, cls = '', drift = true } = {}) {
  const el = h('div', { class: `blend ${cls}` });
  const n = colors.length;
  colors.forEach((c, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = n === 1 ? 0 : spread * 32;
    const blob = h('span', {
      class: 'blob' + (drift ? ' drift' : ''),
      style: {
        left: `${50 + Math.cos(a) * r}%`, top: `${50 + Math.sin(a) * r}%`,
        background: `radial-gradient(closest-side, ${rgba(c, 0.95)}, ${rgba(c, 0.55)} 55%, ${rgba(c, 0)} 100%)`,
        animationDelay: `${-i * 2.3}s`,
      },
    });
    el.append(blob);
  });
  return el;
}

// Expanding echo rings.
export function rings(color, cls = '') {
  const el = h('div', { class: `rings ${cls}` });
  for (let i = 0; i < 3; i++) el.append(h('span', { style: { borderColor: rgba(color, 0.55), background: rgba(color, 0.10), animationDelay: `${i * 0.9}s` } }));
  return el;
}

export function topbar(app, title, { back = true } = {}) {
  return h('header', { class: 'topbar' },
    back ? h('button', { class: 'back', 'aria-label': '뒤로', onClick: () => app.back() }, h('span', { class: 'chev' })) : h('span'),
    h('span', { class: 'topbar-title' }, title),
    h('span'));
}

export function toggle(on, onChange, label) {
  const btn = h('button', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), 'aria-label': label });
  btn.addEventListener('click', e => {
    e.stopPropagation();
    on = !on;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', String(on));
    onChange(on);
  });
  return btn;
}

// A song line; tapping plays/pauses the stand-in audio.
export function songRow(songId, { extra, cls = '' } = {}) {
  const s = SONGS[songId];
  const row = h('button', { class: `song-row ${cls}`, dataset: { song: songId } },
    h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('span', { class: 'song-text' }, h('span', { class: 'song-title' }, s.title), h('span', { class: 'song-artist' }, s.artist)),
    extra || null);
  row.addEventListener('click', () => audio.toggle(songId));
  return row;
}

// Keep every [data-song] element's "playing" class in sync with the audio.
export function syncPlaying(root) {
  const update = id => root.querySelectorAll('[data-song]').forEach(el => el.classList.toggle('playing', el.dataset.song === id));
  update(audio.playing());
  return audio.onChange(update);
}

// Hairlines — thin connectors from annotation labels to a target.
// pairs: [{ from: el, to: el, fromSide, toSide }] ; sides: left|right|top|bottom|center
export function hairlines(screen, pairs, { color = 'var(--line)' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'hairlines');
  screen.append(svg);
  const pt = (el, side, base, inset = 0) => {
    const r = el.getBoundingClientRect();
    const x = { left: r.left + inset, right: r.right - inset }[side] ?? (r.left + r.width / 2);
    const y = { top: r.top + inset, bottom: r.bottom - inset }[side] ?? (r.top + r.height / 2);
    return [x - base.left, y - base.top];
  };
  const draw = () => {
    const base = screen.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
    svg.innerHTML = '';
    for (const p of pairs) {
      if (!p.from.isConnected || !p.to.isConnected) continue;
      const [x1, y1] = pt(p.from, p.fromSide || 'center', base);
      let [x2, y2] = pt(p.to, p.toSide || 'center', base, p.inset || 0);
      if (p.toPoint) [x2, y2] = p.toPoint(base);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', `M${x1},${y1} L${x2},${y2}`);
      line.setAttribute('stroke', color);
      svg.append(line);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x2); dot.setAttribute('cy', y2); dot.setAttribute('r', 2.2);
      dot.setAttribute('fill', color);
      svg.append(dot);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(draw));
  const ro = new ResizeObserver(draw);
  ro.observe(screen);
  return () => ro.disconnect();
}

// Bottom sheet above the 3D layer.
export function sheet(app, title, body, { theme } = {}) {
  const layer = app.layer;
  const close = () => {
    panel.classList.remove('open');
    scrim.classList.remove('open');
    setTimeout(() => { scrim.remove(); panel.remove(); }, 260);
  };
  const scrim = h('div', { class: 'scrim', onClick: close });
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-label': title },
    h('div', { class: 'sheet-grip' }),
    h('div', { class: 'sheet-title' }, title),
    typeof body === 'function' ? body(close) : body);
  if (theme) for (const [k, v] of Object.entries(theme)) panel.style.setProperty(k, v);
  layer.append(scrim, panel);
  requestAnimationFrame(() => { scrim.classList.add('open'); panel.classList.add('open'); });
  return close;
}

export function colorOf(charId) { return CHARACTERS[charId].color; }
export function lighten(hex, t) { return mix(hex, '#ffffff', t); }
