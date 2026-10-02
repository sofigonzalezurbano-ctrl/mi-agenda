'use strict';

/* ============ Toast ============ */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ============ Modal ============ */
let lastFocus = null;

function openModal(innerHTML, { wide = false } = {}) {
  lastFocus = document.activeElement;
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-close></div><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${innerHTML}</div>`;
  root.classList.add('open');
  document.body.style.overflow = 'hidden';
  const first = $('.modal input:not([type=hidden]), .modal select, .modal textarea, .modal button', root);
  if (first && window.matchMedia('(min-width: 641px)').matches) first.focus();
}

function closeModal() {
  const root = $('#modal-root');
  root.classList.remove('open');
  root.innerHTML = '';
  document.body.style.overflow = '';
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function modalHead(title) {
  return `<div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>`;
}

function openSheet(title, bodyHTML, opts) {
  openModal(modalHead(title) + bodyHTML, opts);
}

/* ============ Form builder ============ */
const normOpts = (opts) => (opts || []).map((o) => (Array.isArray(o) ? o : [o, o]));

function fieldHTML(f, v) {
  const cls = `field ${f.half ? 'half' : ''}`;
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  if (f.type === 'html') return `<div class="info-box ${f.cls || ''}" data-field="${f.name}">${f.html}</div>`;
  if (f.type === 'checkbox') {
    return `<div class="${cls}" data-field="${f.name}"><label class="switch"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
  }
  let input;
  switch (f.type) {
    case 'textarea':
      input = `<textarea name="${f.name}" ${ph}>${esc(v)}</textarea>`;
      break;
    case 'select':
      input = `<select name="${f.name}">${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${normOpts(f.options)
        .map(([val, l]) => `<option value="${esc(val)}" ${String(val) === String(v ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      break;
    case 'pills':
      input = `<div class="pills" role="radiogroup">${normOpts(f.options)
        .map(([val, l]) => `<label><input type="radio" name="${f.name}" value="${esc(val)}" ${String(val) === String(v) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
      break;
    case 'days': {
      const sel = v || [];
      input = `<div class="pills">${[1, 2, 3, 4, 5, 6, 0]
        .map((i) => `<label><input type="checkbox" name="${f.name}" value="${i}" ${sel.includes(i) ? 'checked' : ''}><span>${WEEKDAYS[i]}</span></label>`).join('')}</div>`;
      break;
    }
    case 'number':
      input = `<input type="number" name="${f.name}" value="${v ?? ''}" step="${f.step || 'any'}" min="0" inputmode="decimal" ${ph}>`;
      break;
    default:
      input = `<input type="${f.type || 'text'}" name="${f.name}" value="${esc(v ?? '')}" ${ph} autocomplete="off"${f.suggestions ? ` list="dl-${f.name}"` : ''}>`
        + (f.suggestions ? `<datalist id="dl-${f.name}">${f.suggestions.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : '');
  }
  const tag = f.type === 'pills' || f.type === 'days' ? 'div' : 'label';
  return `<${tag} class="${cls}" data-field="${f.name}"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${input}</${tag}>`;
}

function readForm(form, fields) {
  const vals = {};
  fields.forEach((f) => {
    if (f.type === 'html') return;
    if (f.type === 'checkbox') vals[f.name] = form.elements[f.name].checked;
    else if (f.type === 'days') vals[f.name] = $$(`input[name="${f.name}"]:checked`, form).map((i) => Number(i.value));
    else if (f.type === 'pills') { const c = $(`input[name="${f.name}"]:checked`, form); vals[f.name] = c ? c.value : ''; }
    else if (f.type === 'number') { const s = form.elements[f.name].value.trim(); vals[f.name] = s === '' ? null : Number(s); }
    else vals[f.name] = form.elements[f.name].value.trim();
  });
  return vals;
}

/**
 * Generic form modal.
 * cfg: { title, fields, values, onSave(vals) -> false to keep open, onDelete, deleteConfirm, onChange(vals, form), submitLabel }
 */
function openForm(cfg) {
  const { fields } = cfg;
  const values = cfg.values || {};
  openModal(`${modalHead(cfg.title)}
    <form class="form" novalidate>
      ${fields.map((f) => fieldHTML(f, values[f.name])).join('')}
      <div class="form-actions">
        ${cfg.onDelete ? `<button type="button" class="btn btn-ghost danger" data-del>${icon('trash')}Delete</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn-dark">${esc(cfg.submitLabel || 'Save')}</button>
      </div>
    </form>`, { wide: cfg.wide });

  const form = $('#modal-root form');
  const refresh = () => {
    const v = readForm(form, fields);
    fields.forEach((f) => {
      if (f.show) $(`[data-field="${f.name}"]`, form).hidden = !f.show(v);
    });
    if (cfg.onChange) cfg.onChange(v, form);
  };
  form.addEventListener('change', refresh);
  refresh();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = readForm(form, fields);
    let ok = true;
    fields.forEach((f) => {
      const el = $(`[data-field="${f.name}"]`, form);
      if (!el) return;
      el.classList.remove('error');
      if (f.required && !el.hidden && (v[f.name] === '' || v[f.name] == null)) { el.classList.add('error'); ok = false; }
    });
    if (!ok) { toast('Please fill in the required fields'); return; }
    if (cfg.onSave(v) !== false) { closeModal(); App.render(); }
  });

  if (cfg.onDelete) {
    $('[data-del]', form).addEventListener('click', () => {
      if (confirm(cfg.deleteConfirm || 'Delete this item?')) { cfg.onDelete(); closeModal(); App.render(); toast('Deleted'); }
    });
  }
}

/* ============ Shared components ============ */
function emptyState(text, ic = 'sparkle') {
  return `<div class="empty">${icon(ic)}${esc(text)}</div>`;
}
function prioChip(p) {
  return p && PRIORITIES[p] ? `<span class="chip p-${p}"><span class="pdot p-${p}"></span>${PRIORITIES[p].label}</span>` : '';
}
function jobChip(job) {
  return JOBS[job] ? `<span class="chip j-${job}">${esc(JOBS[job].label)}</span>` : '';
}
function checkBtn(done, attrs, label) {
  return `<button class="check ${done ? 'on' : ''}" ${attrs} aria-label="${done ? 'Mark as not done' : 'Mark as done'}: ${esc(label)}" aria-pressed="${done}">${icon('check')}</button>`;
}

const moreBtn = (id, date) =>
  `<button class="icon-btn sm ghost more-btn" data-action="task-more" data-id="${id}" data-date="${date}" aria-label="More options: postpone or cancel">${icon('more')}</button>`;
const postponedChip = (from) => (from ? `<span class="chip outline">Postponed from ${fmtDate(from, { month: 'short', day: 'numeric' })}</span>` : '');

function taskRow(t, { showJob = true } = {}) {
  if (t.recurring) return routineRow(t, showJob);
  const cancelled = isCancelled(t);
  const late = !t.done && !cancelled && t.date && t.date < todayISO();
  const when = t.date ? `${relDay(t.date)}${t.time ? ' · ' + fmtTime(t.time) : ''}` : t.indefinite ? 'Postponed · no date' : 'No date';
  return `<div class="row j-${t.job} ${t.done || cancelled ? 'done' : ''} ${late ? 'carried' : ''}">
    ${cancelled ? '<span class="check off-day" aria-hidden="true"></span>' : checkBtn(t.done, `data-action="toggle-task" data-id="${t.id}"`, t.title)}
    <div class="row-main" data-action="edit-task" data-id="${t.id}">
      <div class="row-title">${esc(t.title)}</div>
      <div class="row-meta">${cancelled ? '<span class="chip dark">Cancelled</span>' : ''}${prioChip(t.priority)}${showJob ? jobChip(t.job) : ''}<span class="${late ? 'danger' : ''}">${late ? '⚠ Not done · ' : ''}${when}</span>${t.postponed && t.date ? postponedChip(t.postponedFrom) : ''}</div>
    </div>
    ${t.done ? '' : moreBtn(t.id, t.date || todayISO())}
  </div>`;
}

/** Fixed task: the check marks today's occurrence only. */
function routineRow(t, showJob) {
  const today = todayISO();
  const dueToday = taskOccursOn(t, today);
  const done = dueToday && taskDoneOn(t, today);
  const check = dueToday
    ? checkBtn(done, `data-action="toggle-task" data-id="${t.id}" data-date="${today}"`, t.title + ' (today)')
    : `<span class="check off-day" title="Not scheduled today" aria-hidden="true"></span>`;
  const skipped = t.skips && t.skips[today];
  const missed = missedRoutineDate(t, today);
  return `<div class="row j-${t.job} ${done || recurringEnded(t) || skipped ? 'done' : ''} ${missed && !done ? 'carried' : ''}">
    ${check}
    <div class="row-main" data-action="edit-task" data-id="${t.id}">
      <div class="row-title">${esc(t.title)}</div>
      ${missed && !done ? `<div class="carried-note">⚠ Not done on ${fmtDate(missed)} — urgent</div>` : ''}
      <div class="row-meta">${prioChip(t.priority)}${showJob ? jobChip(t.job) : ''}<span class="chip outline">${icon('repeat', 'xs')}${esc(recurrenceText(t, 'date'))}</span>${t.time ? `<span>${fmtTime(t.time)}</span>` : ''}<span>${recurringEnded(t) ? 'Ended' : skipped ? (skipped === 'cancelled' ? 'Cancelled today' : 'Postponed today') : dueToday ? (done ? 'Done today' : 'Due today') : 'Not today'}</span></div>
    </div>
    ${dueToday && !done ? moreBtn(t.id, today) : ''}
  </div>`;
}

function taskBoard(tasks, opts = {}) {
  if (!tasks.length) return emptyState(opts.empty || 'No tasks yet — add your first one!', 'check');
  const routine = tasks.filter((t) => t.recurring && !recurringEnded(t))
    .sort((a, b) => Number(taskIsPending(b)) - Number(taskIsPending(a)) || byPriority(a, b));
  const today = todayISO();
  const open = tasks.filter((t) => !t.recurring && !t.done && !isCancelled(t));
  const late = open.filter((t) => t.date && t.date < today).sort((a, b) => a.date.localeCompare(b.date) || byPriority(a, b));
  const noDate = open.filter((t) => !t.date && t.indefinite);
  const pending = open.filter((t) => !late.includes(t) && !noDate.includes(t)).sort(byPriority);
  const done = tasks.filter((t) => (!t.recurring && (t.done || isCancelled(t))) || recurringEnded(t))
    .sort((a, b) => (b.doneAt || b.cancelledAt || 0) - (a.doneAt || a.cancelledAt || 0));
  let html = '';
  if (routine.length) {
    const left = routine.filter(taskIsPending).length;
    html += `<div class="group-title">${icon('repeat', 'xs')}Fixed tasks <span class="count">${left ? left + ' left today' : 'all done today'}</span></div>
      <div class="list">${routine.map((t) => taskRow(t, opts)).join('')}</div>`;
  }
  if (late.length) {
    html += `<div class="group-title danger">⚠ Not done yet — do these first <span class="count">${late.length}</span></div>
      <div class="list">${late.map((t) => taskRow(t, opts)).join('')}</div>`;
  }
  Object.keys(PRIORITIES).forEach((p) => {
    const g = pending.filter((t) => (t.priority || 'medium') === p);
    if (!g.length) return;
    html += `<div class="group-title"><span class="pdot p-${p}"></span>${PRIORITIES[p].label} priority <span class="count">${g.length}</span></div>
      <div class="list">${g.map((t) => taskRow(t, opts)).join('')}</div>`;
  });
  if (noDate.length) {
    html += `<div class="group-title">Postponed · no date <span class="count">${noDate.length}</span></div>
      <div class="list">${noDate.map((t) => taskRow(t, opts)).join('')}</div>`;
  }
  if (!pending.length && !routine.length && !late.length && !noDate.length) html += emptyState('All caught up! Nothing pending.', 'check');
  if (done.length) {
    const key = 'done-' + (opts.key || 'tasks');
    html += `<details class="done-list" data-key="${key}" ${App.openDetails.has(key) ? 'open' : ''}>
      <summary class="group-title">Completed & cancelled <span class="count">${done.length}</span></summary>
      <div class="list">${done.map((t) => taskRow(t, opts)).join('')}</div></details>`;
  }
  return html;
}

const KIND_LABEL = { meeting: 'Meeting', class: 'Class', need: 'Need', task: 'Task', debt: 'Debt', school: 'Class', sub: 'Substitution', makeup: 'Make-up' };

function agendaRow(it, { showTime = true } = {}) {
  const data = `data-kind="${it.kind}" data-id="${it.id}" data-date="${it.date}"`;
  const timeLabel = it.carried ? 'Overdue' : it.time ? fmtTime(it.time) : 'Anytime';
  return `<div class="row j-${it.job} ${it.done ? 'done' : ''} ${it.carried ? 'carried' : ''}">
    ${showTime ? `<span class="time">${timeLabel}</span>` : ''}
    ${checkBtn(it.done, `data-action="toggle-item" ${data}`, it.title)}
    <div class="row-main" data-action="open-item" ${data}>
      <div class="row-title">${esc(it.title)}</div>
      ${it.carried ? `<div class="carried-note">⚠ Not done on ${fmtDate(it.origDate)} — urgent, do it first</div>` : ''}
      <div class="row-meta">${jobChip(it.job)}${it.recurring ? `<span class="chip outline">${icon('repeat', 'xs')}Fixed</span>` : ''}${['meeting', 'class', 'debt', 'school', 'sub', 'makeup'].includes(it.kind) ? `<span class="chip outline">${KIND_LABEL[it.kind]}</span>` : ''}${it.kind === 'debt' ? '' : prioChip(it.priority)}${it.kind === 'task' && !it.carried ? postponedChip(it.postponedFrom) : ''}${it.sub && it.kind !== 'task' && it.kind !== 'need' ? `<span>${esc(it.sub)}</span>` : ''}</div>
    </div>
    ${it.kind === 'task' && !it.done ? moreBtn(it.id, it.carried && !it.recurring ? it.origDate : it.date) : ''}
    ${it.kind === 'class' && !it.done ? `<button class="icon-btn sm ghost more-btn" data-action="class-more" data-id="${it.id}" data-date="${it.date}" aria-label="More options: suspend or postpone">${icon('more')}</button>` : ''}
  </div>`;
}

/** Segmented donut: one arc per job sized by its share of today's items; filled part = done. */
function progressRing(items) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const r = 90, C = 2 * Math.PI * r, sw = 22;
  const gap = total > 1 ? 4 : 0;
  let off = 0, arcs = '';
  const circle = (job, color, len) =>
    `<circle class="j-${job}" cx="110" cy="110" r="${r}" fill="none" style="stroke:${color}" stroke-width="${sw}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"/>`;
  if (!total) {
    arcs = `<circle cx="110" cy="110" r="${r}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="${sw}"/>`;
  }
  const activeJobs = JOB_ORDER.filter((j) => items.some((i) => i.job === j));
  activeJobs.forEach((job) => {
    const its = items.filter((i) => i.job === job);
    const seg = (its.length / total) * C;
    const len = Math.max(seg - gap, 1);
    arcs += circle(job, 'var(--cs)', len);
    const dn = (its.filter((i) => i.done).length / total) * C;
    if (dn > 0) arcs += circle(job, 'var(--c)', Math.max(Math.min(dn, len), 1));
    off += seg;
  });
  const legend = activeJobs.map((job) => {
    const its = items.filter((i) => i.job === job);
    const d = its.filter((i) => i.done).length;
    return `<div class="lg j-${job}"><span class="nav-dot"></span><span>${esc(JOBS[job].label)}</span><b>${d}/${its.length}</b>
      <div class="bar"><i style="width:${(d / its.length) * 100}%"></i></div></div>`;
  }).join('');
  return `<div class="ring" role="img" aria-label="${pct}% of today's items done">
      <svg viewBox="0 0 220 220">${arcs}</svg>
      <div class="ring-center"><div class="pct">${pct}<small>%</small></div><div class="lbl">${done} of ${total} done</div></div>
    </div>
    <div class="job-legend">${legend || '<p class="muted small" style="text-align:center;margin:0">Nothing scheduled today yet.</p>'}</div>`;
}
