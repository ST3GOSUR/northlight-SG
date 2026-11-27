// Run: node helpdesk.test.js
const assert = require('assert');
const h = require('./helpdesk.js');
const H = 3600000, now = Date.now();

// Priority matrix: every impact x urgency combination.
const expected = { 2: 'P3', 3: 'P2', 4: 'P2', 5: 'P1', 6: 'P1' };
for (let i = 1; i <= 3; i++) for (let u = 1; u <= 3; u++) assert.equal(h.priorityOf(i, u), expected[i + u], `impact ${i} urgency ${u}`);

// Overdue: boundary per priority, and Resolved never overdue.
const at = (i, u, ageH, status) => h.makeTicket('x', 'y', i, u, now - ageH * H, status);
assert.ok(!h.isOverdue(at(3, 3, 1), now), 'P1 exactly at target is not overdue');
assert.ok(h.isOverdue(at(3, 3, 1.01), now));
assert.ok(!h.isOverdue(at(2, 2, 3.9), now) && h.isOverdue(at(2, 2, 4.1), now), 'P2 4h');
assert.ok(!h.isOverdue(at(1, 1, 23.9), now) && h.isOverdue(at(1, 1, 24.1), now), 'P3 24h');
assert.ok(!h.isOverdue(at(3, 3, 100, 'Resolved'), now));

// Overdue label text.
assert.equal(h.overdueBy(at(3, 3, 3), now), 2 * H);
assert.equal(h.fmtDuration(2 * H + 5 * 60000), '2h 5m');
assert.equal(h.fmtDuration(90000), '1m');

// Replies, including tickets saved before replies existed.
const t = at(1, 1, 0);
h.addReply(t, 'Support', 'On it', 5);
assert.deepEqual(t.replies, [{ author: 'Support', text: 'On it', time: 5 }]);
const old = { priority: 'P3', status: 'New', created: now };
h.addReply(old, 'A', 'B');
assert.equal(old.replies.length, 1);

// Sort: P1 first, then oldest first within a priority.
const order = h.sorted([at(1, 1, 1), at(3, 3, 1), at(3, 3, 5)]);
assert.deepEqual(order.map(x => x.priority), ['P1', 'P1', 'P3']);
assert.ok(order[0].created < order[1].created);
console.log('all tests passed');
