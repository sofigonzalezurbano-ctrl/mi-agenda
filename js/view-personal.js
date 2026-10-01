'use strict';

function personalSwitcher(active) {
  return `<div class="mobile-tabs"><div class="seg wide">${[['needs', 'Things I need'], ['finances', 'Finances']].map(([r, l]) =>
    `<button class="${r === active ? 'active' : ''}" data-route-to="${r}">${l}</button>`).join('')}</div></div>`;
}

/* ============ Things I need ============ */
function needRow(n) {
  return `<div class="row j-personal ${n.done ? 'done' : ''}">
    ${checkBtn(!!n.done, `data-action="toggle-need" data-id="${n.id}"`, n.title)}
    <div class="row-main" data-action="edit-need" data-id="${n.id}">
      <div class="row-title">${esc(n.title)}</div>
      <div class="row-meta">${prioChip(n.priority)}${n.cost ? `<span class="chip">${money(n.cost, n.currency)}</span>` : ''}${n.date ? `<span>By ${relDay(n.date)}</span>` : ''}${n.notes ? `<span>${esc(n.notes)}</span>` : ''}</div>
    </div>
  </div>`;
}

function viewNeeds() {
  const needs = Store.data.needs;
  const pending = needs.filter((n) => !n.done).sort(byPriority);
  const done = needs.filter((n) => n.done);
  const total = (cur) => pending.filter((n) => (n.currency || 'USD') === cur).reduce((s, n) => s + Number(n.cost || 0), 0);
  const usd = total('USD'), ves = total('VES');

  let list = '';
  Object.keys(PRIORITIES).forEach((p) => {
    const g = pending.filter((n) => (n.priority || 'medium') === p);
    if (g.length) list += `<div class="group-title"><span class="pdot p-${p}"></span>${PRIORITIES[p].label} priority <span class="count">${g.length}</span></div><div class="list">${g.map(needRow).join('')}</div>`;
  });
  if (!needs.length) list = emptyState('Write down the things you need and how urgent they are.', 'bag');
  else if (!pending.length) list = emptyState('You have everything you need!', 'check');
  if (done.length) {
    list += `<details class="done-list" data-key="needs-done" ${App.openDetails.has('needs-done') ? 'open' : ''}>
      <summary class="group-title">Got it <span class="count">${done.length}</span></summary><div class="list">${done.map(needRow).join('')}</div></details>`;
  }

  return `
  ${personalSwitcher('needs')}
  <header class="page-head">
    <div><p class="eyebrow">Personal</p><h1>Things I need</h1></div>
    <div class="head-actions">
      <button class="btn btn-light" data-action="new-task" data-job="personal" data-jobs="personal">${icon('check')}Personal task</button>
      <button class="btn btn-dark" data-action="new-need">${icon('plus')}Add item</button>
    </div>
  </header>
  <div class="grid grid-3" style="margin-bottom:18px">
    <div class="money-card c-pink"><span class="lbl">High priority</span><span class="big">${pending.filter((n) => n.priority === 'high').length}</span><span class="alt">items to get soon</span></div>
    <div class="money-card c-green"><span class="lbl">Pending items</span><span class="big">${pending.length}</span><span class="alt">${done.length} already bought</span></div>
    <div class="money-card c-yellow"><span class="lbl">Estimated total</span><span class="big">${money(usd, 'USD')}</span><span class="alt">${ves ? '+ ' + money(ves, 'VES') : 'for pending items'}</span></div>
  </div>
  <div class="grid grid-2" style="align-items:start">
    <section class="card"><div class="card-head"><h2>Shopping & needs list</h2></div>${list}</section>
    <section class="card"><div class="card-head"><h2>Personal tasks</h2><button class="btn btn-light btn-sm" data-action="new-task" data-job="personal" data-jobs="personal">${icon('plus')}Task</button></div>
      ${taskBoard(Store.data.tasks.filter((t) => t.job === 'personal'), { showJob: false, key: 'personal', empty: 'Personal to-dos (appointments, errands…) go here.' })}</section>
  </div>`;
}

