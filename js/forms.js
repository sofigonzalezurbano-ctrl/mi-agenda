'use strict';

/* Option builders */
const jobOptions = (keys = JOB_ORDER) => keys.map((k) => [k, JOBS[k].label]);
const prioOptions = () => Object.entries(PRIORITIES).map(([k, v]) => [k, `<span class="pdot p-${k}"></span>${v.label}`]);
const currencyOptions = () => Object.entries(CURRENCIES);
const studentOptions = () => [...Store.data.students]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((s) => [s.id, `${s.name}${s.grade || s.section ? ' — ' + studentGroup(s) : ''}`]);
const onlineStudentOptions = () => [...Store.data.onlineStudents]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((s) => [s.id, s.name]);

/* ============ Tasks ============ */
const DAY_PRESETS = { weekdays: [1, 2, 3, 4, 5], everyday: [0, 1, 2, 3, 4, 5, 6] };

function taskForm(task, defaults = {}) {
  const { jobs = JOB_ORDER, ...rest } = defaults;
  const values = task
    ? { ...task, startDate: task.date, days: task.days || [] }
    : { priority: 'medium', job: jobs[0], recurring: false, days: [], startDate: rest.date || todayISO(), ...rest };
  openForm({
    title: task ? (task.recurring ? 'Edit fixed task' : 'Edit task') : 'New task',
    values,
    fields: [
      { name: 'title', label: 'Task', required: true, placeholder: 'What do you need to do?' },
      { name: 'job', label: 'Job / area', type: 'select', options: jobOptions(task ? JOB_ORDER : jobs) },
      { name: 'priority', label: 'Priority', type: 'pills', options: prioOptions() },
      { name: 'recurring', label: 'Fixed task — repeats every week', type: 'checkbox' },
      { name: 'days', label: 'Repeat on', type: 'days', show: (v) => v.recurring },
      {
        name: 'presets', type: 'html', show: (v) => v.recurring,
        html: `<div class="chips"><span class="small muted">Quick pick:</span>
          <button type="button" class="chip-btn" data-preset="weekdays">Mon–Fri</button>
          <button type="button" class="chip-btn" data-preset="everyday">Every day</button></div>`,
      },
      { name: 'date', label: 'Date', type: 'date', half: true, show: (v) => !v.recurring },
      { name: 'startDate', label: 'Starts on', type: 'date', half: true, show: (v) => v.recurring },
      { name: 'time', label: 'Time', type: 'time', half: true },
      { name: 'endDate', label: 'Ends on (optional)', type: 'date', show: (v) => v.recurring },
      { name: 'notes', label: 'Notes', type: 'textarea' },
      ...(task ? [{ name: 'done', label: 'Completed', type: 'checkbox', show: (v) => !v.recurring }] : []),
    ],
    onChange: (v, form) => {
      // First time "fixed task" is ticked with no days chosen, suggest Mon–Fri.
      if (v.recurring && !v.days.length && !form.dataset.suggested) {
        form.dataset.suggested = '1';
        $$('input[name="days"]', form).forEach((i) => { i.checked = DAY_PRESETS.weekdays.includes(Number(i.value)); });
      }
    },
    onSave: (v) => {
      const rec = { title: v.title, job: v.job, priority: v.priority, time: v.time, notes: v.notes, recurring: v.recurring };
      if (v.recurring) {
        Object.assign(rec, {
          date: v.startDate || todayISO(), days: v.days.length ? v.days : [weekday(v.startDate || todayISO())],
          endDate: v.endDate, done: false, doneAt: null,
        });
      } else {
        Object.assign(rec, { date: v.date, days: [], endDate: '', done: !!v.done, doneAt: v.done ? (task && task.doneAt) || Date.now() : null });
      }
      if (task) Store.update('tasks', task.id, rec); else Store.add('tasks', rec);
      toast(task ? 'Task updated' : rec.recurring ? 'Fixed task added' : 'Task added');
    },
    onDelete: task ? () => Store.remove('tasks', task.id) : null,
    deleteConfirm: task && task.recurring ? 'Delete this fixed task from every day it repeats?' : undefined,
  });
  $$('#modal-root [data-preset]').forEach((b) => b.addEventListener('click', () => {
    const days = DAY_PRESETS[b.dataset.preset];
    $$('#modal-root input[name="days"]').forEach((i) => { i.checked = days.includes(Number(i.value)); });
  }));
}

