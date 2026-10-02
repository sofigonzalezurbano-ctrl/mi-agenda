'use strict';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
}

const QUOTES = [
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
  'Work hard, play hard.',
  'Your only limit is you.',
  'Be the energy you want to attract.',
  'Good things take time.',
  'Make it happen.',
  'Stay humble, work hard, be kind.',
  'She believed she could, so she did.',
  'Today is a good day to have a good day.',
  'Push yourself, because no one else is going to do it for you.',
  'Success is the sum of small efforts repeated daily.',
  'Don’t wait for opportunity. Create it.',
  'Be stronger than your excuses.',
  'You’re one decision away from a totally different life.',
  'Keep going. Everything you need will come to you.',
  'Your vibe attracts your tribe.',
  'Do it with passion or not at all.',
  'Wake up with determination, go to bed with satisfaction.',
  'Small progress is still progress.',
  'Organized mind, peaceful heart.',
  'Every expert was once a beginner.',
  'Shine like the whole universe is yours.',
  'Turn your can’ts into cans and your dreams into plans.',
  'Be so good they can’t ignore you.',
  'Mistakes are proof that you are trying.',
  'Work in silence, let success make the noise.',
  'Choose joy today.',
  'Your hustle is beautiful.',
  'Grow through what you go through.',
  'Be a voice, not an echo.',
  'It always seems impossible until it’s done.',
  'Gratitude turns what we have into enough.',
  'Plan your work, then work your plan.',
  'You inspire your students more than you know.',
  'Kindness is always in style.',
  'Make your coffee strong and your goals stronger.',
  'Don’t count the days, make the days count.',
  'You can be a masterpiece and a work in progress at the same time.',
  'Bloom where you are planted.',
  'Fall seven times, stand up eight.',
  'Today’s tasks are tomorrow’s achievements.',
  'Your potential is endless.',
  'Inhale confidence, exhale doubt.',
  'Chase what sets your soul on fire.',
  'Doubt kills more dreams than failure ever will.',
  'Small habits, big changes.',
  'You’ve survived 100% of your hardest days.',
  'Create a life you can’t wait to wake up to.',
  'Energy flows where attention goes.',
  'The best view comes after the hardest climb.',
  'Hustle with heart.',
  'Let your dreams be bigger than your fears.',
  'You are your best investment.',
  'Prioritize your peace.',
  'Slow progress is better than no progress.',
  'Be proud, but never satisfied.',
  'Ordinary days can lead to extraordinary results.',
  'Your time is now.',
  'Make yourself a priority too.',
  'Courage over comfort.',
  'Keep your eyes on the stars and your feet on the ground.',
  'Learning never exhausts the mind.',
  'Abundance starts with a grateful heart.',
  'Stay focused and extra sparkly.',
  'Believe you can and you’re halfway there.',
  'The harder you work, the luckier you get.',
  'Be the reason someone smiles today.',
  'Trust the process.',
  'You are enough, just as you are.',
  'Three jobs, one queen. You’ve got this.',
];

/** Random quote chosen once per app load (refresh = new quote), never the same as last time. */
const QUOTE_KEY = 'miAgenda.lastQuote';
const quoteOfSession = (() => {
  let last = -1;
  try { last = Number(localStorage.getItem(QUOTE_KEY) ?? -1); } catch (e) { /* storage unavailable */ }
  let i;
  do { i = Math.floor(Math.random() * QUOTES.length); } while (i === last && QUOTES.length > 1);
  try { localStorage.setItem(QUOTE_KEY, String(i)); } catch (e) { /* storage unavailable */ }
  return QUOTES[i];
})();

