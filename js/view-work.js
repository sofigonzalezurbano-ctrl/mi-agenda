'use strict';

/* Mobile-only switcher between the three jobs */
function workSwitcher(active) {
  const tabs = [['donbosco', 'Don Bosco'], ['foureleven', '4 Eleven'], ['online', 'Online']];
  return `<div class="mobile-tabs"><div class="seg wide">${tabs.map(([r, l]) =>
    `<button class="${r === active ? 'active' : ''}" data-route-to="${r}">${l}</button>`).join('')}</div></div>`;
}

function tabSeg(current, tabs, action) {
  return `<div class="seg" role="tablist">${tabs.map(([k, l]) =>
    `<button role="tab" aria-selected="${k === current}" class="${k === current ? 'active' : ''}" data-action="${action}" data-tab="${k}">${l}</button>`).join('')}</div>`;
}

/* ============ Don Bosco timetable ============ */
const STATUS_BTNS = [['given', '✓ Given'], ['absent', 'Absent'], ['not_given', 'No class']];

/** Today's (or a given day's) Don Bosco classes with quick buttons to mark them. */
function schoolDayList(iso) {
  const slots = schoolSlotsOn(iso);
  const subs = Store.data.substitutions.filter((x) => x.date === iso).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  if (!slots.length && !subs.length) return '';
  return `<div class="list">${slots.map((s) => {
    const log = schoolLog(s.id, iso);
    return `<div class="row j-donbosco school-row ${log.status ? 'st-' + log.status : ''}">
      <span class="time">${fmtTime(s.start)}</span>
      <div class="row-main" data-action="school-log" data-id="${s.id}" data-date="${iso}">
        <div class="row-title">${esc(slotTitle(s))}</div>
        <div class="row-meta"><span>${fmtRange(s.start, s.end)}</span>${log.status ? `<span class="chip st-chip">${esc(schoolStatusText(log))}</span>` : ''}${log.notes ? `<span>${esc(log.notes)}</span>` : ''}</div>
      </div>
      <div class="status-btns">${STATUS_BTNS.map(([k, l]) => `<button class="toggle-pill ${log.status === k ? 'on' : ''}" data-action="school-status" data-id="${s.id}" data-date="${iso}" data-status="${k}" aria-pressed="${log.status === k}">${l}</button>`).join('')}</div>
    </div>`;
  }).join('')}${subs.map((x) => `
    <div class="row j-donbosco">
      <span class="time">${x.start ? fmtTime(x.start) : ''}</span>
      <div class="row-main" data-action="edit-sub" data-id="${x.id}">
        <div class="row-title">Substitution · ${esc(x.group || 'class')}</div>
        <div class="row-meta"><span class="chip outline">I covered</span>${x.teacher ? `<span>for ${esc(x.teacher)}</span>` : ''}${x.start ? `<span>${fmtRange(x.start, x.end)}</span>` : ''}</div>
      </div>
    </div>`).join('')}</div>`;
}

function schoolMonthStats(ym) {
  const start = ym + '-01', end = addDays(addMonths(start, 1), -1), today = todayISO();
  const c = { given: 0, absent: 0, not_given: 0, unmarked: 0 };
  for (let d = start; d <= end && d <= today; d = addDays(d, 1)) {
    schoolSlotsOn(d).forEach((s) => { const st = schoolLog(s.id, d).status; c[st || 'unmarked']++; });
  }
  c.subs = Store.data.substitutions.filter((x) => x.date && x.date.startsWith(ym)).length;
  return c;
}

