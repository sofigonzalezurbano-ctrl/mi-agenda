'use strict';

function calLegend() {
  return `<div class="legend">${JOB_ORDER.map((j) => `<span class="j-${j}"><span class="nav-dot"></span>${esc(JOBS[j].label)}</span>`).join('')}</div>`;
}

function viewCalendar() {
  const { mode, cursor } = App.ui.cal;
  let title, body;
  if (mode === 'month') { title = fmtMonth(cursor); body = monthView(cursor); }
  else if (mode === 'week') {
    const s = startOfWeek(cursor), e = addDays(s, 6);
    title = `${fmtDate(s, { month: 'short', day: 'numeric' })} – ${fmtDate(e, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    body = weekView(s);
  } else { title = fmtLongDate(cursor); body = dayView(cursor); }

  return `
  <header class="page-head">
    <div><p class="eyebrow">All your jobs in one place</p><h1>Calendar</h1></div>
    <div class="head-actions">
      <button class="btn btn-dark" data-action="quick-add" data-date="${cursor}">${icon('plus')}Add</button>
    </div>
  </header>
  <div class="cal-toolbar">
    <div class="cal-nav">
      <button class="icon-btn" data-action="cal-move" data-dir="-1" aria-label="Previous">${icon('left')}</button>
      <button class="icon-btn" data-action="cal-move" data-dir="1" aria-label="Next">${icon('right')}</button>
      <button class="btn btn-light btn-sm" data-action="cal-today">Today</button>
      <span class="cal-title">${title}</span>
    </div>
    <div class="seg" role="tablist" aria-label="Calendar view">
      ${['day', 'week', 'month'].map((m) => `<button role="tab" aria-selected="${mode === m}" class="${mode === m ? 'active' : ''}" data-action="cal-mode" data-mode="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}
    </div>
  </div>
  ${calLegend()}
  ${body}`;
}

function monthView(cursor) {
  const first = cursor.slice(0, 8) + '01';
  const start = startOfWeek(first);
  const month = cursor.slice(0, 7);
  const today = todayISO();
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    if (i === 35 && d.slice(0, 7) !== month) break; // skip a 6th row that is entirely next month
    const items = agendaFor(d);
    const chips = items.slice(0, 3).map((it) =>
      `<span class="mchip j-${it.job} ${it.done ? 'done' : ''}">${it.time ? fmtTime(it.time) + ' ' : ''}${esc(it.title)}</span>`).join('');
    const more = items.length > 3 ? `<span class="mmore">+${items.length - 3} more</span>` : '';
    const dots = items.slice(0, 6).map((it) => `<i class="j-${it.job}"></i>`).join('');
    cells += `<button class="mcell ${d.slice(0, 7) !== month ? 'other' : ''} ${d === today ? 'today' : ''}" data-action="cal-open-day" data-date="${d}"
      aria-label="${fmtLongDate(d)}, ${items.length} items">
      <span class="dnum">${fromISO(d).getDate()}</span>${chips}${more}<span class="mdots">${dots}</span></button>`;
  }
  return `<div class="month">
    <div class="month-head">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div>${d}</div>`).join('')}</div>
    <div class="month-grid">${cells}</div>
  </div>`;
}

function weekView(start) {
  const today = todayISO();
  let cols = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const items = agendaFor(d);
    cols += `<div class="wcol">
      <button class="whead ${d === today ? 'today' : ''}" data-action="cal-open-day" data-date="${d}">
        <div class="wd">${WEEKDAYS[weekday(d)]}</div><div class="dn">${fromISO(d).getDate()}</div>
      </button>
      <div class="wbody">
        ${items.map((it) => `
          <button class="wcard j-${it.job} ${it.done ? 'done' : ''}" data-action="open-item" data-kind="${it.kind}" data-id="${it.id}" data-date="${d}">
            <span class="t">${it.time ? fmtTime(it.time) : 'Anytime'}<span class="jdot"></span></span>
            <span class="n">${esc(it.title)}</span>
            ${['meeting', 'class', 'debt', 'school', 'sub'].includes(it.kind) ? `<span class="s">${KIND_LABEL[it.kind]}${['debt', 'school', 'sub'].includes(it.kind) ? ' · ' + esc(it.sub) : ''}</span>` : `<span class="s">${esc(JOBS[it.job].label)}</span>`}
          </button>`).join('')}
        <button class="btn btn-ghost btn-sm" data-action="quick-add" data-date="${d}" aria-label="Add on ${fmtLongDate(d)}">${icon('plus')}</button>
      </div>
    </div>`;
  }
  return `<div class="week-wrap"><div class="week">${cols}</div></div>`;
}

function dayView(d) {
  const items = agendaFor(d);
  const untimed = items.filter((i) => !i.time);
  const timed = items.filter((i) => i.time);
  const hours = timed.map((i) => Number(i.time.slice(0, 2)));
  const from = Math.min(6, ...hours), to = Math.max(21, ...hours);
  const nowH = d === todayISO() ? new Date().getHours() : -1;
  let rows = '';
  if (untimed.length) {
    rows += `<div class="trow"><span class="h">Anytime</span><div class="slot">${untimed.map((i) => agendaRow(i, { showTime: false })).join('')}</div></div>`;
  }
  for (let h = from; h <= to; h++) {
    const its = timed.filter((i) => Number(i.time.slice(0, 2)) === h);
    rows += `<div class="trow ${h === nowH ? 'now' : ''}"><span class="h">${fmtTime(pad(h) + ':00')}</span>
      <div class="slot">${its.map((i) => agendaRow(i)).join('')}</div></div>`;
  }
  return `<div class="day-view">
    <div class="timeline">${rows}</div>
    <div class="card c-yellow progress-card">
      <div class="card-head"><h2>Day progress</h2></div>
      ${progressRing(items)}
      <button class="btn btn-dark" data-action="quick-add" data-date="${d}">${icon('plus')}Add to this day</button>
    </div>
  </div>`;
}
