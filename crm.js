const CRM_KEY = 'northlight-crm';
const STAGES = ['Lead', 'Qualified', 'Quote', 'Won', 'Lost'];
const PRIORITIES = ['P1', 'P2', 'P3'];
const HOUR = 3600 * 1000;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// --- data (fake only) ---
function seed(now = Date.now()) {
  return {
    leads: [
      { id: uid(), name: 'Ivy Sample', company: 'Fjord Coffee Roasters', email: 'ivy@example.com', converted: false },
      { id: uid(), name: 'Omar Test', company: 'Harbour Bikes', email: 'omar@example.com', converted: false },
      { id: uid(), name: 'Nina Demo', company: 'Pine & Co Furniture', email: 'nina@example.com', converted: false },
    ],
    accounts: [], contacts: [], opportunities: [],
    cases: [{ id: uid(), accountId: null, subject: 'Logo files missing from handover', priority: 'P2', due: now + 4 * HOUR, closed: false }],
  };
}

// --- logic (pure: no DOM, so tests can run it) ---
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function addLead(db, { name, company, email }) {
  if (!name.trim()) throw new Error('Enter the lead\'s name.');
  if (!company.trim()) throw new Error('Enter the company.');
  if (!EMAIL.test(email.trim())) throw new Error('Enter an email like name@example.com.');
  const lead = { id: uid(), name: name.trim(), company: company.trim(), email: email.trim(), converted: false };
  db.leads.push(lead);
  return lead;
}

// Lead -> account + contact + opportunity. An existing account with the same company name is reused.
function convertLead(db, leadId) {
  const lead = db.leads.find((l) => l.id === leadId);
  if (!lead) throw new Error('No such lead.');
  if (lead.converted) throw new Error(`${lead.name} is already converted.`);
  let account = db.accounts.find((a) => a.name.toLowerCase() === lead.company.toLowerCase());
  if (!account) { account = { id: uid(), name: lead.company }; db.accounts.push(account); }
  const contact = { id: uid(), accountId: account.id, name: lead.name, email: lead.email };
  const opportunity = { id: uid(), accountId: account.id, name: `${lead.company} - new project`, stage: 'Qualified' };
  db.contacts.push(contact);
  db.opportunities.push(opportunity);
  lead.converted = true;
  lead.accountId = account.id;
  return { account, contact, opportunity };
}

function setStage(db, oppId, stage) {
  const o = db.opportunities.find((x) => x.id === oppId);
  if (!o) throw new Error('No such opportunity.');
  if (!STAGES.includes(stage)) throw new Error('Unknown stage.');
  o.stage = stage;
}

const stageCounts = (opps) => STAGES.map((s) => opps.filter((o) => o.stage === s).length);

function addCase(db, { subject, priority, due, accountId }) {
  if (!subject.trim()) throw new Error('Enter a subject for the case.');
  if (!PRIORITIES.includes(priority)) throw new Error('Choose a priority.');
  if (!Number.isFinite(due)) throw new Error('Choose a due date and time.');
  const c = { id: uid(), accountId: accountId || null, subject: subject.trim(), priority, due, closed: false };
  db.cases.push(c);
  return c;
}

const isOverdue = (c, now = Date.now()) => !c.closed && now > c.due;
const sortedCases = (cases) => [...cases].sort((a, b) => Number(a.closed) - Number(b.closed) || a.priority.localeCompare(b.priority) || a.due - b.due);

// Plain SVG bar chart as a string. Only constants and numbers go in, so it is safe to inject as HTML.
function chartSvg(counts) {
  const W = 500, H = 260, L = 40, R = 10, T = 20, B = 40;
  const pw = W - L - R, ph = H - T - B;
  const max = Math.max(...counts, 1), step = Math.ceil(max / 5), top = step * Math.ceil(max / step);
  const r = (n) => Math.round(n * 10) / 10;
  const colors = ['#8fa3bf', '#3b6fd4', '#7a4fd0', '#2e7d32', '#b3261e'];
  const label = STAGES.map((s, i) => `${s} ${counts[i]}`).join(', ');
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Opportunities by stage: ${label}" style="width:100%;height:auto;max-width:520px" font-family="system-ui, sans-serif" font-size="12" fill="#14202e">`;
  for (let v = 0; v <= top; v += step) {
    const y = r(T + ph - (v / top) * ph);
    s += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#d8dfe8"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${v}</text>`;
  }
  const slot = pw / STAGES.length, bw = slot * 0.64;
  STAGES.forEach((stage, i) => {
    const h = (counts[i] / top) * ph, x = L + i * slot + (slot - bw) / 2, y = T + ph - h;
    s += `<rect x="${r(x)}" y="${r(y)}" width="${r(bw)}" height="${r(h)}" fill="${colors[i]}"/>`;
    s += `<text x="${r(x + bw / 2)}" y="${r(y - 5)}" text-anchor="middle" font-weight="700">${counts[i]}</text>`;
    s += `<text x="${r(x + bw / 2)}" y="${H - B + 18}" text-anchor="middle">${stage}</text>`;
  });
  return s + '</svg>';
}

