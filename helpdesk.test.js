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

// Loading: the website form may have created the list first (marker set); training tickets are added once, after it
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), has: (k) => m.has(k), json: (k) => JSON.parse(m.get(k)) }; };
const TK = 'northlight-helpdesk-tickets';
assert.equal(h.loadTickets(mem()).length, 5, 'empty storage gives the five training tickets');
assert.equal(h.loadTickets(mem({ [TK]: 'not json' })).length, 5, 'corrupt storage falls back to the training tickets');
const own = JSON.stringify([{ id: 1, requester: 'Web Visitor (w@example.com)', priority: 'P3', status: 'New', created: 1, issue: 'x', replies: [] }]);
let st = mem({ [TK]: own });
assert.equal(h.loadTickets(st).length, 1, 'no marker: stored tickets are left alone');
st = mem({ [TK]: own, [h.SEED_PENDING_KEY]: '1' });
let loaded = h.loadTickets(st);
assert.equal(loaded.length, 6, 'marker: website ticket plus five training tickets');
assert.equal(loaded[0].requester, 'Web Visitor (w@example.com)', 'the website ticket stays first');
assert.equal(st.json(TK).length, 6, 'merged list is saved');
assert.ok(!st.has(h.SEED_PENDING_KEY), 'marker is cleared');
assert.equal(h.loadTickets(st).length, 6, 'loading again does not add the training tickets twice');
const failing = { ...mem({ [TK]: own, [h.SEED_PENDING_KEY]: '1' }), setItem: () => { throw new Error('full'); } };
assert.equal(h.loadTickets(failing).length, 6, 'a failed save still shows the merged list');
assert.ok(failing.has(h.SEED_PENDING_KEY), 'and keeps the marker so the next load retries');

console.log('all tests passed');
