'use strict';

/* ============ Persistence ============ */
const STORE_KEY = 'miAgenda.v1';

function emptyData() {
  return {
    tasks: [],          // {id, title, job, priority, date, time, notes, done, doneAt}
    students: [],       // Don Bosco: {id, name, grade, section, guardian, guardianPhone, notes}
    incidents: [],      // {id, studentId, date, type, severity, description, guardianNotified, resolved}
    meetings: [],       // {id, studentId, guardian, date, time, topic, notes, done}
    onlineStudents: [], // {id, name, contact, timezone, rate, currency, notes}
    classes: [],        // {id, studentId, subject, startDate, time, duration, recurring, days[], endDate, rate, currency, notes}
    classLogs: {},      // "classId|date" -> {done, paid, topic, homework, notes, txId}
    needs: [],          // {id, title, priority, cost, currency, date, notes, done}
    transactions: [],   // {id, type: income|expense|saving, amount, currency, category, source, goalId, date, note}
    goals: [],          // {id, name, target, currency, deadline}
    settings: { name: 'Sofía', rate: 0, rateDate: null },
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
    return out;
  },

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
    } catch (e) {
      toast('Could not save — export a backup!');
    }
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
  return `${c.subject || 'Class'}${s ? ' · ' + s.name : ''}`;
}

/** Marks a class occurrence paid/unpaid and keeps the linked income transaction in sync. */
function setClassPaid(classId, date, paid) {
  const c = Store.get('classes', classId);
  if (!c) return;
  const log = classLog(classId, date);
  if (paid && !log.paid) {
    let txId = null;
    if (Number(c.rate) > 0) {
      const s = onlineStudentById(c.studentId);
      txId = Store.add('transactions', {
        type: 'income', amount: Number(c.rate), currency: c.currency || 'USD', category: 'Online classes',
        source: 'online', date, note: `${c.subject || 'Class'}${s ? ' – ' + s.name : ''}`, classKey: logKey(classId, date),
      }).id;
    }
    updateClassLog(classId, date, { paid: true, done: true, txId });
  } else if (!paid && log.paid) {
    if (log.txId) Store.remove('transactions', log.txId);
    updateClassLog(classId, date, { paid: false, txId: null });
  }
}

/** All class occurrences between two ISO dates (inclusive). */
function classOccurrences(fromIso, toIso) {
  const out = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) {
    Store.data.classes.forEach((c) => {
      if (classOccursOn(c, d)) out.push({ cls: c, date: d, log: classLog(c.id, d) });
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.cls.time || '').localeCompare(b.cls.time || ''));
}

/* ---- Unified agenda (calendar + daily reminders) ---- */
function agendaFor(iso) {
  const d = Store.data;
  const items = [];
  d.tasks.filter((t) => t.date === iso).forEach((t) => items.push({
    kind: 'task', id: t.id, date: iso, title: t.title, job: t.job, time: t.time, done: !!t.done, priority: t.priority,
    sub: JOBS[t.job]?.label,
  }));
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
      kind: 'class', id: c.id, date: iso, title: classTitle(c), job: 'online', time: c.time, done: !!log.done,
      paid: !!log.paid, sub: c.duration ? `${c.duration} min` : 'Online class',
    });
  });
  d.needs.filter((n) => n.date === iso).forEach((n) => items.push({
    kind: 'need', id: n.id, date: iso, title: n.title, job: 'personal', time: null, done: !!n.done, priority: n.priority,
    sub: 'Things I need',
  }));
  return items.sort(byTime);
}

function toggleAgendaItem(kind, id, date) {
  if (kind === 'task') {
    const t = Store.get('tasks', id);
    Store.update('tasks', id, { done: !t.done, doneAt: !t.done ? Date.now() : null });
  } else if (kind === 'meeting') {
    const m = Store.get('meetings', id);
    Store.update('meetings', id, { done: !m.done });
  } else if (kind === 'class') {
    updateClassLog(id, date, { done: !classLog(id, date).done });
  } else if (kind === 'need') {
    const n = Store.get('needs', id);
    Store.update('needs', id, { done: !n.done });
  }
}

function overdueTasks() {
  const t = todayISO();
  return Store.data.tasks.filter((x) => !x.done && x.date && x.date < t).sort(byPriority);
}

/* ---- Finances ---- */
function toUSD(amount, cur) {
  const n = Number(amount) || 0;
  if (cur !== 'VES') return n;
  const rate = Number(Store.data.settings.rate);
  return rate > 0 ? n / rate : null;
}

function convert(amount, from, to) {
  if (from === to) return Number(amount) || 0;
  const rate = Number(Store.data.settings.rate);
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
    const VES = list.filter((t) => t.currency === 'VES').reduce((s, t) => s + Number(t.amount || 0), 0);
    const vesInUsd = toUSD(VES, 'VES');
    out[type] = { USD, VES, eq: vesInUsd === null ? (VES ? null : USD) : USD + vesInUsd };
  });
  const bal = (cur) => out.income[cur] - out.expense[cur] - out.saving[cur];
  const eq = [out.income.eq, out.expense.eq, out.saving.eq].includes(null) ? null : out.income.eq - out.expense.eq - out.saving.eq;
  out.balance = { USD: bal('USD'), VES: bal('VES'), eq };
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
