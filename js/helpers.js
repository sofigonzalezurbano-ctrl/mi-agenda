'use strict';

/* ============ Constants ============ */
const JOBS = {
  donbosco: { label: 'Don Bosco', group: 'Teacher' },
  movita:   { label: 'Movita Juice Bar', group: '4 Eleven Media' },
  alas:     { label: 'Alas Kitchen', group: '4 Eleven Media' },
  casita:   { label: 'La Casita Mexicana', group: '4 Eleven Media' },
  foureleven: { label: 'All 3 restaurants', group: '4 Eleven Media' },
  online:   { label: 'Online Classes', group: 'Online Teacher' },
  personal: { label: 'Personal', group: 'Personal' },
};
const JOB_ORDER = ['donbosco', 'movita', 'alas', 'casita', 'foureleven', 'online', 'personal'];
const RESTAURANTS = ['movita', 'alas', 'casita'];
/** Jobs that belong to 4 Eleven Media: each restaurant plus tasks shared by all three. */
const FE_JOBS = [...RESTAURANTS, 'foureleven'];

const PRIORITIES = {
  high:   { label: 'High', rank: 0 },
  medium: { label: 'Medium', rank: 1 },
  low:    { label: 'Low', rank: 2 },
};

const INCIDENT_TYPES = ['Behavior', 'Academic', 'Missing homework', 'Tardiness / Absence', 'Health', 'Uniform', 'Conflict with peers', 'Other'];
const SEVERITIES = { minor: 'Minor', moderate: 'Moderate', serious: 'Serious' };

const EXPENSE_CATS = ['Food & groceries', 'Transport', 'Bills & services', 'Rent / Housing', 'Health', 'Personal care', 'Shopping', 'Education', 'Entertainment', 'Family', 'Phone & internet', 'Cashea', 'Debt payment', 'Other'];
const EXCHANGE_METHODS = ['Binance', 'Efectivo (cash)', 'Zelle', 'Pago Móvil', 'Transferencia', 'PayPal', 'Zinli', 'Other'];
const INCOME_CATS = ['Salary', 'Online classes', 'Freelance', 'Bonus', 'Other'];
const INCOME_SOURCES = { donbosco: 'Don Bosco', foureleven: '4 Eleven Media', online: 'Online Classes', other: 'Other' };
/** Currency each job pays in (used as the default when recording income). */
const SOURCE_CURRENCY = { donbosco: 'VES', foureleven: 'USD', online: 'VES', other: 'USD' };
const SOURCE_JOB_CLASS = { donbosco: 'j-donbosco', foureleven: 'j-movita', online: 'j-online', other: 'j-other' };
const CURRENCIES = { USD: 'USD ($)', VES: 'Bolívares (Bs)' };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ============ DOM / string utils ============ */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/* ============ Dates ============ */
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => toISO(new Date());
const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
/** Same day n months later, clamped to the month's last day (Jan 31 + 1 month = Feb 28/29). */
function addMonthsKeepDay(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1 + n, 1);
  t.setDate(Math.min(d, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return toISO(t);
}
const addMonths = (iso, n) => { const d = fromISO(iso); d.setDate(1); d.setMonth(d.getMonth() + n); return toISO(d); };
const weekday = (iso) => fromISO(iso).getDay();
/** Monday of the week containing iso */
const startOfWeek = (iso) => addDays(iso, -((weekday(iso) + 6) % 7));
const monthKey = (iso) => iso.slice(0, 7);

function fmtDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  if (!iso) return '';
  return fromISO(iso).toLocaleDateString('en-US', opts);
}
function fmtLongDate(iso) {
  return fmtDate(iso, { weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtMonth(iso) {
  return fmtDate(iso, { month: 'long', year: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return m ? `${h12}:${pad(m)}${suffix}` : `${h12}${suffix}`;
}
function relDay(iso) {
  const t = todayISO();
  if (iso === t) return 'Today';
  if (iso === addDays(t, 1)) return 'Tomorrow';
  if (iso === addDays(t, -1)) return 'Yesterday';
  return fmtDate(iso);
}

/* ============ Money ============ */
function money(n, cur = 'USD') {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString(cur === 'VES' ? 'es-VE' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-' : '') + (cur === 'VES' ? `Bs ${s}` : `$${s}`);
}

/* ============ Sorting ============ */
const prioRank = (p) => (PRIORITIES[p] || PRIORITIES.medium).rank;
function byPriority(a, b) {
  return prioRank(a.priority) - prioRank(b.priority)
    || (a.date || '9999').localeCompare(b.date || '9999')
    || (a.time || '99').localeCompare(b.time || '99');
}
function byTime(a, b) {
  return (a.time || '99:99').localeCompare(b.time || '99:99') || prioRank(a.priority) - prioRank(b.priority);
}

/* ============ Icons ============ */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .7 3.2 2.6 3.7 5.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M4 20h16"/>',
  upload: '<path d="M12 16V5m0 0-4 4m4-4 4 4M4 20h16"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2M7 6V5a2 2 0 0 1 2-2h8"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/>',
  laptop: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h5"/>',
  dollar: '<path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 1.8 2.6 4.5 3.2 4.5 1.5 4.5 3.3-2 3-4.5 3-4.5-1.3-4.5-3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  piggy: '<path d="M5 11a7 6 0 0 1 12-3h2v3l2 1v3h-2.5a7 6 0 0 1-2.5 2.5V20h-3v-2h-3v2H7v-3a6 6 0 0 1-2-6z"/><path d="M3 9.5c0 1.2.8 2 2 2"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  sparkle: '<path d="M12 3c.6 4.5 2 6.5 6.5 7.5-4.5 1-5.9 3-6.5 8-.6-5-2-7-6.5-8C10 9.5 11.4 7.5 12 3z"/>',
};
function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
