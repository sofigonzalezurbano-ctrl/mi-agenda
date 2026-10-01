'use strict';

/* ============ Persistence ============ */
const STORE_KEY = 'miAgenda.v1';

function emptyData() {
  return {
    tasks: [],          // {id, title, job, priority, date, time, notes, done, doneAt, status: ''|cancelled, postponed, postponedFrom, indefinite,
                        //  recurring, days[], endDate, completions{date: ts}, skips{date: cancelled|postponed}}
    students: [],       // Don Bosco: {id, name, grade, section, guardian, guardianPhone, notes}
    incidents: [],      // {id, studentId, date, type, severity, description, guardianNotified, resolved}
    meetings: [],       // {id, studentId, guardian, date, time, topic, notes, done}
    onlineStudents: [], // {id, name, contact, timezone, notes}
    classes: [],        // {id, studentId, subject, startDate, time, times{weekday: time}|null, recurring, days[], endDate, notes}
    classLogs: {},      // "classId|date" -> {done, topic, homework, notes}
    needs: [],          // {id, title, priority, cost, currency, date, notes, done}
    transactions: [],   // {id, type: income|expense|saving, amount, currency, rate (Bs per USD, for VES), category, source, goalId, debtId, date, note}
                        // or {id, type: 'exchange', direction: buy|sell, usd, ves, exRate, method, date, note} (buying/selling dollars)
    goals: [],          // {id, name, target, currency, deadline}
    schoolSchedule: [], // Don Bosco timetable: {id, day (1=Mon…5=Fri), start, end, group, subject, from}
    schoolLogs: {},     // "slotId|date" -> {status: given|not_given|absent, substitute, notes}
    substitutions: [],  // classes I covered for someone else: {id, date, start, end, group, teacher, notes}
    debts: [],          // {id, creditor, description, amount, currency, installment, repeat: once|monthly, dueDate, notes}
    rates: {},          // date -> Bs per USD (BCV history)
    settings: { name: 'Sofia', rate: 0, rateDate: null, rateSource: null, rateFetchedAt: 0, rateError: null },
  };
}

const Store = {
  data: emptyData(),

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) this.data = this.normalize(JSON.parse(raw));
    } catch (e) {
      console.warn('Could not load data', e);
    }
  },

  normalize(obj) {
    const base = emptyData();
    const out = Object.assign(base, obj || {});
    out.settings = Object.assign(emptyData().settings, (obj && obj.settings) || {});
    if (out.settings.name === 'Sofía') out.settings.name = 'Sofia'; // old default had an accent
    out.rates = Object.assign({}, (obj && obj.rates) || {});
    // Older versions only kept a single rate: seed the history with it.
    if (out.settings.rate > 0 && out.settings.rateDate && !out.rates[out.settings.rateDate]) out.rates[out.settings.rateDate] = out.settings.rate;
    return out;
  },

  /** Persists locally; unless silent (changes that came from the cloud), also sends them to the cloud. */
  save({ silent = false } = {}) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
    } catch (e) {
      toast('Could not save — export a backup!');
    }
    if (!silent && typeof CloudSync !== 'undefined') CloudSync.onLocalSave();
  },

  get(coll, id) { return this.data[coll].find((x) => x.id === id); },

  add(coll, obj) {
    const item = { id: uid(), createdAt: Date.now(), ...obj };
    this.data[coll].push(item);
    this.save();
    return item;
  },

  update(coll, id, patch) {
    const item = this.get(coll, id);
    if (item) Object.assign(item, patch);
    this.save();
    return item;
  },

  remove(coll, id) {
    this.data[coll] = this.data[coll].filter((x) => x.id !== id);
    this.save();
  },
};

/* ============ Domain helpers ============ */
const studentById = (id) => Store.get('students', id);
const onlineStudentById = (id) => Store.get('onlineStudents', id);
const studentGroup = (s) => [s.grade, s.section].filter(Boolean).join(' ') || 'No group';

function removeStudent(id) {
  const d = Store.data;
  d.incidents = d.incidents.filter((x) => x.studentId !== id);
  d.meetings = d.meetings.filter((x) => x.studentId !== id);
  Store.remove('students', id);
}

function removeOnlineStudent(id) {
  Store.data.classes.filter((c) => c.studentId === id).forEach((c) => removeClass(c.id, false));
  Store.remove('onlineStudents', id);
}