// Set by automation.js when the website form created the CRM data before this page ever ran.
const CRM_SEED_PENDING_KEY = 'northlight-crm-needs-seed';

// Returns the saved CRM data, or null when there is none (the page then seeds).
function loadCrm(storage) {
  let s = null;
  try {
    const v = JSON.parse(storage.getItem(CRM_KEY));
    if (v && ['leads', 'accounts', 'contacts', 'opportunities', 'cases'].every((k) => Array.isArray(v[k]))) s = v;
  } catch (e) { /* missing or corrupt: reseed */ }
  if (s && storage.getItem(CRM_SEED_PENDING_KEY) !== null) { // add the sample leads and case once, after the website's leads
    const sample = seed();
    s = { ...s, leads: [...s.leads, ...sample.leads], cases: [...s.cases, ...sample.cases] };
    try { storage.setItem(CRM_KEY, JSON.stringify(s)); storage.removeItem(CRM_SEED_PENDING_KEY); } catch (e) { /* keep the marker so it retries */ }
  }
  return s;
}

// --- page ---
if (typeof document !== 'undefined') {
  const $ = (id) => document.getElementById(id);
  let db;

  const load = () => loadCrm(localStorage);
  const save = () => { try { localStorage.setItem(CRM_KEY, JSON.stringify(db)); } catch (e) { say('Could not save: browser storage is blocked.'); } };
  const say = (t) => { $('msg').textContent = t; };
  const accountName = (id) => (db.accounts.find((a) => a.id === id) || {}).name || '-';

  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text; // textContent: typed text is never parsed as HTML
    if (cls) e.className = cls;
    return e;
  }
  function fill(tbodyId, rows) {
    const body = $(tbodyId);
    body.replaceChildren();
    for (const cells of rows) {
      const tr = document.createElement('tr');
      for (const c of cells) { const td = document.createElement('td'); td.append(c); tr.append(td); }
      body.append(tr);
    }
  }
  const act = (fn, ok) => { try { fn(); save(); if (ok) say(ok); } catch (e) { say(e.message); } render(); };

  function render() {
    fill('leads', db.leads.map((l) => {
      const b = el('button', l.converted ? 'Converted' : 'Convert');
      b.type = 'button';
      b.disabled = l.converted;
      b.addEventListener('click', () => act(() => convertLead(db, l.id), `Converted ${l.name}: account, contact and opportunity created.`));
      return [l.name, l.company, l.email, b];
    }));
    fill('accounts', db.accounts.map((a) => [a.name,
      db.contacts.filter((c) => c.accountId === a.id).map((c) => c.name).join(', ') || '-',
      String(db.opportunities.filter((o) => o.accountId === a.id).length)]));
    fill('contacts', db.contacts.map((c) => [c.name, c.email, accountName(c.accountId)]));
    fill('opps', db.opportunities.map((o) => {
      const sel = el('select');
      sel.setAttribute('aria-label', 'Stage of ' + o.name);
      for (const s of STAGES) { const op = el('option', s); op.selected = s === o.stage; sel.append(op); }
      sel.addEventListener('change', () => act(() => setStage(db, o.id, sel.value)));
      return [o.name, accountName(o.accountId), sel];
    }));
    $('chart').innerHTML = chartSvg(stageCounts(db.opportunities));
    fill('cases', sortedCases(db.cases).map((c) => {
      const b = el('button', c.closed ? 'Closed' : 'Close');
      b.type = 'button';
      b.disabled = c.closed;
      b.addEventListener('click', () => act(() => { c.closed = true; }));
      const due = el('span', new Date(c.due).toLocaleString());
      if (isOverdue(c)) due.append(el('span', 'Overdue', 'overdue'));
      return [c.subject, accountName(c.accountId), c.priority, due, b];
    }));
    const sel = $('c-account');
    const keep = sel.value;
    sel.replaceChildren(new Option('(none)', ''), ...db.accounts.map((a) => new Option(a.name, a.id)));
    sel.value = db.accounts.some((a) => a.id === keep) ? keep : '';
  }

  $('lead-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    act(() => { addLead(db, { name: f.elements.name.value, company: f.elements.company.value, email: f.elements.email.value }); f.reset(); }, 'Lead added.');
  });
  $('case-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    act(() => {
      addCase(db, { subject: f.subject.value, priority: f.priority.value, due: new Date(f.due.value).getTime(), accountId: f.account.value });
      f.reset();
    }, 'Case added.');
  });
  $('reset').addEventListener('click', () => {
    try { localStorage.removeItem(CRM_SEED_PENDING_KEY); } catch (e) { /* ignore */ } // a reset already includes the samples
    db = seed(); save(); say('Demo data reset.'); render();
  });
  window.addEventListener('storage', (e) => { if (e.key === CRM_KEY) { db = load() || db; render(); } });
  setInterval(() => { if (!document.activeElement.closest('table')) render(); }, 60 * 1000); // refresh Overdue labels

  db = load() || seed();
  save();
  render();
} else {
  module.exports = { seed, addLead, convertLead, setStage, stageCounts, addCase, isOverdue, sortedCases, chartSvg, loadCrm, STAGES, CRM_KEY, CRM_SEED_PENDING_KEY };
}
