/**
 * YoYo Quest Tracker & Combo Master  ·  script.js
 *
 * Architecture:
 *  DATA          — built-in + custom trick definitions
 *  STATE         — single source of truth (localStorage-persisted)
 *  UTILS         — pure helpers (sort, slugify, mount-chain, etc.)
 *  PROFILE HUD   — XP / Level / Progress bar
 *  SKILL TREE    — card render, smart sort, Edit / Delete interaction
 *  COMBO ENGINE  — mount-aware generator + challenge
 *  CUSTOM MODAL  — Add / Edit form with dropdown selects
 *  CONFIRM MODAL — in-page confirm / error dialog (no window.alert)
 *  TABS          — navigation
 *  INIT          — bootstrap
 */

'use strict';

/* ============================================================
   CONSTANTS — Standard dropdown options shared by data & UI
============================================================ */

/** Standard category options shown in the custom-trick form. */
const CATEGORY_OPTIONS = [
  'Foundational', 'Mount', 'String Trick', 'Combo',
  'Essential', 'Slack', 'Whip', 'Regenerate', 'Custom',
];

/** Standard mount values — used for entry/exit dropdowns AND combo chaining. */
const MOUNT_OPTIONS = [
  'Hand',
  'Spinning (neutral)',
  'Side Mount',
  'Front Mount',
  'Trapeze',
  'Double Trapeze',
  'Double or Nothing',
  'Hand (returned)',
  'Return',
  'Any',
];

/**
 * Permanent trick IDs that cannot be deleted or have their ID changed.
 * (Core learner-path anchors.)
 */
const PERMANENT_IDS = new Set([
  'sleeper', 'breakaway', 'forward-pass', 'basic-bind',
]);

/* ============================================================
   DATA — Built-in Trick Definitions
   Fields:
     id, name, category, level, difficulty, prereqs, xpReward,
     isStarter, isBind, entryMount, exitMount, youtube_url
============================================================ */

/**
 * @typedef {Object} TrickDef
 * @property {string}   id
 * @property {string}   name
 * @property {string}   category
 * @property {'Beginner'|'Intermediate'|'Advanced'} level
 * @property {number}   difficulty   1–5
 * @property {string[]} prereqs
 * @property {number}   xpReward
 * @property {boolean}  isStarter    throw-type opener
 * @property {boolean}  isBind       finishing bind move
 * @property {string}   entryMount   required mount coming IN
 * @property {string}   exitMount    mount state going OUT
 * @property {string}   youtube_url
 * @property {boolean}  [isCustom]
 */

