// Run: node automation.test.js (fake data only)
const assert = require('assert');
const fs = require('fs');
const a = require('./automation.js');
const helpdesk = require('./helpdesk.js');

const fake = () => { // minimal localStorage stand-in
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), has: (k) => m.has(k), json: (k) => JSON.parse(m.get(k)) };
};
const rulesFile = JSON.parse(fs.readFileSync(__dirname + '/rules.json', 'utf8'));
const rules = a.validateRules(rulesFile);
const normal = { name: 'Ann Fake', email: 'ann@example.com', message: 'Hello, we would like a new logo.' };
const urgent = { name: 'Bo Fake', email: 'bo@example.com', message: 'URGENT: our site is down before a launch!' };

// containsWord: whole word, any case, Unicode-aware
assert.ok(a.containsWord('This is urgent', 'urgent'));
assert.ok(a.containsWord('URGENT!', 'urgent'));
assert.ok(a.containsWord('(urgent)', 'urgent'));
assert.ok(!a.containsWord('urgently needed', 'urgent'));
assert.ok(!a.containsWord('nonurgent', 'urgent'));
assert.ok(!a.containsWord('', 'urgent'));
assert.ok(a.containsWord('je to naléhavé', 'naléhavé'));
assert.ok(!a.containsWord('a+b', 'a.b'), 'regex characters in a rule are literal');

// Normal enquiry: a lead and a P3 ticket, no alert, and a log line for every rule
const s1 = fake();
const r1 = a.runRules(rules, 'form_sent', normal, s1, 5000);
assert.equal(s1.json(a.KEYS.crm).leads.length, 1);
assert.equal(s1.json(a.KEYS.crm).leads[0].email, 'ann@example.com');
const t1 = s1.json(a.KEYS.tickets);
assert.equal(t1.length, 1);
assert.equal(t1[0].priority, 'P3');
assert.equal(t1[0].requester, 'Ann Fake (ann@example.com)');
assert.ok(!s1.has(a.KEYS.outbox), 'no alert for a normal enquiry');
assert.deepEqual(r1.lines.map((l) => `${l.rule}:${l.outcome}`),
  ['form_sent:EVENT', 'create-lead:RAN', 'create-ticket:RAN', 'urgent-p1:SKIPPED', 'urgent-alert:SKIPPED']);
assert.deepEqual(s1.json(a.KEYS.log).map((l) => l.outcome), ['EVENT', 'RAN', 'RAN', 'SKIPPED', 'SKIPPED']);
assert.ok(new Set(r1.lines.map((l) => l.run)).size === 1, 'one run code per enquiry');

// Ticket matches helpdesk's shape and its priority formula
assert.deepEqual(Object.keys(t1[0]).sort(), ['created', 'id', 'impact', 'issue', 'priority', 'replies', 'requester', 'status', 'urgency']);
assert.equal(t1[0].priority, helpdesk.priorityOf(t1[0].impact, t1[0].urgency));

// Urgent enquiry: P1 (consistent with the helpdesk formula) and one alert in the outbox
const s2 = fake();
const r2 = a.runRules(rules, 'form_sent', urgent, s2, 6000);
const t2 = s2.json(a.KEYS.tickets)[0];
assert.equal(t2.priority, 'P1');
assert.equal(helpdesk.priorityOf(t2.impact, t2.urgency), 'P1');
const box = s2.json(a.KEYS.outbox);
assert.equal(box.length, 1);
assert.equal(box[0].to, 'duty-manager@example.com');
assert.equal(box[0].subject, 'URGENT enquiry from Bo Fake');
assert.match(box[0].body, /bo@example\.com.*ticket priority P1/);
assert.equal(box[0].status, 'Not sent (demo)');
assert.deepEqual(r2.lines.map((l) => l.outcome), ['EVENT', 'RAN', 'RAN', 'RAN', 'RAN']);
assert.equal(r2.ticket.priority, 'P1');

// Existing data is kept and appended to
const s3 = fake();
s3.setItem(a.KEYS.tickets, JSON.stringify([{ id: 1, priority: 'P2' }]));
s3.setItem(a.KEYS.crm, JSON.stringify({ leads: [{ id: 'x' }], accounts: [{ id: 'acc' }], contacts: [], opportunities: [], cases: [] }));
a.runRules(rules, 'form_sent', normal, s3, 7000);
assert.equal(s3.json(a.KEYS.tickets).length, 2);
assert.equal(s3.json(a.KEYS.crm).leads.length, 2);
assert.equal(s3.json(a.KEYS.crm).accounts.length, 1);
a.runRules(rules, 'form_sent', normal, s3, 8000);
assert.equal(s3.json(a.KEYS.log).length, 10, 'log keeps growing across runs');

