const KEY = 'northlight-helpdesk-tickets';
const HOUR = 3600 * 1000;
const TARGET_HOURS = { P1: 1, P2: 4, P3: 24 };
const STATUSES = ['New', 'In progress', 'Resolved'];
const LEVELS = { 1: 'Low', 2: 'Medium', 3: 'High' };

// Impact + urgency (2..6): 5-6 = P1, 3-4 = P2, 2 = P3.
function priorityOf(impact, urgency) {
  const s = impact + urgency;
  return s >= 5 ? 'P1' : s >= 3 ? 'P2' : 'P3';
}

function isOverdue(t, now = Date.now()) {
  return t.status !== 'Resolved' && now > t.created + TARGET_HOURS[t.priority] * HOUR;
}

function makeTicket(requester, issue, impact, urgency, created = Date.now(), status = 'New') {
  return { id: created + Math.random(), requester, issue, impact, urgency, priority: priorityOf(impact, urgency), status, created };
}

// Fake data, created relative to now so some are overdue.
function seed() {
  const now = Date.now();
  return [
    makeTicket('Alice Example', 'Cannot log in to the design file server', 3, 3, now - 2 * HOUR),
    makeTicket('Bob Sample', 'Printer on floor 2 jams on A3 paper', 2, 2, now - 1 * HOUR, 'In progress'),
    makeTicket('Carol Test', 'Request a second monitor', 1, 1, now - 3 * HOUR),
    makeTicket('Dan Demo', 'Font licence expired on three laptops', 2, 3, now - 6 * HOUR, 'In progress'),
    makeTicket('Eve Placeholder', 'Wi-Fi slow in meeting room', 1, 2, now - 30 * HOUR, 'Resolved'),
  ];
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) { /* corrupt or unavailable storage: fall back to seed */ }
  return seed();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(tickets)); } catch (e) { /* storage full or blocked */ }
}

function sorted(list) {
  return [...list].sort((a, b) => a.priority.localeCompare(b.priority) || a.created - b.created);
}

if (typeof document !== 'undefined') {
  var tickets = load();
  const listEl = document.getElementById('tickets');

  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text; // textContent: user input is never parsed as HTML
    if (cls) e.className = cls;
    return e;
  }

  function render() {
    listEl.replaceChildren();
    for (const t of sorted(tickets)) {
      const li = el('li', undefined, t.priority + ' ' + t.status);
      const head = el('div');
      head.append(el('span', t.priority, 'badge'), el('strong', t.issue));
      if (isOverdue(t)) head.append(el('span', 'Overdue', 'overdue'));
      const due = new Date(t.created + TARGET_HOURS[t.priority] * HOUR);
      li.append(
        head,
        el('div', `${t.requester} · impact ${LEVELS[t.impact]}, urgency ${LEVELS[t.urgency]} · respond by ${due.toLocaleString()}`, 'meta')
      );
      const sel = el('select');
      sel.setAttribute('aria-label', 'Status');
      for (const s of STATUSES) {
        const o = el('option', s);
        o.selected = s === t.status;
        sel.append(o);
      }
      sel.addEventListener('change', () => { t.status = sel.value; save(); render(); });
      li.append(sel);
      listEl.append(li);
    }
  }

  document.getElementById('ticket-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    tickets.push(makeTicket(f.requester.value.trim(), f.issue.value.trim(), +f.impact.value, +f.urgency.value));
    save();
    render();
    f.reset();
  });

  render();
  setInterval(render, 60 * 1000); // refresh Overdue labels
} else {
  module.exports = { priorityOf, isOverdue, makeTicket, sorted };
}