/** @type {TrickDef[]} */
const BUILTIN_TRICKS = [

  /* ── Beginner Starters ───────────────────────────────── */
  {
    id: 'sleeper',
    name: 'Sleeper',
    category: 'Foundational',
    level: 'Beginner',
    difficulty: 1,
    prereqs: [],
    xpReward: 50,
    isStarter: true,
    isBind: false,
    entryMount: 'Hand',
    exitMount: 'Spinning (neutral)',
    youtube_url: '',
  },
  {
    id: 'breakaway',
    name: 'Breakaway',
    category: 'Foundational',
    level: 'Beginner',
    difficulty: 1,
    prereqs: [],
    xpReward: 50,
    isStarter: true,
    isBind: false,
    entryMount: 'Hand',
    exitMount: 'Side Mount',      // ← fixed: Breakaway lands in Side Mount, not neutral
    youtube_url: '',
  },
  {
    id: 'forward-pass',
    name: 'Forward Pass',
    category: 'Foundational',
    level: 'Beginner',
    difficulty: 1,
    prereqs: [],
    xpReward: 40,
    isStarter: true,
    isBind: false,
    entryMount: 'Hand',
    exitMount: 'Spinning (neutral)',
    youtube_url: '',
  },

  /* ── Beginner Tricks ─────────────────────────────────── */
  {
    id: 'rock-the-baby',
    name: 'Rock the Baby',
    category: 'String Trick',
    level: 'Beginner',
    difficulty: 1,
    prereqs: ['sleeper'],
    xpReward: 50,
    isStarter: false,
    isBind: false,
    entryMount: 'Spinning (neutral)',
    exitMount: 'Spinning (neutral)',
    youtube_url: '',
  },
  {
    id: 'eiffel-tower',
    name: 'Eiffel Tower',
    category: 'String Trick',
    level: 'Beginner',
    difficulty: 1,
    prereqs: ['sleeper'],
    xpReward: 50,
    isStarter: false,
    isBind: false,
    entryMount: 'Spinning (neutral)',
    exitMount: 'Spinning (neutral)',
    youtube_url: '',
  },
  {
    id: 'walk-the-dog',
    name: 'Walk the Dog',
    category: 'Foundational',
    level: 'Beginner',
    difficulty: 1,
    prereqs: ['sleeper'],
    xpReward: 40,
    isStarter: false,
    isBind: false,
    entryMount: 'Spinning (neutral)',
    exitMount: 'Hand (returned)',
    youtube_url: '',
  },
  {
    id: 'front-mount',
    name: 'Front Mount',
    category: 'Mount',
    level: 'Beginner',
    difficulty: 2,
    prereqs: ['sleeper'],
    xpReward: 75,
    isStarter: false,
    isBind: false,
    entryMount: 'Spinning (neutral)',
    exitMount: 'Front Mount',
    youtube_url: '',
  },
  {
    id: 'trapeze',
    name: 'Trapeze',
    category: 'Mount',
    level: 'Beginner',
    difficulty: 2,
    prereqs: ['breakaway'],
    xpReward: 75,
    isStarter: false,
    isBind: false,
    entryMount: 'Side Mount',     // ← takes correct entry from Breakaway exit
    exitMount: 'Trapeze',
    youtube_url: '',
  },

  /* ── Intermediate Tricks ─────────────────────────────── */
  {
    id: 'brain-twister',
    name: 'Brain Twister',
    category: 'Combo',
    level: 'Intermediate',
    difficulty: 3,
    prereqs: ['front-mount'],
    xpReward: 100,
    isStarter: false,
    isBind: false,
    entryMount: 'Front Mount',
    exitMount: 'Front Mount',
    youtube_url: '',
  },
  {
    id: 'trapeze-brother',
    name: 'Trapeze and His Brother',
    category: 'Mount',
    level: 'Intermediate',
    difficulty: 3,
    prereqs: ['trapeze'],
    xpReward: 100,
    isStarter: false,
    isBind: false,
    entryMount: 'Trapeze',
    exitMount: 'Double Trapeze',
    youtube_url: '',
  },
  {
    id: 'double-or-nothing',
    name: 'Double or Nothing',
    category: 'Mount',
    level: 'Intermediate',
    difficulty: 4,
    prereqs: ['trapeze'],
    xpReward: 125,
    isStarter: false,
    isBind: false,
    entryMount: 'Trapeze',
    exitMount: 'Double or Nothing',
    youtube_url: '',
  },

  /* ── Bind Hierarchy — isBind: true ──────────────────── */
  {
    id: 'basic-bind',
    name: 'Basic Bind',
    category: 'Essential',
    level: 'Beginner',
    difficulty: 2,
    prereqs: ['front-mount'],   // Sleeper → Front Mount → Basic Bind
    xpReward: 75,
    isStarter: false,
    isBind: true,
    entryMount: 'Front Mount',
    exitMount: 'Hand (returned)',
    youtube_url: '',
  },
  {
    id: 'side-bind',
    name: 'Side Bind',
    category: 'Essential',
    level: 'Beginner',
    difficulty: 2,
    prereqs: ['breakaway'],     // Breakaway → Side Bind
    xpReward: 75,
    isStarter: false,
    isBind: true,
    entryMount: 'Side Mount',
    exitMount: 'Hand (returned)',
    youtube_url: '',
  },
  {
    id: 'bind',
    name: 'Trapeze Bind',
    category: 'Essential',
    level: 'Intermediate',
    difficulty: 2,
    prereqs: ['trapeze'],       // Trapeze → Trapeze Bind
    xpReward: 75,
    isStarter: false,
    isBind: true,
    entryMount: 'Trapeze',
    exitMount: 'Hand (returned)',
    youtube_url: '',
  },
];

/* ============================================================
   STATE
============================================================ */

/** @typedef {'locked'|'unlocked'|'mastered'} TrickStatus */

/** Runtime trick list (builtin + custom). Rebuilt on init + custom add. */
let TRICKS_DATA = [];

/** @type {{ xp:number, level:number, tricks:Object.<string,TrickStatus> }} */
const STATE = { xp: 0, level: 1, tricks: {} };

const LS_STATE_KEY   = 'yoyoquest_state';
const LS_CUSTOM_KEY  = 'yoyoquest_custom_tricks';
const LEVEL_XP_TABLE = [0, 200, 500, 900, 1400, 2000, 2800, 3800, 5000];
const COMBO_XP       = 50;

/** ID of trick currently being edited (null when adding new). */
let editingTrickId = null;

/* ============================================================
   PERSISTENCE
============================================================ */

