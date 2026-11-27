// Run: node tools/daily-summary.test.js (fake data only)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { summarise } = require('./daily-summary.js');
const root = path.join(__dirname, '..');
const H = 3600000;
const NOW = Date.UTC(2026, 10, 27, 12, 0);

const snap = () => ({
  exportedAt: new Date(NOW - H).toISOString(),
  tickets: [
    { priority: 'P1', status: 'New', created: NOW - 2 * H, issue: 'Server down', requester: 'A (a@example.com)' },      // overdue (1 h target)
    { priority: 'P2', status: 'In progress', created: NOW - H, issue: 'Printer', requester: 'B (b@example.com)' },        // not overdue (4 h)
    { priority: 'P3', status: 'Resolved', created: NOW - 100 * H, issue: 'Old', requester: 'C (c@example.com)' },         // resolved: never overdue
  ],
  crm: {
    leads: [{ converted: false }, { converted: true }, { converted: false }],
    opportunities: [{ stage: 'Qualified' }, { stage: 'Qualified' }, { stage: 'Won' }],
    cases: [{ due: NOW - H, closed: false }, { due: NOW + H, closed: false }, { due: NOW - H, closed: true }],
  },
  outbox: [{}],
  log: [{ outcome: 'EVENT' }, { outcome: 'RAN' }, { outcome: 'RAN' }, { outcome: 'SKIPPED' }, { outcome: 'ERROR' }, { outcome: 'EVENT' }],
});

// Counts
const text = summarise(snap(), NOW);
assert.match(text, /Open tickets: 2 \(P1: 1, P2: 1, P3: 0\)/);
assert.match(text, /Overdue: 1\n/);
assert.match(text, /- P1 \(New\) Server down - A/);
assert.match(text, /Leads not yet converted: 2/);
assert.match(text, /Qualified 2, Quote 0, Won 1/);
assert.match(text, /Open support cases: 2 \(overdue: 1\)/);
assert.match(text, /Enquiries processed: 2/);
assert.match(text, /Rules: 2 ran, 1 skipped, 1 errors/);
assert.match(text, /Alerts in the outbox: 1/);
assert.match(text, /Snapshot taken: 2026-11-27 11:00 UTC/);

// Empty data is a valid summary, not a crash
const empty = summarise({ tickets: [], outbox: [], log: [], crm: { leads: [], opportunities: [], cases: [] } }, NOW);
assert.match(empty, /Open tickets: 0/);
assert.match(empty, /Snapshot taken: unknown/);

// Text from the snapshot cannot add Markdown or HTML
const nasty = snap();
nasty.tickets[0].issue = '<img src=x onerror=1> `code` [link](http://x) | **bold**\nnewline';
const listed = summarise(nasty, NOW).split('\n').find((l) => l.startsWith('  - P1'));
assert.ok(listed, 'the overdue ticket is listed');
assert.ok(!/[<>`|\\[\]*_]/.test(listed.split(' - ')[0] + listed.split(' - ').slice(1, 2).join('')), 'no markup characters from the issue text');
assert.ok(listed.includes('img src=x') && !listed.includes('<'), 'text kept, angle brackets removed');

// Only the first five overdue tickets are listed
const many = snap();
many.tickets = Array.from({ length: 8 }, (_, i) => ({ priority: 'P1', status: 'New', created: NOW - (i + 2) * H, issue: 'x' + i, requester: 'R' }));
assert.match(summarise(many, NOW), /and 3 more/);

// Bad snapshots fail with a clear message (the workflow then shows as failed)
assert.throws(() => summarise(null, NOW), /not an object/);
assert.throws(() => summarise({ tickets: [], outbox: [], log: [] }, NOW), /"crm" needs/);
assert.throws(() => summarise({ ...snap(), tickets: [{ priority: 'P9', created: 1 }] }, NOW), /ticket 1/);
assert.throws(() => summarise({ ...snap(), log: 'no' }, NOW), /"log" must be a list/);

// The committed fake snapshot is valid and the summary runs on it
const committed = JSON.parse(fs.readFileSync(path.join(root, 'data', 'snapshot.json'), 'utf8'));
assert.match(summarise(committed, NOW), /# Northlight daily summary/);
assert.ok(!/@(?!example\.com)[\w.-]+/.test(JSON.stringify(committed)), 'committed snapshot contains only example.com addresses');

// Workflow: daily schedule, manual trigger, read-only permissions, runs the script and writes the job summary
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'daily-summary.yml'), 'utf8');
assert.match(wf, /schedule:\s*\n\s*- cron: '\d+ \d+ \* \* \*'/);
assert.match(wf, /workflow_dispatch:/);
assert.match(wf, /permissions:\s*\n\s*contents: read/);
assert.ok(!/contents: write|git push|secrets\./.test(wf), 'workflow cannot push or use secrets');
assert.match(wf, /node tools\/daily-summary\.js > summary\.md/);
assert.match(wf, /\$GITHUB_STEP_SUMMARY/);

// Page wiring
const page = fs.readFileSync(path.join(root, 'automation.html'), 'utf8');
assert.ok(page.includes('id="export-snapshot"') && /Commit fake data only/.test(page));
assert.ok(/\$\('export-snapshot'\)/.test(fs.readFileSync(path.join(root, 'automation.js'), 'utf8')));

console.log('all tests passed');
