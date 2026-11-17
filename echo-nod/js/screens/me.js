// 7. Me — my character as the specimen in the middle of the page, settings
// arranged around it as small notes joined by hairlines.

import { h, slot, topbar, toggle, hairlines, sheet, colorOf } from '../ui.js';
import { CHARACTERS, CHARACTER_IDS } from '../characters.js';
import { theme } from '../color.js';
import { SONGS } from '../data.js';

const SERVICES = ['Spotify', 'Apple Music', 'YouTube Music', '멜론', '지니'];

export function me(app) {
  const { store } = app;
  const s = store.state;
  const m = s.me;
  const el = h('div', { class: 'screen me' });
  app.theme(el, colorOf(m.char));
  const sheetTheme = () => theme(colorOf(m.char));
  const rerender = () => app.go('me', {}, { replace: true });

  const spec = h('section', { class: 'specimen' });
  spec.append(h('div', { class: 'plate', 'aria-hidden': 'true' }));
  const hero = slot(app, m.char, { cls: 'me-hero', shells: 30, fill: 0.92, label: '나', onTap: () => hero.actor?.play('hop') });
  spec.append(hero.el,
    h('div', { class: 'me-name' }, h('span', { class: 'k' }, '가족이 부르는 나'), h('span', { class: 'n' }, m.callName)));

  const note = (k, v, pos, side, onClick) => {
    const a = h('div', { class: `anno ${side === 'r' ? 'right anno-r' : 'anno-l'}`, style: pos, role: 'button', tabindex: '0', onClick },
      h('span', { class: 'anno-k' }, k), h('span', { class: 'anno-v' }, v));
    spec.append(a);
    return a;
  };

  const carSwitch = toggle(m.shareInCar, v => { m.shareInCar = v; store.save(); }, '차에 타고 있음 표시');
  const notes = [
    note('캐릭터', CHARACTERS[m.char].name, { top: '120px' }, 'l', () => pickCharacter()),
    note('부르는 말', m.callName, { top: '206px' }, 'l', () => editName()),
    note('차에 타고 있음 표시', carSwitch, { top: '292px' }, 'l', e => { if (e.target === e.currentTarget || !carSwitch.contains(e.target)) carSwitch.click(); }),
    note('노래 숨기기', m.hidden.length ? '고르기' : '없음', { top: '388px' }, 'l', () => hideSongs()),
    note('음악 서비스', m.service || '연결 전', { top: '140px' }, 'r', () => connect()),
    note('가족', s.family.map(f => f.callName).join(' · '), { top: '246px' }, 'r', () => manageFamily()),
    note('알림', m.notify ? '받기' : '받지 않기', { top: '352px' }, 'r', () => { m.notify = !m.notify; store.save(); rerender(); }),
  ];
  spec.append(h('div', { class: 'footnote' }, h('span', {}, 'ECHO NOD'), h('span', {}, '점수도 순위도 없는, 우리 차의 노래')));

  el.append(topbar(app, '나'), spec);

  const offLines = hairlines(spec, notes.map((n, i) => ({
    from: n, fromSide: i < 4 ? 'right' : 'left', to: hero.el,
    toPoint: base => {
      const r = hero.el.getBoundingClientRect();
      const left = i < 4;
      const ys = [0.42, 0.52, 0.66, 0.84, 0.46, 0.6, 0.76];
      return [r.left - base.left + r.width * (left ? 0.24 : 0.76), r.top - base.top + r.height * ys[i]];
    },
  })));

  // ---- sheets ---------------------------------------------------------
  function pickCharacter() {
    sheet(app, '캐릭터 바꾸기', close => h('div', { class: 'dots', style: { padding: '8px 0 12px' } },
      CHARACTER_IDS.map(id => h('button', {
        class: 'dot' + (id === m.char ? ' on' : ''), style: { background: CHARACTERS[id].color }, 'aria-label': CHARACTERS[id].name,
        onClick: () => { m.char = id; store.save(); close(); rerender(); },
      }))), { theme: sheetTheme() });
  }
  function editName() {
    sheet(app, '가족이 나를 부르는 말', close => {
      const input = h('input', { class: 'field', value: m.callName, maxlength: '10' });
      setTimeout(() => input.focus(), 300);
      return h('div', {}, input, h('div', { class: 'actions', style: { padding: '18px 0 0' } },
        h('button', { class: 'btn primary', onClick: () => { m.callName = input.value.trim() || m.callName; store.save(); close(); rerender(); } }, '바꾸기')));
    }, { theme: sheetTheme() });
  }
  function hideSongs() {
    sheet(app, '가족에게 보이지 않게 할 곡', () => h('div', {}, Object.keys(SONGS).slice(0, 10).map(id => {
      const on = m.hidden.includes(id);
      const sw = toggle(on, v => {
        m.hidden = v ? [...m.hidden, id] : m.hidden.filter(x => x !== id);
        store.save();
      }, SONGS[id].title);
      return h('div', { class: 'opt' }, h('span', {}, SONGS[id].title, h('span', { class: 'small mute' }, '  ' + SONGS[id].artist)), sw);
    })), { theme: sheetTheme() });
  }
  function connect() {
    sheet(app, '음악 서비스 연결', close => h('div', {}, SERVICES.map(name => h('button', {
      class: 'opt', onClick: () => { m.service = m.service === name ? null : name; store.save(); close(); rerender(); },
    }, name, h('span', { class: 'small mute' }, m.service === name ? '연결됨 · 끊기' : '연결')))), { theme: sheetTheme() });
  }
  function manageFamily() {
    sheet(app, '가족 초대·관리', () => h('div', {},
      s.family.map(f => h('div', { class: 'opt' },
        h('span', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('i', { class: 'dot', style: { width: '22px', height: '22px', background: colorOf(f.char) } }), f.callName),
        h('span', { class: 'small mute' }, f.inCar ? '차에 타고 있어요' : ''))),
      h('div', { class: 'opt' }, h('span', {}, '초대 코드'), h('span', { style: { letterSpacing: '.2em' } }, 'NOD-4821')),
      h('p', { class: 'small mute', style: { margin: '10px 0 0' } }, '프로토타입이라 실제 초대는 보내지 않아요.')), { theme: sheetTheme() });
  }

  return { el, leave() { offLines(); } };
}

