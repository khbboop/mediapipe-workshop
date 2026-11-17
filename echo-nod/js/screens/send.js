// 4. Send a song — the person it's for stands on the card. Pick a song
// (recent or search), optionally add a line, send. Then my character
// sends out ripples in their colour.

import { h, slot, topbar, songRow, syncPlaying, rings, josa, colorOf } from '../ui.js';
import { SONGS, RECENT } from '../data.js';
import * as audio from '../audio.js';

export function send(app, params = {}) {
  const { store } = app;
  const s = store.state;
  const to = store.member(params.to) || s.family[0];
  const inCar = to.inCar && to.shareInCar !== false;
  const el = h('div', { class: 'screen send' });
  app.theme(el, colorOf(to.char));
  let chosen = null;
  let tab = 'recent';
  let query = '';
  let off = null, timer = null;

  const done = () => {
    audio.stop();
    store.send(to.id, chosen, noteInput.value.trim());
    el.replaceChildren();
    app.stage.prune();
    el.append(topbar(app, '', { back: false }));
    const wrap = h('div', { class: 'hero-wrap' });
    wrap.append(rings(colorOf(to.char), 'sent-rings'));
    const mine = slot(app, s.me.char, { cls: 'hero-slot', shells: 28, fill: 0.9, label: '나' });
    mine.actor?.play('hop');
    wrap.append(mine.el);
    el.append(wrap,
      h('section', { class: 'card response-copy' },
        h('h2', { class: 'title' }, `${to.callName}에게 보냈어요`),
        h('p', {}, inCar ? '지금 차에서 흘러나오고 있어요.' : '다음에 차에 탈 때 흘러나와요.')),
      h('div', { class: 'flex-space' }));
    timer = setTimeout(() => app.go('home', {}, { reset: true }), 3000);
  };

  // layout ---------------------------------------------------------------
  const wrap = h('div', { class: 'hero-wrap' });
  const hero = slot(app, to.char, { cls: 'hero-slot', shells: 28, fill: 0.9, label: to.callName });
  if (hero.actor && inCar) hero.actor.sitting = true;
  wrap.append(hero.el);

  const list = h('div', { class: 'list' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const search = h('input', { class: 'field search', placeholder: '곡이나 가수 검색', 'aria-label': '검색' });
  search.addEventListener('input', () => { query = search.value.trim(); drawList(); });
  const noteInput = h('input', { class: 'field note-field', placeholder: '한마디 붙이기 (건너뛰어도 돼요)', maxlength: '60', 'aria-label': '한마디' });
  const sendBtn = h('button', { class: 'btn primary', disabled: true, onClick: done }, '보내기');

  const drawTabs = () => {
    tabs.replaceChildren(
      h('button', { class: tab === 'recent' ? 'on' : '', role: 'tab', onClick: () => { tab = 'recent'; drawTabs(); drawList(); } }, '최근에 들은 곡'),
      h('button', { class: tab === 'search' ? 'on' : '', role: 'tab', onClick: () => { tab = 'search'; drawTabs(); drawList(); setTimeout(() => search.focus(), 50); } }, '검색'));
  };
  const drawList = () => {
    list.replaceChildren();
    const hidden = new Set(s.me.hidden);
    let ids;
    if (tab === 'recent') ids = RECENT;
    else {
      list.append(search);
      const q = query.toLowerCase();
      ids = Object.keys(SONGS).filter(id => !hidden.has(id) && (!q || (SONGS[id].title + SONGS[id].artist).toLowerCase().includes(q))).slice(0, 5);
    }
    for (const id of ids) {
      const row = songRow(id, { cls: id === chosen ? 'chosen' : '' });
      row.addEventListener('click', () => {
        chosen = id;
        sendBtn.disabled = false;
        list.querySelectorAll('.song-row').forEach(r => r.classList.toggle('chosen', r.dataset.song === id));
      });
      list.append(row);
    }
    if (!ids.length) list.append(h('p', { class: 'small mute' }, '찾는 곡이 없어요.'));
  };
  drawTabs(); drawList();

  const card = h('section', { class: 'card over-card' },
    h('div', { class: 'status' }, h('i', { class: 'pulse' + (inCar ? '' : ' off') }),
      inCar ? `${josa(to.callName, '은', '는')} 지금 차에 있어요 · 보내면 바로 나와요` : `${josa(to.callName, '이', '가')} 다음에 차에 탈 때 나와요`),
    tabs, list, noteInput);

  el.append(topbar(app, `${to.callName}에게 노래 보내기`), wrap, card, h('div', { class: 'flex-space' }),
    h('div', { class: 'actions' }, sendBtn));
  off = syncPlaying(el);

  return { el, leave() { off?.(); clearTimeout(timer); } };
}
