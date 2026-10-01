'use strict';

const ROUTES = {
  today: { view: () => viewToday(), title: 'Today', nav: 'today' },
  calendar: { view: () => viewCalendar(), title: 'Calendar', nav: 'calendar' },
  donbosco: { view: () => viewDonBosco(), title: 'Don Bosco', nav: 'work' },
  foureleven: { view: () => viewFourEleven(), title: '4 Eleven Media', nav: 'work' },
  online: { view: () => viewOnline(), title: 'Online Classes', nav: 'work' },
  needs: { view: () => viewNeeds(), title: 'Things I need', nav: 'personal' },
  finances: { view: () => viewFinances(), title: 'Finances', nav: 'personal' },
};

const App = {
  route: 'today',
  openDetails: new Set(),
  currentSheet: null, // re-renders an open detail sheet after a toggle inside it
  lastDay: todayISO(),
  ui: {
    cal: { mode: 'month', cursor: todayISO() },
    db: { tab: 'tasks', group: 'all', q: '', incStatus: 'open', incType: 'all' },
    fe: { rest: 'all' },
    on: { tab: 'schedule', week: startOfWeek(todayISO()) },
    fin: { month: monthKey(todayISO()), type: 'all' },
  },

  render() {
    const r = ROUTES[this.route] || ROUTES.today;
    $('#view').innerHTML = r.view();
    document.title = `${r.title} · My Agenda`;
    $$('[data-route]').forEach((a) => {
      const on = a.dataset.route === this.route || a.dataset.route === r.nav;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  },

  go(route) {
    if (location.hash !== '#' + route) location.hash = route;
    else this.onRoute();
  },

  onRoute() {
    const r = location.hash.slice(1);
    this.route = ROUTES[r] ? r : 'today';
    this.render();
    window.scrollTo(0, 0);
  },
};

/* ============ Actions (event delegation via data-action) ============ */
const ds = (el) => el.dataset;
const ACTIONS = {
  'quick-add': (el) => quickAdd(ds(el).date || (App.route === 'calendar' ? App.ui.cal.cursor : todayISO())),
  settings: () => settingsSheet(),
  export: () => exportBackup(),
  reset: () => {
    const cloud = CloudSync.uid ? ' It will also be erased from your other synced devices.' : '';
    if (!confirm(`Erase ALL your data?${cloud} This cannot be undone. (Export a backup first!)`)) return;
    if (!confirm('Are you completely sure?')) return;
    Store.data = emptyData(); Store.save(); closeModal(); App.render(); toast('All data erased');
  },

  /* tasks & agenda */
  'new-task': (el) => {
    const { job, jobs, date } = ds(el);
    const list = jobs === 'restaurants' ? FE_JOBS : jobs === 'personal' ? ['personal'] : jobs ? jobs.split(',') : [job || 'donbosco'];
    taskForm(null, { jobs: list.includes(job) ? [job, ...list.filter((j) => j !== job)] : list, date: date || '' });
  },
  'edit-task': (el) => taskForm(Store.get('tasks', ds(el).id)),
  'toggle-task': (el) => { toggleAgendaItem('task', ds(el).id); },
  'toggle-item': (el) => {
    const d = ds(el);
    if (d.kind === 'debt') { if (el.getAttribute('aria-pressed') === 'true') toast('Already paid — see Finances'); else payDebtForm(d.id); return; }
    toggleAgendaItem(d.kind, d.id, d.date);
  },
  'open-item': (el) => {
    const { kind, id, date } = ds(el);
    if (kind === 'task') taskForm(Store.get('tasks', id));
    else if (kind === 'meeting') meetingForm(Store.get('meetings', id));
    else if (kind === 'class') classLogForm(id, date);
    else if (kind === 'need') needForm(Store.get('needs', id));
    else if (kind === 'debt') debtForm(Store.get('debts', id));
  },
  /* quick-add shortcuts */
  'qa-task-donbosco': (el) => taskForm(null, { jobs: ['donbosco'], date: ds(el).date }),
  'qa-task-foureleven': (el) => taskForm(null, { jobs: FE_JOBS, date: ds(el).date }),
  'qa-task-personal': (el) => taskForm(null, { jobs: ['personal'], date: ds(el).date }),
  'qa-class': (el) => classForm(null, { startDate: ds(el).date }),

  /* calendar */
  'cal-move': (el) => {
    const c = App.ui.cal, n = Number(ds(el).dir);
    c.cursor = c.mode === 'month' ? addMonths(c.cursor, n) : addDays(c.cursor, c.mode === 'week' ? 7 * n : n);
  },
  'cal-today': () => { App.ui.cal.cursor = todayISO(); },
  'cal-mode': (el) => { App.ui.cal.mode = ds(el).mode; },
  'cal-open-day': (el) => { App.ui.cal.cursor = ds(el).date; App.ui.cal.mode = 'day'; },

  /* Don Bosco */
  'db-tab': (el) => { App.ui.db.tab = ds(el).tab; },
  'db-inc-status': (el) => { App.ui.db.incStatus = ds(el).status; },
  'new-student': () => studentForm(),
  'edit-student': (el) => studentForm(studentById(ds(el).id)),
  'student-detail': (el) => studentDetail(ds(el).id),
  'new-incident': (el) => incidentForm(null, { studentId: ds(el).student || '', date: ds(el).date || todayISO() }),
  'edit-incident': (el) => incidentForm(Store.get('incidents', ds(el).id)),
  'toggle-incident': (el) => {
    const { id, field } = ds(el);
    const inc = Store.get('incidents', id);
    Store.update('incidents', id, { [field]: !inc[field] });
  },
  'new-meeting': (el) => meetingForm(null, { studentId: ds(el).student || '', date: ds(el).date || todayISO() }),
  'edit-meeting': (el) => meetingForm(Store.get('meetings', ds(el).id)),

  /* 4 Eleven */
  'fe-rest': (el) => { App.ui.fe.rest = ds(el).rest; },

  /* Online */
  'on-tab': (el) => { App.ui.on.tab = ds(el).tab; },
  'on-week': (el) => { App.ui.on.week = addDays(App.ui.on.week, Number(ds(el).dir)); },
  'new-class': (el) => classForm(null, { ...(ds(el).student ? { studentId: ds(el).student } : {}), ...(ds(el).date ? { startDate: ds(el).date } : {}) }),
  'edit-class': (el) => classForm(Store.get('classes', ds(el).id)),
  'new-online-student': () => onlineStudentForm(),
  'edit-online-student': (el) => onlineStudentForm(onlineStudentById(ds(el).id)),
  'online-student-detail': (el) => onlineStudentDetail(ds(el).id),

  /* Personal */
  'new-need': (el) => needForm(null, { date: ds(el).date || '' }),
  'edit-need': (el) => needForm(Store.get('needs', ds(el).id)),
  'toggle-need': (el) => { toggleAgendaItem('need', ds(el).id); },
  'new-tx': (el) => txForm(null, { ...(ds(el).type ? { type: ds(el).type } : {}), ...(ds(el).goal ? { goalId: ds(el).goal } : {}) }),
  'edit-tx': (el) => { const t = Store.get('transactions', ds(el).id); if (t.type === 'exchange') exchangeForm(t); else txForm(t); },
  'new-exchange': () => exchangeForm(),
  'fin-month': (el) => { App.ui.fin.month = monthKey(addMonths(App.ui.fin.month + '-01', Number(ds(el).dir))); },
  'fin-type': (el) => { App.ui.fin.type = ds(el).type; },
  'new-goal': () => goalForm(),
  'edit-goal': (el) => goalForm(Store.get('goals', ds(el).id)),
  'edit-rate': () => rateForm(),
  'new-debt': () => debtForm(),
  'edit-debt': (el) => debtForm(Store.get('debts', ds(el).id)),
  'pay-debt': (el) => payDebtForm(ds(el).id),
  'rate-refresh': () => {
    toast('Checking BCV rate…');
    refreshBCVRate({ force: true }).then(() => {
      App.render();
      toast(Store.data.settings.rateError > (Store.data.settings.rateFetchedAt || 0) ? 'Could not reach the rate service' : 'BCV rate up to date');
    });
  },
};

/* Actions that only change state inside an open detail sheet: refresh that sheet afterwards. */
const SHEET_REFRESH = new Set(['toggle-item', 'toggle-incident']);

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { closeModal(); return; }

  const routeBtn = e.target.closest('[data-route-to]');
  if (routeBtn) {
    const { routeTo, tab } = routeBtn.dataset;
    if (tab && routeTo === 'donbosco') App.ui.db.tab = tab;
    App.go(routeTo);
    return;
  }

  const el = e.target.closest('[data-action]');
  if (!el || !ACTIONS[el.dataset.action]) return;
  e.preventDefault();
  const action = el.dataset.action;
  const sheet = $('#modal-root').classList.contains('open') ? App.currentSheet : null;
  ACTIONS[action](el);
  App.render();
  if (sheet && SHEET_REFRESH.has(action)) sheet();
});