/* ============ Don Bosco: students, incidents, meetings ============ */
function studentForm(s) {
  openForm({
    title: s ? 'Edit student' : 'New student',
    values: s || {},
    fields: [
      { name: 'name', label: 'Full name', required: true },
      { name: 'grade', label: 'Grade', half: true, placeholder: 'e.g. 3rd grade' },
      { name: 'section', label: 'Section', half: true, placeholder: 'e.g. A' },
      { name: 'guardian', label: 'Guardian (representante)', half: true },
      { name: 'guardianPhone', label: 'Guardian phone', type: 'tel', half: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave: (v) => {
      if (s) Store.update('students', s.id, v); else Store.add('students', v);
      toast(s ? 'Student updated' : 'Student added');
    },
    onDelete: s ? () => removeStudent(s.id) : null,
    deleteConfirm: 'Delete this student? Their incidents and meetings will be deleted too.',
  });
}

function requireStudents(list, onEmpty) {
  if (list.length) return true;
  toast('Add a student first');
  onEmpty();
  return false;
}

function incidentForm(inc, defaults = {}) {
  if (!requireStudents(Store.data.students, () => studentForm())) return;
  openForm({
    title: inc ? 'Edit incident' : 'New incident',
    values: inc || { date: todayISO(), severity: 'minor', type: INCIDENT_TYPES[0], ...defaults },
    fields: [
      { name: 'studentId', label: 'Student', type: 'select', options: studentOptions(), placeholder: 'Choose a student', required: true },
      { name: 'date', label: 'Date', type: 'date', half: true, required: true },
      { name: 'type', label: 'Type', type: 'select', options: INCIDENT_TYPES, half: true },
      { name: 'severity', label: 'Severity', type: 'pills', options: Object.entries(SEVERITIES) },
      { name: 'description', label: 'What happened?', type: 'textarea', required: true },
      { name: 'guardianNotified', label: 'Guardian notified', type: 'checkbox', half: true },
      { name: 'resolved', label: 'Resolved', type: 'checkbox', half: true },
    ],
    onSave: (v) => {
      if (inc) Store.update('incidents', inc.id, v); else Store.add('incidents', v);
      toast(inc ? 'Incident updated' : 'Incident recorded');
    },
    onDelete: inc ? () => Store.remove('incidents', inc.id) : null,
  });
}

function meetingForm(m, defaults = {}) {
  if (!requireStudents(Store.data.students, () => studentForm())) return;
  openForm({
    title: m ? 'Edit meeting' : 'Meeting with guardian',
    values: m || { date: todayISO(), ...defaults },
    fields: [
      { name: 'studentId', label: 'Student', type: 'select', options: studentOptions(), placeholder: 'Choose a student', required: true },
      { name: 'guardian', label: 'Guardian name', placeholder: 'Uses the student’s guardian if empty' },
      { name: 'date', label: 'Date', type: 'date', half: true, required: true },
      { name: 'time', label: 'Time', type: 'time', half: true },
      { name: 'topic', label: 'Topic', placeholder: 'e.g. Behavior follow-up' },
      { name: 'notes', label: 'Notes / agreements', type: 'textarea' },
      ...(m ? [{ name: 'done', label: 'Meeting held', type: 'checkbox' }] : []),
    ],
    onSave: (v) => {
      if (!v.guardian) v.guardian = studentById(v.studentId)?.guardian || '';
      if (m) Store.update('meetings', m.id, v); else Store.add('meetings', { ...v, done: false });
      toast(m ? 'Meeting updated' : 'Meeting scheduled');
    },
    onDelete: m ? () => Store.remove('meetings', m.id) : null,
  });
}

function studentDetail(id) {
  const s = studentById(id);
  if (!s) return;
  const incs = Store.data.incidents.filter((i) => i.studentId === id).sort((a, b) => b.date.localeCompare(a.date));
  const meets = Store.data.meetings.filter((m) => m.studentId === id).sort((a, b) => b.date.localeCompare(a.date));
  openSheet(s.name, `
    <dl class="kv">
      <dt>Group</dt><dd>${esc(studentGroup(s))}</dd>
      <dt>Guardian</dt><dd>${esc(s.guardian || '—')}${s.guardianPhone ? ' · ' + esc(s.guardianPhone) : ''}</dd>
      ${s.notes ? `<dt>Notes</dt><dd>${esc(s.notes)}</dd>` : ''}
    </dl>
    <div class="chips" style="margin-bottom:16px">
      <button class="btn btn-dark btn-sm" data-action="new-incident" data-student="${id}">${icon('alert')}Incident</button>
      <button class="btn btn-light btn-sm" data-action="new-meeting" data-student="${id}">${icon('chat')}Meeting</button>
      <button class="btn btn-ghost btn-sm" data-action="edit-student" data-id="${id}">${icon('edit')}Edit</button>
    </div>
    <div class="group-title">Incidents <span class="count">${incs.length}</span></div>
    <div class="list">${incs.map(incidentRow).join('') || emptyState('No incidents recorded.', 'check')}</div>
    <div class="group-title">Meetings <span class="count">${meets.length}</span></div>
    <div class="list">${meets.map(meetingRow).join('') || emptyState('No meetings yet.', 'chat')}</div>
  `, { wide: true });
}

function incidentRow(i) {
  const s = studentById(i.studentId);
  const sevColor = { minor: 'p-low', moderate: 'p-medium', serious: 'p-high' }[i.severity] || '';
  return `<div class="row j-donbosco ${i.resolved ? 'done' : ''}">
    <div class="row-main" data-action="edit-incident" data-id="${i.id}">
      <div class="row-title">${esc(s ? s.name : 'Unknown student')} · ${esc(i.type)}</div>
      <div class="row-meta"><span class="chip ${sevColor}">${esc(SEVERITIES[i.severity] || '')}</span><span>${fmtDate(i.date)}</span>${s ? `<span>${esc(studentGroup(s))}</span>` : ''}</div>
      ${i.description ? `<div class="small muted" style="margin-top:6px">${esc(i.description)}</div>` : ''}
    </div>
    <div class="row-actions" style="flex-direction:column;align-items:flex-end;gap:6px">
      <button class="toggle-pill ${i.guardianNotified ? 'on' : ''}" data-action="toggle-incident" data-field="guardianNotified" data-id="${i.id}" aria-pressed="${!!i.guardianNotified}">${icon('chat')}Notified</button>
      <button class="toggle-pill ${i.resolved ? 'on' : ''}" data-action="toggle-incident" data-field="resolved" data-id="${i.id}" aria-pressed="${!!i.resolved}">${icon('check')}Resolved</button>
    </div>
  </div>`;
}

function meetingRow(m) {
  const s = studentById(m.studentId);
  return `<div class="row j-donbosco ${m.done ? 'done' : ''}">
    ${checkBtn(!!m.done, `data-action="toggle-item" data-kind="meeting" data-id="${m.id}" data-date="${m.date}"`, 'meeting')}
    <div class="row-main" data-action="edit-meeting" data-id="${m.id}">
      <div class="row-title">${esc(m.guardian || 'Guardian')} ${s ? `<span class="muted">· ${esc(s.name)}</span>` : ''}</div>
      <div class="row-meta"><span>${relDay(m.date)}${m.time ? ' · ' + fmtTime(m.time) : ''}</span>${m.topic ? `<span class="chip">${esc(m.topic)}</span>` : ''}</div>
    </div>
  </div>`;
}

/* ============ Online classes ============ */
function onlineStudentForm(s) {
  openForm({
    title: s ? 'Edit online student' : 'New online student',
    values: s || { currency: SOURCE_CURRENCY.online },
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'contact', label: 'Contact (email / WhatsApp)', half: true },
      { name: 'timezone', label: 'Time zone / country', half: true, placeholder: 'e.g. Spain (CET)' },
      { name: 'rate', label: 'Default rate per class', type: 'number', half: true },
      { name: 'currency', label: 'Currency', type: 'select', options: currencyOptions(), half: true },
      { name: 'notes', label: 'Notes (level, goals…)', type: 'textarea' },
    ],
    onSave: (v) => {
      if (s) Store.update('onlineStudents', s.id, v); else Store.add('onlineStudents', v);
      toast(s ? 'Student updated' : 'Student added');
    },
    onDelete: s ? () => removeOnlineStudent(s.id) : null,
    deleteConfirm: 'Delete this student? Their classes will be deleted too (payments already recorded stay in Finances).',
  });
}

