// 6. Our family's songs — a large blur of everyone's colours in the middle,
// songs everyone nodded to scattered around it like specimen notes.

import { h, topbar, blend, hairlines, syncPlaying, colorOf } from '../ui.js';
import { average } from '../color.js';
import { SONGS } from '../data.js';
import * as audio from '../audio.js';

// annotation spots (percent of the field) and which side the line leaves from
const SPOTS = [
  { left: '7%', top: '4%', side: 'bottom', cls: '' },
  { right: '7%', top: '10%', side: 'bottom', cls: 'right' },
  { left: '6%', top: '70%', side: 'top', cls: '' },
  { right: '6%', top: '76%', side: 'top', cls: 'right' },
  { left: 'calc(50% - 64px)', top: '88%', side: 'top', cls: '' },
];

export function family(app) {
  const s = app.store.state;
  const chars = [s.me.char, ...s.family.map(f => f.char)];
  const colors = chars.map(colorOf);
  const el = h('div', { class: 'screen family' });
  app.theme(el, average(colors));

  const area = h('section', { class: 'field-area' });
  const big = blend(colors, { spread: 0.26, cls: 'big-blend' });
  area.append(big, h('div', { class: 'center-cap' },
    h('div', { class: 'k' }, '모두가 끄덕인 곡'),
    h('div', { class: 'faces', 'aria-hidden': 'true' }, colors.map(c => h('i', { style: { background: c } })))));

  const pairs = [];
  s.familySongs.slice(0, SPOTS.length).forEach((id, i) => {
    const spot = SPOTS[i];
    const song = SONGS[id];
    const { side, cls, ...pos } = spot;
    const a = h('button', { class: `anno ${cls}`, style: pos, dataset: { song: id }, onClick: () => audio.toggle(id) },
      h('span', { class: 'anno-k' }, song.artist),
      h('span', { class: 'anno-v' }, h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), song.title));
    area.append(a);
    // line from the note toward a point on the edge of the blur
    const angle = Math.atan2(i < 2 ? -1 : 1, (cls === 'right' ? 1 : -1) * (i === 4 ? 0.15 : 1));
    pairs.push({ from: a, fromSide: side, to: big, toPoint: base => {
      const r = big.getBoundingClientRect();
      const cx = r.left + r.width / 2 - base.left, cy = r.top + r.height / 2 - base.top;
      const rad = r.width * 0.3;
      return [cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad];
    } });
  });

  el.append(topbar(app, '우리 가족의 노래'), area,
    h('p', { class: 'foot' }, '곡을 누르면 이어서 들을 수 있어요.'));
  const offLines = hairlines(area, pairs);
  const off = syncPlaying(el);
  return { el, leave() { off(); offLines(); } };
}