// Filters (selects) and search
document.addEventListener('change', (e) => {
  const k = e.target.dataset.change;
  if (!k) return;
  if (k === 'db-group') App.ui.db.group = e.target.value;
  if (k === 'db-inc-type') App.ui.db.incType = e.target.value;
  App.render();
});
document.addEventListener('input', (e) => {
  // Finances quick converter: fill the other box without re-rendering.
  const conv = e.target.dataset.conv;
  if (conv) {
    const rate = currentRate();
    const other = $(`[data-conv="${conv === 'USD' ? 'VES' : 'USD'}"]`);
    const n = parseFloat(e.target.value);
    other.value = rate && n >= 0 ? (conv === 'USD' ? n * rate : n / rate).toFixed(2) : '';
    return;
  }
  if (e.target.dataset.input !== 'db-search') return;
  App.ui.db.q = e.target.value;
  const pos = e.target.selectionStart;
  App.render();
  const input = $('[data-input="db-search"]');
  input.focus();
  input.setSelectionRange(pos, pos);
});
// Remember which "Completed" lists are expanded
document.addEventListener('toggle', (e) => {
  const key = e.target.dataset && e.target.dataset.key;
  if (!key) return;
  if (e.target.open) App.openDetails.add(key); else App.openDetails.delete(key);
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#modal-root').classList.contains('open')) closeModal();
});

