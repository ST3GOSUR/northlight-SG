// Looks for passwords and keys in the files the repository tracks. No dependencies, no network.
// The only passwords in this repo are the FAKE demo accounts in staff.js, which are shown on the staff page on purpose.
// They are not assigned with "password = '...'", so these patterns do not flag them.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const PATTERNS = [
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key id', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Azure storage key or SAS token', /(AccountKey|SharedAccessSignature)=[A-Za-z0-9+/=%&;-]{20,}/],
  ['JSON Web Token', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['password, secret or key assigned a literal value', /\b(pass(word|wd)?|secret|token|api[_-]?key|private[_-]?key)\b["']?\s*[:=]\s*["'][^"'\s]{6,}["']/i],
];

const SECRET_FILE_NAMES = /(^|\/)(\.env(\..+)?|id_rsa|id_ed25519|credentials\.json|[^/]+\.(pem|p12|pfx|key))$/i;
const SKIP_EXTENSIONS = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|pdf|zip)$/i;
const SKIP_FILES = new Set(['package-lock.json']); // long integrity hashes, no secrets

// Values that look like keys but are public on purpose. Keep this list short and give each a reason.
const ALLOWED_VALUES = [
  { value: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', reason: 'the public test key from RFC 6238 (the one-time code standard), used to test staff.js' },
];

function scanText(file, text) {
  const findings = [];
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = ALLOWED_VALUES.reduce((l, a) => l.split(a.value).join(''), rawLine);
    for (const [name, pattern] of PATTERNS) if (pattern.test(line)) findings.push(`${file}:${i + 1}: ${name}`);
  });
  return findings;
}

const scanFileName = (file) => (SECRET_FILE_NAMES.test(file) ? [`${file}: file name looks like a secret or key file`] : []);

// What is in the repository (tracked by git). Falls back to walking the folder if git is not available.
function repoFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch (e) {
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['.git', 'node_modules', 'test-results', 'playwright-report'].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full); else out.push(path.relative(root, full).split(path.sep).join('/'));
      }
    };
    walk(root);
    return out;
  }
}

function scanRepo() {
  const findings = [];
  for (const file of repoFiles()) {
    findings.push(...scanFileName(file));
    if (SKIP_EXTENSIONS.test(file) || SKIP_FILES.has(path.basename(file))) continue;
    const full = path.join(root, file);
    if (!fs.existsSync(full) || fs.statSync(full).size > 1e6) continue;
    findings.push(...scanText(file, fs.readFileSync(full, 'utf8')));
  }
  return findings;
}

module.exports = { scanText, scanFileName, scanRepo, repoFiles };