function persistState() {
  try { localStorage.setItem(LS_STATE_KEY, JSON.stringify({ xp: STATE.xp, level: STATE.level, tricks: STATE.tricks })); } catch (_) {}
}
function persistCustomTricks(arr) {
  try { localStorage.setItem(LS_CUSTOM_KEY, JSON.stringify(arr)); } catch (_) {}
}
function loadCustomTricks() {
  try { const r = localStorage.getItem(LS_CUSTOM_KEY); return r ? JSON.parse(r) : []; } catch (_) { return []; }
}
function loadPersistedState() {
  try { const r = localStorage.getItem(LS_STATE_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; }
}

/* ============================================================
   UTILS
============================================================ */

function computeStatus(trick) {
  return trick.prereqs.every((pid) => STATE.tricks[pid] === 'mastered')
    ? 'unlocked' : 'locked';
}

function recomputeAllStatuses() {
  TRICKS_DATA.forEach((t) => {
    if (STATE.tricks[t.id] !== 'mastered') STATE.tricks[t.id] = computeStatus(t);
  });
}

function cascadeLock(trickId, visited = new Set()) {
  if (visited.has(trickId)) return;
  visited.add(trickId);
  TRICKS_DATA.filter((t) => t.prereqs.includes(trickId)).forEach((dep) => {
    if (STATE.tricks[dep.id] === 'mastered') STATE.xp = Math.max(0, STATE.xp - dep.xpReward);
    STATE.tricks[dep.id] = 'locked';
    cascadeLock(dep.id, visited);
  });
}

function calcLevel(xp) {
  for (let i = LEVEL_XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP_TABLE[i]) return i + 1;
  }
  return 1;
}

function xpForNextLevel(xp) {
  const lv   = calcLevel(xp);
  const cur  = LEVEL_XP_TABLE[lv - 1] ?? 0;
  const nxt  = LEVEL_XP_TABLE[lv]     ?? LEVEL_XP_TABLE[LEVEL_XP_TABLE.length - 1];
  const delta  = nxt - cur;
  const earned = xp - cur;
  return { current: earned, next: delta, progress: delta > 0 ? Math.min(earned / delta, 1) : 1 };
}

function countMastered() {
  return Object.values(STATE.tricks).filter((s) => s === 'mastered').length;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36);
}

/**
 * Smart sort order: mastered first, then unlocked, then locked.
 * Within each tier, preserve original TRICKS_DATA insertion order.
 * @param {TrickDef[]} tricks
 * @returns {TrickDef[]}
 */
function sortedTricks(tricks) {
  const priority = { mastered: 0, unlocked: 1, locked: 2 };
  return [...tricks].sort((a, b) => {
    const pa = priority[STATE.tricks[a.id]] ?? 2;
    const pb = priority[STATE.tricks[b.id]] ?? 2;
    return pa - pb;
  });
}

/**
 * Given an array of mastered tricks and a starting trick,
 * build the longest valid chain where each trick's entryMount
 * matches the previous trick's exitMount.
 * @param {TrickDef[]} pool     - candidate tricks (regular non-starter non-bind)
 * @param {string}     startMount - exitMount of the opener / previous trick
 * @param {number}     targetLen  - desired number of regular steps
 * @returns {TrickDef[]}
 */
function buildMountChain(pool, startMount, targetLen) {
  const chain   = [];
  let   current = startMount;
  const used    = new Set();

  for (let attempt = 0; attempt < targetLen; attempt++) {
    // Prefer tricks whose entryMount matches, fall back to 'Any'
    const compatible = pool.filter(
      (t) => !used.has(t.id) && (t.entryMount === current || t.entryMount === 'Any')
    );
    if (compatible.length === 0) break;
    const chosen = compatible[Math.floor(Math.random() * compatible.length)];
    chain.push(chosen);
    used.add(chosen.id);
    current = chosen.exitMount;
  }
  return chain;
}

/* ============================================================
   TOAST
============================================================ */

function showToast(msg, accent = 'violet') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast' + (accent === 'emerald' ? ' toast-emerald' : '');
  el.classList.remove('hidden');
  void el.offsetWidth;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3200);
}

/* ============================================================
   CONFIRM / ERROR MODAL  (replaces window.alert / window.confirm)
============================================================ */

/**
 * Show the confirm modal.
 * @param {Object} opts
 * @param {string}   opts.title
 * @param {string}   opts.message
 * @param {string}   [opts.confirmLabel='Confirm']
 * @param {'danger'|'violet'} [opts.kind='violet']
 * @param {function} [opts.onConfirm]  called if user clicks Confirm
 * @param {boolean}  [opts.alertOnly]  show only OK button (no cancel)
 */
