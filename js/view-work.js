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
  if (ui.tab === 'tasks') {
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
    ${tabSeg(ui.tab, [['tasks', 'Tasks'], ['students', 'Students'], ['incidents', 'Incidents'], ['meetings', 'Meetings']], 'db-tab')}
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
  } else if (ui.tab === 'students') {
    addBtn = `<button class="btn btn-dark" data-action="new-online-student">${icon('plus')}Student</button>`;
    const list = [...Store.data.onlineStudents].sort((a, b) => a.name.localeCompare(b.name));
    content = list.length ? `<div class="grid grid-3">${list.map((s) => {
      const n = Store.data.classes.filter((c) => c.studentId === s.id).length;
      return `<button class="student-card j-online" data-action="online-student-detail" data-id="${s.id}">
        <span class="avatar">${esc(initials(s.name))}</span>
        <span class="info"><span class="name">${esc(s.name)}</span><br><span class="small muted">${esc([s.timezone, s.contact].filter(Boolean).join(' · ') || 'No contact info')}</span>
        <span class="badges">${s.rate ? `<span class="chip j-online">${money(s.rate, s.currency)}/class</span>` : ''}<span class="chip outline">${n} class plan${n === 1 ? '' : 's'}</span></span></span>
        ${icon('right')}</button>`;
    }).join('')}</div>` : `<div class="card">${emptyState('Add your online students to schedule classes with them.', 'users')}</div>`;
  } else {
    addBtn = '';
    content = onlinePayments();
  }
  return `
  ${workSwitcher('online')}
  <header class="page-head">
    <div><p class="eyebrow">Online Teacher</p><h1>Online Classes</h1></div>
    <div class="head-actions">${addBtn}</div>
  </header>
  <div class="tabs-row">${tabSeg(ui.tab, [['schedule', 'Schedule'], ['students', 'Students'], ['payments', 'Payments']], 'on-tab')}</div>
  ${content}`;
}

function onlineSchedule() {
  const ws = App.ui.on.week;
  const we = addDays(ws, 6);
  const occ = classOccurrences(ws, we);
  const plans = [...Store.data.classes].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  let days = '';
  for (let d = ws; d <= we; d = addDays(d, 1)) {
    const items = occ.filter((o) => o.date === d).map((o) => ({
      kind: 'class', id: o.cls.id, date: d, title: classTitle(o.cls), job: 'online', time: o.cls.time,
      done: !!o.log.done, paid: !!o.log.paid, sub: o.log.topic ? 'Topic: ' + o.log.topic : (o.cls.duration ? o.cls.duration + ' min' : ''),
    }));
    if (!items.length) continue;
    days += `<div class="group-title">${d === todayISO() ? 'Today · ' : ''}${fmtDate(d)}</div><div class="list">${items.map((i) => agendaRow(i)).join('')}</div>`;
  }
  return `<div class="grid grid-2" style="align-items:start">
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
      <div class="card-head"><h2>Class plans</h2><span class="muted small">Recurring & one-off</span></div>
      <div class="list">${plans.map(classPlanRow).join('') || emptyState('Schedule a class — it can repeat every week.', 'calendar')}</div>
    </section>
  </div>`;
}

function onlinePayments() {
  const m = App.ui.on.month;
  const start = m + '-01';
  const end = addDays(addMonths(start, 1), -1);
  const occ = classOccurrences(start, end);
  const given = occ.filter((o) => o.log.done);
  const paid = occ.filter((o) => o.log.paid);
  const owed = given.filter((o) => !o.log.paid);
  const sum = (list, cur) => list.filter((o) => (o.cls.currency || 'USD') === cur).reduce((s, o) => s + Number(o.cls.rate || 0), 0);
  const both = (list) => {
    const u = sum(list, 'USD'), v = sum(list, 'VES');
    return [u || !v ? money(u, 'USD') : '', v ? money(v, 'VES') : ''].filter(Boolean).join(' + ');
  };
  return `
  <div class="cal-toolbar">
    <div class="cal-nav">
      <button class="icon-btn" data-action="on-month" data-dir="-1" aria-label="Previous month">${icon('left')}</button>
      <button class="icon-btn" data-action="on-month" data-dir="1" aria-label="Next month">${icon('right')}</button>
      <span class="cal-title">${fmtMonth(start)}</span>
    </div>
  </div>
  <div class="grid grid-4" style="margin-bottom:16px">
    <div class="money-card c-blue"><span class="lbl">Scheduled</span><span class="big">${occ.length}</span><span class="alt">classes</span></div>
    <div class="money-card j-online c-soft"><span class="lbl">Given</span><span class="big">${given.length}</span><span class="alt">${both(given)}</span></div>
    <div class="money-card c-green"><span class="lbl">Paid</span><span class="big">${paid.length}</span><span class="alt">${both(paid)}</span></div>
    <div class="money-card c-yellow"><span class="lbl">Owed to you</span><span class="big">${both(owed)}</span><span class="alt">${owed.length} class${owed.length === 1 ? '' : 'es'}</span></div>
  </div>
  <section class="card">
    <div class="card-head"><h2>Given but not paid</h2></div>
    <div class="list">${owed.map((o) => `
      <div class="row j-online">
        <span class="time">${fmtDate(o.date, { month: 'short', day: 'numeric' })}</span>
        <div class="row-main" data-action="open-item" data-kind="class" data-id="${o.cls.id}" data-date="${o.date}">
          <div class="row-title">${esc(classTitle(o.cls))}</div>
          <div class="row-meta">${o.cls.rate ? `<span class="chip j-online">${money(o.cls.rate, o.cls.currency)}</span>` : '<span>No rate set</span>'}</div>
        </div>
        <button class="btn btn-dark btn-sm" data-action="toggle-paid" data-id="${o.cls.id}" data-date="${o.date}">Mark paid</button>
      </div>`).join('') || emptyState('Nothing owed. Every class given this month is paid!', 'check')}</div>
    <p class="small muted" style="margin:14px 0 0">Marking a class as paid adds the income to Finances automatically.</p>
  </section>`;
}
