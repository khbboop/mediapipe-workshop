// 5. Between that person and me — the screen is tinted their colour.
// Behind the two of us, our colours overlap as far as we have grown close.

import { h, slot, topbar, blend, songRow, syncPlaying, hairlines, josa, colorOf } from '../ui.js';

export function between(app, params = {}) {
  const { store } = app;
  const s = store.state;
  const them = store.member(params.id) || s.family[0];
  const el = h('div', { class: 'screen between' });
  app.theme(el, colorOf(them.char));
  const closeness = s.closeness[them.id] ?? 0.3;
  const hadReply = store.memberState(them.id);

  const pair = h('section', { class: 'pair' });
  pair.append(blend([colorOf(them.char), colorOf(s.me.char)], { spread: 1.15 - closeness, cls: 'pair-blend' }));
  const theirs = slot(app, them.char, { cls: 'them-slot', shells: 28, fill: 0.9, label: them.callName });
  const mine = slot(app, s.me.char, { cls: 'me-small', shells: 14, fill: 0.92, label: '나' });
  if (hadReply === 'nodded') theirs.actor?.play('nod');
  if (hadReply === 'shook') theirs.actor?.play('shake');
  const annoThem = h('div', { class: 'anno them' }, h('span', { class: 'anno-k' }, '그 사람'), h('span', { class: 'anno-v' }, them.callName));
  const annoMe = h('div', { class: 'anno right mine' }, h('span', { class: 'anno-k' }, '나'), h('span', { class: 'anno-v' }, s.me.callName));
  pair.append(theirs.el, mine.el, annoThem, annoMe);
  store.markSeen(them.id);

  const mutual = store.mutualSongs(them.id);
  const both = (s.history[them.id] || []).slice().reverse();
  const replyTag = x => x.reply === 'nod' ? h('span', { class: 'tag nod' }, '끄덕') : x.reply === 'shake' ? h('span', { class: 'tag' }, '도리도리') : h('span', { class: 'tag' }, '아직');

  const card = h('section', { class: 'card sections' },
    h('p', { class: 'sec-k' }, '둘의 노래'),
    mutual.length ? mutual.map(id => songRow(id)) : h('p', { class: 'empty' }, '아직 둘이 함께 끄덕인 곡이 없어요.'),
    h('hr', { class: 'rule' }),
    h('p', { class: 'sec-k' }, '주고받은 노래'),
    both.map(item => songRow(item.songId, {
      cls: 'exchange',
      extra: h('span', { class: 'tag' }, item.dir === 'sent' ? '보냄 · ' : '받음 · ', replyTag(item)),
    })));

  el.append(topbar(app, `${josa(them.callName, '과', '와')} 나 사이`), pair, card, h('div', { class: 'flex-space' }),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', onClick: () => app.go('send', { to: them.id }) }, `${them.callName}에게 노래 보내기`)));

  const offLines = hairlines(pair, [
    { from: annoThem, fromSide: 'bottom', to: theirs.el, toPoint: base => {
      const r = theirs.el.getBoundingClientRect();
      return [r.left - base.left + r.width * 0.36, r.top - base.top + r.height * 0.22];
    } },
    { from: annoMe, fromSide: 'bottom', to: mine.el, toPoint: base => {
      const r = mine.el.getBoundingClientRect();
      return [r.left - base.left + r.width * 0.62, r.top - base.top + r.height * 0.3];
    } },
  ]);
  const off = syncPlaying(el);
  return { el, leave() { off(); offLines(); } };
}
