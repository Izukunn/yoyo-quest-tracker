/**
 * ============================================================
 * YoYo Quest Tracker & Combo Master — script.js
 * Vanilla JS | Dark Mode | Gamified SPA
 * ============================================================
 */

'use strict';

// ============================================================
// 1. GAME DATA — Trick Definitions (JSON)
// ============================================================

/**
 * Each trick:
 *  id         – unique string identifier
 *  name       – display name
 *  category   – trick style category
 *  difficulty – 1 (Beginner) to 5 (Advanced)
 *  prereq     – id of prerequisite trick, or null
 *  xpReward   – XP earned when mastered
 */
const TRICKS_DATA = [
  {
    id: 'sleeper',
    name: 'Sleeper',
    category: 'Foundation',
    difficulty: 1,
    prereq: null,
    xpReward: 30,
  },
  {
    id: 'breakaway',
    name: 'Breakaway',
    category: 'Foundation',
    difficulty: 1,
    prereq: null,
    xpReward: 30,
  },
  {
    id: 'front-mount',
    name: 'Front Mount',
    category: 'Mount',
    difficulty: 2,
    prereq: 'sleeper',
    xpReward: 50,
  },
  {
    id: 'trapeze',
    name: 'Trapeze',
    category: 'Mount',
    difficulty: 2,
    prereq: 'breakaway',
    xpReward: 50,
  },
  {
    id: 'brain-twister',
    name: 'Brain Twister',
    category: 'String Trick',
    difficulty: 3,
    prereq: 'front-mount',
    xpReward: 75,
  },
  {
    id: 'trapeze-brother',
    name: "Trapeze & His Brother",
    category: 'Mount',
    difficulty: 3,
    prereq: 'trapeze',
    xpReward: 75,
  },
  {
    id: 'double-or-nothing',
    name: 'Double or Nothing',
    category: 'Mount',
    difficulty: 4,
    prereq: 'trapeze',
    xpReward: 100,
  },
  {
    id: 'bind',
    name: 'Bind',
    category: 'Essential',
    difficulty: 2,
    prereq: 'trapeze',
    xpReward: 50,
  },
];

// XP needed per level (index = level, value = cumulative XP to reach that level)
const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];

// Player title per level
const PLAYER_TITLES = [
  'Novice Thrower',      // L1
  'String Spinner',      // L2
  'Mount Apprentice',    // L3
  'Combo Seeker',        // L4
  'Trick Architect',     // L5
  'Yoyo Veteran',        // L6
  'Combo Artisan',       // L7
  'Trick Master',        // L8
  'Elite Spinner',       // L9
  'YoYo Legend',         // L10
];

// ============================================================
// 2. STATE MANAGEMENT
// ============================================================

/**
 * Application state — source of truth.
 * Persisted to localStorage on every mutation.
 */
let state = {
  // trick statuses: 'locked' | 'unlocked' | 'mastered'
  trickStatus: {},     // { [trickId]: 'locked' | 'unlocked' | 'mastered' }
  player: {
    xp: 0,
    level: 1,
  },
  currentCombo: [],    // array of trick ids in current combo
  comboCompleted: false,
};

const STORAGE_KEY = 'yoyo_quest_state_v1';

/** Persist state to localStorage */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* storage unavailable — silent fail */ }
}

/** Load persisted state; initialise defaults if absent */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Merge only known keys to avoid stale data issues
      if (saved.trickStatus) state.trickStatus = saved.trickStatus;
      if (saved.player)      state.player      = saved.player;
    }
  } catch (_) { /* corrupted storage — start fresh */ }

  // Initialise any missing trick statuses
  TRICKS_DATA.forEach(trick => {
    if (!state.trickStatus[trick.id]) {
      state.trickStatus[trick.id] = trick.prereq === null ? 'unlocked' : 'locked';
    }
  });
}

// ============================================================
// 3. GAME LOGIC — XP & Levels
// ============================================================

/**
 * Calculate current level based on total XP.
 * @param {number} xp
 * @returns {number} level (1-indexed)
 */
function calcLevel(xp) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 1; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, LEVEL_THRESHOLDS.length);
}

/**
 * Add XP to the player and update level.
 * Returns { prevLevel, newLevel, levelled } for UI feedback.
 * @param {number} amount
 */
function addXP(amount) {
  const prevLevel = state.player.level;
  state.player.xp   += amount;
  state.player.level = calcLevel(state.player.xp);
  const levelled = state.player.level > prevLevel;
  saveState();
  return { prevLevel, newLevel: state.player.level, levelled };
}

/**
 * XP progress within current level (0–1 fraction).
 */
