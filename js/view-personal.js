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
function ratePanel() {
  const st = Store.data.settings;
  const rate = currentRate();
  const next = upcomingRate();
  const rateDay = Object.keys(Store.data.rates).filter((d) => d <= todayISO()).sort().pop() || st.rateDate;
  const status = st.rateError && (!st.rateFetchedAt || st.rateError > st.rateFetchedAt)
    ? '<span class="danger">Could not update online — showing the last saved rate.</span>'
    : st.rateSource === 'manual' ? 'Entered manually' : st.rateFetchedAt ? `Updated automatically ${fmtTime(new Date(st.rateFetchedAt).toTimeString().slice(0, 5))}` : '';
  return `<section class="card rate-panel">
    <div class="rate-main">
      <span class="small muted">BCV official rate${rateDay ? ' · ' + fmtDate(rateDay) : ''}</span>
      <span class="rate">${rate ? `${money(rate, 'VES')} <small>per $1</small>` : 'No rate yet'}</span>
      <span class="small muted">${status}</span>
      ${next ? `<span class="small">Next: <b>${money(next.rate, 'VES')}</b> from ${fmtDate(next.date)}</span>` : ''}
      <div class="chips" style="margin-top:6px">
        <button class="btn btn-dark btn-sm" data-action="rate-refresh">${icon('refresh')}Update now</button>
        <button class="btn btn-ghost btn-sm" data-action="edit-rate">${icon('edit')}Set manually</button>
      </div>
    </div>
    <div class="converter" aria-label="Currency converter">
      <span class="small muted">Quick converter</span>
      <label class="conv-field"><span>$</span><input type="number" inputmode="decimal" min="0" step="any" data-conv="USD" placeholder="0.00" aria-label="Dollars"></label>
      <span class="conv-eq" aria-hidden="true">⇅</span>
      <label class="conv-field"><span>Bs</span><input type="number" inputmode="decimal" min="0" step="any" data-conv="VES" placeholder="0,00" aria-label="Bolívares"></label>
    </div>
  </section>`;
}

function debtRow(d) {
  const s = debtStatus(d);
  const pct = d.amount > 0 ? Math.min(100, (s.paid / d.amount) * 100) : 0;
  const when = s.done ? 'Paid off 🎉' : s.overdue ? `Overdue since ${fmtDate(s.nextDue)}` : `Pay ${relDay(s.nextDue).toLowerCase() === 'today' ? 'today' : 'by ' + fmtDate(s.nextDue)}`;
  const freq = { monthly: 'every month', biweekly: 'every 2 weeks' }[d.repeat];
  const plan = !freq ? 'One payment' : d.installment ? `${money(d.installment, d.currency)} ${freq}` : freq[0].toUpperCase() + freq.slice(1);
  return `<div class="debt ${s.done ? 'paid' : s.overdue ? 'overdue' : ''}">
    <div class="debt-top">
      <div class="debt-main" data-action="edit-debt" data-id="${d.id}">
        <div class="row-title">${esc(d.creditor)}${d.description ? ` <span class="muted">· ${esc(d.description)}</span>` : ''}</div>
        <div class="row-meta"><span class="debt-when">${when}</span><span class="chip outline">${plan}</span></div>
      </div>
      ${s.done ? '' : `<button class="btn btn-dark btn-sm" data-action="pay-debt" data-id="${d.id}">${icon('check')}Pay</button>`}
    </div>
    <div class="bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Paid"><i style="width:${pct}%"></i></div>
    <div class="debt-nums small"><span><b>${money(s.remaining, d.currency)}</b> left</span><span class="muted">${money(s.paid, d.currency)} of ${money(d.amount, d.currency)} paid</span></div>
  </div>`;
}