function classForm(c, defaults = {}) {
  if (!requireStudents(Store.data.onlineStudents, () => onlineStudentForm())) return;
  const firstStudent = onlineStudentById(defaults.studentId) || Store.data.onlineStudents[0];
  openForm({
    title: c ? 'Edit class' : 'New online class',
    values: c || {
      startDate: todayISO(), duration: 60, recurring: false, days: [],
      studentId: firstStudent.id, rate: firstStudent.rate, currency: firstStudent.currency || SOURCE_CURRENCY.online, ...defaults,
    },
    fields: [
      { name: 'studentId', label: 'Student', type: 'select', options: onlineStudentOptions(), required: true },
      { name: 'subject', label: 'What is the class?', required: true, placeholder: 'e.g. English B1 – conversation' },
      { name: 'startDate', label: 'Date (first class)', type: 'date', half: true, required: true },
      { name: 'time', label: 'Time', type: 'time', half: true },
      { name: 'duration', label: 'Duration (min)', type: 'number', half: true },
      { name: 'recurring', label: 'Repeats every week', type: 'checkbox', half: true },
      { name: 'days', label: 'Repeat on', type: 'days', show: (v) => v.recurring },
      { name: 'endDate', label: 'Ends on (optional)', type: 'date', show: (v) => v.recurring },
      { name: 'rate', label: 'Rate per class', type: 'number', half: true },
      { name: 'currency', label: 'Currency', type: 'select', options: currencyOptions(), half: true },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onChange: (v, form) => {
      // When choosing a student on a new class, pre-fill their default rate.
      if (!c && v.studentId !== form.dataset.lastStudent) {
        const s = onlineStudentById(v.studentId);
        if (form.dataset.lastStudent && s) {
          if (s.rate != null) form.elements.rate.value = s.rate;
          if (s.currency) form.elements.currency.value = s.currency;
        }
        form.dataset.lastStudent = v.studentId;
      }
    },
    onSave: (v) => {
      if (v.recurring && !v.days.length) v.days = [weekday(v.startDate)];
      if (c) Store.update('classes', c.id, v); else Store.add('classes', v);
      toast(c ? 'Class updated' : 'Class scheduled');
    },
    onDelete: c ? () => removeClass(c.id) : null,
    deleteConfirm: 'Delete this class (and all its repetitions)?',
  });
}

function classLogForm(classId, date) {
  const c = Store.get('classes', classId);
  if (!c) return;
  const log = classLog(classId, date);
  const s = onlineStudentById(c.studentId);
  openForm({
    title: 'Class notes',
    values: { ...log, done: !!log.done, paid: !!log.paid },
    fields: [
      {
        name: 'info', type: 'html', cls: 'j-online', html: `<b>${esc(c.subject)}</b> with ${esc(s ? s.name : '—')}<br>
          <span class="muted">${fmtLongDate(date)}${c.time ? ' · ' + fmtTime(c.time) : ''}${c.duration ? ' · ' + c.duration + ' min' : ''}${c.rate ? ' · ' + money(c.rate, c.currency) : ''}</span>
          <div style="margin-top:8px"><button type="button" class="btn btn-light btn-sm" data-action="edit-class" data-id="${c.id}">${icon('edit')}Edit class plan</button></div>`,
      },
      { name: 'topic', label: 'Topic covered' },
      { name: 'homework', label: 'Homework assigned' },
      { name: 'notes', label: 'Progress notes', type: 'textarea' },
      { name: 'done', label: 'Class given', type: 'checkbox', half: true },
      { name: 'paid', label: 'Paid', type: 'checkbox', half: true },
    ],
    onSave: (v) => {
      updateClassLog(classId, date, { topic: v.topic, homework: v.homework, notes: v.notes, done: v.done || v.paid });
      setClassPaid(classId, date, v.paid);
      toast('Class saved');
    },
  });
}

function onlineStudentDetail(id) {
  const s = onlineStudentById(id);
  if (!s) return;
  const classes = Store.data.classes.filter((c) => c.studentId === id);
  const history = Object.entries(Store.data.classLogs)
    .map(([k, log]) => { const [cid, date] = k.split('|'); return { cls: Store.get('classes', cid), date, log }; })
    .filter((x) => x.cls && x.cls.studentId === id && (x.log.done || x.log.topic || x.log.notes))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);
  openSheet(s.name, `
    <dl class="kv">
      <dt>Contact</dt><dd>${esc(s.contact || '—')}</dd>
      <dt>Time zone</dt><dd>${esc(s.timezone || '—')}</dd>
      <dt>Rate</dt><dd>${s.rate ? money(s.rate, s.currency) + ' / class' : '—'}</dd>
      ${s.notes ? `<dt>Notes</dt><dd>${esc(s.notes)}</dd>` : ''}
    </dl>
    <div class="chips" style="margin-bottom:16px">
      <button class="btn btn-dark btn-sm" data-action="new-class" data-student="${id}">${icon('plus')}Schedule class</button>
      <button class="btn btn-ghost btn-sm" data-action="edit-online-student" data-id="${id}">${icon('edit')}Edit</button>
    </div>
    <div class="group-title">Class plans <span class="count">${classes.length}</span></div>
    <div class="list">${classes.map(classPlanRow).join('') || emptyState('No classes scheduled.', 'calendar')}</div>
    <div class="group-title">Recent history</div>
    <div class="list">${history.map((h) => `
      <div class="row j-online ${h.log.done ? '' : ''}">
        <div class="row-main" data-action="open-item" data-kind="class" data-id="${h.cls.id}" data-date="${h.date}">
          <div class="row-title">${fmtDate(h.date)} · ${esc(h.log.topic || h.cls.subject)}</div>
          <div class="row-meta">${h.log.paid ? '<span class="chip dark">Paid</span>' : '<span class="chip outline">Unpaid</span>'}${h.log.homework ? `<span>HW: ${esc(h.log.homework)}</span>` : ''}</div>
          ${h.log.notes ? `<div class="small muted" style="margin-top:6px">${esc(h.log.notes)}</div>` : ''}
        </div>
      </div>`).join('') || emptyState('No classes logged yet.', 'note')}</div>
  `, { wide: true });
}