// Corrupt storage does not crash a run
const s4 = fake();
s4.setItem(a.KEYS.tickets, '{{not json');
s4.setItem(a.KEYS.crm, '"a string"');
a.runRules(rules, 'form_sent', normal, s4, 1);
assert.equal(s4.json(a.KEYS.tickets).length, 1);

// Edit one rule (what you do by hand): change the trigger word and the behaviour changes
const edited = JSON.parse(JSON.stringify(rulesFile));
for (const r of edited.rules) if (r.if) r.if.contains = 'asap';
const editedRules = a.validateRules(edited);
const s5 = fake();
a.runRules(editedRules, 'form_sent', urgent, s5, 1);
assert.equal(s5.json(a.KEYS.tickets)[0].priority, 'P3', '"urgent" no longer triggers');
const s6 = fake();
a.runRules(editedRules, 'form_sent', { ...normal, message: 'We need this ASAP please' }, s6, 1);
assert.equal(s6.json(a.KEYS.tickets)[0].priority, 'P1');
assert.equal(s6.json(a.KEYS.outbox).length, 1);

// Rule that cannot run logs an ERROR and the others still run
const misordered = a.validateRules({ rules: [rulesFile.rules[2], rulesFile.rules[0]] });
const s7 = fake();
const r7 = a.runRules(misordered, 'form_sent', urgent, s7, 1);
assert.deepEqual(r7.lines.map((l) => l.outcome), ['EVENT', 'ERROR', 'RAN']);
assert.match(r7.lines[1].detail, /create_ticket/);
assert.equal(s7.json(a.KEYS.crm).leads.length, 1);

// Rules for another event are ignored; a rules list with only a ticket does not touch the CRM
const s8 = fake();
const r8 = a.runRules(a.validateRules({ rules: [{ id: 't', when: 'form_sent', action: 'create_ticket' }, { id: 'o', when: 'other', action: 'create_lead' }] }), 'form_sent', normal, s8, 1);
assert.equal(r8.lines.length, 2);
assert.ok(!s8.has(a.KEYS.crm));

// Blocked storage surfaces as an error instead of a false success
assert.throws(() => a.runRules(rules, 'form_sent', normal, { getItem: () => null, setItem: () => { throw new Error('blocked'); } }, 1), /blocked/);

// Log is capped
const s9 = fake();
for (let i = 0; i < 130; i++) a.runRules(rules, 'form_sent', normal, s9, i);
assert.equal(s9.json(a.KEYS.log).length, 500);

// Message with HTML stays plain text data (rendering uses textContent)
const s10 = fake();
a.runRules(rules, 'form_sent', { ...urgent, message: 'urgent <img src=x onerror=alert(1)>' }, s10, 1);
assert.ok(s10.json(a.KEYS.outbox)[0].body.includes('<img src=x onerror=alert(1)>'));

// validateRules: clear messages for hand-edit mistakes
const bad = (rule) => a.validateRules({ rules: [rule] });
assert.throws(() => a.validateRules(null), /"rules" list/);
assert.throws(() => a.validateRules({}), /"rules" list/);
assert.throws(() => bad({ when: 'form_sent', action: 'create_lead' }), /needs an "id"/);
assert.throws(() => bad({ id: 'x', action: 'create_lead' }), /"when"/);
assert.throws(() => bad({ id: 'x', when: 'form_sent', action: 'send_email' }), /unknown action "send_email"/);
assert.throws(() => bad({ id: 'x', when: 'form_sent', action: 'create_lead', if: { field: 'phone', contains: 'a' } }), /"field"/);
assert.throws(() => bad({ id: 'x', when: 'form_sent', action: 'create_lead', if: null }), /"field"/);
assert.throws(() => bad({ id: 'x', when: 'form_sent', action: 'set_ticket_priority', priority: 'P9' }), /P1, P2 or P3/);
assert.throws(() => bad({ id: 'x', when: 'form_sent', action: 'add_outbox' }), /"to" and "subject"/);
assert.throws(() => a.validateRules({ rules: [rulesFile.rules[0], rulesFile.rules[0]] }), /used twice/);

// Pages: ids used by automation.js exist in automation.html; index loads the engine before the form script and links the page
const page = fs.readFileSync(__dirname + '/automation.html', 'utf8');
const js = fs.readFileSync(__dirname + '/automation.js', 'utf8');
for (const id of new Set([...js.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]).concat([...js.matchAll(/fillTable\('([\w-]+)'/g)].map((m) => m[1])))) {
  assert.ok(page.includes(`id="${id}"`), `missing id ${id}`);
}
assert.ok(page.includes('id="automation-page"'));
const index = fs.readFileSync(__dirname + '/index.html', 'utf8');
assert.ok(index.indexOf('src="automation.js"') > 0 && index.indexOf('src="automation.js"') < index.indexOf('src="contact.js"'));
assert.ok(index.includes('href="automation.html"'));

console.log('all tests passed');