function showConfirmModal({ title, message, confirmLabel = 'Confirm', kind = 'violet', onConfirm, alertOnly = false }) {
  const modal  = document.getElementById('confirm-modal');
  const ttl    = document.getElementById('cm-title');
  const msg    = document.getElementById('cm-message');
  const btnOk  = document.getElementById('cm-ok');
  const btnCnl = document.getElementById('cm-cancel');

  ttl.textContent = title;
  msg.textContent = message;
  btnOk.textContent = confirmLabel;
  btnOk.className = 'cm-btn ' + (kind === 'danger' ? 'cm-btn-danger' : 'cm-btn-violet');

  btnCnl.classList.toggle('hidden', !!alertOnly);

  // Remove old listeners by replacing the button node
  const newOk = btnOk.cloneNode(true);
  btnOk.parentNode.replaceChild(newOk, btnOk);

  newOk.addEventListener('click', () => {
    closeConfirmModal();
    if (onConfirm) onConfirm();
  });

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  newOk.focus();
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

/* ============================================================
   PROFILE HUD
============================================================ */

function renderProfile(leveledUp = false) {
  const lvl = calcLevel(STATE.xp);
  STATE.level = lvl;
  document.getElementById('player-level').textContent    = lvl;
  document.getElementById('player-mastered').textContent = countMastered();
  document.getElementById('player-xp').textContent       = STATE.xp;
  const { current, next, progress } = xpForNextLevel(STATE.xp);
  document.getElementById('xp-bar-label').textContent = `${current} / ${next} XP`;
  const bar = document.getElementById('xp-bar');
  bar.style.width = `${(progress * 100).toFixed(1)}%`;
  bar.classList.remove('xp-pulse');
  void bar.offsetWidth;
  bar.classList.add('xp-pulse');
  if (leveledUp) {
    const av = document.querySelector('#player-panel .w-14');
    if (av) { av.classList.remove('level-up-flash'); void av.offsetWidth; av.classList.add('level-up-flash'); }
  }
}

function addXP(amount) {
  const prev = calcLevel(STATE.xp);
  STATE.xp  += amount;
  const next  = calcLevel(STATE.xp);
  persistState();
  renderProfile(next > prev);
  if (next > prev) showToast(`🎉 Level Up! You are now Level ${next}!`, 'emerald');
}

/* ============================================================
   SKILL TREE — Render & Interaction
============================================================ */

const cardTemplate = document.getElementById('trick-card-template');

const LEVEL_BADGE = {
  Beginner:     { bg: 'rgba(59,130,246,0.18)',  color: '#93c5fd', border: 'rgba(59,130,246,0.35)' },
  Intermediate: { bg: 'rgba(234,179,8,0.18)',   color: '#fde047', border: 'rgba(234,179,8,0.35)' },
  Advanced:     { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5', border: 'rgba(239,68,68,0.35)' },
};

function buildDifficultyDots(diff, status) {
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= 5; i++) {
    const d = document.createElement('span');
    d.className = 'star-dot' + (i <= diff ? (' ' + (status === 'mastered' ? 'filled-mastered' : 'filled')) : '');
    d.setAttribute('aria-hidden', 'true');
    frag.appendChild(d);
  }
  return frag;
}

/**
 * Create a trick card DOM element.
 * @param {TrickDef} trick
 * @returns {HTMLElement}
 */
function createTrickCard(trick) {
  const status  = STATE.tricks[trick.id];
  const clone   = cardTemplate.content.cloneNode(true);
  const card    = clone.querySelector('.trick-card');
  const isPerm  = PERMANENT_IDS.has(trick.id);

  card.classList.add(`state-${status}`);
  card.dataset.trickId = trick.id;

  /* ── Name + category ── */
  card.querySelector('.trick-name').textContent = trick.name;
  card.querySelector('.trick-category').textContent =
    trick.category + (trick.isCustom ? ' ★' : '');

  /* ── Level badge ── */
  const lbc = LEVEL_BADGE[trick.level] ?? LEVEL_BADGE.Beginner;
  const lvlEl = document.createElement('span');
  lvlEl.textContent = trick.level;
  lvlEl.style.cssText = `display:inline-block;font-size:0.6rem;font-weight:700;
    text-transform:uppercase;letter-spacing:0.07em;padding:1px 7px;
    border-radius:999px;margin-top:3px;background:${lbc.bg};
    color:${lbc.color};border:1px solid ${lbc.border};`;
  card.querySelector('.trick-category').after(lvlEl);

  /* ── Difficulty dots ── */
  const diffEl = card.querySelector('.trick-difficulty');
  diffEl.appendChild(buildDifficultyDots(trick.difficulty, status));
  diffEl.setAttribute('aria-label', `Difficulty: ${trick.difficulty} out of 5`);

  /* ── Prereq note ── */
  const prereqEl = card.querySelector('.trick-prereq');
  if (trick.prereqs.length > 0) {
    prereqEl.textContent = 'Requires: ' + trick.prereqs
      .map((pid) => TRICKS_DATA.find((t) => t.id === pid)?.name ?? pid).join(', ');
  } else {
    prereqEl.textContent = 'No prerequisites';
  }

  /* ── Mount info ── */
  if (trick.entryMount || trick.exitMount) {
    const mEl = document.createElement('p');
    mEl.style.cssText = 'font-size:0.6rem;color:#71717a;margin-top:-2px;';
    const parts = [];
    if (trick.entryMount) parts.push(`In: ${trick.entryMount}`);
    if (trick.exitMount)  parts.push(`Out: ${trick.exitMount}`);
    mEl.textContent = parts.join(' · ');
    prereqEl.after(mEl);
  }

  /* ── Overlay tags (Bind / Starter / Custom) ── */
  if (trick.isBind || trick.isStarter) {
    const tag = document.createElement('span');
    if (trick.isBind) {
      tag.textContent = '🔗 Bind';
      tag.style.cssText = 'position:absolute;top:8px;left:8px;font-size:0.55rem;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:999px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);';
    } else {
      tag.textContent = '🚀 Starter';
      tag.style.cssText = 'position:absolute;top:8px;left:8px;font-size:0.55rem;font-weight:700;text-transform:uppercase;padding:2px 6px;border-radius:999px;background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);';
    }
    card.appendChild(tag);
  }

  /* ── Status badge ── */
  const badge = card.querySelector('.trick-badge');
  if (status === 'locked') {
    badge.textContent = '🔒 Locked'; badge.classList.add('badge-locked');
  } else if (status === 'unlocked') {
    badge.textContent = '⚡ Unlocked'; badge.classList.add('badge-unlocked');
  } else {
    badge.textContent = '✅ Mastered'; badge.classList.add('badge-mastered');
  }

  /* ── Primary action button ── */
  const btn = card.querySelector('.trick-action-btn');
  if (status === 'locked') {
    btn.textContent = '🔒 Locked';
    btn.disabled    = true;
    btn.setAttribute('aria-disabled', 'true');
  } else if (status === 'unlocked') {
    btn.textContent = `Set Mastered (+${trick.xpReward} XP)`;
    btn.addEventListener('click', () => onSetMastered(trick.id));
  } else {
    btn.textContent = '↩ Reset';
    btn.addEventListener('click', () => onResetTrick(trick.id));
  }

  /* ── Edit / Delete icon buttons (bottom-right of card) ── */
  const cardActions = card.querySelector('.card-actions');
  if (cardActions) {
    // Edit button — always shown
    const editBtn = document.createElement('button');
    editBtn.className   = 'card-icon-btn edit-btn';
    editBtn.title       = 'Edit trick';
    editBtn.setAttribute('aria-label', `Edit ${trick.name}`);
    editBtn.innerHTML   = '✏️';
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); onEditTrick(trick.id); });
    cardActions.appendChild(editBtn);

    // Delete button — hidden for permanent tricks
    if (!isPerm) {
      const delBtn = document.createElement('button');
      delBtn.className = 'card-icon-btn delete-btn';
      delBtn.title     = 'Delete trick';
      delBtn.setAttribute('aria-label', `Delete ${trick.name}`);
      delBtn.innerHTML = '🗑️';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); onDeleteTrick(trick.id); });
      cardActions.appendChild(delBtn);
    }
  }

  return card;
}