function recurrenceText(c, startField = 'startDate') {
  if (!c.recurring) return `Once · ${fmtDate(c[startField])}`;
  const sel = [1, 2, 3, 4, 5, 6, 0].filter((d) => (c.days || []).includes(d));
  const key = sel.join('');
  const days = key === '1234560' ? 'Every day' : key === '12345' ? 'Mon–Fri' : 'Every ' + sel.map((d) => WEEKDAYS[d]).join(', ');
  return `${days}${c.endDate ? ' until ' + fmtDate(c.endDate) : ''}`;
}

function classPlanRow(c) {
  const ended = c.recurring ? c.endDate && c.endDate < todayISO() : c.startDate < todayISO();
  return `<div class="row j-online ${ended ? 'done' : ''}">
    <div class="row-main" data-action="edit-class" data-id="${c.id}">
      <div class="row-title">${esc(classTitle(c))}</div>
      <div class="row-meta"><span>${recurrenceText(c)}${c.time ? ' · ' + fmtTime(c.time) : ''}</span>${c.rate ? `<span class="chip j-online">${money(c.rate, c.currency)}</span>` : ''}</div>
    </div>
  </div>`;
}

/* ============ Personal: needs ============ */
function needForm(n, defaults = {}) {
  openForm({
    title: n ? 'Edit item' : 'Something I need',
    values: n || { priority: 'medium', currency: 'USD', ...defaults },
    fields: [
      { name: 'title', label: 'What do you need?', required: true },
      { name: 'priority', label: 'Priority', type: 'pills', options: prioOptions() },
      { name: 'cost', label: 'Estimated cost', type: 'number', half: true },
      { name: 'currency', label: 'Currency', type: 'select', options: currencyOptions(), half: true },
      { name: 'date', label: 'Get it by (shows in calendar)', type: 'date' },
      { name: 'notes', label: 'Notes / where to buy', type: 'textarea' },
      ...(n ? [{ name: 'done', label: 'Got it!', type: 'checkbox' }] : []),
    ],
    onSave: (v) => {
      if (n) Store.update('needs', n.id, v); else Store.add('needs', { ...v, done: false });
      toast(n ? 'Updated' : 'Added to your list');
    },
    onDelete: n ? () => Store.remove('needs', n.id) : null,
  });
}

