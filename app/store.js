// Progress persistence. Per-question mastery level:
//   0 = new / missed, 1 = familiar (answered right once), 2 = mastered (right twice in a row)
window.Store = (() => {
  const KEY = 'dmv-teach-me-v1';
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { state = {}; }
  state.levels ||= {};
  state.selected ||= null;
  state.hard ||= {};   // id -> true for questions the user tagged as Hard
  state.streak ||= {}; // id -> consecutive correct answers in Intensive mode

  // Storage can be unavailable (private browsing, some file:// setups); progress then lasts the session.
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  return {
    level: (id) => state.levels[id] || 0,
    setLevel(id, lvl) { state.levels[id] = lvl; save(); },
    get selected() { return state.selected; },
    set selected(v) { state.selected = v; save(); },
    reset(ids) { for (const id of ids) delete state.levels[id]; save(); },
    isHard: (id) => !!state.hard[id],
    hardIds: () => Object.keys(state.hard),
    toggleHard(id) {
      if (state.hard[id]) delete state.hard[id];
      else { state.hard[id] = true; state.streak[id] = 0; }
      save();
      return !!state.hard[id];
    },
    streak: (id) => state.streak[id] || 0,
    setStreak(id, n) { state.streak[id] = n; save(); },
  };
})();