/**
 * Render the full trick grid with smart sorting applied.
 */
function renderSkillTree() {
  const grid = document.getElementById('trick-grid');
  grid.innerHTML = '';
  sortedTricks(TRICKS_DATA).forEach((trick) => grid.appendChild(createTrickCard(trick)));
}

/* ────────────────── Skill Tree Actions ────────────────── */

function onSetMastered(trickId) {
  if (STATE.tricks[trickId] !== 'unlocked') return;
  const trick = TRICKS_DATA.find((t) => t.id === trickId);
  if (!trick) return;
  STATE.tricks[trickId] = 'mastered';
  recomputeAllStatuses();
  persistState();
  addXP(trick.xpReward);
  renderSkillTree();
  showToast(`🏆 "${trick.name}" mastered! +${trick.xpReward} XP`, 'violet');
}

function onResetTrick(trickId) {
  if (STATE.tricks[trickId] !== 'mastered') return;
  const trick = TRICKS_DATA.find((t) => t.id === trickId);
  if (!trick) return;
  STATE.xp = Math.max(0, STATE.xp - trick.xpReward);
  STATE.tricks[trickId] = 'unlocked';
  cascadeLock(trickId);
  recomputeAllStatuses();
  persistState();
  renderProfile();
  renderSkillTree();
  showToast(`↩ "${trick.name}" reset — dependents re-locked. XP adjusted.`, 'violet');
}

/**
 * Handle Delete button — checks prereq safety, then confirms.
 * @param {string} trickId
 */
function onDeleteTrick(trickId) {
  if (PERMANENT_IDS.has(trickId)) {
    showConfirmModal({
      title: '🛡️ Protected Trick',
      message: 'This trick is a core foundation and cannot be deleted.',
      confirmLabel: 'OK',
      alertOnly: true,
    });
    return;
  }

  // Check if any OTHER trick depends on this one
  const dependents = TRICKS_DATA.filter(
    (t) => t.id !== trickId && t.prereqs.includes(trickId)
  );
  if (dependents.length > 0) {
    const names = dependents.map((t) => `"${t.name}"`).join(', ');
    showConfirmModal({
      title: '⚠️ Cannot Delete',
      message: `"${TRICKS_DATA.find((t) => t.id === trickId)?.name}" is a prerequisite for: ${names}. Remove or re-assign those tricks first.`,
      confirmLabel: 'OK',
      alertOnly: true,
    });
    return;
  }

  const trick = TRICKS_DATA.find((t) => t.id === trickId);
  showConfirmModal({
    title: '🗑️ Delete Trick',
    message: `Are you sure you want to delete "${trick?.name}"? This cannot be undone.`,
    confirmLabel: 'Delete',
    kind: 'danger',
    onConfirm: () => executeDeleteTrick(trickId),
  });
}