function xpProgress() {
  const lvl = state.player.level;
  const maxLvl = LEVEL_THRESHOLDS.length;
  if (lvl >= maxLvl) return { current: state.player.xp, needed: state.player.xp, fraction: 1 };
  const xpThisLevel = LEVEL_THRESHOLDS[lvl - 1];       // XP at start of current level
  const xpNextLevel = LEVEL_THRESHOLDS[lvl];            // XP needed to reach next level
  const current     = state.player.xp - xpThisLevel;
  const needed      = xpNextLevel - xpThisLevel;
  const fraction    = Math.min(current / needed, 1);
  return { current, needed, fraction };
}

// ============================================================
// 4. GAME LOGIC — Skill Tree
// ============================================================

/**
 * Recompute all trick statuses based on prerequisite chain.
 * Only 'locked' tricks are checked; mastered tricks stay mastered.
 */
function recomputeStatuses() {
  TRICKS_DATA.forEach(trick => {
    // If already mastered, leave it
    if (state.trickStatus[trick.id] === 'mastered') return;

    // No prereq → always unlocked
    if (trick.prereq === null) {
      state.trickStatus[trick.id] = 'unlocked';
      return;
    }

    // Unlock if prereq is mastered
    const prereqStatus = state.trickStatus[trick.prereq];
    if (prereqStatus === 'mastered') {
      state.trickStatus[trick.id] = 'unlocked';
    } else {
      state.trickStatus[trick.id] = 'locked';
    }
  });
  saveState();
}

/**
 * Set a trick to 'mastered'. Rewards XP. Returns XP result.
 * @param {string} trickId
 */
function masterTrick(trickId) {
  if (state.trickStatus[trickId] !== 'unlocked') return null;
  state.trickStatus[trickId] = 'mastered';
  const trick = TRICKS_DATA.find(t => t.id === trickId);
  const xpResult = addXP(trick.xpReward);
  recomputeStatuses();
  return xpResult;
}

/**
 * Reset a trick back to 'unlocked'. Also resets any mastered tricks
 * that depend (directly or transitively) on this trick.
 * @param {string} trickId
 */
function resetTrick(trickId) {
  if (state.trickStatus[trickId] !== 'mastered') return;

  // BFS to find all tricks that depend on trickId (transitively)
  const dependents = getDependents(trickId);

  // Deduct XP for this trick
  const trick = TRICKS_DATA.find(t => t.id === trickId);
  state.player.xp = Math.max(0, state.player.xp - trick.xpReward);

  // Deduct XP for each mastered dependent and reset them
  dependents.forEach(depId => {
    if (state.trickStatus[depId] === 'mastered') {
      const dep = TRICKS_DATA.find(t => t.id === depId);
      state.player.xp = Math.max(0, state.player.xp - dep.xpReward);
    }
    state.trickStatus[depId] = 'locked';
  });

  state.trickStatus[trickId] = 'unlocked';
  state.player.level = calcLevel(state.player.xp);
  recomputeStatuses();
}

/**
 * Get all trick IDs that directly or transitively depend on a given trick.
 * @param {string} trickId
 * @returns {string[]}
 */
function getDependents(trickId) {
  const result = [];
  const queue  = [trickId];
  while (queue.length) {
    const current = queue.shift();
    TRICKS_DATA.forEach(t => {
      if (t.prereq === current && !result.includes(t.id)) {
        result.push(t.id);
        queue.push(t.id);
      }
    });
  }
  return result;
}

/**
 * Count mastered tricks.
 */
function countMastered() {
  return Object.values(state.trickStatus).filter(s => s === 'mastered').length;
}

// ============================================================
// 5. GAME LOGIC — Combo Generator
// ============================================================

/**
 * Get available tricks (unlocked OR mastered), excluding 'Bind' from the
 * random pool (Bind is always appended at the end for realism).
 * @returns {string[]} array of trick ids
 */
function getAvailableTrickIds() {
  return TRICKS_DATA
    .filter(t => t.id !== 'bind' && (state.trickStatus[t.id] === 'unlocked' || state.trickStatus[t.id] === 'mastered'))
    .map(t => t.id);
}

/**
 * Generate a random combo of 3–4 tricks from available pool + Bind at end.
 * Returns null if pool has fewer than 3 tricks.
 * @returns {string[]|null}
 */