/* ============ Personal: finances ============ */
function conversionHint(amount, currency, date) {
  const rate = rateOn(date || todayISO());
  if (!(amount > 0)) return rate ? `BCV rate for this date: ${money(rate, 'VES')} per $1` : 'No exchange rate yet';
  if (!rate) return 'No exchange rate yet — set it in Finances';
  return currency === 'VES'
    ? `≈ ${money(amount / rate, 'USD')} at ${money(rate, 'VES')} per $1`
    : `≈ ${money(amount * rate, 'VES')} at ${money(rate, 'VES')} per $1`;
}

function txForm(tx, defaults = {}) {
  const base = { type: 'expense', currency: 'USD', date: todayISO(), source: 'other', ...defaults };
  if (!tx && base.type === 'income') base.currency = SOURCE_CURRENCY[base.source] || 'USD';
  const values = tx ? { ...tx, category_in: tx.category, category_ex: tx.category } : base;
  const goalOpts = [['', 'General savings'], ...Store.data.goals.map((g) => [g.id, g.name])];
  openForm({
    title: tx ? 'Edit movement' : 'New movement',
    values,
    fields: [
      { name: 'type', label: 'Type', type: 'pills', options: [['income', 'Income'], ['expense', 'Expense'], ['saving', 'Saving']] },
      { name: 'source', label: 'From which job?', type: 'select', options: Object.entries(INCOME_SOURCES), half: true, show: (v) => v.type === 'income' },
      { name: 'category_in', label: 'Category', type: 'select', options: INCOME_CATS, half: true, show: (v) => v.type === 'income' },
      { name: 'amount', label: 'Amount', type: 'number', half: true, required: true },
      { name: 'currency', label: 'Currency', type: 'select', options: currencyOptions(), half: true },
      { name: 'hint', type: 'html', cls: 'small', html: '<span data-conv-hint></span>' },
      { name: 'category_ex', label: 'Category', type: 'select', options: EXPENSE_CATS, show: (v) => v.type === 'expense' },
      { name: 'goalId', label: 'Savings goal', type: 'select', options: goalOpts, show: (v) => v.type === 'saving' },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'note', label: 'Note', placeholder: 'Optional description' },
    ],
    onChange: (v, form) => {
      // Picking a job pre-selects the currency it pays in.
      if (v.type === 'income' && form.dataset.lastSource && v.source !== form.dataset.lastSource) {
        form.elements.currency.value = SOURCE_CURRENCY[v.source] || 'USD';
        v.currency = form.elements.currency.value;
      }
      form.dataset.lastSource = v.source;
      $('[data-conv-hint]', form).textContent = conversionHint(v.amount, v.currency, v.date);
    },
    onSave: (v) => {
      const keepRate = tx && tx.currency === 'VES' && tx.date === v.date && tx.rate;
      const rec = {
        type: v.type, amount: v.amount, currency: v.currency, date: v.date, note: v.note,
        rate: v.currency === 'VES' ? (keepRate ? tx.rate : rateOn(v.date)) : null,
        category: v.type === 'income' ? v.category_in : v.type === 'expense' ? v.category_ex : 'Savings',
        source: v.type === 'income' ? v.source : null,
        goalId: v.type === 'saving' ? v.goalId || null : null,
      };
      if (tx) Store.update('transactions', tx.id, rec); else Store.add('transactions', rec);
      toast(tx ? 'Movement updated' : 'Movement added');
    },
    onDelete: tx ? () => {
      // Keep the linked class in sync if this payment came from an online class.
      if (tx.classKey && Store.data.classLogs[tx.classKey]) Object.assign(Store.data.classLogs[tx.classKey], { paid: false, txId: null });
      Store.remove('transactions', tx.id);
    } : null,
  });
  const form = $('#modal-root form');
  // Live conversion while typing the amount.
  form.addEventListener('input', () => {
    $('[data-conv-hint]', form).textContent = conversionHint(Number(form.elements.amount.value), form.elements.currency.value, form.elements.date.value);
  });
}