function removeClass(id, save = true) {
  const logs = Store.data.classLogs;
  Object.keys(logs).forEach((k) => { if (k.startsWith(id + '|')) delete logs[k]; });
  Store.data.classes = Store.data.classes.filter((c) => c.id !== id);
  if (save) Store.save();
}

/* ---- Don Bosco timetable ---- */
const SCHOOL_STATUS = { given: 'Given', not_given: 'Not given', absent: 'I was absent' };

/** Her 2026–2027 English timetable, loaded once. Fixed ids so two devices seeding it don't create duplicates. */
const DEFAULT_SCHOOL_SCHEDULE = [
  ['mon-1', 1, '07:00', '08:15', '2° B'], ['mon-3', 1, '11:05', '12:20', '2° A'],
  ['tue-1', 2, '07:00', '08:15', '2° A'], ['tue-2', 2, '08:15', '09:30', '2° B'],
  ['wed-1', 3, '07:00', '08:15', '2° B'], ['wed-2', 3, '08:15', '09:30', '2° A'],
  ['fri-1', 5, '07:00', '08:15', '2° B'], ['fri-2', 5, '08:15', '09:30', '2° A'],
];
function seedSchoolSchedule() {
  const d = Store.data;
  if (d.settings.schoolSeeded || d.schoolSchedule.length) return;
  DEFAULT_SCHOOL_SCHEDULE.forEach(([id, day, start, end, group]) => d.schoolSchedule.push({
    id: 'sch-' + id, day, start, end, group, subject: 'Inglés', from: '2026-09-28',
  }));
  d.settings.schoolSeeded = true;
  Store.save();
}

function schoolSlotsOn(iso) {
  const wd = weekday(iso);
  return Store.data.schoolSchedule
    .filter((s) => s.day === wd && (!s.from || iso >= s.from) && (!s.to || iso <= s.to))
    .sort((a, b) => a.start.localeCompare(b.start));
}
const schoolLogKey = (slotId, date) => `${slotId}|${date}`;
const schoolLog = (slotId, date) => Store.data.schoolLogs[schoolLogKey(slotId, date)] || {};
function setSchoolLog(slotId, date, patch) {
  const key = schoolLogKey(slotId, date);
  const log = { ...(Store.data.schoolLogs[key] || {}), ...patch };
  if (!log.status && !log.notes) delete Store.data.schoolLogs[key]; else Store.data.schoolLogs[key] = log;
  Store.save();
}
function schoolStatusText(log) {
  if (log.status === 'absent') return log.substitute ? `Absent · covered by ${log.substitute}` : 'Absent';
  return SCHOOL_STATUS[log.status] || 'Not marked';
}
const slotTitle = (s) => `${s.subject || 'Class'} · ${s.group}`;

