(() => {
  const DECKS = window.DMV_DATA;
  const ROUND_SIZE = 7;
  const view = document.getElementById('view');
  const headerInfo = document.getElementById('header-info');
  const exitBtn = document.getElementById('exit-btn');

  const allQuestions = DECKS.flatMap((d) => d.questions.map((q) => ({ ...q, deck: d.title, deckId: d.id })));
  const byDeck = Object.fromEntries(DECKS.map((d) => [d.id, d]));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const shortTitle = (t) => t.replace(/^Chapter (\d+) - /, 'Ch $1 · ').replace('Road Signs You Need To Know', 'Road Signs');

  // "Hard" tag toggle, usable anywhere a question is shown. Clicks are delegated so every
  // copy of a question's button stays in sync.
  const byId = Object.fromEntries(allQuestions.map((q) => [q.id, q]));
  const hardLabel = (on) => (on ? '⚑ Hard' : '⚐ Mark hard');
  const hardBtn = (id) => `<button class="hard-btn ${Store.isHard(id) ? 'on' : ''}" data-hard="${esc(id)}" title="Tag as Hard for Intensive mode (H)">${hardLabel(Store.isHard(id))}</button>`;
  function toggleHard(id) {
    const on = Store.toggleHard(id);
    document.querySelectorAll(`[data-hard="${CSS.escape(id)}"]`).forEach((b) => {
      b.classList.toggle('on', on);
      b.textContent = hardLabel(on);
    });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-hard]');
    if (!b) return;
    e.stopPropagation(); // don't flip flashcards / pick options
    toggleHard(b.dataset.hard);
  }, true);

  // Keyboard handling is swapped per view. currentQ is the question on screen (for H).
  let onKey = null;
  let currentQ = null;
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape' && !exitBtn.classList.contains('hidden')) return home();
    if ((e.key === 'h' || e.key === 'H') && currentQ) return toggleHard(currentQ.id);
    if (onKey) onKey(e);
  });
  document.getElementById('home-link').onclick = () => home();
  exitBtn.onclick = () => home();

  function selectedDeckIds() {
    const sel = Store.selected;
    return sel && sel.length ? sel.filter((id) => byDeck[id]) : DECKS.map((d) => d.id);
  }
  function selectedQuestions() {
    const ids = new Set(selectedDeckIds());
    return allQuestions.filter((q) => ids.has(q.deckId));
  }
  // Answer history feeds the pass estimate. Only record genuine attempts, not re-asks
  // straight after being shown the answer.
  const record = (q, ok) => Store.record(q.id, ok, Exam.RECENT);
  const pct = (x) => `${Math.round(100 * x)}%`;
  function counts(qs) {
    let m = 0, f = 0;
    for (const q of qs) { const l = Store.level(q.id); if (l >= 2) m++; else if (l === 1) f++; }
    return { m, f, total: qs.length };
  }
  function meter(qs) {
    const { m, f, total } = counts(qs);
    return `<span class="meter" title="${m} mastered, ${f} familiar, ${total - m - f} new"><i class="m" style="width:${(100 * m) / total}%"></i><i class="f" style="width:${(100 * f) / total}%"></i></span>`;
  }
  function chrome(inSession, info = '') {
    exitBtn.classList.toggle('hidden', !inSession);
    headerInfo.textContent = info;
  }

  // ---------- Home ----------
  function home() {
    onKey = null;
    currentQ = null;
    chrome(false);
    const sel = new Set(selectedDeckIds());
    const qs = selectedQuestions();
    const c = counts(qs);
    const hardCount = Store.hardIds().filter((id) => byId[id]).length;
    view.innerHTML = `
      <div class="card">
        <h2>Choose what to study</h2>
        <p class="muted" style="margin-top:0">Questions from the official NY DMV driver's manual practice quizzes. ${allQuestions.length} questions total.</p>
        <div class="row" style="margin-bottom:6px">
          <button class="link" id="sel-all">Select all</button>
          <button class="link" id="sel-none">Select none</button>
        </div>
        <div class="decks">
        ${DECKS.map((d) => `
          <div class="deck">
            <label><input type="checkbox" value="${d.id}" ${sel.has(d.id) ? 'checked' : ''}>
              <span><span class="t-full">${esc(d.title)}</span><span class="t-short">${esc(shortTitle(d.title))}</span>
              <span class="muted">(${d.questions.length})</span></span></label>
            ${meter(d.questions)}
          </div>`).join('')}
        </div>
      </div>
      <div class="modes">
        <button class="card mode" id="go-learn"><b>🧠 Learn</b><span class="muted">Adaptive rounds — answer each question correctly twice to master it.</span></button>
        <button class="card mode" id="go-cards"><b>🗂️ Flashcards</b><span class="muted">Flip through questions and answers.</span></button>
        <button class="card mode" id="go-test"><b>📝 Test</b><span class="muted">Simulate the real 20-question exam, or a custom test from your selected chapters.</span></button>
        <button class="card mode" id="go-intensive" ${hardCount ? '' : 'disabled'}><b>🔥 Intensive</b><span class="muted">${hardCount
          ? `Drill your ${hardCount} Hard-tagged question${hardCount === 1 ? '' : 's'} until each is right 3 times in a row.`
          : 'Tag questions as ⚑ Hard during any mode to drill them here.'}</span></button>
      </div>
      ${readinessCard()}
      <p class="muted" style="text-align:center;margin-top:24px">
        Selected: ${c.total} questions · ${c.m} mastered · ${c.f} familiar
        · <button class="link" id="reset">Reset progress for selection</button>
      </p>`;
    const boxes = [...view.querySelectorAll('.deck input')];
    const persist = () => { Store.selected = boxes.filter((b) => b.checked).map((b) => b.value); home(); };
    boxes.forEach((b) => (b.onchange = persist));
    view.querySelector('#sel-all').onclick = () => { boxes.forEach((b) => (b.checked = true)); persist(); };
    view.querySelector('#sel-none').onclick = () => { boxes.forEach((b) => (b.checked = false)); Store.selected = ['__none__']; home(); };
    const need = (fn) => () => (selectedQuestions().length ? fn() : alert('Select at least one chapter first.'));
    view.querySelector('#go-learn').onclick = need(learn);
    view.querySelector('#go-cards').onclick = need(flashcards);
    view.querySelector('#go-test').onclick = testSetup;
    view.querySelector('#go-intensive').onclick = intensive;
    view.querySelector('#reset').onclick = () => {
      if (confirm('Reset mastery for the selected chapters?')) { Store.reset(qs.map((q) => q.id)); home(); }
    };
  }

  function readinessCard() {
    const est = Exam.estimate(allQuestions, Store.history);
    const R = Exam.RULES;
    if (!est.answered) {
      return `<div class="card readiness"><div class="detail"><b>Exam readiness</b><br>
        <span class="muted">Answer some questions in any mode and this will estimate your chance of passing the real test.</span></div></div>`;
    }
    const color = est.pass >= 0.9 ? 'good' : est.pass >= 0.6 ? 'ink' : 'bad';
    const weak = est.chapters.slice(0, 3);
    return `
      <div class="card readiness">
        <div><div class="big" style="color:var(--${color})">${pct(est.pass)}</div><div class="muted" style="font-size:13px">chance to pass</div></div>
        <div class="detail">
          <b>Exam readiness</b> <span class="muted">— from ${est.answered} of ${est.total} questions answered, over thousands of simulated ${R.total}-question exams.</span>
          ${est.signFail >= 0.01 ? `<br>${pct(est.signFail)} of simulated exams fail the road-sign rule (need ${R.passSigns} of ${R.signs}).` : ''}
          <br>Weakest chapters (estimated accuracy):
          <ul>${weak.map((c) => `<li>${esc(shortTitle(c.title))}: ${pct(c.accuracy)}${c.seen < c.count ? ` <span class="muted">(${c.count - c.seen} not yet seen)</span>` : ''}</li>`).join('')}</ul>
          ${est.answered < 40 ? '<span class="muted">Early estimate — it firms up as you answer more.</span>' : ''}
        </div>
      </div>`;
  }

  // After a correct answer: move on shortly, or straight away on Space/Enter. Skips if the
  // user has left the view in the meantime.
  const ADVANCE_MS = 400;
  function advanceSoon(fb, next) {
    let gone = false;
    const go = () => { if (gone) return; gone = true; clearTimeout(t); if (view.contains(fb)) next(); };
    const t = setTimeout(go, ADVANCE_MS);
    onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); go(); } };
  }

  // Option hotkeys: 1-4, or home-row D F J K.
  const ALT_KEYS = 'dfjk';
  const optionKey = (e) => {
    const n = parseInt(e.key, 10);
    return n >= 1 && n <= 4 ? n : ALT_KEYS.indexOf(e.key.toLowerCase()) + 1;
  };

  // ---------- shared multiple-choice renderer ----------
  // Renders a question with shuffled options; calls done(correct) once answered.
  function renderMC(container, q, done, { tag } = {}) {
    currentQ = q;
    const order = shuffle(q.options.map((_, i) => i));
    container.innerHTML = `
      <div class="qhead"><span class="tag">${tag || ''}</span>${hardBtn(q.id)}</div>
      <p class="q">${esc(q.q)}</p>
      ${q.img ? `<img class="q-img" src="${esc(q.img)}" alt="">` : ''}
      <div class="opts">
        ${order.map((oi, k) => `<button class="opt" data-oi="${oi}"><span class="k">${k + 1}</span><span>${esc(q.options[oi])}</span></button>`).join('')}
      </div>
      <div class="feedback"></div>`;
    const btns = [...container.querySelectorAll('.opt')];
    let answered = false;
    const choose = (btn) => {
      if (answered) return;
      answered = true;
      container.querySelector('.opts').classList.add('locked');
      const oi = +btn.dataset.oi;
      const ok = oi === q.answer;
      btns.forEach((b) => {
        const bi = +b.dataset.oi;
        if (bi === q.answer) b.classList.add('correct');
        else if (b === btn) b.classList.add('wrong');
        else b.classList.add('dim');
      });
      done(ok, oi);
    };
    btns.forEach((b) => (b.onclick = () => choose(b)));
    return {
      key(e) { const n = optionKey(e); if (n >= 1 && n <= btns.length) { choose(btns[n - 1]); return true; } return false; },
      get answered() { return answered; },
      feedback: container.querySelector('.feedback'),
    };
  }

  // ---------- Learn ----------
  function learn() {
    const qs = selectedQuestions();
    const info = () => { const c = counts(qs); chrome(true, `Mastered ${c.m} / ${c.total}`); };

    function nextRound() {
      const pool = qs.filter((q) => Store.level(q.id) < 2);
      if (!pool.length) return finished();
      // Prefer questions you've started on, then new ones.
      const started = shuffle(pool.filter((q) => Store.level(q.id) === 1));
      const fresh = shuffle(pool.filter((q) => Store.level(q.id) === 0));
      const round = [...started, ...fresh].slice(0, ROUND_SIZE);
      runRound(shuffle(round));
    }

    function runRound(round) {
      const queue = [...round];
      const results = new Map(); // id -> first-try correct
      const total = round.length;
      let doneCount = 0;

      function ask() {
        info();
        if (!queue.length) return summary(round, results);
        const q = queue.shift();
        const lvl = Store.level(q.id);
        view.innerHTML = `
          <div class="progress"><span>${doneCount} / ${total}</span><span class="bar"><i style="width:${(100 * doneCount) / total}%"></i></span></div>
          <div class="card" id="qcard"></div>`;
        const mc = renderMC(view.querySelector('#qcard'), q, (ok, chosen) => {
          if (!results.has(q.id)) { results.set(q.id, ok); record(q, ok); }
          const fb = mc.feedback;
          if (ok) {
            Store.setLevel(q.id, lvl + 1);
            doneCount++;
            fb.innerHTML = `<span class="msg good">${lvl + 1 >= 2 ? '🎉 Mastered!' : '✓ Nice — you\'ll see this once more.'}</span>`;
            advanceSoon(fb, ask);
          } else {
            Store.setLevel(q.id, 0);
            // Ask it again later in this round.
            queue.splice(Math.min(queue.length, 2 + Math.floor(Math.random() * 2)), 0, q);
            fb.innerHTML = `<span class="msg bad">✗ Not quite. The answer is highlighted in green.</span>
              <span class="kbd">Press Space</span><button class="primary" id="cont">Continue</button>`;
            fb.querySelector('#cont').onclick = ask;
            onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ask(); } };
          }
        }, { tag: `${esc(shortTitle(q.deck))} · ${lvl === 0 ? 'New' : 'Familiar'}` });
        onKey = (e) => mc.key(e);
      }
      ask();
    }

    function summary(round, results) {
      info();
      currentQ = null;
      const c = counts(qs);
      view.innerHTML = `
        <div class="card">
          <h2>Round complete!</h2>
          <div class="progress"><span>${c.m} / ${c.total} mastered</span><span class="bar"><i style="width:${(100 * c.m) / c.total}%"></i></span></div>
          ${round.map((q) => `
            <div class="review-item">${hardBtn(q.id)}
              ${results.get(q.id) ? '✅' : '🔁'} ${esc(q.q)}${q.img ? ` <img src="${esc(q.img)}" alt="" style="height:28px;vertical-align:middle">` : ''}
              <div class="a">${esc(q.options[q.answer])}</div>
            </div>`).join('')}
          <div class="row" style="margin-top:20px"><button class="primary" id="next">Continue →</button><span class="kbd">or press Enter</span></div>
        </div>`;
      view.querySelector('#next').onclick = nextRound;
      onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextRound(); } };
    }

    function finished() {
      info();
      onKey = null;
      currentQ = null;
      view.innerHTML = `
        <div class="card" style="text-align:center">
          <div style="font-size:64px">🏆</div>
          <h2>You've mastered all ${qs.length} questions!</h2>
          <p class="muted">Try a practice test to confirm, or reset progress to learn again.</p>
          <div class="row" style="justify-content:center">
            <button class="primary" id="t">Take a test</button>
            <button id="r">Reset &amp; learn again</button>
          </div>
        </div>`;
      view.querySelector('#t').onclick = testSetup;
      view.querySelector('#r').onclick = () => { Store.reset(qs.map((q) => q.id)); learn(); };
    }

    nextRound();
  }

  // ---------- Intensive ----------
  // Drills only Hard-tagged questions (from every chapter). Each must be answered right
  // STREAK_GOAL times in a row; a miss resets the streak, brings the question back almost
  // immediately, and you must click the right answer before moving on.
  const STREAK_GOAL = 3;
  function intensive() {
    const hard = () => Store.hardIds().map((id) => byId[id]).filter(Boolean);
    const dots = (n) => `<span class="streak">${'●'.repeat(n)}${'○'.repeat(STREAK_GOAL - n)}</span>`;
    const info = () => {
      const h = hard();
      chrome(true, `🔥 Intensive · ${h.filter((q) => Store.streak(q.id) >= STREAK_GOAL).length} / ${h.length} conquered`);
    };

    const active = shuffle(hard().filter((q) => Store.streak(q.id) < STREAK_GOAL));
    if (!active.length) return done();
    const queue = active;
    const misses = new Map();
    const recorded = new Set();
    ask();

    function ask() {
      // Questions un-tagged mid-session drop out.
      while (queue.length && !Store.isHard(queue[0].id)) queue.shift();
      if (!queue.length) return done();
      info();
      const q = queue.shift();
      const streak = Store.streak(q.id);
      view.innerHTML = `
        <div class="progress"><span>${queue.length + 1} left in drill</span></div>
        <div class="card" id="qcard"></div>`;
      const container = view.querySelector('#qcard');
      const mc = renderMC(container, q, (ok) => {
        if (!recorded.has(q.id)) { recorded.add(q.id); record(q, ok); }
        const fb = mc.feedback;
        if (ok) {
          const n = streak + 1;
          Store.setStreak(q.id, n);
          if (n < STREAK_GOAL) queue.splice(Math.min(queue.length, 2 + n * 2), 0, q); // space it out more each time
          fb.innerHTML = `<span class="msg good">${n >= STREAK_GOAL ? '🔥 Conquered!' : `✓ Streak ${dots(n)}`}</span>`;
          advanceSoon(fb, ask);
        } else {
          Store.setStreak(q.id, 0);
          misses.set(q.id, (misses.get(q.id) || 0) + 1);
          queue.splice(Math.min(queue.length, 1), 0, q); // back after one other question
          const right = container.querySelector('.opt.correct');
          const num = [...container.querySelectorAll('.opt')].indexOf(right) + 1;
          fb.innerHTML = `<span class="msg bad">✗ Streak reset. Click the correct answer (or press ${num}) to lock it in.</span>`;
          right.style.cursor = 'pointer';
          right.onclick = ask;
          onKey = (e) => { if (optionKey(e) === num) ask(); };
        }
      }, { tag: `${esc(shortTitle(q.deck))} · ${dots(streak)}` });
      onKey = (e) => mc.key(e);
    }

    function done() {
      info();
      onKey = null;
      currentQ = null;
      const h = hard();
      if (!h.length) return home();
      const conquered = h.filter((q) => Store.streak(q.id) >= STREAK_GOAL);
      view.innerHTML = `
        <div class="card">
          <h2>${conquered.length === h.length ? '🔥 All Hard questions conquered!' : 'Drill complete'}</h2>
          <p class="muted">Each question needs ${STREAK_GOAL} correct answers in a row. Un-tag ones you're confident about, or keep them for another drill.</p>
          ${h.map((q) => `
            <div class="review-item">${hardBtn(q.id)}
              ${dots(Store.streak(q.id))} ${misses.get(q.id) ? `<span class="muted">(missed ${misses.get(q.id)}×)</span>` : ''}
              ${esc(q.q)}${q.img ? ` <img src="${esc(q.img)}" alt="" style="height:28px;vertical-align:middle">` : ''}
              <div class="a">${esc(q.options[q.answer])}</div>
            </div>`).join('')}
          <div class="row" style="margin-top:20px">
            <button class="primary" id="again">Drill again</button>
            ${conquered.length ? `<button id="untag">Un-tag ${conquered.length} conquered</button>` : ''}
            <button id="home">Home</button>
          </div>
        </div>`;
      view.querySelector('#again').onclick = () => { hard().forEach((q) => Store.setStreak(q.id, 0)); intensive(); };
      view.querySelector('#home').onclick = home;
      const u = view.querySelector('#untag');
      if (u) u.onclick = () => { conquered.forEach((q) => Store.isHard(q.id) && Store.toggleHard(q.id)); done(); };
    }
  }

  // ---------- Flashcards ----------
  function flashcards() {
    let cards = selectedQuestions();
    let i = 0, flipped = false, shuffled = false;

    function render() {
      chrome(true, `Card ${i + 1} / ${cards.length}`);
      const q = cards[i];
      currentQ = q;
      view.innerHTML = `
        <div class="flip ${flipped ? 'flipped' : ''}" id="flip">
          <div class="flip-inner">
            <div class="card face front">
              ${hardBtn(q.id)}
              <span class="tag">${esc(shortTitle(q.deck))}</span>
              ${q.img ? `<img class="q-img" src="${esc(q.img)}" alt="" style="margin:0 auto 16px">` : ''}
              <p class="q">${esc(q.q)}</p>
              <span class="kbd">Click or press Space to flip</span>
            </div>
            <div class="card face back">
              ${hardBtn(q.id)}
              <span class="tag">Answer</span>
              <p class="ans">${esc(q.options[q.answer])}</p>
              <p class="muted" style="font-size:14px">${esc(q.q)}</p>
            </div>
          </div>
        </div>
        <div class="fc-nav">
          <button id="prev" ${i === 0 ? 'disabled' : ''}>← Prev</button>
          <span class="muted">${i + 1} / ${cards.length}</span>
          <button id="next" ${i === cards.length - 1 ? 'disabled' : ''}>Next →</button>
        </div>
        <div class="fc-nav"><button class="link" id="shuf">${shuffled ? '↺ Original order' : '🔀 Shuffle'}</button></div>`;
      const flip = view.querySelector('#flip');
      flip.onclick = () => { flipped = !flipped; flip.classList.toggle('flipped', flipped); };
      view.querySelector('#prev').onclick = () => go(-1);
      view.querySelector('#next').onclick = () => go(1);
      view.querySelector('#shuf').onclick = () => {
        shuffled = !shuffled;
        cards = shuffled ? shuffle(cards) : selectedQuestions();
        i = 0; flipped = false; render();
      };
    }
    function go(d) {
      const n = i + d;
      if (n < 0 || n >= cards.length) return;
      i = n; flipped = false; render();
    }
    onKey = (e) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); view.querySelector('#flip').click(); }
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    render();
  }

  // ---------- Test ----------
  // Quick eased scroll (~300ms) that puts el just below the sticky header.
  function scrollToEl(el) {
    const header = document.querySelector('header').offsetHeight;
    const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY - header - 12);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return window.scrollTo(0, target);
    const start = window.scrollY, dist = target - start, t0 = performance.now(), DUR = 300;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / DUR);
      window.scrollTo(0, start + dist * (1 - (1 - t) ** 3)); // ease-out cubic
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function testSetup() {
    const qs = selectedQuestions();
    chrome(true, '');
    onKey = null;
    currentQ = null;
    const R = Exam.RULES;
    const sizes = [10, 20, 30].filter((n) => n < qs.length);
    view.innerHTML = `
      <div class="card">
        <h2>🎓 Real exam</h2>
        <p class="muted">Same format as the NY written test: ${R.total} questions from all chapters, ${R.signs} of them road signs.
          You need ${R.passTotal} correct <b>and</b> at least ${R.passSigns} of the ${R.signs} road signs.</p>
        <button class="primary" id="go-exam">Start exam</button>
      </div>
      <div class="card" style="margin-top:16px">
        <h2>Custom test</h2>
        ${qs.length ? `
          <p class="muted">Random questions from your ${selectedDeckIds().length} selected chapter(s). 70% passes.</p>
          <div class="row">
            ${sizes.map((n) => `<button data-n="${n}">${n} questions</button>`).join('')}
            <button data-n="${qs.length}">All ${qs.length}</button>
          </div>` : '<p class="muted">Select chapters on the home page to build a custom test.</p>'}
      </div>`;
    view.querySelector('#go-exam').onclick = exam;
    view.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => runTest(shuffle(qs).slice(0, +b.dataset.n))));
  }

  function exam() {
    currentQ = null;
    onKey = null;
    runTest(Exam.draw(allQuestions), { exam: true });
  }

  function runTest(qs, opts = {}) {
    chrome(true, opts.exam ? `🎓 Exam simulator · ${qs.length} questions` : `Test · ${qs.length} questions`);
    const orders = qs.map((q) => shuffle(q.options.map((_, i) => i)));
    view.innerHTML = `
      <div class="card">
        ${qs.map((q, n) => `
          <div class="tq" data-n="${n}">
            <div class="qhead"><span class="tag">${n + 1} of ${qs.length}</span>${hardBtn(q.id)}</div>
            <p class="q">${esc(q.q)}</p>
            ${q.img ? `<img class="q-img" src="${esc(q.img)}" alt="">` : ''}
            <div class="opts">
              ${orders[n].map((oi, k) => `<button class="opt" data-oi="${oi}"><span class="k">${'ABCD'[k]}</span><span>${esc(q.options[oi])}</span></button>`).join('')}
            </div>
          </div>`).join('')}
        <div class="row" style="margin-top:20px"><button class="primary" id="submit">Submit test</button><span class="muted" id="left"></span></div>
      </div>`;
    const picks = new Array(qs.length).fill(null);
    const left = view.querySelector('#left');
    const updateLeft = () => { const r = picks.filter((p) => p === null).length; left.textContent = r ? `${r} unanswered` : 'All answered'; };
    updateLeft();
    view.querySelectorAll('.tq').forEach((el) => {
      const n = +el.dataset.n;
      el.querySelectorAll('.opt').forEach((b) => (b.onclick = () => {
        el.querySelectorAll('.opt').forEach((o) => o.style.borderColor = '');
        b.style.borderColor = 'var(--brand)';
        const first = picks[n] === null;
        picks[n] = +b.dataset.oi;
        updateLeft();
        // Move on after a question's first answer (not when changing an answer).
        if (first) scrollToEl(view.querySelector(`.tq[data-n="${n + 1}"]`) || view.querySelector('#submit'));
      }));
    });
    view.querySelector('#submit').onclick = () => {
      const r = picks.filter((p) => p === null).length;
      if (r && !confirm(`${r} question(s) unanswered. Submit anyway?`)) return;
      testResults(qs, picks, opts);
    };
  }

  function testResults(qs, picks, opts = {}) {
    const right = qs.filter((q, n) => picks[n] === q.answer).length;
    qs.forEach((q, n) => {
      if (picks[n] !== null) record(q, picks[n] === q.answer);
      if (picks[n] !== q.answer) Store.setLevel(q.id, 0);
    });
    const R = Exam.RULES;
    const g = Exam.grade(qs, qs.map((q, n) => picks[n] === q.answer));
    const pass = opts.exam ? g.pass : right / qs.length >= 0.7;
    const verdict = !opts.exam
      ? (pass ? 'you would pass! 🎉' : 'keep studying, 70% is needed to pass.')
      : pass ? 'PASS 🎉'
      : g.total >= R.passTotal ? `FAIL — enough overall, but only ${g.signs} of ${R.signs} road signs (need ${R.passSigns}).`
      : `FAIL — need ${R.passTotal} of ${R.total}.`;
    chrome(true, opts.exam ? 'Exam results' : 'Test results');
    window.scrollTo(0, 0);
    const missed = qs.map((q, n) => [q, picks[n]]).filter(([q, p]) => p !== q.answer);
    view.innerHTML = `
      <div class="card" style="text-align:center">
        <div class="score" style="color:var(--${pass ? 'good' : 'bad'})">${opts.exam ? `${right} / ${qs.length}` : pct(right / qs.length)}</div>
        <p>${opts.exam ? `Road signs: ${g.signs} / ${R.signs} · ` : `${right} of ${qs.length} correct — `}${verdict}</p>
        <div class="row" style="justify-content:center">
          <button class="primary" id="again">${opts.exam ? 'New exam' : 'New test'}</button>
          ${missed.length ? '<button id="learn">Learn missed questions</button>' : ''}
        </div>
      </div>
      ${missed.length ? `<div class="card" style="margin-top:16px"><h2>Review missed (${missed.length})</h2>
        ${missed.map(([q, p]) => `
          <div class="review-item">${hardBtn(q.id)}
            ${esc(q.q)}${q.img ? ` <img src="${esc(q.img)}" alt="" style="height:40px;vertical-align:middle">` : ''}
            ${p !== null ? `<div class="y">${esc(q.options[p])}</div>` : '<div class="muted">(no answer)</div>'}
            <div class="a">${esc(q.options[q.answer])}</div>
          </div>`).join('')}</div>` : ''}`;
    view.querySelector('#again').onclick = opts.exam ? exam : testSetup;
    const lb = view.querySelector('#learn');
    if (lb) lb.onclick = learn; // missed questions were reset to level 0, so Learn picks them up
  }

  home();
})();
