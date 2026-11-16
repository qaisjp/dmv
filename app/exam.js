// Real NY written-test rules, and a Monte Carlo estimate of your chance of passing them.
// The exam: 20 questions, of which 4 are road signs. You pass with 14+ correct overall
// AND at least 2 of the 4 road-sign questions correct.
window.Exam = (() => {
  const SIGNS_DECK = 'Road-Signs-You-Need-To-Know';
  const RULES = { total: 20, signs: 4, passTotal: 14, passSigns: 2 };
  const RECENT = 5; // only the last few answers to a question count towards its estimate

  // Picks k random items (partial Fisher–Yates; does not mutate the input).
  function sample(arr, k) {
    const a = [...arr];
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(Math.random() * (a.length - i));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }

  const split = (questions) => ({
    signs: questions.filter((q) => q.deckId === SIGNS_DECK),
    rest: questions.filter((q) => q.deckId !== SIGNS_DECK),
  });

  // One exam: 4 road-sign questions plus 16 drawn evenly from the chapter questions
  // (so each chapter shows up in proportion to its size), in random order. Some chapter
  // questions reuse a road-sign picture (stop sign, railroad crossing); those are skipped
  // when that sign was already drawn so the same sign isn't asked twice.
  function pick(signs, rest) {
    const s = sample(signs, RULES.signs);
    const used = new Set(s.map((q) => q.img));
    return [s, sample(rest.filter((q) => !used.has(q.img)), RULES.total - RULES.signs)];
  }
  function draw(questions) {
    const { signs, rest } = split(questions);
    const picked = pick(signs, rest).flat();
    return sample(picked, picked.length);
  }

  function grade(qs, correct) {
    let total = 0, signs = 0;
    qs.forEach((q, i) => {
      if (!correct[i]) return;
      total++;
      if (q.deckId === SIGNS_DECK) signs++;
    });
    return { total, signs, pass: total >= RULES.passTotal && signs >= RULES.passSigns };
  }

  // Estimated chance you answer each question right. Uses your last few answers to it,
  // pulled toward your accuracy on that chapter (so unseen questions borrow from what
  // you've shown on similar ones, and a chapter you've never touched counts as 50/50).
  function probabilities(questions, history) {
    const byDeck = {};
    for (const q of questions) {
      const h = history(q.id);
      const d = (byDeck[q.deckId] ||= { c: 0, n: 0 });
      d.n += h.length;
      d.c += [...h].filter((x) => x === '1').length;
    }
    const p = new Map();
    for (const q of questions) {
      const h = history(q.id);
      const d = byDeck[q.deckId];
      const prior = (d.c + 1) / (d.n + 2);
      const c = [...h].filter((x) => x === '1').length;
      p.set(q.id, (c + 2 * prior) / (h.length + 2));
    }
    return p;
  }

  function estimate(questions, history, runs = 4000) {
    const p = probabilities(questions, history);
    const { signs, rest } = split(questions);
    let passes = 0, signFails = 0;
    for (let r = 0; r < runs; r++) {
      let total = 0, s = 0;
      const [sq, rq] = pick(signs, rest);
      for (const q of sq) if (Math.random() < p.get(q.id)) { total++; s++; }
      for (const q of rq) if (Math.random() < p.get(q.id)) total++;
      if (total >= RULES.passTotal && s >= RULES.passSigns) passes++;
      else if (s < RULES.passSigns) signFails++;
    }
    // Per-chapter expected accuracy, weakest first.
    const decks = {};
    for (const q of questions) {
      const d = (decks[q.deckId] ||= { id: q.deckId, title: q.deck, sum: 0, count: 0, seen: 0 });
      d.sum += p.get(q.id);
      d.count++;
      if (history(q.id).length) d.seen++;
    }
    const chapters = Object.values(decks).map((d) => ({ ...d, accuracy: d.sum / d.count })).sort((a, b) => a.accuracy - b.accuracy);
    const answered = questions.filter((q) => history(q.id).length).length;
    return { pass: passes / runs, signFail: signFails / runs, chapters, answered, total: questions.length };
  }

  return { RULES, RECENT, SIGNS_DECK, draw, grade, estimate, probabilities };
})();
