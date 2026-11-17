// 3. Received song — the sender stands on the song card, half their body
// over its top edge. Nod is the one bright button.

import { h, slot, topbar, josa, colorOf } from '../ui.js';
import { SONGS } from '../data.js';
import * as audio from '../audio.js';

export function received(app, params = {}) {
  const { store } = app;
  const s = store.state;
  const item = s.inbox.find(r => r.id === params.id) || s.inbox.find(r => r.status === 'new') || s.inbox[0];
  const from = store.member(item.from);
  const song = SONGS[item.songId];
  const el = h('div', { class: 'screen received' });
  app.theme(el, colorOf(from.char));
  let offAudio = null;
  let timer = null;

  const render = mode => {
    el.replaceChildren();
    app.stage.prune();
    offAudio?.();
    el.append(topbar(app, mode === 'listen' ? '받은 노래' : ''));

    if (mode === 'listen') {
      const wrap = h('div', { class: 'hero-wrap' });
      const { el: slotEl, actor } = slot(app, from.char, { cls: 'hero-slot', shells: 28, fill: 0.9, label: from.callName });
      actor?.play('hop');
      wrap.append(slotEl);

      const playBtn = h('button', { class: 'play', 'aria-label': '재생' }, h('i'));
      const player = h('div', { class: 'player', dataset: { song: item.songId } }, playBtn, h('div', { class: 'progress' }, h('i')));
      playBtn.addEventListener('click', () => audio.toggle(item.songId));
      offAudio = audio.onChange(id => {
        const on = id === item.songId;
        player.classList.toggle('playing', on);
        playBtn.classList.toggle('playing', on);
        playBtn.setAttribute('aria-label', on ? '멈춤' : '재생');
      });

      const card = h('section', { class: 'card over-card' },
        h('p', { class: 'kicker' }, `${josa(from.callName, '이', '가')} 보낸 노래`),
        h('h2', { class: 'title' }, song.title),
        h('p', { class: 'artist' }, song.artist),
        item.note ? h('p', { class: 'note' }, item.note) : null,
        player);

      el.append(wrap, card, h('div', { class: 'flex-space' }),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', onClick: () => respond('nod') }, '끄덕'),
          h('button', { class: 'btn', onClick: () => respond('shake') }, '도리도리')),
        h('button', { class: 'link', style: { marginTop: '-12px', marginBottom: '10px' }, onClick: () => app.go('home', {}, { reset: true }) }, '나중에 듣기'));
      return;
    }

    // my character answers; the sender watches from the side
    const wrap = h('div', { class: 'hero-wrap' });
    const mine = slot(app, s.me.char, { cls: 'hero-slot', shells: 28, fill: 0.9, label: '나' });
    const theirs = slot(app, from.char, { cls: 'side-slot', shells: 14, fill: 0.9, label: from.callName });
    wrap.append(mine.el, theirs.el);
    const card = h('section', { class: 'card response-copy' });
    el.append(wrap, card, h('div', { class: 'flex-space' }));

    if (mode === 'nodded') {
      mine.actor?.play('nod', () => mine.actor.setExpression('squint'));
      setTimeout(() => theirs.actor?.play('hop'), 900);
      card.append(h('h2', { class: 'title' }, '둘의 노래에 담았어요'),
        h('p', {}, `「${song.title}」, ${josa(from.callName, '과', '와')} 나의 노래로 남았어요.`));
      timer = setTimeout(() => app.go('home', {}, { reset: true }), 3200);
      el.append(h('div', { class: 'actions' }, h('button', { class: 'btn', onClick: () => app.go('home', {}, { reset: true }) }, '홈으로')));
    } else {
      mine.actor?.play('shake');
      setTimeout(() => theirs.actor?.play('wiggle'), 900);
      card.append(h('h2', { class: 'title' }, '이번 곡은 넘길게요'),
        h('p', {}, `${from.callName}에게 도리도리가 전해져요.`, h('br'), '취향이 다른 것도 알아가는 거예요.'));
      el.append(h('div', { class: 'actions stack' },
        h('button', { class: 'btn primary', onClick: () => app.go('home', {}, { reset: true }) }, '그냥 끝내기'),
        h('button', { class: 'btn', onClick: () => app.go('send', { to: from.id }, { replace: true }) }, '대신 이 노래 보내기')));
    }
  };

  const respond = async reply => {
    audio.stop();
    store.respond(item.id, reply);
    render(reply === 'nod' ? 'nodded' : 'shook');
  };

  render('listen');
  return {
    el,
    leave() { offAudio?.(); clearTimeout(timer); },
  };
}