function goalForm(g) {
  openForm({
    title: g ? 'Edit goal' : 'New savings goal',
    values: g || { currency: 'USD' },
    fields: [
      { name: 'name', label: 'Goal', required: true, placeholder: 'e.g. New laptop' },
      { name: 'target', label: 'Target amount', type: 'number', half: true, required: true },
      { name: 'currency', label: 'Currency', type: 'select', options: currencyOptions(), half: true },
      { name: 'deadline', label: 'Target date (optional)', type: 'date' },
    ],
    onSave: (v) => {
      if (g) Store.update('goals', g.id, v); else Store.add('goals', v);
      toast(g ? 'Goal updated' : 'Goal created');
    },
    onDelete: g ? () => {
      Store.data.transactions.forEach((t) => { if (t.goalId === g.id) t.goalId = null; });
      Store.remove('goals', g.id);
    } : null,
    deleteConfirm: 'Delete this goal? Savings already recorded stay as general savings.',
  });
}

function rateForm() {
  openForm({
    title: 'Set rate manually',
    values: { rate: currentRate() || null, rateDate: todayISO() },
    fields: [
      { name: 'info', type: 'html', cls: 'small', html: 'The app updates the BCV rate automatically when you are online. Use this only if it could not update or you need a rate for a specific day.' },
      { name: 'rate', label: 'Bolívares per 1 USD', type: 'number', required: true, half: true },
      { name: 'rateDate', label: 'Date', type: 'date', half: true, required: true },
    ],
    onSave: (v) => {
      setRate(v.rate, v.rateDate, 'manual');
      toast('Rate saved');
    },
  });
}

