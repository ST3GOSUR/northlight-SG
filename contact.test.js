// Run: node contact.test.js (fake data only)
const assert = require('assert');
const fs = require('fs');
const c = require('./contact.js');

// Validation messages
assert.deepEqual(c.validate({ name: 'Ann', email: 'ann@example.com', message: 'Hello, I need a new logo.' }), {});
const all = c.validate({ name: ' ', email: '', message: 'short' });
assert.deepEqual(Object.keys(all), ['name', 'email', 'message']);
assert.match(c.validate({ name: 'A', email: 'ann@', message: 'long enough message' }).email, /name@example\.com/);
assert.equal(c.validate({ name: 'A', email: 'a@b.co', message: 'x'.repeat(1001) }).message, 'Please keep the message under 1000 characters.');

// Ticket matches the helpdesk's shape and priority rules (impact 1 + urgency 1 = P3, 24 h target)
const t = c.makeEnquiryTicket(' Ann ', ' ann@example.com ', ' Need a logo please ', 1000);
assert.deepEqual(Object.keys(t).sort(), ['created', 'id', 'impact', 'issue', 'priority', 'replies', 'requester', 'status', 'urgency']);
assert.equal(t.requester, 'Ann (ann@example.com)');
assert.equal(t.issue, 'Website enquiry: Need a logo please');
assert.deepEqual([t.priority, t.status, t.impact, t.urgency], ['P3', 'New', 1, 1]);
const helpdesk = require('./helpdesk.js');
assert.equal(t.priority, helpdesk.priorityOf(t.impact, t.urgency));

// Storage: appends to existing tickets, survives empty/corrupt storage, and surfaces blocked storage
const mem = (init) => { let v = init; return { getItem: () => v, setItem: (k, x) => { assert.equal(k, c.TICKETS_KEY); v = x; }, get: () => JSON.parse(v) }; };
let s = mem(null); c.addTicket(t, s); assert.equal(s.get().length, 1);
s = mem(JSON.stringify([{ id: 1 }])); c.addTicket(t, s); assert.equal(s.get().length, 2);
s = mem('not json'); c.addTicket(t, s); assert.equal(s.get().length, 1);
assert.throws(() => c.addTicket(t, { getItem: () => null, setItem: () => { throw new Error('blocked'); } }), /blocked/);

// SEO rules and FAQ JSON-LD for index.html
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const title = html.match(/<title>(.*?)<\/title>/)[1];
const desc = html.match(/<meta name="description" content="(.*?)">/)[1];
assert.ok(title.length < 60, `title ${title.length}`);
assert.ok(desc.length < 155, `description ${desc.length}`);
assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
const imgs = html.match(/<img\b[^>]*>/g) || [];
assert.ok(imgs.length > 0 && imgs.every((i) => /\balt="[^"]+"/.test(i)), 'every img has alt text');
assert.ok(!/<script[^>]+src="https?:/.test(html), 'no outside scripts');
const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
assert.equal(ld['@type'], 'FAQPage');
assert.equal(ld.mainEntity.length, 4);
for (const q of ld.mainEntity) { // structured data must match the visible FAQ
  assert.ok(html.includes(`<summary>${q.name}</summary><p>${q.acceptedAnswer.text}</p>`), `FAQ mismatch: ${q.name}`);
}
for (const id of ['name-error', 'email-error', 'message-error', 'contact-form', 'form-status']) assert.ok(html.includes(`id="${id}"`), id);
for (const page of ['helpdesk.html', 'staff.html', 'troubleshoot.html']) {
  assert.ok(html.includes(`href="${page}"`) && fs.existsSync(__dirname + '/' + page), `link to ${page}`);
}

console.log('all tests passed');