function generateCombo() {
  const pool = getAvailableTrickIds();
  if (pool.length < 3) return null;

  // Shuffle Fisher-Yates
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Pick 3 or 4 (randomly choose count)
  const count = pool.length >= 4 && Math.random() > 0.4 ? 4 : 3;
  const combo = shuffled.slice(0, count);

  // Always end with Bind if Bind is available
  const bindStatus = state.trickStatus['bind'];
  if (bindStatus === 'unlocked' || bindStatus === 'mastered') {
    combo.push('bind');
  }

  return combo;
}

// ============================================================
// 6. DOM HELPERS
// ============================================================

/** Get element by id (shorthand) */
const $ = id => document.getElementById(id);

/** Difficulty label and dot color */
function difficultyInfo(level) {
  const labels = ['', 'Beginner', 'Easy', 'Intermediate', 'Hard', 'Expert'];
  const colors  = ['', '#10B981', '#34D399', '#F59E0B', '#F97316', '#EF4444'];
  return { label: labels[level] || 'Unknown', color: colors[level] || '#94a3b8' };
}

/** Build difficulty dot HTML */
function difficultyDots(level) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= level;
    const info   = difficultyInfo(level);
    html += `<span class="diff-dot" style="background:${filled ? info.color : '#1e293b'}; border: 1px solid ${filled ? info.color : '#334155'};"></span>`;
  }
  return html;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {string} icon  – emoji icon
 */
