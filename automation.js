// Rule engine for the website form. Rules are data in rules.json. NOTHING IS REALLY SENT: the "outbox" is only a list.
const KEYS = {
  tickets: 'northlight-helpdesk-tickets', // same keys the helpdesk and CRM pages read
  crm: 'northlight-crm',
  outbox: 'northlight-outbox',
  log: 'northlight-automation-log',
};
const ACTIONS = ['create_lead', 'create_ticket', 'set_ticket_priority', 'add_outbox'];
const FIELDS = ['name', 'email', 'message'];
const SCORES = { P1: 3, P2: 2, P3: 1 }; // impact and urgency that give each priority in the helpdesk
const LOG_LIMIT = 500; // shortcut: keeps only the newest 500 lines, move to a real store if more history matters
const uid = () => Math.random().toString(36).slice(2, 8);

// Throws a clear message for the mistakes a hand edit of rules.json is likely to make.
function validateRules(data) {
  if (!data || !Array.isArray(data.rules)) throw new Error('rules.json must contain a "rules" list.');
  const seen = new Set();
  data.rules.forEach((r, i) => {
    const where = `Rule ${i + 1}${r && r.id ? ` (${r.id})` : ''}`;
    if (!r || typeof r.id !== 'string' || !r.id) throw new Error(`${where}: needs an "id".`);
    if (seen.has(r.id)) throw new Error(`${where}: the id is used twice.`);
    seen.add(r.id);
    if (typeof r.when !== 'string' || !r.when) throw new Error(`${where}: needs a "when" (for example "form_sent").`);
    if (!ACTIONS.includes(r.action)) throw new Error(`${where}: unknown action "${r.action}". Use one of: ${ACTIONS.join(', ')}.`);
    if ('if' in r) {
      const c = r.if;
      if (!c || !FIELDS.includes(c.field) || typeof c.contains !== 'string' || !c.contains) {
        throw new Error(`${where}: "if" needs a "field" (${FIELDS.join(', ')}) and a "contains" word.`);
      }
    }
    if (r.action === 'set_ticket_priority' && !SCORES[r.priority]) throw new Error(`${where}: "priority" must be P1, P2 or P3.`);
    if (r.action === 'add_outbox' && (typeof r.to !== 'string' || typeof r.subject !== 'string')) throw new Error(`${where}: add_outbox needs "to" and "subject".`);
  });
  return data.rules;
}

// Whole word, any case, Unicode-aware: "URGENT!" matches "urgent", "urgently" does not.
function containsWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu').test(text);
}

const fill = (template, vars) => template.replace(/\{(name|email|message|priority)\}/g, (_, k) => vars[k] ?? '');

function readJson(storage, key, fallback, valid) {
  try { const v = JSON.parse(storage.getItem(key)); if (valid(v)) return v; } catch (e) { /* missing or corrupt: use the fallback */ }
  return fallback();
}
const emptyCrm = () => ({ leads: [], accounts: [], contacts: [], opportunities: [], cases: [] });
const isCrm = (v) => v && ['leads', 'accounts', 'contacts', 'opportunities', 'cases'].every((k) => Array.isArray(v[k]));

const ACTION_FUNCTIONS = {
  create_lead(rule, ctx, state) {
    ctx.lead = { id: uid() + Date.now().toString(36), name: ctx.name, company: '(not given)', email: ctx.email, converted: false, source: 'website' };
    state.crm.leads.push(ctx.lead);
    state.dirty.add('crm');
    return `lead created for ${ctx.name} (${ctx.email})`;
  },
  create_ticket(rule, ctx, state, now) {
    ctx.ticket = {
      id: now + Math.random(), requester: `${ctx.name} (${ctx.email})`, issue: 'Website enquiry: ' + ctx.message,
      impact: 1, urgency: 1, priority: 'P3', status: 'New', created: now, replies: [],
    };
    state.tickets.push(ctx.ticket);
    state.dirty.add('tickets');
    return 'ticket created with priority P3';
  },
  set_ticket_priority(rule, ctx, state) {
    if (!ctx.ticket) throw new Error('there is no ticket yet. Put the create_ticket rule before this one.');
    ctx.ticket.priority = rule.priority;
    ctx.ticket.impact = ctx.ticket.urgency = SCORES[rule.priority];
    state.dirty.add('tickets');
    return `ticket priority set to ${rule.priority}`;
  },
  add_outbox(rule, ctx, state, now) {
    const vars = { name: ctx.name, email: ctx.email, message: ctx.message, priority: ctx.ticket ? ctx.ticket.priority : '' };
    const item = { id: uid(), time: now, to: rule.to, subject: fill(rule.subject, vars), body: fill(rule.body || '{message}', vars), status: 'Not sent (demo)' };
    state.outbox.push(item);
    state.dirty.add('outbox');
    return `alert queued for ${item.to}: "${item.subject}" (nothing is really sent)`;
  },
};

