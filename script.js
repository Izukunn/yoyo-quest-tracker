/**
 * YoYo Quest Tracker & Combo Master
 * script.js — Main application logic
 *
 * Architecture:
 *  - DATA          : built-in trick definitions (expandable via custom tricks)
 *  - STATE         : single source of truth (persisted in localStorage)
 *  - UTILS         : pure helpers
 *  - PROFILE HUD   : XP / Level display
 *  - SKILL TREE    : rendering + interaction
 *  - COMBO ENGINE  : generator + challenge logic (starter-throw rules)
 *  - CUSTOM TRICK  : modal form + localStorage persistence
 *  - TABS          : navigation
 *  - INIT          : bootstrap
 */

'use strict';

/* ============================================================
   DATA — Built-in Trick Definitions
   Each trick has:
     id, name, category, level, difficulty, prereqs, xpReward,
     isStarter (true = throw opener, subject to placement rules),
     isBind    (true = always the finishing step in a combo),
     entryMount, exitMount, youtube_url
============================================================ */

/**
 * @typedef {Object} TrickDef
 * @property {string}   id          - Unique slug
 * @property {string}   name        - Display name
 * @property {string}   category    - Trick category
 * @property {'Beginner'|'Intermediate'|'Advanced'} level - Skill level
 * @property {number}   difficulty  - 1–5 star rating
 * @property {string[]} prereqs     - IDs that must be 'mastered' first
 * @property {number}   xpReward    - XP granted on mastery
 * @property {boolean}  isStarter   - True for throw-type openers
 * @property {boolean}  isBind      - True for bind-type finishing moves
 * @property {string}   entryMount  - Mount required to enter this trick
 * @property {string}   exitMount   - Mount state after completing this trick
 * @property {string}   youtube_url - Optional YouTube video link (future use)
 * @property {boolean}  [isCustom]  - True for user-created tricks
 */

/** @type {TrickDef[]} */
const BUILTIN_TRICKS = [
  /* ── Beginner Starters (no prereqs, throw openers) ── */
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
    exitMount: 'Trapeze',
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

  /* ── Beginner Tricks ── */
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
    exitMount: 'Return',
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
    entryMount: 'Breakaway',
    exitMount: 'Trapeze',
    youtube_url: '',
  },

  /* ── Intermediate Tricks ── */
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

  /* ── Bind moves — isBind: true ── */
  {
    id: 'basic-bind',
    name: 'Basic Bind',
    category: 'Essential',
    level: 'Beginner',
    difficulty: 2,
    prereqs: ['front-mount'],   // reachable early via Sleeper -> Front Mount
    xpReward: 75,
    isStarter: false,
    isBind: true,
    entryMount: 'Front Mount / Trapeze',
    exitMount: 'Hand (returned)',
    youtube_url: '',
  },
  {
    id: 'bind',
    name: 'Bind (Trapeze)',
    category: 'Essential',
    level: 'Intermediate',
    difficulty: 2,
    prereqs: ['trapeze'],
    xpReward: 75,
    isStarter: false,
    isBind: true,
    entryMount: 'Trapeze',
    exitMount: 'Hand (returned)',
    youtube_url: '',
  },
];

/* ============================================================
   STATE — Single source of truth
============================================================ */

/**
 * @typedef {'locked'|'unlocked'|'mastered'} TrickStatus
 * @typedef {Object} PlayerState
 * @property {number} xp       - Accumulated total XP
 * @property {number} level    - Current player level
 * @property {Object.<string, TrickStatus>} tricks - trick id -> status
 */

/** Runtime trick list (built-in + custom merged). Mutated by addCustomTrick(). */
let TRICKS_DATA = [];

/** @type {PlayerState} */
const STATE = {
  xp: 0,
  level: 1,
  tricks: {},
};

/** localStorage keys */
const LS_STATE_KEY  = 'yoyoquest_state';
const LS_CUSTOM_KEY = 'yoyoquest_custom_tricks';

