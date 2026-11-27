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

// Milliseconds past the response target, or 0 if not overdue.
function overdueBy(t, now = Date.now()) {
  return isOverdue(t, now) ? now - (t.created + TARGET_HOURS[t.priority] * HOUR) : 0;
}

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm';
}

function addReply(t, author, text, time = Date.now()) {
  (t.replies = t.replies || []).push({ author, text, time }); // old saved tickets have no replies yet
}

function makeTicket(requester, issue, impact, urgency, created = Date.now(), status = 'New') {
  return { id: created + Math.random(), requester, issue, impact, urgency, priority: priorityOf(impact, urgency), status, created, replies: [] };
}

// Fake data, created relative to now so some are overdue.
function seed() {
  const now = Date.now();
  // Rubric: P1 many people/money/security at risk now; P2 one person blocked or a deadline; P3 annoying, work continues.
  const tix = [
    makeTicket('Studio director', "I can't open my email and my client meeting starts in 30 minutes.", 2, 2, now - 5 * 60000),
    makeTicket('Designer', 'The second-floor printer prints blank pages.', 1, 1, now - 2 * HOUR),
    makeTicket('HR', 'New starter Maya begins Monday. She needs a laptop and accounts.', 1, 2, now - 1 * HOUR),
    makeTicket('Finance', 'Three of us got an invoice email with an attachment. One person opened it.', 3, 3, now - 2 * HOUR),
    makeTicket('Account manager', 'Wi-Fi is slow in the meeting room.', 1, 1, now - 3 * HOUR),
  ];
  addReply(tix[3], 'Support', 'Isolating the affected laptop and checking the attachment.', now - 20 * 60000);
  return tix;
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

  function replyHistory(t) {
    const box = el('div', undefined, 'replies');
    box.append(el('strong', 'Replies (' + (t.replies || []).length + ')'));
    const ul = el('ul');
    for (const r of t.replies || []) {
      ul.append(el('li', r.author + ' · ' + new Date(r.time).toLocaleString() + ': ' + r.text));
    }
    const f = el('form', undefined, 'reply-form');
    const who = el('input'); who.placeholder = 'Name'; who.required = true; who.maxLength = 60;
    const txt = el('input'); txt.placeholder = 'Reply'; txt.required = true; txt.maxLength = 300;
    f.append(who, txt, el('button', 'Reply'));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      addReply(t, who.value.trim(), txt.value.trim());
      save();
      render();
    });
    box.append(ul, f);
    return box;
  }

  function render() {
    listEl.replaceChildren();
    for (const t of sorted(tickets)) {
      const li = el('li', undefined, t.priority + ' ' + t.status);
      const head = el('div');
      head.append(el('span', t.priority, 'badge'), el('strong', t.issue));
      if (isOverdue(t)) head.append(el('span', 'Overdue ' + fmtDuration(overdueBy(t)), 'overdue'));
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
      li.append(sel, replyHistory(t));
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
  // Refresh Overdue labels, but not while someone is typing in the list.
  setInterval(() => { if (!listEl.contains(document.activeElement)) render(); }, 60 * 1000);

  document.getElementById('export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(tickets, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'helpdesk-tickets.json';
    a.click();
    URL.revokeObjectURL(url);
  });
} else {
  module.exports = { priorityOf, isOverdue, overdueBy, fmtDuration, addReply, makeTicket, sorted };
}
