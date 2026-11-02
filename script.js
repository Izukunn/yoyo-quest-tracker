/**
 * YoYo Quest Tracker & Combo Master
 * script.js — Main application logic
 *
 * Architecture:
 *  - STATE         : single source of truth object
 *  - DATA          : static trick definitions
 *  - UTILS         : pure helpers
 *  - SKILL TREE    : rendering + interaction
 *  - COMBO ENGINE  : generator + challenge logic
 *  - PROFILE HUD   : XP / Level display
 *  - TABS          : navigation
 *  - INIT          : bootstrap
 */

'use strict';

/* ============================================================
   DATA — Static Trick Definitions
============================================================ */

/**
 * @typedef {Object} TrickDef
 * @property {string}   id         - Unique identifier (slug)
 * @property {string}   name       - Display name
 * @property {string}   category   - Trick category
 * @property {number}   difficulty - 1–5 star rating
 * @property {string[]} prereqs    - IDs that must be 'mastered' first
 * @property {number}   xpReward   - XP granted on mastery
 */

/** @type {TrickDef[]} */
const TRICKS_DATA = [
  {
    id: 'sleeper',
    name: 'Sleeper',
    category: 'Foundational',
    difficulty: 1,
    prereqs: [],
    xpReward: 50,
  },
  {
    id: 'breakaway',
    name: 'Breakaway',
    category: 'Foundational',
    difficulty: 1,
    prereqs: [],
    xpReward: 50,
  },
  {
    id: 'front-mount',
    name: 'Front Mount',
    category: 'Mount',
    difficulty: 2,
    prereqs: ['sleeper'],
    xpReward: 75,
  },
  {
    id: 'trapeze',
    name: 'Trapeze',
    category: 'Mount',
    difficulty: 2,
    prereqs: ['breakaway'],
    xpReward: 75,
  },
  {
    id: 'brain-twister',
    name: 'Brain Twister',
    category: 'Combo',
    difficulty: 3,
    prereqs: ['front-mount'],
    xpReward: 100,
  },
  {
    id: 'trapeze-brother',
    name: 'Trapeze and His Brother',
    category: 'Mount',
    difficulty: 3,
    prereqs: ['trapeze'],
    xpReward: 100,
  },
  {
    id: 'double-or-nothing',
    name: 'Double or Nothing',
    category: 'Mount',
    difficulty: 4,
    prereqs: ['trapeze'],
    xpReward: 125,
  },
  {
    id: 'bind',
    name: 'Bind',
    category: 'Essential',
    difficulty: 2,
    prereqs: ['trapeze'],
    xpReward: 75,
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
 * @property {Object.<string, TrickStatus>} tricks - Map of trick id -> status
 */

/** @type {PlayerState} */
const STATE = {
  xp: 0,
  level: 1,
  tricks: {},    // populated in initState()
};

/* XP thresholds per level (index = level - 1) */
const LEVEL_XP_TABLE = [0, 200, 500, 900, 1400, 2000, 2800, 3800, 5000];

/* XP reward for completing a combo challenge */
const COMBO_CHALLENGE_XP = 50;

/* ============================================================
   UTILS — Pure helpers
============================================================ */

/**
 * Compute the unlocked/locked status of a trick (does NOT touch 'mastered').
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
 * Re-compute unlocked/locked for every trick that is NOT currently mastered.
 * Mastered tricks are only touched by explicit user actions (onSetMastered /
 * cascadeLock), so they are skipped here.
 */
function recomputeAllStatuses() {
  TRICKS_DATA.forEach((trick) => {
    if (STATE.tricks[trick.id] !== 'mastered') {
      STATE.tricks[trick.id] = computeStatus(trick);
    }
  });
}

/**
 * Recursively force-lock a trick and every trick that directly or indirectly
 * depends on it (cascading reset). Also deducts the xpReward of every
 * mastered trick that gets locked in the process.
 *
 * @param {string} trickId   - The trick being locked / reset
 * @param {Set<string>} [visited] - Internal guard against infinite cycles
 */
function cascadeLock(trickId, visited = new Set()) {
  if (visited.has(trickId)) return;
  visited.add(trickId);

  // Find every trick that lists trickId as a direct prerequisite
  const dependents = TRICKS_DATA.filter((t) => t.prereqs.includes(trickId));

  dependents.forEach((dep) => {
    // If the dependent was mastered, deduct its XP before locking it
    if (STATE.tricks[dep.id] === 'mastered') {
      STATE.xp = Math.max(0, STATE.xp - dep.xpReward);
    }
    STATE.tricks[dep.id] = 'locked';
    // Recurse into this dependent's own dependents
    cascadeLock(dep.id, visited);
  });
}

/**
 * Calculate the player's level from their total XP.
 * @param {number} xp
 * @returns {number}
 */
function calcLevel(xp) {
  let level = 1;
  for (let i = LEVEL_XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP_TABLE[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

/**
 * Return the XP required for the NEXT level given total XP.
 * @param {number} xp
 * @returns {{ current: number, next: number, progress: number }}
 */
function xpForNextLevel(xp) {
  const level = calcLevel(xp);
  const currentThreshold = LEVEL_XP_TABLE[level - 1] ?? 0;
  const nextThreshold = LEVEL_XP_TABLE[level] ?? LEVEL_XP_TABLE[LEVEL_XP_TABLE.length - 1];
  const delta = nextThreshold - currentThreshold;
  const earned = xp - currentThreshold;
  const progress = delta > 0 ? Math.min(earned / delta, 1) : 1;
  return {
    current: earned,
    next: delta,
    progress,
  };
}

/**
 * Count how many tricks are mastered.
 * @returns {number}
 */
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

  // Re-trigger animation by forcing reflow
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

/* ============================================================
   PROFILE HUD — Level / XP display
============================================================ */

/**
 * Refresh all elements in the player profile panel.
 * @param {boolean} [leveledUp=false] - trigger level-up visual effect
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

  // XP bar pulse on change
  const bar = document.getElementById('xp-bar');
  bar.classList.remove('xp-pulse');
  void bar.offsetWidth; // reflow
  bar.classList.add('xp-pulse');

  // Level-up avatar flash
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
 * Add XP to state and update UI. Returns true if player leveled up.
 * @param {number} amount
 * @returns {boolean}
 */
function addXP(amount) {
  const prevLevel = calcLevel(STATE.xp);
  STATE.xp += amount;
  const newLevel = calcLevel(STATE.xp);
  const leveledUp = newLevel > prevLevel;
  renderProfile(leveledUp);
  if (leveledUp) {
    showToast(`🎉 Level Up! You are now Level ${newLevel}!`, 'emerald');
  }
  return leveledUp;
}

/* ============================================================
   SKILL TREE — Render & Interaction
============================================================ */

/** Reference to the trick card template element */
const cardTemplate = document.getElementById('trick-card-template');

/**
 * Build star dots HTML for a difficulty rating.
 * @param {number} difficulty - 1–5
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
 * Create a trick card DOM element from a TrickDef.
 * @param {TrickDef} trick
 * @returns {HTMLElement}
 */
function createTrickCard(trick) {
  const status = STATE.tricks[trick.id];
  const clone = cardTemplate.content.cloneNode(true);
  const card = clone.querySelector('.trick-card');

  // State class
  card.classList.add(`state-${status}`);
  card.dataset.trickId = trick.id;

  // Content
  card.querySelector('.trick-name').textContent = trick.name;
  card.querySelector('.trick-category').textContent = trick.category;

  // Difficulty dots
  const diffContainer = card.querySelector('.trick-difficulty');
  diffContainer.appendChild(buildDifficultyDots(trick.difficulty, status));
  diffContainer.setAttribute('aria-label', `Difficulty: ${trick.difficulty} out of 5`);

  // Prerequisite note
  const prereqEl = card.querySelector('.trick-prereq');
  if (trick.prereqs.length > 0) {
    const prereqNames = trick.prereqs
      .map((pid) => TRICKS_DATA.find((t) => t.id === pid)?.name ?? pid)
      .join(', ');
    prereqEl.textContent = `Requires: ${prereqNames}`;
  } else {
    prereqEl.textContent = 'No prerequisites';
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
 * Render the full trick grid (clears & rebuilds).
 */
function renderSkillTree() {
  const grid = document.getElementById('trick-grid');
  grid.innerHTML = '';
  TRICKS_DATA.forEach((trick) => {
    grid.appendChild(createTrickCard(trick));
  });
}

/**
 * Handle "Set Mastered" click.
 * @param {string} trickId
 */
function onSetMastered(trickId) {
  if (STATE.tricks[trickId] !== 'unlocked') return;
  const trick = TRICKS_DATA.find((t) => t.id === trickId);
  if (!trick) return;

  STATE.tricks[trickId] = 'mastered';
  recomputeAllStatuses();

  addXP(trick.xpReward);
  renderSkillTree();
  showToast(`🏆 "${trick.name}" mastered! +${trick.xpReward} XP`, 'violet');
}

/**
 * Handle "Reset" click — downgrade mastered trick back to unlocked,
 * and re-lock any tricks that depended on it.
 * @param {string} trickId
 */
function onResetTrick(trickId) {
  if (STATE.tricks[trickId] !== 'mastered') return;
  const trick = TRICKS_DATA.find((t) => t.id === trickId);
  if (!trick) return;

  // Deduct this trick's own XP reward (floor at 0)
  STATE.xp = Math.max(0, STATE.xp - trick.xpReward);

  // Reset this trick to unlocked (it still meets its own prereqs)
  STATE.tricks[trickId] = 'unlocked';

  // Cascade-lock all direct and indirect dependents, deducting their XP too
  cascadeLock(trickId);

  // Re-evaluate unlocked/locked for any remaining non-mastered tricks
  recomputeAllStatuses();

  renderProfile();
  renderSkillTree();
  showToast(`↩ "${trick.name}" reset — dependents re-locked. XP adjusted.`, 'violet');
}

/* ============================================================
   COMBO ENGINE — Generator & Challenge
============================================================ */

/** Tracks whether the current combo challenge has been completed */
let comboCompleted = false;

/**
 * Collect only tricks with status 'mastered' (eligible for combo generation).
 * 'Unlocked' tricks are excluded — the player must mark them mastered first.
 * @returns {TrickDef[]}
 */
function getMasteredTricks() {
  return TRICKS_DATA.filter((t) => STATE.tricks[t.id] === 'mastered');
}

/**
 * Generate a combo: 3–4 random tricks from MASTERED-only pool + mandatory Bind.
 * Bind is excluded from the main steps and always appended as the finishing move.
 * @returns {TrickDef[]} — the selected tricks with Bind at the end
 */
function generateCombo() {
  const mastered = getMasteredTricks();
  // Exclude 'bind' from the selectable steps; it is the mandatory finish
  const nonBind = mastered.filter((t) => t.id !== 'bind');
  const count = nonBind.length >= 4 ? 4 : Math.min(3, nonBind.length);
  const picked = pickRandom(nonBind, count);

  // Always end with Bind (appended regardless of its mastery status)
  const bindTrick = TRICKS_DATA.find((t) => t.id === 'bind');
  if (bindTrick) picked.push(bindTrick);

  return picked;
}

/**
 * Render one combo step card.
 * @param {TrickDef} trick
 * @param {number} stepIndex - 0-based
 * @param {boolean} isBind
 * @returns {HTMLElement}
 */
function createComboStep(trick, stepIndex, isBind) {
  const div = document.createElement('div');
  div.className = 'combo-step' + (isBind ? ' bind-step' : '');
  div.style.animationDelay = `${stepIndex * 0.08}s`;
  div.setAttribute('role', 'listitem');

  div.innerHTML = `
    <p class="step-num">${isBind ? 'Finish' : `Step ${stepIndex + 1}`}</p>
    <p class="step-name">${trick.name}</p>
  `;
  return div;
}

/**
 * Render arrow separator between combo steps.
 * @param {number} index - delay index
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
 * Render the current combo into the combo flow container.
 * @param {TrickDef[]} combo
 */
function renderComboFlow(combo) {
  const flow = document.getElementById('combo-flow');
  flow.innerHTML = '';

  combo.forEach((trick, i) => {
    const isBind = trick.id === 'bind';
    const step = createComboStep(trick, i, isBind);
    flow.appendChild(step);
    if (i < combo.length - 1) {
      flow.appendChild(createArrow(i));
    }
  });
}

/**
 * Handle "Generate Daily Combo Challenge" button click.
 */
function onGenerateCombo() {
  // Only mastered (non-bind) tricks are eligible for combo generation
  const masteredNonBind = getMasteredTricks().filter((t) => t.id !== 'bind');
  const comboDisplay = document.getElementById('combo-display');
  const comboEmpty = document.getElementById('combo-empty');
  const feedback = document.getElementById('combo-feedback');

  if (masteredNonBind.length === 0) {
    comboDisplay.classList.add('hidden');
    comboEmpty.classList.remove('hidden');
    return;
  }

  comboEmpty.classList.add('hidden');
  comboDisplay.classList.remove('hidden');
  feedback.classList.add('hidden');
  feedback.textContent = '';

  // Reset complete button state
  const completeBtn = document.getElementById('btn-complete');
  completeBtn.disabled = false;
  completeBtn.classList.remove('opacity-40');
  comboCompleted = false;

  const combo = generateCombo();
  // Store for completion handler
  document.getElementById('combo-flow').dataset.comboJson = JSON.stringify(
    combo.map((t) => t.id)
  );

  renderComboFlow(combo);
}

/**
 * Handle "Complete Challenge" button click.
 */
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
   TABS — Navigation
============================================================ */

/**
 * Switch the visible view section.
 * @param {'skilltree'|'combo'} viewId
 */
function switchTab(viewId) {
  const views = document.querySelectorAll('.view-section');
  views.forEach((v) => v.classList.add('hidden'));

  const active = document.getElementById(`view-${viewId}`);
  if (active) active.classList.remove('hidden');

  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((t) => {
    const isActive = t.id === `tab-${viewId}`;
    t.classList.toggle('active-tab', isActive);
    t.setAttribute('aria-selected', String(isActive));
  });
}

/* ============================================================
   INIT — Bootstrap the application
============================================================ */

/**
 * Initialise trick statuses from scratch.
 * Tricks with no prereqs start as 'unlocked', rest as 'locked'.
 */
function initState() {
  TRICKS_DATA.forEach((trick) => {
    STATE.tricks[trick.id] = trick.prereqs.length === 0 ? 'unlocked' : 'locked';
  });
}

/**
 * Bind all static event listeners.
 */
function bindEvents() {
  // Tab navigation
  document.getElementById('tab-skilltree').addEventListener('click', () => switchTab('skilltree'));
  document.getElementById('tab-combo').addEventListener('click', () => switchTab('combo'));

  // Combo buttons
  document.getElementById('btn-generate').addEventListener('click', onGenerateCombo);
  document.getElementById('btn-complete').addEventListener('click', onCompleteChallenge);
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

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
