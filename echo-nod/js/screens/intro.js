// 0. Intro — my character appears, blurs into the family's colours, echoes,
// and settles into home. First launch plays it fully; afterwards ~1s.

import { h, slot, blend, rings, colorOf, wait } from '../ui.js';

export function intro(app) {
  const s = app.store.state;
  const first = !s.onboarded;
  const el = h('div', { class: 'screen intro' });
  const colors = [s.me.char, ...s.family.map(f => f.char)].map(colorOf);
  el.append(
    blend(colors, { spread: 0.3, cls: 'intro-blend' }),
    h('div', { class: 'intro-rings' }, rings(colorOf(s.me.char))),
  );
  const { el: slotEl, actor } = slot(app, s.me.char, { cls: 'intro-slot', shells: 28, fill: 0.9 });
  el.append(slotEl, h('div', { class: 'wordmark' }, 'ECHO NOD'));

  const canvas = app.stage.renderer?.domElement;
  let cancelled = false;

  return {
    el,
    async enter() {
      const T = first ? 1 : 0.32;
      await wait(700 * T);
      if (cancelled) return;
      actor?.play('hop');
      await wait(500 * T);
      if (cancelled) return;
      el.classList.add('melt');
      if (canvas) canvas.style.filter = 'blur(16px)';
      slotEl.style.opacity = '0.5';
      await wait(1700 * T);
      if (cancelled) return;
      el.classList.add('settle');
      await wait(500 * T);
      if (cancelled) return;
      app.go(first ? 'setup' : 'home', {}, { reset: true });
    },
    leave() {
      cancelled = true;
      if (canvas) canvas.style.filter = '';
    },
  };
}
