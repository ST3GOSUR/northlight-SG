// Daily summary of a snapshot exported from automation.html. READ-ONLY: reads one JSON file and prints Markdown.
// Run: node tools/daily-summary.js [path/to/snapshot.json]   (default: data/snapshot.json)
const fs = require('fs');
const path = require('path');
const helpdesk = require('../helpdesk.js'); // same overdue rule as the help desk page
const crm = require('../crm.js');           // same stages and case rule as the CRM page

const when = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
// Snapshot text ends up in a Markdown page, so strip characters that could add formatting or HTML.
const clean = (s, max = 60) => String(s ?? '').replace(/[\r\n\t`<>|\\[\]*_]/g, ' ').trim().slice(0, max);

function check(snap) {
  const bad = (m) => { throw new Error(`Invalid snapshot: ${m}`); };
  if (!snap || typeof snap !== 'object') bad('not an object.');
  for (const k of ['tickets', 'outbox', 'log']) if (!Array.isArray(snap[k])) bad(`"${k}" must be a list.`);
  if (!snap.crm || !['leads', 'opportunities', 'cases'].every((k) => Array.isArray(snap.crm[k]))) bad('"crm" needs leads, opportunities and cases lists.');
  snap.tickets.forEach((t, i) => {
    if (!['P1', 'P2', 'P3'].includes(t.priority) || !Number.isFinite(t.created)) bad(`ticket ${i + 1} needs a priority (P1-P3) and a created time.`);
  });
}

function summarise(snap, now = Date.now()) {
  check(snap);
  const open = snap.tickets.filter((t) => t.status !== 'Resolved');
  const overdue = open.filter((t) => helpdesk.isOverdue(t, now)).sort((a, b) => a.priority.localeCompare(b.priority) || a.created - b.created);
  const counts = crm.stageCounts(snap.crm.opportunities);
  const openCases = snap.crm.cases.filter((c) => !c.closed);
  const outcome = (o) => snap.log.filter((l) => l.outcome === o).length;
  const lines = [
    '# Northlight daily summary',
    '',
    `Snapshot taken: ${snap.exportedAt ? when(Date.parse(snap.exportedAt)) : 'unknown'}. Summary run: ${when(now)}.`,
    'Fake demo data only. Nothing here was sent anywhere.',
    '',
    '## Help desk',
    `- Open tickets: ${open.length} (${['P1', 'P2', 'P3'].map((p) => `${p}: ${open.filter((t) => t.priority === p).length}`).join(', ')})`,
    `- Overdue: ${overdue.length}`,
    ...overdue.slice(0, 5).map((t) => `  - ${t.priority} (${t.status}) ${clean(t.issue)} - ${clean(t.requester, 40)}, created ${when(t.created)}`),
    ...(overdue.length > 5 ? [`  - and ${overdue.length - 5} more`] : []),
    '',
    '## CRM',
    `- Leads not yet converted: ${snap.crm.leads.filter((l) => !l.converted).length}`,
    `- Opportunities by stage: ${crm.STAGES.map((s, i) => `${s} ${counts[i]}`).join(', ')}`,
    `- Open support cases: ${openCases.length} (overdue: ${openCases.filter((c) => crm.isOverdue(c, now)).length})`,
    '',
    '## Automation',
    `- Enquiries processed: ${outcome('EVENT')}`,
    `- Rules: ${outcome('RAN')} ran, ${outcome('SKIPPED')} skipped, ${outcome('ERROR')} errors`,
    `- Alerts in the outbox: ${snap.outbox.length} (nothing is really sent)`,
  ];
  return lines.join('\n') + '\n';
}

function main() {
  const file = process.argv[2] || path.join(__dirname, '..', 'data', 'snapshot.json');
  try {
    process.stdout.write(summarise(JSON.parse(fs.readFileSync(file, 'utf8'))));
  } catch (e) {
    console.error(`Cannot summarise ${file}: ${e.message}`); // non-zero exit makes a scheduled run show as failed
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { summarise };