function debtsSection() {
  const debts = Store.data.debts;
  const active = debts.filter((d) => !debtStatus(d).done)
    .sort((a, b) => debtStatus(a).nextDue.localeCompare(debtStatus(b).nextDue));
  const paid = debts.filter((d) => debtStatus(d).done);
  const owed = (cur) => active.filter((d) => d.currency === cur).reduce((s, d) => s + debtStatus(d).remaining, 0);
  const usd = owed('USD'), ves = owed('VES');
  const eq = toUSD(ves, 'VES');
  const next = active[0];
  return `<section class="card" style="margin-bottom:16px">
    <div class="card-head"><h2>Debts</h2><button class="btn btn-light btn-sm" data-action="new-debt">${icon('plus')}Debt</button></div>
    ${active.length ? `<div class="debt-summary">
        <div><span class="small muted">You owe</span><div class="big-num">${[usd ? money(usd, 'USD') : '', ves ? money(ves, 'VES') : ''].filter(Boolean).join(' + ')}</div>
          ${usd && ves && eq !== null ? `<span class="small muted">≈ ${money(usd + eq, 'USD')} total</span>` : ''}</div>
        <div><span class="small muted">Next payment</span><div class="next-pay ${debtStatus(next).overdue ? 'danger' : ''}"><b>${esc(next.creditor)}</b> · ${relDay(debtStatus(next).nextDue)} · ${money(debtInstallmentAmount(next), next.currency)}</div></div>
      </div>` : ''}
    <div class="debt-list">${active.map(debtRow).join('') || emptyState(debts.length ? 'No debts left — you’re free! 🎉' : 'Add what you owe and when you have to pay it. Payment dates show up in your calendar.', 'wallet')}</div>
    ${paid.length ? `<details class="done-list" data-key="debts-paid" ${App.openDetails.has('debts-paid') ? 'open' : ''}>
      <summary class="group-title">Paid off <span class="count">${paid.length}</span></summary><div class="debt-list">${paid.map(debtRow).join('')}</div></details>` : ''}
  </section>`;
}

function walletCard(cur, T) {
  const row = (label, v, cls = '') => `<div class="wallet-row ${cls}"><span>${label}</span><span class="amt">${money(v, cur)}</span></div>`;
  const eq = cur === 'VES' && T.balance.vesEq !== null && (T.income.VES || T.expense.VES || T.saving.VES)
    ? `<div class="small muted" style="text-align:right">Balance ≈ ${money(T.balance.vesEq, 'USD')}</div>` : '';
  return `<section class="card wallet ${cur === 'VES' ? 'c-soft j-donbosco' : 'c-soft j-movita'}">
    <div class="card-head"><h2>${cur === 'VES' ? 'Bolívares' : 'Dollars'}</h2>
      <span class="small muted">${cur === 'VES' ? 'Don Bosco · Online classes' : '4 Eleven Media'}</span></div>
    ${row('Income', T.income[cur], 'in')}
    ${row('Expenses', -T.expense[cur], 'out')}
    ${row('Saved', -T.saving[cur], 'save')}
    ${row('Balance', T.balance[cur], 'total')}
    ${eq}
  </section>`;
}

