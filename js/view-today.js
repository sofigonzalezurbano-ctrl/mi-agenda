'use strict';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
}

const DAILY_QUOTES = [
  'Small steps every day add up to big results.',
  'You are capable of more than you think.',
  'Progress, not perfection.',
  'One task at a time, one day at a time.',
  'Your effort today is your success tomorrow.',
  'Be proud of how far you have come.',
  'Discipline is choosing what you want most over what you want now.',
  'Make today so good that yesterday gets jealous.',
  'You don’t have to be perfect to be amazing.',
  'Start where you are. Use what you have. Do what you can.',
  'Great things never come from comfort zones.',
  'Believe in yourself and all that you are.',
  'Done is better than perfect.',
  'Every day is a fresh start.',
  'Dream big, work hard, stay focused.',
  'Your future self will thank you.',
  'Focus on the step in front of you, not the whole staircase.',
  'Hard work beats talent when talent doesn’t work hard.',
  'You are doing better than you think.',
  'Rest if you must, but don’t quit.',
  'Little by little, a little becomes a lot.',
  'Teach, inspire, grow — and repeat.',
  'The secret of getting ahead is getting started.',
  'Stay patient and trust your journey.',
  'Do something today that your future self will love.',
  'Strong women build each other up — starting with themselves.',
  'Consistency is your superpower.',
  'Celebrate every small win.',
  'You were made to do hard things.',
  'Breathe. You’ve got this.',
  'A positive mindset brings positive things.',
];

/** Same quote all day, a different one each day. */
function dailyQuote(iso) {
  const d = fromISO(iso);
  const dayOfYear = Math.round((d - new Date(d.getFullYear(), 0, 1)) / 86400000);
  return DAILY_QUOTES[(dayOfYear + d.getFullYear()) % DAILY_QUOTES.length];
}

function viewToday() {
  const today = todayISO();
  const items = agendaFor(today);
  const overdue = overdueTasks();
  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const highPending = Store.data.tasks.filter((t) => !t.done && t.priority === 'high').length;
  const nextMeeting = Store.data.meetings
    .filter((m) => !m.done && m.date >= today)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
  const owed = classOccurrences(monthKey(today) + '-01', today).filter((o) => o.log.done && !o.log.paid);
  const tomorrow = agendaFor(addDays(today, 1));

  return `
  <header class="page-head">
    <div>
      <p class="eyebrow">${fmtLongDate(today)}</p>
      <h1>${greeting()},<br>${esc(Store.data.settings.name)}!</h1>
      <p class="sub">${esc(dailyQuote(today))} ✿</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-dark" data-action="quick-add">${icon('plus')}Add</button>
      <button class="icon-btn" data-action="settings" aria-label="Settings">${icon('settings')}</button>
    </div>
  </header>

  <div class="today-grid">
    <div class="today-left">
      <section class="card c-yellow progress-card" aria-labelledby="prog-h">
        <div class="card-head"><h2 id="prog-h">Today's progress</h2><span class="chip dark">${pending.length} left</span></div>
        ${progressRing(items)}
      </section>

      <div class="stat-cards">
        <button class="stat c-pink" style="border:0;text-align:left" data-route-to="donbosco">
          <span class="num">${highPending}</span><span class="lbl">High-priority tasks pending</span>
        </button>
        <button class="stat c-blue" style="border:0;text-align:left" data-route-to="online">
          <span class="num">${owed.length}</span><span class="lbl">Classes unpaid this month</span>
        </button>
        <button class="stat c-green" style="border:0;text-align:left" data-route-to="donbosco" data-tab="meetings">
          <span class="lbl">Next guardian meeting</span>
          <span class="lbl">${nextMeeting ? `<b>${esc(nextMeeting.guardian || 'Guardian')}</b> · ${relDay(nextMeeting.date)}${nextMeeting.time ? ' ' + fmtTime(nextMeeting.time) : ''}` : 'None scheduled'}</span>
        </button>
      </div>
    </div>

    <div class="grid" style="gap:16px">
      <section class="card" aria-labelledby="rem-h">
        <div class="card-head">
          <h2 id="rem-h">Daily reminders</h2>
          <button class="btn btn-light btn-sm" data-action="quick-add" data-date="${today}">${icon('plus')}Add</button>
        </div>
        <div class="list">
          ${pending.map((i) => agendaRow(i)).join('') || (items.length ? emptyState('Everything for today is done. Amazing!', 'sparkle') : emptyState('Nothing scheduled for today. Add tasks, classes or meetings with a date to see them here.', 'calendar'))}
        </div>
        ${done.length ? `<details class="done-list" data-key="today-done" ${App.openDetails.has('today-done') ? 'open' : ''}>
          <summary class="group-title">Done today <span class="count">${done.length}</span></summary>
          <div class="list">${done.map((i) => agendaRow(i)).join('')}</div></details>` : ''}
      </section>

      ${overdue.length ? `
      <section class="card c-pink" aria-labelledby="od-h">
        <div class="card-head"><h2 id="od-h">Overdue</h2><span class="muted">${overdue.length} task${overdue.length > 1 ? 's' : ''}</span></div>
        <div class="list">${overdue.map((t) => taskRow(t)).join('')}</div>
      </section>` : ''}

      <section class="card" aria-labelledby="tm-h">
        <div class="card-head"><h2 id="tm-h">Tomorrow</h2><span class="muted">${fmtDate(addDays(today, 1))}</span></div>
        <div class="list">${tomorrow.map((i) => agendaRow(i)).join('') || emptyState('Nothing yet for tomorrow.', 'calendar')}</div>
      </section>
    </div>
  </div>`;
}