/**
 * Actually remove the trick from TRICKS_DATA, STATE, and localStorage.
 * @param {string} trickId
 */
function executeDeleteTrick(trickId) {
  // Deduct XP if it was mastered
  const trick = TRICKS_DATA.find((t) => t.id === trickId);
  if (trick && STATE.tricks[trickId] === 'mastered') {
    STATE.xp = Math.max(0, STATE.xp - trick.xpReward);
  }
  // Remove from live array
  TRICKS_DATA = TRICKS_DATA.filter((t) => t.id !== trickId);
  // Remove from STATE
  delete STATE.tricks[trickId];
  // Update custom tricks in localStorage (only custom tricks are stored there)
  const customs = loadCustomTricks().filter((t) => t.id !== trickId);
  persistCustomTricks(customs);
  persistState();
  renderProfile();
  renderSkillTree();
  showToast(`🗑️ "${trick?.name ?? trickId}" deleted.`, 'violet');
}

/**
 * Open the modal pre-filled for editing an existing trick.
 * @param {string} trickId
 */
function onEditTrick(trickId) {
  const trick = TRICKS_DATA.find((t) => t.id === trickId);
  if (!trick) return;
  editingTrickId = trickId;

  populateModalDropdowns();
  populatePrereqSelect(trickId);

  // Pre-fill fields
  document.getElementById('ct-name').value       = trick.name;
  document.getElementById('ct-category').value   = trick.category;
  document.getElementById('ct-level').value      = trick.level;
  document.getElementById('ct-entry').value      = trick.entryMount;
  document.getElementById('ct-exit').value       = trick.exitMount;
  document.getElementById('ct-difficulty').value = trick.difficulty;

  // Pre-select prereqs
  const sel = document.getElementById('ct-prereqs');
  Array.from(sel.options).forEach((opt) => {
    opt.selected = trick.prereqs.includes(opt.value);
  });

  // Disable name field for permanent tricks
  const nameInput = document.getElementById('ct-name');
  nameInput.disabled = PERMANENT_IDS.has(trickId);

  // Update modal title & submit label
  document.getElementById('modal-title-text').textContent = '✏️ Edit Trick';
  document.getElementById('btn-modal-submit').textContent = 'Save Changes';

  openCustomModal();
}

/* ============================================================
   COMBO ENGINE
   Rules:
   • Only MASTERED tricks enter the pool.
   • Starters (isStarter) only at position 0.
   • Regular tricks chained by entryMount ↔ exitMount.
   • Bind appended last.
============================================================ */

let comboCompleted = false;

function getMasteredTricks() {
  return TRICKS_DATA.filter((t) => STATE.tricks[t.id] === 'mastered');
}

/**
 * Generate a mount-aware combo sequence.
 * @returns {TrickDef[]}
 */
function generateCombo() {
  const mastered = getMasteredTricks();
  const starters = mastered.filter((t) => t.isStarter);
  const regulars = mastered.filter((t) => !t.isStarter && !t.isBind);
  const binds    = mastered.filter((t) => t.isBind);

  const combo = [];

  /* Step 0 — pick one starter as the opener */
  let openerExit = 'Any';
  if (starters.length > 0) {
    const opener = starters[Math.floor(Math.random() * starters.length)];
    combo.push(opener);
    openerExit = opener.exitMount;
  }

  /* Step 1 — build mount-compatible chain of 2–3 regulars */
  const targetLen = regulars.length >= 3 ? 3 : Math.min(2, regulars.length);
  const chain = buildMountChain(regulars, openerExit, targetLen);
  combo.push(...chain);

  /* Step 2 — append a bind */
  if (binds.length > 0) {
    combo.push(binds[Math.floor(Math.random() * binds.length)]);
  }

  return combo;
}

function createComboStep(trick, idx) {
  const isBindStep  = trick.isBind;
  const isStart     = trick.isStarter;
  const div = document.createElement('div');
  div.className  = 'combo-step' +
    (isBindStep ? ' bind-step' : '') + (isStart ? ' starter-step' : '');
  div.style.animationDelay = `${idx * 0.08}s`;
  div.setAttribute('role', 'listitem');
  const label = isBindStep ? 'Finish' : isStart ? 'Opener' : `Step ${idx + 1}`;
  div.innerHTML = `<p class="step-num">${label}</p>
    <p class="step-name">${trick.name}</p>
    <p class="step-level">${trick.level ?? ''}</p>`;
  return div;
}