/* XP thresholds per level (index = level - 1) */
const LEVEL_XP_TABLE = [0, 200, 500, 900, 1400, 2000, 2800, 3800, 5000];

/* XP for completing a combo challenge */
const COMBO_CHALLENGE_XP = 50;

/* ============================================================
   LOCAL STORAGE — Persistence helpers
============================================================ */

/** Save current STATE (xp, level, tricks) to localStorage. */
function persistState() {
  try {
    localStorage.setItem(LS_STATE_KEY, JSON.stringify({
      xp: STATE.xp,
      level: STATE.level,
      tricks: STATE.tricks,
    }));
  } catch (_) { /* storage might be unavailable in some contexts */ }
}

/** Save custom trick array to localStorage. */
function persistCustomTricks(customs) {
  try {
    localStorage.setItem(LS_CUSTOM_KEY, JSON.stringify(customs));
  } catch (_) {}
}

/** Load custom tricks from localStorage. Returns [] if none. */
function loadCustomTricks() {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

/** Load player state from localStorage. Returns null if none saved. */
function loadPersistedState() {
  try {
    const raw = localStorage.getItem(LS_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

/* ============================================================
   UTILS — Pure helpers
============================================================ */

/**
 * Compute unlocked/locked status for a trick (never touches 'mastered').
 * A trick is unlocked only when ALL its prereqs are 'mastered'.
 * @param {TrickDef} trick
 * @returns {TrickStatus}
 */
function computeStatus(trick) {
  const allPrereqsMet = trick.prereqs.every(
    (pid) => STATE.tricks[pid] === 'mastered'
  );
  return allPrereqsMet ? 'unlocked' : 'locked';
}

/**
 * Re-compute unlocked/locked for every non-mastered trick.
 */
function recomputeAllStatuses() {
  TRICKS_DATA.forEach((trick) => {
    if (STATE.tricks[trick.id] !== 'mastered') {
      STATE.tricks[trick.id] = computeStatus(trick);
    }
  });
}

/**
 * Recursively force-lock a trick and all its descendants.
 * Deducts xpReward for every mastered trick that gets locked.
 * @param {string} trickId
 * @param {Set<string>} [visited]
 */
function cascadeLock(trickId, visited = new Set()) {
  if (visited.has(trickId)) return;
  visited.add(trickId);

  const dependents = TRICKS_DATA.filter((t) => t.prereqs.includes(trickId));
  dependents.forEach((dep) => {
    if (STATE.tricks[dep.id] === 'mastered') {
      STATE.xp = Math.max(0, STATE.xp - dep.xpReward);
    }
    STATE.tricks[dep.id] = 'locked';
    cascadeLock(dep.id, visited);
  });
}

/**
 * Calculate player level from total XP.
 * @param {number} xp
 * @returns {number}
 */
function calcLevel(xp) {
  let level = 1;
  for (let i = LEVEL_XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP_TABLE[i]) { level = i + 1; break; }
  }
  return level;
}

/**
 * Return XP progress toward the next level.
 * @param {number} xp
 * @returns {{ current: number, next: number, progress: number }}
 */
function xpForNextLevel(xp) {
  const level = calcLevel(xp);
  const currentThreshold = LEVEL_XP_TABLE[level - 1] ?? 0;
  const nextThreshold    = LEVEL_XP_TABLE[level] ?? LEVEL_XP_TABLE[LEVEL_XP_TABLE.length - 1];
  const delta    = nextThreshold - currentThreshold;
  const earned   = xp - currentThreshold;
  const progress = delta > 0 ? Math.min(earned / delta, 1) : 1;
  return { current: earned, next: delta, progress };
}

/** Count mastered tricks. */
function countMastered() {
  return Object.values(STATE.tricks).filter((s) => s === 'mastered').length;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'violet'|'emerald'} [accent='violet']
 */
function showToast(message, accent = 'violet') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast';
  if (accent === 'emerald') toast.classList.add('toast-emerald');
  toast.classList.remove('hidden');
  void toast.offsetWidth;
  toast.style.animation = 'none';
  void toast.offsetWidth;
  toast.style.animation = '';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

/**
 * Pick `count` random unique items from an array.
 * @template T
 * @param {T[]} arr
 * @param {number} count
 * @returns {T[]}
 */
function pickRandom(arr, count) {
  const copy = [...arr];
  const result = [];
  for (let i = 0; i < Math.min(count, copy.length); i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

/**
 * Generate a slug ID from a user-supplied name (lowercase, hyphenated).
 * Appends a short timestamp suffix to ensure uniqueness.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36);
}

/* ============================================================
   PROFILE HUD — Level / XP display
============================================================ */

/**
 * Refresh the player profile panel.
 * @param {boolean} [leveledUp=false]
 */
function renderProfile(leveledUp = false) {
  const lvl = calcLevel(STATE.xp);
  STATE.level = lvl;

  document.getElementById('player-level').textContent = lvl;
  document.getElementById('player-mastered').textContent = countMastered();
  document.getElementById('player-xp').textContent = STATE.xp;

  const { current, next, progress } = xpForNextLevel(STATE.xp);
  document.getElementById('xp-bar-label').textContent = `${current} / ${next} XP`;
  document.getElementById('xp-bar').style.width = `${(progress * 100).toFixed(1)}%`;

  const bar = document.getElementById('xp-bar');
  bar.classList.remove('xp-pulse');
  void bar.offsetWidth;
  bar.classList.add('xp-pulse');

  if (leveledUp) {
    const avatar = document.querySelector('#player-panel .w-14');
    if (avatar) {
      avatar.classList.remove('level-up-flash');
      void avatar.offsetWidth;
      avatar.classList.add('level-up-flash');
    }
  }
}

/**
 * Add XP, persist, and refresh UI. Returns true if leveled up.
 * @param {number} amount
 * @returns {boolean}
 */
function addXP(amount) {
  const prevLevel = calcLevel(STATE.xp);
  STATE.xp += amount;
  const newLevel = calcLevel(STATE.xp);
  const leveledUp = newLevel > prevLevel;
  persistState();
  renderProfile(leveledUp);
  if (leveledUp) showToast(`🎉 Level Up! You are now Level ${newLevel}!`, 'emerald');
  return leveledUp;
}

/* ============================================================
   SKILL TREE — Render & Interaction
============================================================ */

/** Reference to the trick card template */
const cardTemplate = document.getElementById('trick-card-template');

/** Level badge colour map */
const LEVEL_BADGE = {
  Beginner:     { bg: 'rgba(59,130,246,0.18)', color: '#93c5fd', border: 'rgba(59,130,246,0.35)' },
  Intermediate: { bg: 'rgba(234,179,8,0.18)',  color: '#fde047', border: 'rgba(234,179,8,0.35)' },
  Advanced:     { bg: 'rgba(239,68,68,0.18)',  color: '#fca5a5', border: 'rgba(239,68,68,0.35)' },
};

/**
 * Build difficulty dot spans.
 * @param {number} difficulty
 * @param {TrickStatus} status
 * @returns {DocumentFragment}
 */
function buildDifficultyDots(difficulty, status) {
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= 5; i++) {
    const dot = document.createElement('span');
    dot.className = 'star-dot';
    if (i <= difficulty) {
      dot.classList.add(status === 'mastered' ? 'filled-mastered' : 'filled');
    }
    dot.setAttribute('aria-hidden', 'true');
    frag.appendChild(dot);
  }
  return frag;
}

/**
 * Create a trick card DOM element.
 * @param {TrickDef} trick
 * @returns {HTMLElement}
 */
function createTrickCard(trick) {
  const status = STATE.tricks[trick.id];
  const clone  = cardTemplate.content.cloneNode(true);
  const card   = clone.querySelector('.trick-card');

  card.classList.add(`state-${status}`);
  card.dataset.trickId = trick.id;

  // Name + category
  card.querySelector('.trick-name').textContent = trick.name;
  card.querySelector('.trick-category').textContent =
    trick.category + (trick.isCustom ? ' ★' : '');

  // Level badge (injected after category)
  const lbConf = LEVEL_BADGE[trick.level] ?? LEVEL_BADGE.Beginner;
  const levelEl = document.createElement('span');
  levelEl.className = 'trick-level-badge';
  levelEl.textContent = trick.level;
  levelEl.style.cssText = `
    display:inline-block;
    font-size:0.6rem;font-weight:700;
    text-transform:uppercase;letter-spacing:0.07em;
    padding:1px 7px;border-radius:999px;margin-top:3px;
    background:${lbConf.bg};color:${lbConf.color};
    border:1px solid ${lbConf.border};
  `;
  card.querySelector('.trick-category').after(levelEl);

  // Difficulty dots
  const diffContainer = card.querySelector('.trick-difficulty');
  diffContainer.appendChild(buildDifficultyDots(trick.difficulty, status));
  diffContainer.setAttribute('aria-label', `Difficulty: ${trick.difficulty} out of 5`);

  // Prereq note
  const prereqEl = card.querySelector('.trick-prereq');
  if (trick.prereqs.length > 0) {
    const names = trick.prereqs
      .map((pid) => TRICKS_DATA.find((t) => t.id === pid)?.name ?? pid)
      .join(', ');
    prereqEl.textContent = `Requires: ${names}`;
  } else {
    prereqEl.textContent = 'No prerequisites';
  }

  // Entry/exit mount (show for all tricks that have them)
  if (trick.entryMount || trick.exitMount) {
    const mountEl = document.createElement('p');
    mountEl.className = 'trick-mount-info';
    mountEl.style.cssText = 'font-size:0.6rem;color:#71717a;margin-top:-4px;';
    const parts = [];
    if (trick.entryMount) parts.push(`In: ${trick.entryMount}`);
    if (trick.exitMount)  parts.push(`Out: ${trick.exitMount}`);
    mountEl.textContent = parts.join(' · ');
    prereqEl.after(mountEl);
  }

  // Status badge
  const badge = card.querySelector('.trick-badge');
  if (status === 'locked') {
    badge.textContent = '🔒 Locked';
    badge.classList.add('badge-locked');
  } else if (status === 'unlocked') {
    badge.textContent = '⚡ Unlocked';
    badge.classList.add('badge-unlocked');
  } else {
    badge.textContent = '✅ Mastered';
    badge.classList.add('badge-mastered');
  }

  // Bind badge overlay
  if (trick.isBind) {
    const bindTag = document.createElement('span');
    bindTag.textContent = '🔗 Bind';
    bindTag.style.cssText = `
      position:absolute;top:8px;left:8px;
      font-size:0.55rem;font-weight:700;text-transform:uppercase;
      padding:2px 6px;border-radius:999px;
      background:rgba(16,185,129,0.15);color:#34d399;
      border:1px solid rgba(16,185,129,0.3);
    `;
    card.style.position = 'relative';
    card.appendChild(bindTag);
  }

  // Starter badge overlay
  if (trick.isStarter) {
    const startTag = document.createElement('span');
    startTag.textContent = '🚀 Starter';
    startTag.style.cssText = `
      position:absolute;top:8px;left:8px;
      font-size:0.55rem;font-weight:700;text-transform:uppercase;
      padding:2px 6px;border-radius:999px;
      background:rgba(139,92,246,0.15);color:#a78bfa;
      border:1px solid rgba(139,92,246,0.3);
    `;
    card.style.position = 'relative';
    card.appendChild(startTag);
  }

  // Action button
  const btn = card.querySelector('.trick-action-btn');
  if (status === 'locked') {
    btn.textContent = '🔒 Locked';
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
  } else if (status === 'unlocked') {
    btn.textContent = `Set Mastered (+${trick.xpReward} XP)`;
    btn.addEventListener('click', () => onSetMastered(trick.id));
  } else {
    btn.textContent = '↩ Reset to Unlocked';
    btn.addEventListener('click', () => onResetTrick(trick.id));
  }

  return card;
}

/**
 * Render (or re-render) the full trick grid.
 */
function renderSkillTree() {
  const grid = document.getElementById('trick-grid');
  grid.innerHTML = '';
  TRICKS_DATA.forEach((trick) => grid.appendChild(createTrickCard(trick)));
}

/**
 * Handle "Set Mastered".
 * @param {string} trickId
 */
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

/**
 * Handle "Reset" — cascades lock to all dependents.
 * @param {string} trickId
 */
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

/* ============================================================
   COMBO ENGINE — Generator + Challenge
   Starter-throw placement rules:
     • isStarter tricks (Sleeper, Breakaway, Forward Pass) may ONLY appear:
         1. As the very first trick of the sequence, OR
         2. Immediately after a Bind step.
     • Two starters may NOT appear back-to-back.
     • isBind tricks act as the mandatory finish of every combo.
============================================================ */

/** Tracks if the current challenge has been claimed. */
let comboCompleted = false;

/**
 * Return all mastered tricks (eligible for combo generation).
 * @returns {TrickDef[]}
 */
function getMasteredTricks() {
  return TRICKS_DATA.filter((t) => STATE.tricks[t.id] === 'mastered');
}

/**
 * Build a valid combo sequence respecting starter-throw rules.
 *
 * Algorithm:
 *  1. Split mastered tricks into: starters, regular, binds.
 *  2. Pick ONE starter for slot 0.
 *  3. Fill 2–3 more slots with regular (non-starter, non-bind) tricks.
 *  4. Append a bind trick as the mandatory finish.
 *
 * If no bind is mastered, the combo ends without one (edge case).
 *
 * @returns {TrickDef[]}
 */
function generateCombo() {
  const mastered  = getMasteredTricks();
  const starters  = mastered.filter((t) => t.isStarter);
  const regulars  = mastered.filter((t) => !t.isStarter && !t.isBind);
  const binds     = mastered.filter((t) => t.isBind);

  const combo = [];

  /* ── Step 1: pick a starter for position 0 ── */
  if (starters.length > 0) {
    combo.push(pickRandom(starters, 1)[0]);
  }

  /* ── Step 2: fill 2–3 regular trick slots ── */
  const regularCount = regulars.length >= 3 ? 3 : Math.min(2, regulars.length);
  const picked = pickRandom(regulars, regularCount);
  combo.push(...picked);

  /* ── Step 3: append a bind as the finishing move ── */
  if (binds.length > 0) {
    combo.push(pickRandom(binds, 1)[0]);
  }

  return combo;
}

/**
 * Render a single combo step card.
 * @param {TrickDef} trick
 * @param {number} stepIndex
 * @returns {HTMLElement}
 */
function createComboStep(trick, stepIndex) {
  const isBindStep = trick.isBind;
  const div = document.createElement('div');
  div.className = 'combo-step' + (isBindStep ? ' bind-step' : '') +
                  (trick.isStarter ? ' starter-step' : '');
  div.style.animationDelay = `${stepIndex * 0.08}s`;
  div.setAttribute('role', 'listitem');

  const label = isBindStep ? 'Finish' : trick.isStarter ? 'Opener' : `Step ${stepIndex + 1}`;
  div.innerHTML = `
    <p class="step-num">${label}</p>
    <p class="step-name">${trick.name}</p>
    <p class="step-level">${trick.level ?? ''}</p>
  `;
  return div;
}

/**
 * Render arrow connector between combo steps.
 * @param {number} index
 * @returns {HTMLElement}
 */
function createArrow(index) {
  const span = document.createElement('span');
  span.className = 'combo-arrow';
  span.setAttribute('aria-hidden', 'true');
  span.style.animationDelay = `${index * 0.08}s`;
  span.textContent = '→';
  return span;
}

/**
 * Render the combo sequence into the combo-flow container.
 * @param {TrickDef[]} combo
 */
function renderComboFlow(combo) {
  const flow = document.getElementById('combo-flow');
  flow.innerHTML = '';
  combo.forEach((trick, i) => {
    flow.appendChild(createComboStep(trick, i));
    if (i < combo.length - 1) flow.appendChild(createArrow(i));
  });
}

/** Handle "Generate Daily Combo Challenge". */
function onGenerateCombo() {
  const masteredNonBind = getMasteredTricks().filter((t) => !t.isBind);
  const comboDisplay    = document.getElementById('combo-display');
  const comboEmpty      = document.getElementById('combo-empty');
  const feedback        = document.getElementById('combo-feedback');

  if (masteredNonBind.length === 0) {
    comboDisplay.classList.add('hidden');
    comboEmpty.classList.remove('hidden');
    return;
  }

  comboEmpty.classList.add('hidden');
  comboDisplay.classList.remove('hidden');
  feedback.classList.add('hidden');
  feedback.textContent = '';

  const completeBtn = document.getElementById('btn-complete');
  completeBtn.disabled = false;
  comboCompleted = false;

  const combo = generateCombo();
  document.getElementById('combo-flow').dataset.comboIds =
    combo.map((t) => t.id).join(',');

  renderComboFlow(combo);
}

/** Handle "Complete Challenge". */
function onCompleteChallenge() {
  if (comboCompleted) return;
  comboCompleted = true;

  const completeBtn = document.getElementById('btn-complete');
  completeBtn.disabled = true;

  addXP(COMBO_CHALLENGE_XP);

  const feedback = document.getElementById('combo-feedback');
  feedback.textContent = `🎯 Challenge completed! +${COMBO_CHALLENGE_XP} XP earned.`;
  feedback.className = 'mt-4 text-sm font-semibold text-neon-emerald';
  feedback.classList.remove('hidden');

  showToast(`🎯 Combo challenge complete! +${COMBO_CHALLENGE_XP} XP`, 'emerald');
}

/* ============================================================
   CUSTOM TRICK CREATOR — Modal form
============================================================ */

/** Open the custom trick modal. */
function openCustomModal() {
  document.getElementById('custom-modal').classList.remove('hidden');
  document.getElementById('custom-modal').setAttribute('aria-hidden', 'false');
  document.getElementById('ct-name').focus();
}

/** Close the custom trick modal and reset the form. */
function closeCustomModal() {
  document.getElementById('custom-modal').classList.add('hidden');
  document.getElementById('custom-modal').setAttribute('aria-hidden', 'true');
  document.getElementById('custom-trick-form').reset();
  document.getElementById('ct-error').textContent = '';
}

/**
 * Populate the prerequisite <select> inside the modal with all current tricks.
 */
function populatePrereqSelect() {
  const sel = document.getElementById('ct-prereqs');
  sel.innerHTML = '';
  TRICKS_DATA.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
}

/**
 * Handle form submission: validate, create TrickDef, inject into TRICKS_DATA,
 * initialise its status in STATE, persist, and refresh the UI.
 * @param {SubmitEvent} e
 */
function onCustomTrickSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('ct-error');
  errorEl.textContent = '';

  const name       = document.getElementById('ct-name').value.trim();
  const category   = document.getElementById('ct-category').value.trim() || 'Custom';
  const level      = document.getElementById('ct-level').value;
  const entryMount = document.getElementById('ct-entry').value.trim();
  const exitMount  = document.getElementById('ct-exit').value.trim();
  const diffVal    = parseInt(document.getElementById('ct-difficulty').value, 10);

  // Gather selected prereqs (multi-select)
  const prereqsSel = document.getElementById('ct-prereqs');
  const prereqs    = Array.from(prereqsSel.selectedOptions).map((o) => o.value);

  // Validation
  if (!name) {
    errorEl.textContent = 'Trick name is required.';
    document.getElementById('ct-name').focus();
    return;
  }
  const duplicate = TRICKS_DATA.find(
    (t) => t.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    errorEl.textContent = `A trick named "${name}" already exists.`;
    return;
  }

  /** @type {TrickDef} */
  const newTrick = {
    id:          slugify(name),
    name,
    category,
    level,
    difficulty:  isNaN(diffVal) ? 2 : Math.max(1, Math.min(5, diffVal)),
    prereqs,
    xpReward:    level === 'Advanced' ? 150 : level === 'Intermediate' ? 100 : 60,
    isStarter:   false,
    isBind:      false,
    entryMount,
    exitMount,
    youtube_url: '',
    isCustom:    true,
  };

  // Inject into the live TRICKS_DATA array
  TRICKS_DATA.push(newTrick);

  // Initialise status in STATE
  STATE.tricks[newTrick.id] = computeStatus(newTrick);

  // Persist custom tricks separately
  const existing = loadCustomTricks();
  existing.push(newTrick);
  persistCustomTricks(existing);
  persistState();

  renderSkillTree();
  closeCustomModal();
  showToast(`✨ "${newTrick.name}" added to your Skill Tree!`, 'violet');
}

/* ============================================================
   TABS — Navigation
============================================================ */

/**
 * Switch the visible view section.
 * @param {'skilltree'|'combo'} viewId
 */
function switchTab(viewId) {
  document.querySelectorAll('.view-section').forEach((v) => v.classList.add('hidden'));
  const active = document.getElementById(`view-${viewId}`);
  if (active) active.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach((t) => {
    const isActive = t.id === `tab-${viewId}`;
    t.classList.toggle('active-tab', isActive);
    t.setAttribute('aria-selected', String(isActive));
  });
}

/* ============================================================
   INIT — Bootstrap
============================================================ */

/**
 * Merge built-in tricks with saved custom tricks into TRICKS_DATA.
 */
function buildTricksData() {
  const customs = loadCustomTricks();
  TRICKS_DATA = [...BUILTIN_TRICKS, ...customs];
}

/**
 * Initialise STATE from localStorage or from scratch.
 */
function initState() {
  buildTricksData();

  const saved = loadPersistedState();
  if (saved) {
    // Restore XP and level
    STATE.xp    = saved.xp    ?? 0;
    STATE.level = saved.level ?? 1;

    // Restore trick statuses; ensure any NEW built-in tricks not in saved data get defaults
    STATE.tricks = saved.tricks ?? {};
    TRICKS_DATA.forEach((trick) => {
      if (!(trick.id in STATE.tricks)) {
        STATE.tricks[trick.id] = computeStatus(trick);
      }
    });
    // Re-run full status computation to fix any inconsistencies
    recomputeAllStatuses();
  } else {
    // Fresh start: tricks with no prereqs start unlocked
    TRICKS_DATA.forEach((trick) => {
      STATE.tricks[trick.id] = trick.prereqs.length === 0 ? 'unlocked' : 'locked';
    });
  }
}

/**
 * Bind all static event listeners.
 */
function bindEvents() {
  // Tabs
  document.getElementById('tab-skilltree')
    .addEventListener('click', () => switchTab('skilltree'));
  document.getElementById('tab-combo')
    .addEventListener('click', () => switchTab('combo'));

  // Combo
  document.getElementById('btn-generate')
    .addEventListener('click', onGenerateCombo);
  document.getElementById('btn-complete')
    .addEventListener('click', onCompleteChallenge);

  // Custom trick modal — open button in skill tree header
  document.getElementById('btn-add-trick')
    .addEventListener('click', () => {
      populatePrereqSelect();
      openCustomModal();
    });

  // Modal close buttons
  document.getElementById('btn-modal-close')
    .addEventListener('click', closeCustomModal);
  document.getElementById('btn-modal-cancel')
    .addEventListener('click', closeCustomModal);

  // Close modal on backdrop click
  document.getElementById('custom-modal')
    .addEventListener('click', (e) => {
      if (e.target === document.getElementById('custom-modal')) closeCustomModal();
    });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCustomModal();
  });

  // Form submit
  document.getElementById('custom-trick-form')
    .addEventListener('submit', onCustomTrickSubmit);
}

/**
 * Application entry point.
 */
function init() {
  initState();
  bindEvents();
  renderProfile();
  renderSkillTree();
}

document.addEventListener('DOMContentLoaded', init);
