// 1. First-time setup — family, character, what the family calls me,
// and whether "I'm in the car" is shown by default.

import { h, slot, toggle, colorOf } from '../ui.js';
import { CHARACTERS, CHARACTER_IDS } from '../characters.js';

const STEPS = ['family', 'pick', 'name', 'car'];

export function setup(app, params = {}) {
  const store = app.store;
  const me = store.state.me;
  const step = params.step || 'family';
  const i = STEPS.indexOf(step);
  const el = h('div', { class: 'screen setup' });
  app.theme(el, colorOf(me.char));

  el.append(h('div', { class: 'steps', 'aria-hidden': 'true' }, STEPS.map((_, k) => h('i', { class: k === i ? 'on' : '' }))));

  const zone = h('div', { class: 'hero-zone' });
  let hero = slot(app, me.char, { cls: 'setup-slot plinth', shells: 28, fill: 0.86 });
  zone.append(hero.el);
  el.append(zone);

  const copy = h('div', { class: 'copy' });
  const actions = h('div', { class: 'actions stack' });
  el.append(copy, actions);

  const next = () => {
    store.save();
    if (i < STEPS.length - 1) app.go('setup', { step: STEPS[i + 1] }, { replace: true });
    else { store.state.onboarded = true; store.save(); app.go('home', {}, { reset: true }); }
  };

  if (step === 'family') {
    copy.append(h('p', { class: 'lead' }, '같은 차에서,', h('br'), '서로의 노래를.'),
      h('p', {}, '가족을 만들거나, 받은 초대로 들어가요.'));
    let joining = false;
    const code = h('input', { class: 'field', placeholder: '초대 코드', maxlength: '8', 'aria-label': '초대 코드' });
    const join = h('button', { class: 'btn', onClick: () => {
      if (!joining) { joining = true; copy.append(code); code.focus(); join.textContent = '이 코드로 들어가기'; return; }
      next();
    } }, '초대 받아 들어가기');
    actions.append(h('button', { class: 'btn primary', onClick: next }, '가족 만들기'), join);
  }

  if (step === 'pick') {
    let idx = CHARACTER_IDS.indexOf(me.char);
    const nameTag = h('div', { class: 'anno right pick-name' }, h('span', { class: 'anno-k' }, '나의 캐릭터'), h('span', { class: 'anno-v' }, CHARACTERS[me.char].name));
    zone.append(nameTag);
    const dots = h('div', { class: 'dots' });
    const choose = k => {
      idx = (k + CHARACTER_IDS.length) % CHARACTER_IDS.length;
      me.char = CHARACTER_IDS[idx];
      app.theme(el, colorOf(me.char));
      app.stage.remove(hero.actor);
      hero.el.remove();
      hero = slot(app, me.char, { cls: 'setup-slot plinth', shells: 28, fill: 0.86 });
      zone.prepend(hero.el);
      hero.actor?.play('hop');
      nameTag.querySelector('.anno-v').textContent = CHARACTERS[me.char].name;
      dots.querySelectorAll('.dot').forEach((d, j) => d.classList.toggle('on', j === idx));
    };
    CHARACTER_IDS.forEach((id, k) => dots.append(h('button', {
      class: 'dot' + (k === idx ? ' on' : ''), style: { background: CHARACTERS[id].color }, 'aria-label': CHARACTERS[id].name, onClick: () => choose(k),
    })));
    zone.append(h('div', { class: 'swipe-hint' },
      h('button', { class: 'prev', 'aria-label': '이전', onClick: () => choose(idx - 1) }, h('i', { class: 'chev' })),
      h('button', { class: 'next', 'aria-label': '다음', onClick: () => choose(idx + 1) }, h('i', { class: 'chev' }))));
    let x0 = null;
    zone.addEventListener('pointerdown', e => (x0 = e.clientX));
    zone.addEventListener('pointerup', e => { if (x0 != null && Math.abs(e.clientX - x0) > 40) choose(idx + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    copy.append(dots, h('p', {}, '가족에게 보일 내 모습이에요.'));
    actions.append(h('button', { class: 'btn primary', onClick: next }, '이 아이로 할게요'));
  }

  if (step === 'name') {
    const input = h('input', { class: 'field', value: me.callName, placeholder: '예: 콩이, 첫째, 우리 딸', maxlength: '10', 'aria-label': '가족이 나를 부르는 말' });
    input.addEventListener('input', () => (me.callName = input.value.trim() || '나'));
    copy.append(h('p', { class: 'lead' }, '가족이 나를 뭐라고 부르나요?'), input);
    actions.append(h('button', { class: 'btn primary', onClick: next }, '다음'));
    hero.actor?.play('wiggle');
  }

  if (step === 'car') {
    copy.append(
      h('p', { class: 'lead' }, '차에 타면 알려 줄까요?'),
      h('p', {}, '켜 두면 내가 차에 있을 때 가족 화면에 표시돼요.', h('br'), '그때 받은 노래는 바로 차에서 나와요. 언제든 끌 수 있어요.'),
      h('div', { class: 'toggle-line' }, h('span', {}, '차에 타고 있음 표시'), toggle(me.shareInCar, v => (me.shareInCar = v), '차에 타고 있음 표시')));
    actions.append(h('button', { class: 'btn primary', onClick: next }, '시작하기'));
    if (hero.actor) hero.actor.sitting = true;
  }

  return { el };
}