function createArrow(idx) {
  const s = document.createElement('span');
  s.className = 'combo-arrow';
  s.setAttribute('aria-hidden', 'true');
  s.style.animationDelay = `${idx * 0.08}s`;
  s.textContent = '→';
  return s;
}

function renderComboFlow(combo) {
  const flow = document.getElementById('combo-flow');
  flow.innerHTML = '';
  combo.forEach((trick, i) => {
    flow.appendChild(createComboStep(trick, i));
    if (i < combo.length - 1) flow.appendChild(createArrow(i));
  });
}

function onGenerateCombo() {
  const nonBind = getMasteredTricks().filter((t) => !t.isBind);
  const display = document.getElementById('combo-display');
  const empty   = document.getElementById('combo-empty');
  const fb      = document.getElementById('combo-feedback');

  if (nonBind.length === 0) {
    display.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  display.classList.remove('hidden');
  fb.classList.add('hidden');
  fb.textContent = '';
  document.getElementById('btn-complete').disabled = false;
  comboCompleted = false;
  const combo = generateCombo();
  document.getElementById('combo-flow').dataset.comboIds = combo.map((t) => t.id).join(',');
  renderComboFlow(combo);
}

function onCompleteChallenge() {
  if (comboCompleted) return;
  comboCompleted = true;
  document.getElementById('btn-complete').disabled = true;
  addXP(COMBO_XP);
  const fb = document.getElementById('combo-feedback');
  fb.textContent = `🎯 Challenge completed! +${COMBO_XP} XP earned.`;
  fb.className   = 'mt-4 text-sm font-semibold text-neon-emerald';
  fb.classList.remove('hidden');
  showToast(`🎯 Combo complete! +${COMBO_XP} XP`, 'emerald');
}

/* ============================================================
   CUSTOM TRICK MODAL — Add / Edit
============================================================ */

function openCustomModal() {
  const m = document.getElementById('custom-modal');
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
  document.getElementById('ct-name').focus();
}

function closeCustomModal() {
  const m = document.getElementById('custom-modal');
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
  document.getElementById('custom-trick-form').reset();
  document.getElementById('ct-error').textContent = '';
  // Re-enable name field (might have been disabled for edit)
  document.getElementById('ct-name').disabled = false;
  // Reset modal title / submit label back to "add" defaults
  document.getElementById('modal-title-text').textContent = '✨ Add Custom Trick';
  document.getElementById('btn-modal-submit').textContent = 'Add Trick';
  editingTrickId = null;
}

/**
 * Populate category and mount dropdowns from the shared constant arrays.
 */
function populateModalDropdowns() {
  const catSel = document.getElementById('ct-category');
  catSel.innerHTML = CATEGORY_OPTIONS.map(
    (c) => `<option value="${c}">${c}</option>`
  ).join('');

  ['ct-entry', 'ct-exit'].forEach((selId) => {
    const s = document.getElementById(selId);
    s.innerHTML = MOUNT_OPTIONS.map(
      (m) => `<option value="${m}">${m}</option>`
    ).join('');
  });
}

/**
 * Populate the prerequisite multi-select, excluding the trick being edited.
 * @param {string|null} [excludeId]
 */
function populatePrereqSelect(excludeId = null) {
  const sel = document.getElementById('ct-prereqs');
  sel.innerHTML = '';
  TRICKS_DATA.filter((t) => t.id !== excludeId).forEach((t) => {
    const o = document.createElement('option');
    o.value       = t.id;
    o.textContent = t.name;
    sel.appendChild(o);
  });
}

/**
 * Handle Add / Edit form submission.
 * @param {SubmitEvent} e
 */
function onCustomTrickSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('ct-error');
  errEl.textContent = '';

  const name       = document.getElementById('ct-name').value.trim();
  const category   = document.getElementById('ct-category').value;
  const level      = document.getElementById('ct-level').value;
  const entryMount = document.getElementById('ct-entry').value;
  const exitMount  = document.getElementById('ct-exit').value;
  const diffVal    = parseInt(document.getElementById('ct-difficulty').value, 10);
  const prereqs    = Array.from(
    document.getElementById('ct-prereqs').selectedOptions
  ).map((o) => o.value);

  if (!name) {
    errEl.textContent = 'Trick name is required.';
    document.getElementById('ct-name').focus();
    return;
  }

  /* ── EDIT MODE ── */
  if (editingTrickId) {
    const idx = TRICKS_DATA.findIndex((t) => t.id === editingTrickId);
    if (idx === -1) { errEl.textContent = 'Trick not found.'; return; }

    // Check name collision (allow keeping the same name)
    const collision = TRICKS_DATA.find(
      (t) => t.id !== editingTrickId && t.name.toLowerCase() === name.toLowerCase()
    );
    if (collision) { errEl.textContent = `A trick named "${name}" already exists.`; return; }

    const existing = TRICKS_DATA[idx];
    const updated  = {
      ...existing,
      name,
      category,
      level,
      entryMount,
      exitMount,
      difficulty: isNaN(diffVal) ? existing.difficulty : Math.max(1, Math.min(5, diffVal)),
      prereqs,
      xpReward:   level === 'Advanced' ? 150 : level === 'Intermediate' ? 100 : 60,
    };
    TRICKS_DATA[idx] = updated;

    // Sync custom tricks in localStorage if it's a custom trick
    if (updated.isCustom) {
      const customs = loadCustomTricks().map((t) => t.id === editingTrickId ? updated : t);
      persistCustomTricks(customs);
    }
    // Recompute statuses in case prereqs changed
    recomputeAllStatuses();
    persistState();
    renderSkillTree();
    closeCustomModal();
    showToast(`✏️ "${updated.name}" updated!`, 'violet');
    return;
  }

  /* ── ADD MODE ── */
  const duplicate = TRICKS_DATA.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (duplicate) { errEl.textContent = `A trick named "${name}" already exists.`; return; }

  /** @type {TrickDef} */
  const newTrick = {
    id:          slugify(name),
    name, category, level, prereqs,
    difficulty:  isNaN(diffVal) ? 2 : Math.max(1, Math.min(5, diffVal)),
    xpReward:    level === 'Advanced' ? 150 : level === 'Intermediate' ? 100 : 60,
    isStarter:   false,
    isBind:      false,
    entryMount, exitMount,
    youtube_url: '',
    isCustom:    true,
  };

  TRICKS_DATA.push(newTrick);
  STATE.tricks[newTrick.id] = computeStatus(newTrick);

  const customs = loadCustomTricks();
  customs.push(newTrick);
  persistCustomTricks(customs);
  persistState();

  renderSkillTree();
  closeCustomModal();
  showToast(`✨ "${newTrick.name}" added to your Skill Tree!`, 'violet');
}

