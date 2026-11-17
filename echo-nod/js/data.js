// ECHO NOD — prototype data. Everything is local and made up; nothing here
// talks to a real music service or a real car.

export const SONGS = {
  s1:  { title: '여름밤의 산책', artist: '소란한 오후' },
  s2:  { title: '창문을 조금만', artist: '밤산책' },
  s3:  { title: '오래된 라디오', artist: '이른 봄' },
  s4:  { title: '천천히, 천천히', artist: '하늘공방' },
  s5:  { title: '고속도로 위 노을', artist: '모래알' },
  s6:  { title: '우리 집 강아지', artist: '따뜻한 손' },
  s7:  { title: '토요일 아침', artist: '파란 우산' },
  s8:  { title: '처음 듣는 노래', artist: '새벽 세 시' },
  s9:  { title: '긴 터널을 지나', artist: '둥근 달' },
  s10: { title: '바람이 분다면', artist: '연둣빛' },
  s11: { title: '두 번째 정류장', artist: '작은 방' },
  s12: { title: '느린 오후', artist: '하늘공방' },
  s13: { title: '할머니의 부엌', artist: '이른 봄' },
  s14: { title: '눈 내리는 국도', artist: '모래알' },
};

export const RECENT = ['s7', 's10', 's11', 's12'];

const KEY = 'echonod.v1';

function defaults() {
  return {
    onboarded: false,
    me: { char: 'green', callName: '콩이', shareInCar: true, notify: true, service: null, hidden: ['s9'] },
    family: [
      { id: 'mom', char: 'purple', callName: '엄마', inCar: false },
      { id: 'sis', char: 'cream',  callName: '막내', inCar: false },
      { id: 'dad', char: 'blue',   callName: '아빠', inCar: true },
    ],
    inbox: [
      { id: 'r1', from: 'mom', songId: 's3', note: '운전하다 이 노래 듣고 네 생각났어.', status: 'new' },
    ],
    // dir: 'sent' (me → them) | 'recv' (them → me); reply: 'nod' | 'shake' | null
    history: {
      mom: [
        { dir: 'recv', songId: 's1', reply: 'nod' },
        { dir: 'sent', songId: 's4', reply: 'nod' },
        { dir: 'sent', songId: 's12', reply: 'shake' },
        { dir: 'recv', songId: 's13', reply: 'nod' },
      ],
      sis: [
        { dir: 'sent', songId: 's10', reply: 'nod', unseen: true },
        { dir: 'recv', songId: 's6', reply: 'nod' },
      ],
      dad: [
        { dir: 'recv', songId: 's14', reply: 'nod' },
        { dir: 'sent', songId: 's7', reply: null },
      ],
    },
    // how far two colours have mixed (never shown as a number)
    closeness: { mom: 0.72, sis: 0.5, dad: 0.3 },
    familySongs: ['s1', 's5', 's8', 's2', 's6'],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch (e) { /* storage unavailable — fall back to defaults */ }
  return defaults();
}

export const store = {
  state: load(),
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  },
  reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    this.state = defaults();
  },
  member(id) { return this.state.family.find(f => f.id === id); },
  // incoming > replied > in the car > idle
  memberState(id) {
    const s = this.state;
    if (s.inbox.some(r => r.from === id && r.status === 'new')) return 'incoming';
    const last = (s.history[id] || []).filter(h => h.dir === 'sent' && h.reply && h.unseen).pop();
    if (last) return last.reply === 'nod' ? 'nodded' : 'shook';
    const m = this.member(id);
    if (m.inCar && m.shareInCar !== false) return 'incar';
    return 'idle';
  },
  mutualSongs(id) {
    return (this.state.history[id] || []).filter(h => h.reply === 'nod').map(h => h.songId);
  },
  markSeen(id) {
    (this.state.history[id] || []).forEach(h => delete h.unseen);
    this.save();
  },
  respond(inboxId, reply) {
    const s = this.state;
    const item = s.inbox.find(r => r.id === inboxId);
    if (!item) return;
    item.status = 'answered';
    (s.history[item.from] ||= []).push({ dir: 'recv', songId: item.songId, reply });
    if (reply === 'nod') s.closeness[item.from] = Math.min(0.95, (s.closeness[item.from] || 0.3) + 0.08);
    this.save();
  },
  send(to, songId, note) {
    const s = this.state;
    (s.history[to] ||= []).push({ dir: 'sent', songId, note, reply: null });
    this.save();
  },
};