function schoolScheduleTab() {
  const ws = App.ui.db.week;
  const days = [0, 1, 2, 3, 4].map((i) => addDays(ws, i));
  const today = todayISO();
  const ranges = [...new Map(Store.data.schoolSchedule.map((s) => [s.start + '-' + s.end, s])).values()]
    .sort((a, b) => a.start.localeCompare(b.start));
  const cell = (d, r) => {
    const s = schoolSlotsOn(d).find((x) => x.start === r.start && x.end === r.end);
    if (!s) return '<td></td>';
    const log = schoolLog(s.id, d);
    return `<td><button class="tt-cell st-${log.status || (d > today ? 'future' : 'none')}" data-action="school-log" data-id="${s.id}" data-date="${d}">
      <b>${esc(s.group)}</b><span>${esc(log.status ? schoolStatusText(log) : d > today ? (s.subject || '') : 'Tap to mark')}</span></button></td>`;
  };
  const weekSubs = Store.data.substitutions.filter((x) => x.date >= ws && x.date <= addDays(ws, 6)).sort((a, b) => a.date.localeCompare(b.date));
  const st = schoolMonthStats(monthKey(today));
  return `
  <section class="card" style="margin-bottom:16px">
    <div class="card-head" style="flex-wrap:wrap">
      <h2>${fmtDate(ws, { month: 'short', day: 'numeric' })} – ${fmtDate(days[4], { month: 'short', day: 'numeric' })}</h2>
      <div class="cal-nav">
        <button class="icon-btn sm" data-action="db-week" data-dir="-7" aria-label="Previous week">${icon('left')}</button>
        <button class="btn btn-light btn-sm" data-action="db-week" data-dir="0">This week</button>
        <button class="icon-btn sm" data-action="db-week" data-dir="7" aria-label="Next week">${icon('right')}</button>
        <button class="btn btn-ghost btn-sm" data-action="edit-schedule">${icon('edit')}Edit timetable</button>
      </div>
    </div>
    ${ranges.length ? `<div class="tt-wrap"><table class="timetable">
      <thead><tr><th>Time</th>${days.map((d) => `<th class="${d === today ? 'today' : ''}">${WEEKDAYS[weekday(d)]} ${fromISO(d).getDate()}</th>`).join('')}</tr></thead>
      <tbody>${ranges.map((r) => `<tr><th>${fmtRange(r.start, r.end)}</th>${days.map((d) => cell(d, r)).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div class="legend" style="margin:12px 0 0"><span><i class="lg-dot st-given"></i>Given</span><span><i class="lg-dot st-absent"></i>Absent (substitute)</span><span><i class="lg-dot st-not_given"></i>No class</span><span><i class="lg-dot st-none"></i>Not marked</span></div>`
      : emptyState('Add your class blocks to see your timetable.', 'calendar')}
  </section>
  <div class="grid grid-2" style="align-items:start">
    <section class="card">
      <div class="card-head"><h2>${fmtMonth(today)}</h2><span class="small muted">so far</span></div>
      <div class="grid grid-2 school-stats">
        <div class="stat st-given"><span class="num">${st.given}</span><span class="lbl">Classes given</span></div>
        <div class="stat st-absent"><span class="num">${st.absent}</span><span class="lbl">Absences</span></div>
        <div class="stat st-not_given"><span class="num">${st.not_given}</span><span class="lbl">No class</span></div>
        <div class="stat c-blue"><span class="num">${st.subs}</span><span class="lbl">Substitutions I did</span></div>
      </div>
      ${st.unmarked ? `<p class="small muted" style="margin:12px 0 0">${st.unmarked} past class${st.unmarked > 1 ? 'es' : ''} not marked yet.</p>` : ''}
    </section>
    <section class="card">
      <div class="card-head"><h2>Substitutions I did</h2><button class="btn btn-light btn-sm" data-action="new-sub">${icon('plus')}Add</button></div>
      <div class="list">${weekSubs.map((x) => `<div class="row j-donbosco"><span class="time">${fmtDate(x.date, { weekday: 'short', day: 'numeric' })}</span>
        <div class="row-main" data-action="edit-sub" data-id="${x.id}"><div class="row-title">${esc(x.group || 'Class')}${x.teacher ? ` · for ${esc(x.teacher)}` : ''}</div>
        <div class="row-meta">${x.start ? `<span>${fmtRange(x.start, x.end)}</span>` : ''}${x.notes ? `<span>${esc(x.notes)}</span>` : ''}</div></div></div>`).join('')
        || emptyState('None this week. When you cover a class for someone, add it here.', 'users')}</div>
    </section>
  </div>`;
}

/* ============ Don Bosco ============ */
function viewDonBosco() {
  const ui = App.ui.db;
  const d = Store.data;
  const today = todayISO();
  const tasks = d.tasks.filter((t) => t.job === 'donbosco');
  const openInc = d.incidents.filter((i) => !i.resolved);
  const upcoming = d.meetings.filter((m) => !m.done && m.date >= today);

  const summary = [
    ['tasks', tasks.filter(taskIsPending).length, 'Pending tasks'],
    ['students', d.students.length, 'Students'],
    ['incidents', openInc.length, 'Open incidents'],
    ['meetings', upcoming.length, 'Upcoming meetings'],
  ];

  let content = '';
  let addBtn = '';
  if (ui.tab === 'schedule') {
    addBtn = `<button class="btn btn-dark" data-action="new-sub">${icon('plus')}Substitution I did</button>`;
    content = schoolScheduleTab();
  } else if (ui.tab === 'tasks') {
    addBtn = `<button class="btn btn-dark" data-action="new-task" data-job="donbosco">${icon('plus')}Task</button>`;
    content = `<div class="card">${taskBoard(tasks, { showJob: false, key: 'donbosco' })}</div>`;
  } else if (ui.tab === 'students') {
    addBtn = `<button class="btn btn-dark" data-action="new-student">${icon('plus')}Student</button>`;
    content = studentsTab();
  } else if (ui.tab === 'incidents') {
    addBtn = `<button class="btn btn-dark" data-action="new-incident">${icon('plus')}Incident</button>`;
    content = incidentsTab();
  } else {
    addBtn = `<button class="btn btn-dark" data-action="new-meeting">${icon('plus')}Meeting</button>`;
    const past = d.meetings.filter((m) => m.done || m.date < today).sort((a, b) => b.date.localeCompare(a.date));
    const next = upcoming.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    content = `<div class="card">
      <div class="group-title">Upcoming <span class="count">${next.length}</span></div>
      <div class="list">${next.map(meetingRow).join('') || emptyState('No upcoming meetings with guardians.', 'chat')}</div>
      ${past.length ? `<div class="group-title">Past <span class="count">${past.length}</span></div><div class="list">${past.map(meetingRow).join('')}</div>` : ''}
    </div>`;
  }

  return `
  ${workSwitcher('donbosco')}
  <header class="page-head">
    <div><p class="eyebrow">Teacher</p><h1>Colegio Don Bosco</h1></div>
    <div class="head-actions">${addBtn}</div>
  </header>
  <div class="grid grid-4" style="margin-bottom:18px">
    ${summary.map(([tab, n, l]) => `<button class="job-card j-donbosco ${ui.tab === tab ? 'active' : ''}" data-action="db-tab" data-tab="${tab}"><span class="num">${n}</span><span class="name">${l}</span></button>`).join('')}
  </div>
  <div class="tabs-row">
    ${tabSeg(ui.tab, [['schedule', 'Schedule'], ['tasks', 'Tasks'], ['students', 'Students'], ['incidents', 'Incidents'], ['meetings', 'Meetings']], 'db-tab')}
  </div>
  ${content}`;
}

function groupSelect(value) {
  const groups = [...new Set(Store.data.students.map(studentGroup))].sort();
  return `<select class="select-pill" data-change="db-group" aria-label="Filter by group">
    <option value="all">All groups</option>${groups.map((g) => `<option ${g === value ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>`;
}

function studentsTab() {
  const ui = App.ui.db;
  const q = ui.q.toLowerCase();
  const list = Store.data.students
    .filter((s) => ui.group === 'all' || studentGroup(s) === ui.group)
    .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.guardian || '').toLowerCase().includes(q))
    .sort((a, b) => studentGroup(a).localeCompare(studentGroup(b)) || a.name.localeCompare(b.name));
  const groups = [...new Set(list.map(studentGroup))];
  const card = (s) => {
    const inc = Store.data.incidents.filter((i) => i.studentId === s.id);
    const open = inc.filter((i) => !i.resolved).length;
    const meets = Store.data.meetings.filter((m) => m.studentId === s.id).length;
    return `<button class="student-card j-donbosco" data-action="student-detail" data-id="${s.id}">
      <span class="avatar">${esc(initials(s.name))}</span>
      <span class="info"><span class="name">${esc(s.name)}</span><br><span class="small muted">${esc(s.guardian ? 'Guardian: ' + s.guardian : 'No guardian added')}</span>
      <span class="badges">${inc.length ? `<span class="chip ${open ? 'p-high' : 'outline'}">${inc.length} incident${inc.length > 1 ? 's' : ''}${open ? ` · ${open} open` : ''}</span>` : ''}${meets ? `<span class="chip outline">${meets} meeting${meets > 1 ? 's' : ''}</span>` : ''}</span></span>
      ${icon('right')}
    </button>`;
  };
  return `<div class="tabs-row">
      <label class="search">${icon('search')}<input type="search" placeholder="Search students" value="${esc(ui.q)}" data-input="db-search" aria-label="Search students"></label>
      ${groupSelect(ui.group)}
    </div>
    ${!Store.data.students.length ? `<div class="card">${emptyState('Register your students to track incidents and guardian meetings.', 'users')}</div>`
      : !list.length ? `<div class="card">${emptyState('No students match.', 'search')}</div>`
      : groups.map((g) => `<div class="group-title">${esc(g)} <span class="count">${list.filter((s) => studentGroup(s) === g).length}</span></div>
        <div class="grid grid-3">${list.filter((s) => studentGroup(s) === g).map(card).join('')}</div>`).join('')}`;
}

function incidentsTab() {
  const ui = App.ui.db;
  const list = Store.data.incidents
    .filter((i) => {
      const s = studentById(i.studentId);
      return ui.group === 'all' || (s && studentGroup(s) === ui.group);
    })
    .filter((i) => ui.incStatus === 'all' || (ui.incStatus === 'open' ? !i.resolved : i.resolved))
    .filter((i) => ui.incType === 'all' || i.type === ui.incType)
    .sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="tabs-row">
      <div class="chips">${[['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) =>
        `<button class="chip-btn ${ui.incStatus === k ? 'active' : ''}" data-action="db-inc-status" data-status="${k}">${l}</button>`).join('')}</div>
      <div class="chips">
        ${groupSelect(ui.group)}
        <select class="select-pill" data-change="db-inc-type" aria-label="Filter by type"><option value="all">All types</option>${INCIDENT_TYPES.map((t) => `<option ${t === ui.incType ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="card"><div class="list">${list.map(incidentRow).join('') || emptyState('No incidents here.', 'check')}</div></div>`;
}

/* ============ 4 Eleven Media ============ */
function viewFourEleven() {
  const rest = App.ui.fe.rest;
  const all = Store.data.tasks.filter((t) => FE_JOBS.includes(t.job));
  // A restaurant's view also includes the tasks shared by all three.
  const shown = rest === 'all' ? all
    : rest === 'foureleven' ? all.filter((t) => t.job === 'foureleven')
    : all.filter((t) => t.job === rest || t.job === 'foureleven');
  const today = todayISO();
  const sharedPending = all.filter((t) => t.job === 'foureleven' && taskIsPending(t)).length;
  return `
  ${workSwitcher('foureleven')}
  <header class="page-head">
    <div><p class="eyebrow">Executive Assistant</p><h1>4 Eleven Media</h1></div>
    <div class="head-actions"><button class="btn btn-dark" data-action="new-task" data-job="${rest === 'all' ? 'movita' : rest}" data-jobs="restaurants">${icon('plus')}Task</button></div>
  </header>
  <div class="grid grid-4" style="margin-bottom:18px">
    ${FE_JOBS.map((r) => {
      const pend = all.filter((t) => t.job === r && taskIsPending(t));
      const todayN = pend.filter((t) => taskOccursOn(t, today)).length;
      const high = pend.filter((t) => t.priority === 'high').length;
      const extra = r !== 'foureleven' && sharedPending ? ` · +${sharedPending} shared` : '';
      return `<button class="job-card j-${r} ${rest === r ? 'active' : ''}" data-action="fe-rest" data-rest="${rest === r ? 'all' : r}" aria-pressed="${rest === r}">
        <span class="name">${esc(JOBS[r].label)}</span>
        <span class="num">${pend.length}</span>
        <span class="muted">pending · ${todayN} today · ${high} high${extra}</span>
      </button>`;
    }).join('')}
  </div>
  <div class="tabs-row">
    <div class="chips">
      <button class="chip-btn ${rest === 'all' ? 'active' : ''}" data-action="fe-rest" data-rest="all">Everything</button>
      ${FE_JOBS.map((r) => `<button class="chip-btn ${rest === r ? 'active' : ''}" data-action="fe-rest" data-rest="${r}"><span class="nav-dot j-${r}"></span>${esc(JOBS[r].label)}</button>`).join('')}
    </div>
  </div>
  <div class="card">${taskBoard(shown, { showJob: rest !== 'foureleven', key: 'fe-' + rest })}</div>`;
}

/* ============ Online classes ============ */
function viewOnline() {
  const ui = App.ui.on;
  let content, addBtn;
  if (ui.tab === 'schedule') {
    addBtn = `<button class="btn btn-dark" data-action="new-class">${icon('plus')}Class</button>`;
    content = onlineSchedule();
  } else {
    addBtn = `<button class="btn btn-dark" data-action="new-online-student">${icon('plus')}Student</button>`;
    const list = [...Store.data.onlineStudents].sort((a, b) => a.name.localeCompare(b.name));
    content = list.length ? `<div class="grid grid-3">${list.map((s) => {
      const n = Store.data.classes.filter((c) => c.studentId === s.id).length;
      return `<button class="student-card j-online" data-action="online-student-detail" data-id="${s.id}">
        <span class="avatar">${esc(initials(s.name))}</span>
        <span class="info"><span class="name">${esc(s.name)}</span><br><span class="small muted">${esc([s.timezone, s.contact].filter(Boolean).join(' · ') || 'No contact info')}</span>
        <span class="badges"><span class="chip outline">${n ? `${n} class schedule${n === 1 ? '' : 's'}` : 'No classes yet'}</span></span></span>
        ${icon('right')}</button>`;
    }).join('')}</div>` : `<div class="card">${emptyState('Add your online students to schedule classes with them.', 'users')}</div>`;
  }
  return `
  ${workSwitcher('online')}
  <header class="page-head">
    <div><p class="eyebrow">Online Teacher</p><h1>Online Classes</h1></div>
    <div class="head-actions">${addBtn}</div>
  </header>
  <div class="tabs-row">${tabSeg(ui.tab, [['schedule', 'Schedule'], ['students', 'Students']], 'on-tab')}</div>
  ${content}`;
}

function skippedClassRow(o) {
  const t = classTimeOn(o.cls, o.date);
  return `<div class="row j-online done">
    <span class="time">${t ? fmtTime(t) : ''}</span>
    <div class="row-main" data-action="class-more" data-id="${o.cls.id}" data-date="${o.date}">
      <div class="row-title">${esc(classTitle(o.cls))}</div>
      <div class="row-meta"><span class="chip ${o.log.status === 'suspended' ? 'dark' : 'outline'}">${esc(classStatusText(o.log))}</span></div>
    </div>
    <button class="icon-btn sm ghost more-btn" data-action="class-more" data-id="${o.cls.id}" data-date="${o.date}" aria-label="Change">${icon('more')}</button>
  </div>`;
}

function toRescheduleCard() {
  const list = classesToReschedule();
  if (!list.length) return '';
  return `<section class="card c-soft j-online" style="margin-bottom:16px">
    <div class="card-head"><h2>To reschedule</h2><span class="small muted">${list.length} class${list.length > 1 ? 'es' : ''} postponed without a date</span></div>
    <div class="list">${list.map(({ cls, date }) => `<div class="row j-online">
      <div class="row-main" data-action="class-more" data-id="${cls.id}" data-date="${date}">
        <div class="row-title">${esc(classTitle(cls))}</div>
        <div class="row-meta"><span>Was on ${fmtDate(date)}</span></div>
      </div>
      <button class="btn btn-dark btn-sm" data-action="class-more" data-id="${cls.id}" data-date="${date}">Set new date</button>
    </div>`).join('')}</div>
  </section>`;
}

function onlineSchedule() {
  const ws = App.ui.on.week;
  const we = addDays(ws, 6);
  const occ = classOccurrences(ws, we);
  const plans = [...Store.data.classes].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  let days = '';
  for (let d = ws; d <= we; d = addDays(d, 1)) {
    const dayOcc = occ.filter((o) => o.date === d);
    if (!dayOcc.length) continue;
    const rows = dayOcc.map((o) => (classSkipped(o.log) ? skippedClassRow(o) : agendaRow({
      kind: 'class', id: o.cls.id, date: d, title: classTitle(o.cls), job: 'online', time: classTimeOn(o.cls, d),
      done: !!o.log.done, sub: o.log.topic ? 'Topic: ' + o.log.topic : o.cls.makeupFor ? 'Make-up class' : '',
    })));
    days += `<div class="group-title">${d === todayISO() ? 'Today · ' : ''}${fmtDate(d)}</div><div class="list">${rows.join('')}</div>`;
  }
  return `${toRescheduleCard()}<div class="grid grid-2" style="align-items:start">
    <section class="card">
      <div class="card-head">
        <h2>${fmtDate(ws, { month: 'short', day: 'numeric' })} – ${fmtDate(we, { month: 'short', day: 'numeric' })}</h2>
        <div class="cal-nav">
          <button class="icon-btn sm" data-action="on-week" data-dir="-7" aria-label="Previous week">${icon('left')}</button>
          <button class="icon-btn sm" data-action="on-week" data-dir="7" aria-label="Next week">${icon('right')}</button>
        </div>
      </div>
      ${days || emptyState('No classes this week.', 'laptop')}
    </section>
    <section class="card">
      <div class="card-head"><h2>Weekly schedule</h2><button class="btn btn-light btn-sm" data-action="new-class">${icon('plus')}Class</button></div>
      <div class="list">${plans.map(classPlanRow).join('') || emptyState('Add a class: pick the student, the days and the time — it repeats every week.', 'calendar')}</div>
    </section>
  </div>`;
}