function viewToday() {
  const today = todayISO();
  const items = agendaFor(today);
  const overdueDebts = Store.data.debts.filter((d) => debtStatus(d).overdue);
  const pending = items.filter((i) => !i.done);
  // School classes have their own card with quick buttons, so the reminders list skips them.
  const listItems = items.filter((i) => !['school', 'sub', 'reminder'].includes(i.kind));
  const listPending = listItems.filter((i) => !i.done);
  const done = listItems.filter((i) => i.done);
  const schoolToday = schoolDayList(today);
  const upcoming = upcomingReminders(today);
  const noDateTasks = Store.data.tasks.filter((t) => !t.recurring && t.indefinite && !t.date && !t.done && !isCancelled(t)).sort(byPriority);

  const highPending = Store.data.tasks.filter((t) => taskIsPending(t) && t.priority === 'high').length;
  const nextMeeting = Store.data.meetings
    .filter((m) => !m.done && m.date >= today)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];
  const classesToday = items.filter((i) => i.kind === 'class');
  const tomorrow = agendaFor(addDays(today, 1));

  return `
  <header class="page-head">
    <div>
      <p class="eyebrow">${fmtLongDate(today)}</p>
      <h1>${greeting()},<br>${esc(Store.data.settings.name)}!</h1>
      <p class="sub">${esc(quoteOfSession)} ✿</p>
    </div>
    <div class="head-actions">
      ${syncBadge('pill')}
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
          <span class="num">${classesToday.filter((i) => !i.done).length}</span><span class="lbl">Online classes left today</span>
        </button>
        <button class="stat c-green" style="border:0;text-align:left" data-route-to="donbosco" data-tab="meetings">
          <span class="lbl">Next guardian meeting</span>
          <span class="lbl">${nextMeeting ? `<b>${esc(nextMeeting.guardian || 'Guardian')}</b> · ${relDay(nextMeeting.date)}${nextMeeting.time ? ' ' + fmtTime(nextMeeting.time) : ''}` : 'None scheduled'}</span>
        </button>
      </div>
    </div>

    <div class="grid" style="gap:16px">
      <section class="card reminders-card" aria-labelledby="rmd-h">
        <div class="card-head"><h2 id="rmd-h">Reminders</h2><button class="btn btn-light btn-sm" data-action="new-reminder">${icon('plus')}Reminder</button></div>
        <div class="list">${upcoming.map((r) => {
          const n = daysUntil(r.date);
          const badge = n < 0 ? `${-n} day${n < -1 ? 's' : ''} late` : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
          return `<div class="row j-${r.job || 'personal'} ${n < 0 ? 'carried' : ''}">
            <span class="countdown ${n <= 1 ? 'soon' : ''}">${badge}</span>
            ${checkBtn(false, `data-action="toggle-item" data-kind="reminder" data-id="${r.id}" data-date="${r.date}"`, r.title)}
            <div class="row-main" data-action="edit-reminder" data-id="${r.id}">
              <div class="row-title">${esc(r.title)}</div>
              <div class="row-meta">${jobChip(r.job || 'personal')}<span>${fmtLongDate(r.date)}${r.time ? ' · ' + fmtTime(r.time) : ''}</span>${r.notes ? `<span>${esc(r.notes)}</span>` : ''}</div>
            </div>
          </div>`;
        }).join('') || emptyState('Nothing coming up in the next week. Add a reminder and it shows up here a week before.', 'clock')}</div>
      </section>

      ${schoolToday ? `<section class="card" aria-labelledby="sch-h">
        <div class="card-head"><h2 id="sch-h">Don Bosco today</h2><button class="btn btn-light btn-sm" data-route-to="donbosco" data-tab="schedule">Timetable</button></div>
        ${schoolToday}
      </section>` : ''}

      <section class="card" aria-labelledby="rem-h">
        <div class="card-head">
          <h2 id="rem-h">Daily reminders</h2>
          <button class="btn btn-light btn-sm" data-action="quick-add" data-date="${today}">${icon('plus')}Add</button>
        </div>
        <div class="list">
          ${listPending.map((i) => agendaRow(i)).join('') || (listItems.length ? emptyState('Everything for today is done. Amazing!', 'sparkle') : emptyState('Nothing scheduled for today. Add tasks, classes or meetings with a date to see them here.', 'calendar'))}
        </div>
        ${noDateTasks.length ? `<details class="done-list" data-key="today-nodate" ${App.openDetails.has('today-nodate') ? 'open' : ''}>
          <summary class="group-title">Postponed · no date <span class="count">${noDateTasks.length}</span></summary>
          <div class="list">${noDateTasks.map((t) => taskRow(t)).join('')}</div></details>` : ''}
        ${done.length ? `<details class="done-list" data-key="today-done" ${App.openDetails.has('today-done') ? 'open' : ''}>
          <summary class="group-title">Done today <span class="count">${done.length}</span></summary>
          <div class="list">${done.map((i) => agendaRow(i)).join('')}</div></details>` : ''}
      </section>

      ${overdueDebts.length ? `
      <section class="card c-pink" aria-labelledby="od-h">
        <div class="card-head"><h2 id="od-h">Overdue</h2><span class="muted">${overdueDebts.length} debt${overdueDebts.length > 1 ? 's' : ''}</span></div>
        <div class="list">${overdueDebts.map((d) => {
          const s = debtStatus(d);
          return `<div class="row j-personal"><div class="row-main" data-action="edit-debt" data-id="${d.id}">
            <div class="row-title">Pay ${esc(d.creditor)} · ${money(debtInstallmentAmount(d, s), d.currency)}</div>
            <div class="row-meta"><span class="chip outline">Debt</span><span class="danger">Was due ${fmtDate(s.nextDue)}</span></div></div>
            <button class="btn btn-dark btn-sm" data-action="pay-debt" data-id="${d.id}">Pay</button></div>`;
        }).join('')}</div>
      </section>` : ''}

      <section class="card" aria-labelledby="tm-h">
        <div class="card-head"><h2 id="tm-h">Tomorrow</h2><span class="muted">${fmtDate(addDays(today, 1))}</span></div>
        <div class="list">${tomorrow.map((i) => agendaRow(i)).join('') || emptyState('Nothing yet for tomorrow.', 'calendar')}</div>
      </section>
    </div>
  </div>`;
}