let toastTimer = null;
function showToast(message, type = 'info', icon = 'ℹ️') {
  const toast      = $('toast');
  const toastInner = $('toast-inner');
  const toastMsg   = $('toast-msg');
  const toastIcon  = $('toast-icon');

  toastMsg.textContent  = message;
  toastIcon.textContent = icon;

  // Reset classes
  toastInner.className = 'glass-card rounded-xl px-5 py-3 text-sm font-semibold flex items-center gap-3 shadow-xl';
  toastInner.classList.add(`toast-${type}`);

  toast.classList.remove('hidden');
  toast.style.animation = 'none';
  // Force reflow
  void toast.offsetWidth;
  toast.style.animation = '';

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// ============================================================
// 7. RENDER — Player Profile
// ============================================================

function renderProfile() {
  const { xp, level } = state.player;
  const mastered       = countMastered();
  const { current, needed, fraction } = xpProgress();
  const maxLvl = LEVEL_THRESHOLDS.length;
  const title  = PLAYER_TITLES[Math.min(level - 1, PLAYER_TITLES.length - 1)];

  $('player-level').textContent    = level;
  $('player-xp').textContent       = xp;
  $('player-mastered').textContent  = mastered;
  $('player-title').textContent    = title;

  const xpLabel = level >= maxLvl
    ? 'MAX LEVEL'
    : `${current} / ${needed} XP to next level`;
  $('xp-progress-label').textContent = xpLabel;

  const bar = $('xp-bar');
  bar.style.width = `${Math.round(fraction * 100)}%`;

  const wrapper = $('xp-bar-wrapper');
  wrapper.setAttribute('aria-valuenow', Math.round(fraction * 100));
}

// ============================================================
// 8. RENDER — Skill Tree
// ============================================================

function renderSkillTree() {
  const grid = $('skill-grid');
  grid.innerHTML = '';

  TRICKS_DATA.forEach((trick, idx) => {
    const status = state.trickStatus[trick.id] || 'locked';
    const card   = buildTrickCard(trick, status, idx);
    grid.appendChild(card);
  });

  // Progress summary
  const total    = TRICKS_DATA.length;
  const mastered = countMastered();
  const unlocked = Object.values(state.trickStatus).filter(s => s === 'unlocked').length;
  $('progress-summary').textContent = `${mastered}/${total} Mastered · ${unlocked} Available`;
}

/**
 * Build a trick card DOM element.
 * @param {Object} trick
 * @param {string} status  – 'locked' | 'unlocked' | 'mastered'
 * @param {number} idx     – for stagger delay
 * @returns {HTMLElement}
 */
function buildTrickCard(trick, status, idx) {
  const diff    = difficultyInfo(trick.difficulty);
  const prereq  = trick.prereq ? TRICKS_DATA.find(t => t.id === trick.prereq) : null;

  // Status badge config
  const badgeMap = {
    locked:   { cls: 'badge-locked',   icon: '🔒', label: 'Locked'   },
    unlocked: { cls: 'badge-unlocked', icon: '✅', label: 'Unlocked' },
    mastered: { cls: 'badge-mastered', icon: '⭐', label: 'Mastered'  },
  };
  const badge = badgeMap[status];

  // Action button
  let actionBtn = '';
  if (status === 'unlocked') {
    actionBtn = `<button class="btn-trick btn-trick-master" data-action="master" data-id="${trick.id}" aria-label="Set ${trick.name} as mastered">
      ⚡ Set Mastered
    </button>`;
  } else if (status === 'mastered') {
    actionBtn = `<button class="btn-trick btn-trick-reset" data-action="reset" data-id="${trick.id}" aria-label="Reset ${trick.name}">
      ↩ Reset
    </button>`;
  } else {
    const prereqName = prereq ? prereq.name : '—';
    actionBtn = `<button class="btn-trick btn-trick-locked" disabled aria-disabled="true" aria-label="${trick.name} is locked, requires ${prereqName}">
      🔒 Requires: ${prereqName}
    </button>`;
  }

  const article = document.createElement('article');
  article.className = `trick-card status-${status}`;
  article.setAttribute('role', 'listitem');
  article.setAttribute('aria-label', `${trick.name} — ${status}`);
  article.style.animationDelay = `${idx * 0.04}s`;

  article.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <h4 class="text-sm font-bold text-slate-100 leading-tight">${trick.name}</h4>
      <span class="badge ${badge.cls} shrink-0">${badge.icon} ${badge.label}</span>
    </div>
    <div class="flex items-center gap-1.5 flex-wrap">
      <span class="text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-md">${trick.category}</span>
      <span class="text-xs font-semibold" style="color:${diff.color}">${diff.label}</span>
    </div>
    <div class="flex items-center gap-1" title="Difficulty ${trick.difficulty}/5" aria-label="Difficulty ${trick.difficulty} out of 5">
      ${difficultyDots(trick.difficulty)}
    </div>
    <div class="text-xs text-slate-500 mt-0.5">
      ${prereq
        ? `Prereq: <span class="text-slate-400">${prereq.name}</span>`
        : '<span class="text-emerald-500/70">No Prerequisite</span>'
      }
      <span class="ml-2 text-amber-400/80">+${trick.xpReward} XP</span>
    </div>
    ${actionBtn}
  `;

  return article;
}

// ============================================================
// 9. RENDER — Combo Generator
// ============================================================

/**
 * Render the current combo into #combo-flow.
 */
function renderCombo() {
  const comboDisplay = $('combo-display');
  const comboEmpty   = $('combo-empty');
  const comboFlow    = $('combo-flow');

  if (!state.currentCombo || state.currentCombo.length === 0) {
    comboDisplay.classList.add('hidden');
    comboEmpty.classList.add('hidden');
    return;
  }

  comboDisplay.classList.remove('hidden');
  comboEmpty.classList.add('hidden');
  comboFlow.innerHTML = '';

  state.currentCombo.forEach((trickId, idx) => {
    const trick  = TRICKS_DATA.find(t => t.id === trickId);
    const isBind = trickId === 'bind';
    const status = state.trickStatus[trickId];

    // Arrow between steps
    if (idx > 0) {
      const arrow = document.createElement('span');
      arrow.className     = 'combo-arrow';
      arrow.textContent   = '→';
      arrow.setAttribute('aria-hidden', 'true');
      comboFlow.appendChild(arrow);
    }

    const step = document.createElement('div');
    step.className = `combo-step-card${isBind ? ' is-bind' : ''}`;
    step.setAttribute('role', 'listitem');
    step.setAttribute('aria-label', `Step ${idx + 1}: ${trick.name}`);
    step.style.animationDelay = `${idx * 0.1}s`;

    const stepNum = document.createElement('p');
    stepNum.className   = 'text-xs font-bold mb-1';
    stepNum.style.color = isBind ? '#34d399' : '#a78bfa';
    stepNum.textContent = isBind ? 'FINISH' : `Step ${idx + 1}`;

    const trickName = document.createElement('p');
    trickName.className   = 'text-sm font-bold text-slate-100';
    trickName.textContent = trick.name;

    const trickCat = document.createElement('p');
    trickCat.className   = 'text-xs text-slate-500 mt-1';
    trickCat.textContent = trick.category;

    // Status pill
    const statusPill = document.createElement('span');
    const isM = status === 'mastered';
    statusPill.className   = `badge mt-2 ${isM ? 'badge-mastered' : 'badge-unlocked'}`;
    statusPill.textContent = isM ? '⭐ Mastered' : '✅ Unlocked';

    step.appendChild(stepNum);
    step.appendChild(trickName);
    step.appendChild(trickCat);
    step.appendChild(statusPill);
    comboFlow.appendChild(step);
  });

  // Update Complete Challenge button state
  $('btn-complete-combo').disabled = state.comboCompleted;
  if (state.comboCompleted) {
    $('btn-complete-combo').textContent = '🏆 Challenge Completed!';
    $('btn-complete-combo').style.opacity = '0.5';
    $('btn-complete-combo').style.cursor  = 'not-allowed';
  } else {
    $('btn-complete-combo').textContent = '✅ Complete Challenge (+50 XP)';
    $('btn-complete-combo').style.opacity = '';
    $('btn-complete-combo').style.cursor  = '';
  }
}

// ============================================================
// 10. VIEW NAVIGATION
// ============================================================

function showView(viewName) {
  const skillView = $('view-skill-tree');
  const comboView = $('view-combo');
  const navSkill  = $('nav-skill-tree');
  const navCombo  = $('nav-combo');

  if (viewName === 'skill-tree') {
    skillView.classList.remove('hidden');
    comboView.classList.add('hidden');
    navSkill.classList.add('active-nav');
    navSkill.setAttribute('aria-pressed', 'true');
    navCombo.classList.remove('active-nav');
    navCombo.setAttribute('aria-pressed', 'false');
  } else {
    comboView.classList.remove('hidden');
    skillView.classList.add('hidden');
    navCombo.classList.add('active-nav');
    navCombo.setAttribute('aria-pressed', 'true');
    navSkill.classList.remove('active-nav');
    navSkill.setAttribute('aria-pressed', 'false');
  }
}

// ============================================================
// 11. EVENT HANDLERS
// ============================================================

/** Handle trick card action buttons (event delegation) */
function handleSkillGridClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action  = btn.dataset.action;
  const trickId = btn.dataset.id;
  const trick   = TRICKS_DATA.find(t => t.id === trickId);
  if (!trick) return;

  if (action === 'master') {
    const xpResult = masterTrick(trickId);
    if (xpResult) {
      renderSkillTree();
      renderProfile();
      if (xpResult.levelled) {
        showToast(`🎉 LEVEL UP! You are now Level ${xpResult.newLevel}!`, 'success', '🎉');
      } else {
        showToast(`⭐ "${trick.name}" mastered! +${trick.xpReward} XP`, 'success', '⭐');
      }
    }
  } else if (action === 'reset') {
    const dependents = getDependents(trickId);
    const masteredDeps = dependents.filter(id => state.trickStatus[id] === 'mastered');
    resetTrick(trickId);
    renderSkillTree();
    renderProfile();
    const resetMsg = masteredDeps.length > 0
      ? `↩ "${trick.name}" reset. ${masteredDeps.length} dependent trick(s) also reset.`
      : `↩ "${trick.name}" has been reset.`;
    showToast(resetMsg, 'info', '↩️');
  }
}

/** Handle Generate Combo button */
function handleGenerateCombo() {
  const combo = generateCombo();
  if (!combo) {
    $('combo-display').classList.add('hidden');
    $('combo-empty').classList.remove('hidden');
    showToast('Not enough tricks! Master more tricks first.', 'error', '🔒');
    return;
  }
  state.currentCombo    = combo;
  state.comboCompleted  = false;
  renderCombo();
  showToast('New combo generated! Give it a try! 🎲', 'info', '🎲');
}

/** Handle Complete Challenge button */
function handleCompleteChallenge() {
  if (state.comboCompleted) return;
  state.comboCompleted = true;
  const xpResult = addXP(50);
  renderProfile();
  renderCombo(); // disable the button
  if (xpResult.levelled) {
    showToast(`🎉 LEVEL UP! You are now Level ${xpResult.newLevel}! +50 XP`, 'success', '🎉');
  } else {
    showToast('🏆 Challenge completed! +50 XP earned!', 'success', '🏆');
  }
}

/** Handle Regenerate button */
function handleRegenerateCombo() {
  handleGenerateCombo();
}

// ============================================================
// 12. BOOTSTRAP — Initialise Application
// ============================================================

function init() {
  // Load persisted or default state
  loadState();

  // Ensure status integrity (handle stale saves)
  recomputeStatuses();

  // Initial renders
  renderProfile();
  renderSkillTree();

  // --- Navigation ---
  $('nav-skill-tree').addEventListener('click', () => showView('skill-tree'));
  $('nav-combo').addEventListener('click',      () => showView('combo'));

  // --- Skill Tree (event delegation on grid) ---
  $('skill-grid').addEventListener('click', handleSkillGridClick);

  // --- Combo Master ---
  $('btn-generate-combo').addEventListener('click',  handleGenerateCombo);
  $('btn-complete-combo').addEventListener('click',  handleCompleteChallenge);
  $('btn-regenerate-combo').addEventListener('click', handleRegenerateCombo);
}

// Run once DOM is ready
document.addEventListener('DOMContentLoaded', init);