/* ============ Quick add & settings ============ */
function quickAdd(date = todayISO()) {
  const opt = (action, job, ic, label) =>
    `<button class="j-${job}" data-action="${action}" data-date="${date}">${icon(ic)}${label}</button>`;
  openSheet('Add something', `
    <p class="muted small" style="margin:-6px 0 14px">For ${fmtLongDate(date)}</p>
    <div class="quick-grid">
      ${opt('qa-task-donbosco', 'donbosco', 'check', 'Don Bosco task')}
      ${opt('qa-task-foureleven', 'movita', 'check', '4 Eleven task')}
      ${opt('qa-class', 'online', 'laptop', 'Online class')}
      ${opt('new-meeting', 'donbosco', 'chat', 'Guardian meeting')}
      ${opt('new-incident', 'donbosco', 'alert', 'Incident')}
      ${opt('qa-task-personal', 'personal', 'star', 'Personal task')}
      ${opt('new-need', 'personal', 'bag', 'Something I need')}
      ${opt('new-tx', 'other', 'wallet', 'Money movement')}
    </div>`);
}

function settingsSheet() {
  const st = Store.data.settings;
  const counts = ['tasks', 'students', 'incidents', 'meetings', 'onlineStudents', 'classes', 'needs', 'transactions']
    .reduce((s, k) => s + Store.data[k].length, 0);
  openSheet('Settings & backup', `
    ${syncSectionHTML()}
    <div class="group-title" style="margin-top:22px">You</div>
    <form class="form" id="settings-form">
      <label class="field"><span>Your name</span><input name="name" value="${esc(st.name)}"></label>
      <div class="form-actions"><span class="spacer"></span><button class="btn btn-dark" type="submit">Save name</button></div>
    </form>
    <div class="group-title" style="margin-top:22px">Backup</div>
    <p class="small muted" style="margin:0 0 12px">Your data (${counts} records) is saved on this device${CloudSync.uid ? ' and synced to your account' : ''}. Export a backup now and then as an extra copy.</p>
    <div class="chips">
      <button class="btn btn-dark btn-sm" data-action="export">${icon('download')}Export backup</button>
      <label class="btn btn-light btn-sm" style="cursor:pointer">${icon('upload')}Import backup<input type="file" accept="application/json,.json" id="import-file" hidden></label>
      <button class="btn btn-ghost btn-sm danger" data-action="reset">${icon('trash')}Erase everything</button>
    </div>`);
  $('#settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    st.name = e.target.elements.name.value.trim() || 'Sofia';
    Store.save();
    closeModal(); App.render(); toast('Saved');
  });
  $('#import-file').addEventListener('change', (e) => importBackup(e.target.files[0]));
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `my-agenda-backup-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj || typeof obj !== 'object' || !Array.isArray(obj.tasks)) throw new Error('bad file');
      if (!confirm('Replace all current data with this backup?')) return;
      Store.data = Store.normalize(obj);
      Store.save();
      closeModal(); App.render(); toast('Backup imported');
    } catch (e) {
      toast('That file is not a valid backup');
    }
  };
  reader.readAsText(file);
}