// Runs every rule for an event, logs one line per rule, then saves. Returns { ticket, lead, lines }.
function runRules(rules, event, data, storage, now = Date.now()) {
  const state = {
    tickets: readJson(storage, KEYS.tickets, () => [], Array.isArray),
    crm: readJson(storage, KEYS.crm, emptyCrm, isCrm),
    outbox: readJson(storage, KEYS.outbox, () => [], Array.isArray),
    log: readJson(storage, KEYS.log, () => [], Array.isArray),
    dirty: new Set(),
  };
  const ctx = { name: String(data.name ?? '').trim(), email: String(data.email ?? '').trim(), message: String(data.message ?? '').trim(), lead: null, ticket: null };
  const run = uid();
  const lines = [];
  const note = (rule, outcome, detail) => lines.push({ time: now, run, rule, outcome, detail });

  note(event, 'EVENT', `${event} from ${ctx.name} (${ctx.email})`);
  for (const rule of rules) {
    if (rule.when !== event) continue;
    if (rule.if && !containsWord(ctx[rule.if.field], rule.if.contains)) {
      note(rule.id, 'SKIPPED', `condition not met: ${rule.if.field} does not contain the word "${rule.if.contains}"`);
      continue;
    }
    try { note(rule.id, 'RAN', ACTION_FUNCTIONS[rule.action](rule, ctx, state, now)); } catch (e) { note(rule.id, 'ERROR', e.message); }
  }

  // shortcut: no rollback if storage fills up halfway through saving; fine for a learning demo
  const save = (key, value) => storage.setItem(key, JSON.stringify(value));
  if (state.dirty.has('tickets')) save(KEYS.tickets, state.tickets);
  if (state.dirty.has('crm')) save(KEYS.crm, state.crm);
  if (state.dirty.has('outbox')) save(KEYS.outbox, state.outbox);
  save(KEYS.log, [...state.log, ...lines].slice(-LOG_LIMIT));
  return { ticket: ctx.ticket, lead: ctx.lead, lines };
}

// Browser only: fetch cache is off so an edit to rules.json applies on the next send.
async function loadRules() {
  let res;
  try { res = await fetch('rules.json', { cache: 'no-store' }); } catch (e) {
    throw new Error('Could not load rules.json. Open the site over http(s), not as a file.');
  }
  if (!res.ok) throw new Error(`Could not load rules.json (HTTP ${res.status}).`);
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('rules.json is not valid JSON: ' + e.message); }
  return validateRules(data);
}

// --- automation.html (outbox, log, rules) ---
if (typeof document !== 'undefined' && document.getElementById('automation-page')) {
  const $ = (id) => document.getElementById(id);
  const read = (key) => readJson(localStorage, key, () => [], Array.isArray);

  function fillTable(id, rows, emptyText, cols) {
    const body = $(id);
    body.replaceChildren();
    if (!rows.length) {
      const td = document.createElement('td');
      td.colSpan = cols;
      td.textContent = emptyText;
      const tr = document.createElement('tr');
      tr.append(td);
      body.append(tr);
    }
    for (const cells of rows) {
      const tr = document.createElement('tr');
      for (const c of cells) { const td = document.createElement('td'); td.textContent = c.text; if (c.cls) td.className = c.cls; tr.append(td); }
      body.append(tr);
    }
  }
  const when = (t) => ({ text: new Date(t).toLocaleString() });

  function render() {
    fillTable('outbox', read(KEYS.outbox).reverse().map((m) => [when(m.time), { text: m.to }, { text: m.subject }, { text: m.body }, { text: m.status }]),
      'The outbox is empty. Send an enquiry with the word "urgent" from the home page.', 5);
    fillTable('log', read(KEYS.log).reverse().map((l) => [when(l.time), { text: l.run }, { text: l.rule }, { text: l.outcome, cls: l.outcome }, { text: l.detail }]),
      'No rules have run yet. Send an enquiry from the home page.', 5);
  }

  $('clear').addEventListener('click', () => {
    try { localStorage.removeItem(KEYS.outbox); localStorage.removeItem(KEYS.log); } catch (e) { /* storage blocked */ }
    render();
  });
  // Everything the daily summary needs, as one file. Saved by the browser; nothing is uploaded.
  $('export-snapshot').addEventListener('click', () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      tickets: read(KEYS.tickets),
      crm: readJson(localStorage, KEYS.crm, emptyCrm, isCrm),
      outbox: read(KEYS.outbox),
      log: read(KEYS.log),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snapshot.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  window.addEventListener('storage', render);
  render();

  loadRules().then((rules) => {
    $('rules').replaceChildren(...rules.map((r) => {
      const li = document.createElement('li');
      li.textContent = `${r.id}: ${r.description || `${r.action} when ${r.when}`}`;
      return li;
    }));
  }).catch((e) => { $('rules-error').textContent = e.message; $('rules-error').hidden = false; });
}

if (typeof module !== 'undefined') module.exports = { validateRules, containsWord, runRules, fill, KEYS, ACTIONS };