// Detail sheets register themselves so they can refresh after inline toggles.
const _openModal = openModal;
openModal = function (...args) { App.currentSheet = null; _openModal(...args); };
const _studentDetail = studentDetail;
studentDetail = function (id) { _studentDetail(id); App.currentSheet = () => studentDetail(id); };
const _onlineStudentDetail = onlineStudentDetail;
onlineStudentDetail = function (id) { _onlineStudentDetail(id); App.currentSheet = () => onlineStudentDetail(id); };

/* Re-render when the day changes (e.g. app left open overnight) */
function checkNewDay() {
  const t = todayISO();
  if (t !== App.lastDay) { App.lastDay = t; App.render(); }
}
/* Keep the BCV rate fresh: on open, every 30 min (fetches only if older than 3 h) and when coming back to the tab. */
function autoRate() {
  refreshBCVRate().then((changed) => { if (changed && !$('#modal-root').classList.contains('open')) App.render(); });
}
setInterval(() => { checkNewDay(); }, 60 * 1000);
setInterval(autoRate, 30 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkNewDay(); autoRate(); } });

/* ============ Boot ============ */
$$('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon); });
Store.load();
window.addEventListener('hashchange', () => App.onRoute());
App.onRoute();
CloudSync.setStatus(CloudSync.status);
autoRate();
