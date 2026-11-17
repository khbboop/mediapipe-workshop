// 2. Home — almost no words. My character stands large on the floor; the
// family gathers small around the colour they make together. Each family
// character shows what's going on by what it is doing.

import { h, slot, blend, rings, colorOf } from '../ui.js';
import { mix } from '../color.js';

const STATE_TEXT = {
  incoming: '노래가 왔어요',
  incar: '차에 타고 있어요',
  nodded: '끄덕했어요',
  shook: '도리도리했어요',
  idle: '',
};

const SPOTS = [
  { left: '4%', top: '40%' },
  { left: 'calc(50% - 52px)', top: '2%' },
  { right: '4%', top: '44%' },
];

export function home(app) {
  const { store } = app;
  const s = store.state;
  const el = h('div', { class: 'screen home' });
  app.theme(el, colorOf(s.me.char));

  el.append(h('header', { class: 'topline' },
    h('span', { class: 'brand' }, 'ECHO NOD'),
    h('span', { class: 'small mute' }, today())));

  const field = h('section', { class: 'family-field' });
  const colors = [s.me.char, ...s.family.map(f => f.char)].map(colorOf);
  const b = blend(colors, { spread: 0.34, cls: 'home-blend' });
  b.setAttribute('role', 'button');
  b.setAttribute('aria-label', '우리 가족의 노래');
  b.addEventListener('click', () => app.go('family'));
  b.append(h('span', { class: 'blend-label' }, '우리'));
  field.append(b);
  s.family.forEach((f, i) => field.append(member(app, f, SPOTS[i % SPOTS.length])));
  el.append(field);

  const zone = h('section', { class: 'me-zone' });
  const floor = h('div', { class: 'me-floor' });
  const meSlot = slot(app, s.me.char, { cls: 'me-slot', shells: 26, fill: 0.95, onTap: () => app.go('me'), label: '나' });
  floor.append(meSlot.el, h('div', { class: 'me-caption' },
    h('span', { class: 'name' }, s.me.callName),
    h('span', { class: 'small mute' }, s.me.shareInCar ? '차에 타면 가족에게 보여요' : '차에 타도 보이지 않아요')));
  zone.append(floor);
  el.append(zone);

  return { el };
}

function member(app, f, spot) {
  const st = app.store.memberState(f.id);
  const color = colorOf(f.char);
  const wrap = h('div', { class: `member st-${st}`, style: spot });
  if (st === 'incar') {
    wrap.style.setProperty('--seat-a', mix(color, '#fffcf6', 0.68));
    wrap.style.setProperty('--seat-b', mix(color, '#fffcf6', 0.52));
    wrap.append(h('div', { class: 'seat', 'aria-hidden': 'true' }));
  }
  if (st === 'incoming') wrap.append(rings(color));

  const go = () => {
    if (st === 'incoming') {
      const item = app.store.state.inbox.find(r => r.from === f.id && r.status === 'new');
      app.go('received', { id: item.id });
    } else if (st === 'incar') app.go('send', { to: f.id });
    else app.go('between', { id: f.id });
  };
  const { el, actor } = slot(app, f.char, { cls: 'member-slot', shells: 12, fill: 0.86, onTap: go, label: f.callName });
  if (actor) {
    if (st === 'nodded') actor.repeat('nod', 2.8);
    if (st === 'shook') actor.repeat('shake', 3.2);
    if (st === 'incoming') actor.repeat('wiggle', 3.6);
    if (st === 'incar') actor.sitting = true;
  }
  wrap.append(el,
    h('span', { class: 'm-name' }, f.callName),
    h('span', { class: 'm-state' }, STATE_TEXT[st]));
  return wrap;
}

function today() {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