/* ============================================================
   TABS
============================================================ */

function switchTab(viewId) {
  document.querySelectorAll('.view-section').forEach((v) => v.classList.add('hidden'));
  const active = document.getElementById(`view-${viewId}`);
  if (active) active.classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach((t) => {
    const on = t.id === `tab-${viewId}`;
    t.classList.toggle('active-tab', on);
    t.setAttribute('aria-selected', String(on));
  });
}

/* ============================================================
   INIT
============================================================ */

function buildTricksData() {
  TRICKS_DATA = [...BUILTIN_TRICKS, ...loadCustomTricks()];
}

function initState() {
  buildTricksData();
  const saved = loadPersistedState();
  if (saved) {
    STATE.xp     = saved.xp    ?? 0;
    STATE.level  = saved.level ?? 1;
    STATE.tricks = saved.tricks ?? {};
    // Seed status for any new tricks not in saved state
    TRICKS_DATA.forEach((t) => {
      if (!(t.id in STATE.tricks)) STATE.tricks[t.id] = computeStatus(t);
    });
    recomputeAllStatuses();
  } else {
    TRICKS_DATA.forEach((t) => {
      STATE.tricks[t.id] = t.prereqs.length === 0 ? 'unlocked' : 'locked';
    });
  }
}

function bindEvents() {
  /* Tabs */
  document.getElementById('tab-skilltree').addEventListener('click', () => switchTab('skilltree'));
  document.getElementById('tab-combo').addEventListener('click',     () => switchTab('combo'));

  /* Combo */
  document.getElementById('btn-generate').addEventListener('click', onGenerateCombo);
  document.getElementById('btn-complete').addEventListener('click', onCompleteChallenge);

  /* Custom trick — open Add modal */
  document.getElementById('btn-add-trick').addEventListener('click', () => {
    editingTrickId = null;
    populateModalDropdowns();
    populatePrereqSelect(null);
    document.getElementById('modal-title-text').textContent = '✨ Add Custom Trick';
    document.getElementById('btn-modal-submit').textContent = 'Add Trick';
    openCustomModal();
  });

  /* Modal close/cancel */
  document.getElementById('btn-modal-close').addEventListener('click',  closeCustomModal);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeCustomModal);
  document.getElementById('custom-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('custom-modal')) closeCustomModal();
  });

  /* Confirm modal cancel */
  document.getElementById('cm-cancel').addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('confirm-modal')) closeConfirmModal();
  });

  /* Form submit */
  document.getElementById('custom-trick-form').addEventListener('submit', onCustomTrickSubmit);

  /* Keyboard: Escape closes any open modal */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCustomModal(); closeConfirmModal(); }
  });
}

function init() {
  initState();
  bindEvents();
  renderProfile();
  renderSkillTree();
}

document.addEventListener('DOMContentLoaded', init);
