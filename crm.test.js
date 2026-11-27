// Run: node crm.test.js (fake data only)
const assert = require('assert');
const fs = require('fs');
const c = require('./crm.js');
const H = 3600000;

// Seed: three leads, one open case, nothing else
const db = c.seed(1000);
assert.equal(db.leads.length, 3);
assert.equal(db.cases.length, 1);
assert.deepEqual([db.accounts.length, db.contacts.length, db.opportunities.length], [0, 0, 0]);
assert.equal(db.cases[0].due, 1000 + 4 * H);

// Convert: lead -> account + contact + opportunity, linked, lead marked converted
const lead = db.leads[0];
const { account, contact, opportunity } = c.convertLead(db, lead.id);
assert.deepEqual([db.accounts.length, db.contacts.length, db.opportunities.length], [1, 1, 1]);
assert.equal(account.name, lead.company);
assert.equal(contact.accountId, account.id);
assert.equal(opportunity.accountId, account.id);
assert.equal(opportunity.stage, 'Qualified');
assert.equal(contact.email, lead.email);
assert.ok(lead.converted);
assert.throws(() => c.convertLead(db, lead.id), /already converted/);
assert.throws(() => c.convertLead(db, 'nope'), /No such lead/);
assert.equal(db.accounts.length, 1, 'failed converts create nothing');

// A second lead from the same company reuses the account
const l2 = c.addLead(db, { name: 'Second Person', company: ' fjord coffee roasters ', email: 'second@example.com' });
c.convertLead(db, l2.id);
assert.equal(db.accounts.length, 1);
assert.equal(db.contacts.length, 2);
assert.equal(db.opportunities.length, 2);

// Lead validation
assert.throws(() => c.addLead(db, { name: ' ', company: 'X', email: 'a@b.co' }), /name/);
assert.throws(() => c.addLead(db, { name: 'A', company: '', email: 'a@b.co' }), /company/);
assert.throws(() => c.addLead(db, { name: 'A', company: 'X', email: 'nope' }), /email/);

// Stages and counts
assert.deepEqual(c.STAGES, ['Lead', 'Qualified', 'Quote', 'Won', 'Lost']);
assert.deepEqual(c.stageCounts(db.opportunities), [0, 2, 0, 0, 0]);
c.setStage(db, opportunity.id, 'Won');
assert.deepEqual(c.stageCounts(db.opportunities), [0, 1, 0, 1, 0]);
assert.throws(() => c.setStage(db, opportunity.id, 'Maybe'), /Unknown stage/);
assert.throws(() => c.setStage(db, 'nope', 'Won'), /No such opportunity/);

// Cases: validation, overdue, sorting
assert.throws(() => c.addCase(db, { subject: '', priority: 'P1', due: 1 }), /subject/);
assert.throws(() => c.addCase(db, { subject: 'x', priority: 'P9', due: 1 }), /priority/);
assert.throws(() => c.addCase(db, { subject: 'x', priority: 'P1', due: NaN }), /due/);
const urgent = c.addCase(db, { subject: 'Server down', priority: 'P1', due: 500, accountId: account.id });
assert.ok(c.isOverdue(urgent, 501) && !c.isOverdue(urgent, 500), 'overdue only after the due time');
urgent.closed = true;
assert.ok(!c.isOverdue(urgent, 99999), 'closed is never overdue');
urgent.closed = false;
assert.equal(c.sortedCases(db.cases)[0].subject, 'Server down', 'P1 first');
urgent.closed = true;
assert.equal(c.sortedCases(db.cases).at(-1).subject, 'Server down', 'closed cases last');

// Chart: one bar per stage, heights proportional, stage labels and counts present
const svg = c.chartSvg([0, 2, 0, 1, 0]);
assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
assert.equal((svg.match(/<rect /g) || []).length, 5);
for (const s of c.STAGES) assert.ok(svg.includes(`>${s}</text>`), s);
assert.ok(svg.includes('Opportunities by stage: Lead 0, Qualified 2, Quote 0, Won 1, Lost 0'));
const heights = [...svg.matchAll(/<rect [^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]));
assert.equal(heights[1], heights[3] * 2, 'a bar for 2 is twice as tall as a bar for 1');
assert.equal(heights[0], 0);
assert.ok(c.chartSvg([0, 0, 0, 0, 0]).includes('<rect'), 'empty chart still draws');
assert.ok(!/NaN|Infinity/.test(c.chartSvg([0, 0, 0, 0, 0])), 'empty chart has no NaN');
assert.ok(!/NaN|Infinity/.test(c.chartSvg([30, 1, 0, 7, 2])), 'larger counts have no NaN');

// Page wiring: every id crm.js uses exists in crm.html; index links to it
const html = fs.readFileSync(__dirname + '/crm.html', 'utf8');
const js = fs.readFileSync(__dirname + '/crm.js', 'utf8');
const used = new Set([...js.matchAll(/\$\('([\w-]+)'\)/g)].map((m) => m[1]).concat([...js.matchAll(/fill\('([\w-]+)'/g)].map((m) => m[1])));
for (const id of used) assert.ok(html.includes(`id="${id}"`), `missing id ${id}`);
assert.ok(fs.readFileSync(__dirname + '/index.html', 'utf8').includes('href="crm.html"'), 'index.html links to crm.html');

console.log('all tests passed');
