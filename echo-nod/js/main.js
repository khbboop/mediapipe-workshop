// ECHO NOD — app shell: stage, router, theme.

import { Stage } from './stage.js';
import { store } from './data.js';
import { applyTheme } from './color.js';
import * as audio from './audio.js';
import { wait } from './ui.js';

import { intro } from './screens/intro.js';
import { setup } from './screens/setup.js';
import { home } from './screens/home.js';
import { received } from './screens/received.js';
import { send } from './screens/send.js';
import { between } from './screens/between.js';
import { family } from './screens/family.js';
import { me } from './screens/me.js';

const SCREENS = { intro, setup, home, received, send, between, family, me };

const appEl = document.getElementById('app');
const host = document.getElementById('screen');
const layer = document.getElementById('layer');

const params = new URLSearchParams(location.search);
if (params.has('reset')) store.reset();

const app = {
  store,
  layer,
  stage: null,
  lowPower: params.has('lite') || (navigator.hardwareConcurrency || 8) <= 4,
  theme: applyTheme,
  stack: [],
  current: null,
  go(name, p = {}, { replace = false, reset = false } = {}) {
    if (reset) this.stack = [];
    else if (!replace && this.current && this.current.name !== 'intro') this.stack.push(this.current);
    return show(name, p);
  },
  back() {
    const prev = this.stack.pop() || { name: 'home', params: {} };
    return show(prev.name, prev.params, true);
  },
};
app.stage = new Stage(appEl);
window.echoNod = app; // handy for poking around in devtools

let active = null;
let busy = Promise.resolve();

function show(name, p = {}, isBack = false) {
  busy = busy.then(async () => {
    const first = !active;
    if (!first) {
      appEl.classList.add('fading');
      await wait(200);
      active.leave?.();
      audio.stop();
    }
    layer.replaceChildren();
    host.replaceChildren();
    app.stage.prune();
    app.current = { name, params: p };
    const view = SCREENS[name](app, p) || {};
    active = view;
    host.append(view.el);
    if (!isBack) host.scrollTop = 0;
    view.enter?.();
    location.hash = name === 'intro' ? '' : [name, ...Object.values(p)].join('/');
    await wait(30);
    appEl.classList.remove('fading');
  });
  return busy;
}

// Deep links (#between/mom) skip the intro — useful while designing.
const [hName, hArg] = location.hash.replace(/^#\/?/, '').split('/');
if (hName && SCREENS[hName] && hName !== 'intro') {
  const argKey = { received: 'id', send: 'to', between: 'id' }[hName];
  if (!store.state.onboarded && hName !== 'setup') { store.state.onboarded = true; store.save(); }
  app.go(hName, argKey && hArg ? { [argKey]: hArg } : {});
} else {
  app.go('intro');
}
