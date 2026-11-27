const cfg = typeof CONFIG !== 'undefined' ? CONFIG : require('./config.js');

// Every localStorage record as one object. Values that are JSON are parsed so the file is readable;
// anything else is kept as text. (A text value that happens to be valid JSON, like "true", comes out parsed.)
function exportAll(storage, now = new Date()) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) keys.push(storage.key(i));
  keys.sort();
  const data = {};
  for (const key of keys) {
    const raw = storage.getItem(key);
    try { data[key] = JSON.parse(raw); } catch (e) { data[key] = raw; }
  }
  return { exportedAt: now.toISOString(), site: cfg.siteName, recordCount: keys.length, data };
}

// --- settings.html ---
if (typeof document !== 'undefined' && document.getElementById('settings-page')) {
  const $ = (id) => document.getElementById(id);
  const say = (t) => { $('msg').textContent = t; };

  $('site-name').textContent = cfg.siteName;
  for (const [key, value] of Object.entries(cfg)) {
    const tr = document.createElement('tr');
    for (const text of [key, String(value)]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    $('config').append(tr);
  }

  fetch(cfg.healthUrl, { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((h) => {
      $('h-name').textContent = h.name ?? '-';
      $('h-version').textContent = h.version ?? '-';
      $('h-build').textContent = h.buildDate ? new Date(h.buildDate).toLocaleString() : '-';
    })
    .catch((e) => { $('health-error').textContent = `Could not read ${cfg.healthUrl} (${e.message}). Open the site over http(s), not as a file.`; $('health-error').hidden = false; });

  $('export').addEventListener('click', () => {
    try {
      const out = exportAll(localStorage);
      const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cfg.exportFilePrefix}-${out.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      say(`Exported ${out.recordCount} record(s).`);
    } catch (e) {
      say('Could not read this browser\'s storage: ' + e.message);
    }
  });
}

if (typeof module !== 'undefined') module.exports = { exportAll };