/* ---- Recurring (fixed) tasks ---- */
const isCancelled = (t) => t.status === 'cancelled';
const isWeekend = (iso) => [0, 6].includes(weekday(iso));
function nextWorkday(iso) {
  let d = addDays(iso, 1);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

function taskOccursOn(t, iso) {
  if (!t.recurring) return t.date === iso && !isCancelled(t);
  if (t.skips && t.skips[iso]) return false;
  if (!t.date || iso < t.date) return false;
  if (t.endDate && iso > t.endDate) return false;
  return (t.days || []).includes(weekday(iso));
}
const taskDoneOn = (t, iso) => (t.recurring ? !!(t.completions || {})[iso] : !!t.done);
const recurringEnded = (t) => !!(t.recurring && t.endDate && t.endDate < todayISO());
/** Still needs doing: a one-off task not done, or a fixed task due today and not done today. */
function taskIsPending(t) {
  if (!t.recurring) return !t.done && !isCancelled(t);
  const today = todayISO();
  return taskOccursOn(t, today) && !taskDoneOn(t, today);
}

/**
 * Unfinished one-off tasks from earlier days. They come back first (in red) on the next working day:
 * a Friday task shows up on Monday, and nothing is carried onto weekends.
 */
function carriedOverTasks(iso = todayISO()) {
  if (isWeekend(iso)) return [];
  return Store.data.tasks
    .filter((t) => !t.recurring && !t.done && !isCancelled(t) && t.date && t.date < iso && nextWorkday(t.date) <= iso)
    .sort((a, b) => a.date.localeCompare(b.date) || prioRank(a.priority) - prioRank(b.priority));
}

/**
 * Fixed tasks: the most recent day it was due before `iso`, if it was not done (and not cancelled/postponed).
 * Like one-off tasks it is flagged from the next working day, never on weekends.
 */
function missedRoutineDate(t, iso = todayISO()) {
  if (!t.recurring || isWeekend(iso)) return null;
  const created = t.createdAt ? toISO(new Date(t.createdAt)) : t.date;
  for (let k = 1; k <= 14; k++) {
    const d = addDays(iso, -k);
    if (d < t.date || d < created) return null;
    if (t.skips && t.skips[d]) return null;
    if (!taskOccursOn(t, d)) continue;
    return !taskDoneOn(t, d) && nextWorkday(d) <= iso ? d : null;
  }
  return null;
}

/** Move a task to another day, or to "no date" (to = ''). A fixed task only moves this one day, as a new one-off task. */
function postponeTask(id, fromDate, to) {
  const t = Store.get('tasks', id);
  if (!t) return;
  if (t.recurring) {
    // Also settles a missed earlier day that was showing in red, so the warning goes away.
    const missed = missedRoutineDate(t, todayISO());
    Store.update('tasks', id, { skips: { ...(t.skips || {}), ...(missed ? { [missed]: 'postponed' } : {}), [fromDate]: 'postponed' } });
    Store.add('tasks', {
      title: t.title, job: t.job, priority: t.priority, time: t.time, notes: t.notes, done: false,
      date: to, postponed: true, postponedFrom: fromDate, indefinite: !to, fromTask: t.id,
    });
  } else {
    Store.update('tasks', id, { date: to, postponed: true, postponedFrom: t.postponedFrom || t.date || fromDate, indefinite: !to, status: '' });
  }
}

function cancelTask(id, date) {
  const t = Store.get('tasks', id);
  if (!t) return;
  if (t.recurring) {
    const missed = missedRoutineDate(t, todayISO());
    Store.update('tasks', id, { skips: { ...(t.skips || {}), ...(missed ? { [missed]: 'cancelled' } : {}), [date]: 'cancelled' } });
  }
  else Store.update('tasks', id, { status: 'cancelled', cancelledAt: Date.now(), done: false });
}

function restoreTask(id, date) {
  const t = Store.get('tasks', id);
  if (!t) return;
  if (t.recurring) {
    const skips = { ...(t.skips || {}) };
    delete skips[date];
    Store.update('tasks', id, { skips });
  } else Store.update('tasks', id, { status: '', cancelledAt: null });
}

/* ---- Online classes ---- */
function classOccursOn(c, iso) {
  if (!c.startDate) return false;
  if (!c.recurring) return c.startDate === iso;
  if (iso < c.startDate) return false;
  if (c.endDate && iso > c.endDate) return false;
  return (c.days || []).includes(weekday(iso));
}
const logKey = (classId, date) => `${classId}|${date}`;
const classLog = (classId, date) => Store.data.classLogs[logKey(classId, date)] || {};

function updateClassLog(classId, date, patch) {
  const key = logKey(classId, date);
  const log = Store.data.classLogs[key] || {};
  Store.data.classLogs[key] = Object.assign(log, patch);
  Store.save();
}

function classTitle(c) {
  const s = onlineStudentById(c.studentId);
  const name = s ? s.name : 'Student';
  return c.subject ? `${name} · ${c.subject}` : `Class with ${name}`;
}

/** Time of a class on a given day (classes can have a different time per weekday). */
const classTimeOn = (c, iso) => (c.times && c.times[weekday(iso)]) || c.time || '';

/** All class occurrences between two ISO dates (inclusive). */
function classOccurrences(fromIso, toIso) {
  const out = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) {
    Store.data.classes.forEach((c) => {
      if (classOccursOn(c, d)) out.push({ cls: c, date: d, log: classLog(c.id, d) });
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || classTimeOn(a.cls, a.date).localeCompare(classTimeOn(b.cls, b.date)));
}

/* ---- Unified agenda (calendar + daily reminders) ---- */
function agendaFor(iso) {
  const d = Store.data;
  const items = [];
  if (iso === todayISO()) carriedOverTasks(iso).forEach((t) => items.push({
    kind: 'task', id: t.id, date: iso, title: t.title, job: t.job, time: null, done: false, priority: t.priority,
    sub: JOBS[t.job]?.label, carried: true, origDate: t.date,
  }));
  const isToday = iso === todayISO();
  d.tasks.filter((t) => taskOccursOn(t, iso)).forEach((t) => {
    // A fixed task left undone last time shows in red today (if it is also due today, today's one carries the warning).
    const missed = isToday && t.recurring && !taskDoneOn(t, iso) ? missedRoutineDate(t, iso) : null;
    items.push({
      kind: 'task', id: t.id, date: iso, title: t.title, job: t.job, time: t.time, done: taskDoneOn(t, iso), priority: t.priority,
      postponedFrom: t.postponed ? t.postponedFrom : null,
      sub: JOBS[t.job]?.label, recurring: !!t.recurring, carried: !!missed, origDate: missed || undefined,
    });
  });
  if (isToday) d.tasks.filter((t) => t.recurring && !taskOccursOn(t, iso)).forEach((t) => {
    const missed = missedRoutineDate(t, iso);
    if (missed) items.push({
      kind: 'task', id: t.id, date: missed, title: t.title, job: t.job, time: null, done: false, priority: t.priority,
      sub: JOBS[t.job]?.label, recurring: true, carried: true, origDate: missed,
    });
  });
  d.meetings.filter((m) => m.date === iso).forEach((m) => {
    const s = studentById(m.studentId);
    items.push({
      kind: 'meeting', id: m.id, date: iso, title: `Meeting: ${m.guardian || (s ? s.name + "'s guardian" : 'Guardian')}`,
      job: 'donbosco', time: m.time, done: !!m.done, sub: m.topic || (s ? s.name : ''),
    });
  });
  d.classes.filter((c) => classOccursOn(c, iso)).forEach((c) => {
    const log = classLog(c.id, iso);
    items.push({
      kind: 'class', id: c.id, date: iso, title: classTitle(c), job: 'online', time: classTimeOn(c, iso), done: !!log.done,
      sub: log.topic ? 'Topic: ' + log.topic : 'Online class',
    });
  });
  schoolSlotsOn(iso).forEach((s) => {
    const log = schoolLog(s.id, iso);
    items.push({
      kind: 'school', id: s.id, date: iso, title: slotTitle(s), job: 'donbosco', time: s.start, end: s.end,
      done: !!log.status, status: log.status || '',
      sub: log.status || iso <= todayISO() ? schoolStatusText(log) : `${fmtTime(s.start)}–${fmtTime(s.end)}`,
    });
  });
  d.substitutions.filter((x) => x.date === iso).forEach((x) => items.push({
    kind: 'sub', id: x.id, date: iso, title: `Substitution · ${x.group || 'class'}`, job: 'donbosco', time: x.start, end: x.end,
    done: iso <= todayISO(), sub: x.teacher ? `Covered for ${x.teacher}` : 'Substitution',
  }));
  d.debts.forEach((debt) => {
    const k = debtOccurrenceOn(debt, iso);
    if (k < 0) return;
    const s = debtStatus(debt);
    const done = isInstallmentDebt(debt) ? k < s.payments : s.remaining <= 0;
    items.push({
      kind: 'debt', id: debt.id, date: iso, title: `Pay ${debt.creditor}`, job: 'personal', time: null, done, priority: 'high',
      sub: money(debtInstallmentAmount(debt, s) || debt.amount, debt.currency),
    });
  });
  d.needs.filter((n) => n.date === iso).forEach((n) => items.push({
    kind: 'need', id: n.id, date: iso, title: n.title, job: 'personal', time: null, done: !!n.done, priority: n.priority,
    sub: 'Things I need',
  }));
  // Carried-over (not done before) first, then by time.
  return items.sort((a, b) => Number(!!b.carried) - Number(!!a.carried) || byTime(a, b));
}

function toggleAgendaItem(kind, id, date) {
  if (kind === 'task') {
    const t = Store.get('tasks', id);
    if (t.recurring) {
      const day = date || todayISO();
      const completions = { ...(t.completions || {}) };
      if (completions[day]) delete completions[day]; else completions[day] = Date.now();
      Store.update('tasks', id, { completions });
    } else {
      Store.update('tasks', id, { done: !t.done, doneAt: !t.done ? Date.now() : null });
    }
  } else if (kind === 'meeting') {
    const m = Store.get('meetings', id);
    Store.update('meetings', id, { done: !m.done });
  } else if (kind === 'class') {
    updateClassLog(id, date, { done: !classLog(id, date).done });
  } else if (kind === 'school') {
    setSchoolLog(id, date, { status: schoolLog(id, date).status ? '' : 'given', substitute: '' });
  } else if (kind === 'need') {
    const n = Store.get('needs', id);
    Store.update('needs', id, { done: !n.done });
  }
}

/* ---- Debts ---- */
/** Debts paid in installments: every month on the same day, or every 2 weeks (e.g. Cashea). */
const isInstallmentDebt = (debt) => debt.repeat === 'monthly' || debt.repeat === 'biweekly';
/** Date of installment k (0 = first). */
const debtDueAt = (debt, k) => (debt.repeat === 'biweekly' ? addDays(debt.dueDate, 14 * k) : addMonthsKeepDay(debt.dueDate, k));
const debtPayments = (debt) => Store.data.transactions.filter((t) => t.debtId === debt.id);

/** Paid so far (in the debt's currency), what is left, and the next date to pay. */
function debtStatus(debt) {
  const pays = debtPayments(debt);
  const paid = pays.reduce((sum, t) => {
    const cur = t.currency || 'USD';
    if (cur === debt.currency) return sum + Number(t.amount || 0);
    const r = txRate(t);
    if (!r) return sum;
    return sum + (debt.currency === 'VES' ? Number(t.amount) * r : Number(t.amount) / r);
  }, 0);
  const remaining = Math.max(0, Number(debt.amount || 0) - paid);
  const done = remaining <= 0.005;
  // Installment debts: each payment covers one installment, so the next due date moves forward one period per payment.
  const nextDue = done ? null : isInstallmentDebt(debt) ? debtDueAt(debt, pays.length) : debt.dueDate;
  return { paid, remaining: done ? 0 : remaining, payments: pays.length, nextDue, done, overdue: !!nextDue && nextDue < todayISO() };
}

/** What the next payment should be: the installment (or what is left, if less), else the whole remaining amount. */
function debtInstallmentAmount(debt, s = debtStatus(debt)) {
  if (isInstallmentDebt(debt) && debt.installment > 0) return s.remaining > 0 ? Math.min(debt.installment, s.remaining) : debt.installment;
  return s.remaining;
}

/** Which installment (0, 1, 2…) falls on this date, or -1. Paid ones stay visible; future ones only while money is owed. */
function debtOccurrenceOn(debt, iso) {
  if (!debt.dueDate || iso < debt.dueDate) return -1;
  if (!isInstallmentDebt(debt)) return iso === debt.dueDate ? 0 : -1;
  let k;
  if (debt.repeat === 'biweekly') {
    const days = Math.round((fromISO(iso) - fromISO(debt.dueDate)) / 86400000);
    if (days % 14) return -1;
    k = days / 14;
  } else {
    const [y0, m0] = debt.dueDate.split('-').map(Number);
    const [y1, m1] = iso.split('-').map(Number);
    k = (y1 - y0) * 12 + (m1 - m0);
  }
  if (debtDueAt(debt, k) !== iso) return -1;
  const s = debtStatus(debt);
  if (k < s.payments) return k;
  if (s.done) return -1;
  const left = debt.installment > 0 ? Math.ceil(s.remaining / debt.installment) : Infinity;
  return k < s.payments + left ? k : -1;
}

/* ---- Finances ---- */
const RATE_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'; // public mirror of the BCV official rate
const RATE_MAX_AGE = 3 * 60 * 60 * 1000;

/** Bs per USD in effect on a date: that day's BCV rate, else the latest earlier one, else the last known. */
function rateOn(iso) {
  const r = Store.data.rates || {};
  if (r[iso]) return Number(r[iso]);
  const earlier = Object.keys(r).filter((d) => d <= iso).sort().pop();
  if (earlier) return Number(r[earlier]);
  return Number(Store.data.settings.rate) || null;
}
const currentRate = () => rateOn(todayISO());
/** A rate already published for a future day (BCV publishes the next business day's rate in advance). */
function upcomingRate() {
  const t = todayISO();
  const d = Object.keys(Store.data.rates || {}).filter((x) => x > t).sort()[0];
  return d ? { date: d, rate: Number(Store.data.rates[d]) } : null;
}

function setRate(rate, date, source) {
  const st = Store.data.settings;
  Store.data.rates[date] = rate;
  if (!st.rateDate || date >= st.rateDate) Object.assign(st, { rate, rateDate: date, rateSource: source });
  Store.save();
}

/** Fetches the BCV rate online (at most every few hours unless forced). Resolves true when it changed. */
async function refreshBCVRate({ force = false } = {}) {
  const st = Store.data.settings;
  if (!force && Date.now() - (st.rateFetchedAt || 0) < RATE_MAX_AGE) return false;
  try {
    const res = await fetch(RATE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const rate = Number(json.promedio);
    if (!(rate > 0)) throw new Error('No rate in response');
    const date = String(json.fechaActualizacion || '').slice(0, 10) || todayISO();
    const changed = Number(Store.data.rates[date]) !== rate;
    st.rateFetchedAt = Date.now();
    st.rateError = null;
    setRate(rate, date, 'bcv');
    return changed;
  } catch (e) {
    console.warn('Could not update BCV rate', e);
    st.rateError = Date.now();
    Store.save();
    return false;
  }
}

/** Rate used for a movement: the one saved with it, else the BCV rate of its date. */
const txRate = (t) => Number(t.rate) || rateOn(t.date);

function toUSD(amount, cur, rate = currentRate()) {
  const n = Number(amount) || 0;
  if (cur !== 'VES') return n;
  return rate > 0 ? n / rate : null;
}
const txUSD = (t) => toUSD(t.amount, t.currency || 'USD', txRate(t));

function convert(amount, from, to) {
  if (from === to) return Number(amount) || 0;
  const rate = currentRate();
  if (!(rate > 0)) return null;
  return to === 'VES' ? (Number(amount) || 0) * rate : (Number(amount) || 0) / rate;
}

function monthTransactions(ym) {
  return Store.data.transactions.filter((t) => t.date && t.date.startsWith(ym));
}

/** Totals per type and currency, plus USD-equivalent when the rate is known. */
function financeTotals(txs) {
  const out = {};
  ['income', 'expense', 'saving'].forEach((type) => {
    const list = txs.filter((t) => t.type === type);
    const USD = list.filter((t) => t.currency !== 'VES').reduce((s, t) => s + Number(t.amount || 0), 0);
    const ves = list.filter((t) => t.currency === 'VES');
    const VES = ves.reduce((s, t) => s + Number(t.amount || 0), 0);
    const vesEqs = ves.map(txUSD);
    const vesEq = vesEqs.includes(null) ? null : vesEqs.reduce((s, v) => s + v, 0);
    out[type] = { USD, VES, vesEq, eq: vesEq === null ? null : USD + vesEq };
  });
  const bal = (cur) => out.income[cur] - out.expense[cur] - out.saving[cur];
  const eq = [out.income.eq, out.expense.eq, out.saving.eq].includes(null) ? null : out.income.eq - out.expense.eq - out.saving.eq;
  const vesEq = [out.income.vesEq, out.expense.vesEq, out.saving.vesEq].includes(null) ? null : out.income.vesEq - out.expense.vesEq - out.saving.vesEq;
  out.balance = { USD: bal('USD'), VES: bal('VES'), vesEq, eq };

  // Buying/selling dollars moves money between the two wallets (not income or expense).
  const ex = { USD: 0, VES: 0, vesEq: 0 };
  txs.filter((t) => t.type === 'exchange').forEach((t) => {
    const sign = t.direction === 'sell' ? -1 : 1; // buy: +$ / −Bs
    ex.USD += sign * Number(t.usd || 0);
    ex.VES -= sign * Number(t.ves || 0);
    const r = rateOn(t.date);
    ex.vesEq = ex.vesEq === null || !r ? null : ex.vesEq - (sign * Number(t.ves || 0)) / r;
  });
  out.exchange = ex;
  out.balance.USD += ex.USD;
  out.balance.VES += ex.VES;
  if (out.balance.vesEq !== null) out.balance.vesEq = ex.vesEq === null ? null : out.balance.vesEq + ex.vesEq;
  if (out.balance.eq !== null) out.balance.eq = ex.vesEq === null ? null : out.balance.eq + ex.USD + ex.vesEq;
  return out;
}

function goalProgress(goal) {
  let missingRate = false;
  const saved = Store.data.transactions
    .filter((t) => t.type === 'saving' && t.goalId === goal.id)
    .reduce((s, t) => {
      const v = convert(t.amount, t.currency || 'USD', goal.currency || 'USD');
      if (v === null) { missingRate = true; return s; }
      return s + v;
    }, 0);
  return { saved, missingRate, pct: goal.target > 0 ? Math.min(100, (saved / goal.target) * 100) : 0 };
}