/* ============ Finances ============ */
function viewFinances() {
  const ui = App.ui.fin;
  const ym = ui.month;
  const st = Store.data.settings;
  const txs = monthTransactions(ym);
  const T = financeTotals(txs);
  const hasRate = Number(st.rate) > 0;

  const moneyCard = (cls, ic, label, tot) => `
    <div class="money-card ${cls}">
      <span class="lbl">${icon(ic)}${label}</span>
      <span class="big">${money(tot.USD, 'USD')}</span>
      <span class="alt">${money(tot.VES, 'VES')}</span>
      ${tot.VES ? `<span class="eq">${tot.eq === null ? 'Set the exchange rate to see the total' : '≈ ' + money(tot.eq, 'USD') + ' total'}</span>` : ''}
    </div>`;

  // Bars (USD equivalent; VES ignored only if no rate is set)
  const sumBy = (list, keyFn) => {
    const m = {};
    list.forEach((t) => {
      const v = toUSD(t.amount, t.currency || 'USD');
      if (v === null) return;
      const k = keyFn(t);
      m[k] = (m[k] || 0) + v;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const bars = (rows, clsFn) => {
    if (!rows.length) return emptyState('No data this month.', 'wallet');
    const max = Math.max(...rows.map((r) => r[1]), 1);
    return `<div class="hbars">${rows.map(([k, v]) => `
      <div class="hbar ${clsFn(k)}"><span>${esc(k in INCOME_SOURCES ? INCOME_SOURCES[k] : k)}</span>
      <span class="track"><i style="width:${(v / max) * 100}%"></i></span><span class="v">${money(v, 'USD')}</span></div>`).join('')}</div>`;
  };
  const expRows = sumBy(txs.filter((t) => t.type === 'expense'), (t) => t.category || 'Other');
  const incRows = sumBy(txs.filter((t) => t.type === 'income'), (t) => t.source || 'other');
  const missingVes = !hasRate && txs.some((t) => t.currency === 'VES');
  const EXP_COLORS = ['j-casita', 'j-online', 'j-movita', 'j-alas', 'j-donbosco', 'j-personal'];

  const filtered = txs.filter((t) => ui.type === 'all' || t.type === ui.type).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const sign = { income: '+', expense: '−', saving: '→' };
  const amtCls = { income: 'in', expense: 'out', saving: 'save' };

  return `
  ${personalSwitcher('finances')}
  <header class="page-head">
    <div><p class="eyebrow">Personal</p><h1>Finances</h1></div>
    <div class="head-actions">
      <button class="btn btn-light" data-action="new-tx" data-type="income">${icon('plus')}Income</button>
      <button class="btn btn-dark" data-action="new-tx" data-type="expense">${icon('plus')}Expense</button>
    </div>
  </header>

  <div class="cal-toolbar">
    <div class="cal-nav">
      <button class="icon-btn" data-action="fin-month" data-dir="-1" aria-label="Previous month">${icon('left')}</button>
      <button class="icon-btn" data-action="fin-month" data-dir="1" aria-label="Next month">${icon('right')}</button>
      <span class="cal-title">${fmtMonth(ym + '-01')}</span>
    </div>
    <div class="card rate-card" style="padding:10px 10px 10px 18px">
      <div><div class="small muted">Exchange rate${st.rateDate ? ' · ' + fmtDate(st.rateDate) : ''}</div>
      <div class="rate">${hasRate ? `1 USD = ${money(st.rate, 'VES')}` : 'Not set'}</div></div>
      <button class="btn btn-dark btn-sm" data-action="edit-rate">${icon('edit')}Update</button>
    </div>
  </div>

  <div class="grid grid-4" style="margin-bottom:16px">
    ${moneyCard('c-green', 'dollar', 'Income', T.income)}
    ${moneyCard('c-pink', 'bag', 'Expenses', T.expense)}
    ${moneyCard('c-blue', 'piggy', 'Saved', T.saving)}
    ${moneyCard('c-yellow', 'wallet', 'Balance', T.balance)}
  </div>

  <div class="grid grid-2" style="margin-bottom:16px;align-items:start">
    <section class="card">
      <div class="card-head"><h2>Where my money goes</h2><span class="muted small">USD equivalent</span></div>
      ${bars(expRows, (k) => EXP_COLORS[EXPENSE_CATS.indexOf(k) % EXP_COLORS.length] || 'j-other')}
      ${missingVes ? '<p class="small muted" style="margin:12px 0 0">Amounts in Bs are not included until you set the exchange rate.</p>' : ''}
    </section>
    <section class="card">
      <div class="card-head"><h2>Income by job</h2><span class="muted small">USD equivalent</span></div>
      ${bars(incRows, (k) => ({ donbosco: 'j-donbosco', foureleven: 'j-movita', online: 'j-online' }[k] || 'j-other'))}
    </section>
  </div>

  <section class="card" style="margin-bottom:16px">
    <div class="card-head"><h2>Savings goals</h2><button class="btn btn-light btn-sm" data-action="new-goal">${icon('plus')}Goal</button></div>
    ${Store.data.goals.length ? `<div class="grid grid-3">${Store.data.goals.map((g) => {
      const p = goalProgress(g);
      return `<div class="goal">
        <div class="top"><span class="name">${esc(g.name)}</span><button class="icon-btn sm ghost" data-action="edit-goal" data-id="${g.id}" aria-label="Edit goal">${icon('edit')}</button></div>
        <div class="small muted"><b style="color:var(--ink)">${money(p.saved, g.currency)}</b> of ${money(g.target, g.currency)}${g.deadline ? ' · by ' + fmtDate(g.deadline) : ''}</div>
        <div class="bar" role="progressbar" aria-valuenow="${Math.round(p.pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p.pct}%"></i></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="small muted">${Math.round(p.pct)}%${p.missingRate ? ' · set rate' : ''}</span>
        <button class="btn btn-dark btn-sm" data-action="new-tx" data-type="saving" data-goal="${g.id}">${icon('plus')}Save</button></div>
      </div>`;
    }).join('')}</div>` : emptyState('Create a goal (e.g. "Emergency fund") and track your savings toward it.', 'piggy')}
  </section>

  <section class="card">
    <div class="card-head" style="flex-wrap:wrap">
      <h2>Movements</h2>
      <div class="chips">${[['all', 'All'], ['income', 'Income'], ['expense', 'Expenses'], ['saving', 'Savings']].map(([k, l]) =>
        `<button class="chip-btn ${ui.type === k ? 'active' : ''}" data-action="fin-type" data-type="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="list">${filtered.map((t) => {
      const goal = t.goalId ? Store.get('goals', t.goalId) : null;
      const job = t.type === 'income' ? ({ donbosco: 'donbosco', foureleven: 'movita', online: 'online' }[t.source] || 'other') : t.type === 'saving' ? 'alas' : 'casita';
      return `<div class="row j-${job}">
        <span class="time">${fmtDate(t.date, { month: 'short', day: 'numeric' })}</span>
        <div class="row-main" data-action="edit-tx" data-id="${t.id}">
          <div class="row-title">${esc(t.note || t.category || 'Movement')}</div>
          <div class="row-meta"><span class="chip">${esc(t.type === 'saving' ? (goal ? goal.name : 'General savings') : t.category || '')}</span>${t.type === 'income' && t.source ? `<span>${esc(INCOME_SOURCES[t.source] || '')}</span>` : ''}</div>
        </div>
        <span class="amt ${amtCls[t.type]}">${sign[t.type]} ${money(t.amount, t.currency)}</span>
      </div>`;
    }).join('') || emptyState('No movements this month.', 'wallet')}</div>
  </section>`;
}