function viewFinances() {
  const ui = App.ui.fin;
  const ym = ui.month;
  const txs = monthTransactions(ym);
  const T = financeTotals(txs);
  const noRate = !currentRate() && txs.some((t) => t.currency === 'VES');
  const eqv = (v) => (v === null ? '—' : money(v, 'USD'));

  // Totals in USD equivalent, each Bs movement converted at its own day's BCV rate.
  const sumBy = (list, keyFn) => {
    const m = {};
    list.forEach((t) => {
      const k = keyFn(t);
      m[k] = m[k] || { eq: 0, USD: 0, VES: 0 };
      m[k][t.currency === 'VES' ? 'VES' : 'USD'] += Number(t.amount || 0);
      m[k].eq += txUSD(t) || 0;
    });
    return Object.entries(m).sort((a, b) => b[1].eq - a[1].eq);
  };
  const bars = (rows, labelFn, clsFn, showNative) => {
    if (!rows.length) return emptyState('No data this month.', 'wallet');
    const max = Math.max(...rows.map((r) => r[1].eq), 1);
    return `<div class="hbars">${rows.map(([k, v]) => `
      <div class="hbar ${clsFn(k)}"><span>${esc(labelFn(k))}${showNative ? `<br><span class="small muted">${[v.VES ? money(v.VES, 'VES') : '', v.USD ? money(v.USD, 'USD') : ''].filter(Boolean).join(' + ')}</span>` : ''}</span>
      <span class="track"><i style="width:${(v.eq / max) * 100}%"></i></span><span class="v">${money(v.eq, 'USD')}</span></div>`).join('')}</div>`;
  };
  const incRows = sumBy(txs.filter((t) => t.type === 'income'), (t) => t.source || 'other');
  const expRows = sumBy(txs.filter((t) => t.type === 'expense'), (t) => t.category || 'Other');
  const EXP_COLORS = ['j-casita', 'j-online', 'j-movita', 'j-alas', 'j-donbosco', 'j-personal'];

  const filtered = txs.filter((t) => ui.type === 'all' || t.type === ui.type)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
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

  ${ratePanel()}

  <div class="cal-toolbar" style="margin-top:18px">
    <div class="cal-nav">
      <button class="icon-btn" data-action="fin-month" data-dir="-1" aria-label="Previous month">${icon('left')}</button>
      <button class="icon-btn" data-action="fin-month" data-dir="1" aria-label="Next month">${icon('right')}</button>
      <span class="cal-title">${fmtMonth(ym + '-01')}</span>
    </div>
  </div>

  <section class="card c-yellow" style="margin-bottom:16px">
    <div class="card-head"><h2>Month total in dollars</h2><span class="small muted">Bs converted at the BCV rate of each day</span></div>
    <div class="grid grid-4 total-grid">
      <div><span class="small muted">Income</span><div class="big-num">${eqv(T.income.eq)}</div></div>
      <div><span class="small muted">Expenses</span><div class="big-num">${eqv(T.expense.eq)}</div></div>
      <div><span class="small muted">Saved</span><div class="big-num">${eqv(T.saving.eq)}</div></div>
      <div><span class="small muted">Balance</span><div class="big-num">${eqv(T.balance.eq)}</div></div>
    </div>
    ${noRate ? '<p class="small" style="margin:10px 0 0">Bs amounts need an exchange rate — tap “Update now” above.</p>' : ''}
  </section>

  ${debtsSection()}

  <div class="grid grid-2" style="margin-bottom:16px;align-items:start">
    ${walletCard('VES', T)}
    ${walletCard('USD', T)}
  </div>

  <div class="grid grid-2" style="margin-bottom:16px;align-items:start">
    <section class="card">
      <div class="card-head"><h2>Income by job</h2><span class="muted small">≈ USD</span></div>
      ${bars(incRows, (k) => INCOME_SOURCES[k] || k, (k) => SOURCE_JOB_CLASS[k] || 'j-other', true)}
    </section>
    <section class="card">
      <div class="card-head"><h2>Where my money goes</h2><span class="muted small">≈ USD</span></div>
      ${bars(expRows, (k) => k, (k) => EXP_COLORS[EXPENSE_CATS.indexOf(k) % EXP_COLORS.length] || 'j-other', true)}
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
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="small muted">${Math.round(p.pct)}%${p.missingRate ? ' · needs rate' : ''}</span>
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
      const cls = t.type === 'income' ? SOURCE_JOB_CLASS[t.source] || 'j-other' : t.type === 'saving' ? 'j-alas' : 'j-casita';
      const usd = t.currency === 'VES' ? txUSD(t) : null;
      return `<div class="row ${cls}">
        <span class="time">${fmtDate(t.date, { month: 'short', day: 'numeric' })}</span>
        <div class="row-main" data-action="edit-tx" data-id="${t.id}">
          <div class="row-title">${esc(t.note || t.category || 'Movement')}</div>
          <div class="row-meta"><span class="chip">${esc(t.type === 'saving' ? (goal ? goal.name : 'General savings') : t.category || '')}</span>${t.type === 'income' && t.source ? `<span>${esc(INCOME_SOURCES[t.source] || '')}</span>` : ''}${t.currency === 'VES' && txRate(t) ? `<span>@ ${money(txRate(t), 'VES')}</span>` : ''}</div>
        </div>
        <span class="tx-amt"><span class="amt ${amtCls[t.type]}">${sign[t.type]} ${money(t.amount, t.currency)}</span>${usd !== null && t.currency === 'VES' ? `<span class="small muted">≈ ${money(usd, 'USD')}</span>` : ''}</span>
      </div>`;
    }).join('') || emptyState('No movements this month.', 'wallet')}</div>
  </section>`;
}
