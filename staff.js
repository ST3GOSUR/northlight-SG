// LEARNING MODEL: every check below runs in the browser, so anyone can bypass it. Real systems check on a server.
const USERS_KEY = 'northlight-staff-users';
const SESSION_KEY = 'northlight-staff-session'; // sessionStorage: signed out when the tab closes
const GROUPS = ['Design', 'Sales', 'IT'];
const ITERATIONS = 100000;
const STEP_MS = 30000;

// Fake demo accounts. The passwords are fake and shown on the page on purpose; only salted hashes are stored.
const SEED = [
  ['ana', 'Ana Novak', 'Design', 'Art Director', 'Ana-demo-1', 'JBSWY3DPEHPK3PXP'],
  ['ben', 'Ben Kral', 'Design', 'Designer', 'Ben-demo-2', 'KRSXG5CTMVRXEZLU'],
  ['cleo', 'Cleo Hart', 'Sales', 'Sales Lead', 'Cleo-demo-3', 'MFRGGZDFMZTWQ2LK'],
  ['dan', 'Dan Moore', 'Sales', 'Account Manager', 'Dan-demo-4', 'NBSWY3DPFQQHO33S'],
  ['eli', 'Eli Ford', 'IT', 'IT Manager', 'Eli-demo-5', 'ONSWG4TFOQYTEMZU'],
  ['fay', 'Fay Lund', 'IT', 'Support Technician', 'Fay-demo-6', 'GEZDGNBVGY3TQOJQ'],
];
const DEMO_PASSWORDS = Object.fromEntries(SEED.map((s) => [s[0], s[4]]));

const enc = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

// --- password hashing (PBKDF2 via Web Crypto) ---
async function hashPassword(password, saltB64) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: ITERATIONS }, key, 256);
  return toB64(bits);
}

// --- TOTP (RFC 6238) ---
function base32decode(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s.toUpperCase().replace(/=+$/, '')) {
    const i = A.indexOf(ch);
    if (i < 0) throw new Error('bad base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

async function totp(secretB32, time = Date.now(), digits = 6) {
  const counter = Math.floor(time / STEP_MS);
  const buf = new DataView(new ArrayBuffer(8));
  buf.setUint32(0, Math.floor(counter / 2 ** 32));
  buf.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey('raw', base32decode(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, '0');
}

// Accepts the previous, current and next 30 s code to allow for clock drift. Returns the matching time step, or null.
async function matchTotp(secret, code, time = Date.now()) {
  for (const d of [-1, 0, 1]) {
    const t = time + d * STEP_MS;
    if ((await totp(secret, t)) === code) return Math.floor(t / STEP_MS);
  }
  return null;
}

async function verifyTotp(secret, code, time = Date.now()) {
  return (await matchTotp(secret, code, time)) !== null;
}

// --- users ---
async function makeUser(username, name, group, role, password, secret) {
  const salt = toB64(randomBytes(16));
  return { username, name, group, role, salt, hash: await hashPassword(password, salt), secret, active: true };
}

async function seedUsers() {
  return Promise.all(SEED.map(([u, n, g, r, p, s]) => makeUser(u, n, g, r, p, s)));
}

// Step 1. Wrong user and wrong password give the same message. A leaver is only told after the password is right.
async function checkPassword(users, username, password) {
  const u = users.find((x) => x.username === username);
  if (!u || (await hashPassword(password, u.salt)) !== u.hash) return { error: 'Wrong username or password.' };
  if (!u.active) return { error: 'This account has been disabled (leaver). Contact IT.', disabled: true };
  return { user: u };
}

// Step 2. Checks "active" again: someone may have left between the two steps.
// A code works once: the time step it belongs to is remembered (user.lastStep), and that step or any older one is refused.
// The caller must save the user list after a success so the memory survives a reload.
async function checkCode(user, code, time = Date.now()) {
  if (!user.active) return { error: 'This account has been disabled (leaver). Contact IT.', disabled: true };
  const step = await matchTotp(user.secret, code.trim(), time);
  if (step === null) return { error: 'Wrong code.' };
  if (step <= (user.lastStep ?? -1)) return { error: 'That code has already been used. Wait for the next one.' };
  user.lastStep = step;
  return { user };
}

// --- lockout: 5 wrong passwords or codes lock that username for a minute ---
const MAX_FAILURES = 5;
const LOCK_MS = 60000;
const FAIL_WINDOW_MS = 15 * 60000; // failures older than this are forgotten
const FAILURES_KEY = 'northlight-staff-failures';

// `failures` is { username: { count, last, lockedUntil } }. It counts the name typed, whether or not the account
// exists, so being locked does not reveal which accounts are real.
function lockedSeconds(failures, username, now = Date.now()) {
  const f = failures[username];
  return f && f.lockedUntil > now ? Math.ceil((f.lockedUntil - now) / 1000) : 0;
}

function recordFailure(failures, username, now = Date.now()) {
  const f = failures[username] || { count: 0, last: 0, lockedUntil: 0 };
  if (now - f.last > FAIL_WINDOW_MS) f.count = 0;
  f.count += 1;
  f.last = now;
  if (f.count >= MAX_FAILURES) { f.count = 0; f.lockedUntil = now + LOCK_MS; }
  failures[username] = f;
  const names = Object.keys(failures);
  if (names.length > 100) for (const n of names) if (n !== username && failures[n].lockedUntil <= now) delete failures[n]; // stay small
}

const clearFailures = (failures, username) => { delete failures[username]; };

const canAdmin = (u) => !!u && u.active && u.group === 'IT';

// Admin actions check the actor themselves, not just the page, so hiding the buttons is not the only guard.
async function joiner(users, actor, name, group) {
  if (!canAdmin(actor)) throw new Error('Only IT can add staff.');
  if (!GROUPS.includes(group)) throw new Error('Unknown group.');
  name = name.trim();
  const username = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  if (!username) throw new Error('Enter a name.');
  if (users.some((u) => u.username === username)) throw new Error(`Username "${username}" already exists.`);
  const A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const password = Array.from(randomBytes(12), (b) => A[b % A.length]).join('');
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const secret = Array.from(randomBytes(16), (b) => B32[b % 32]).join('');
  const user = await makeUser(username, name, group, 'New starter', password, secret);
  users.push(user);
  return { user, password };
}

function leaver(users, actor, username) {
  if (!canAdmin(actor)) throw new Error('Only IT can remove staff.');
  if (actor.username === username) throw new Error('You cannot mark yourself as a leaver.');
  const u = users.find((x) => x.username === username);
  if (!u) throw new Error('No such user.');
  u.active = false;
}

// --- page ---
if (typeof document !== 'undefined') {
  const $ = (id) => document.getElementById(id);
  let users = [];
  let pending = null; // user who passed step 1, waiting for the code

  const load = () => {
    try { const s = JSON.parse(localStorage.getItem(USERS_KEY)); return Array.isArray(s) ? s : null; } catch (e) { return null; }
  };
  const save = () => { try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) { /* storage blocked */ } };
  const sessionName = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch (e) { return null; } };
  const setSession = (v) => { try { v ? sessionStorage.setItem(SESSION_KEY, v) : sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } };
  const say = (text) => { $('msg').textContent = text; };

  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text; // textContent: names are never parsed as HTML
    if (cls) e.className = cls;
    return e;
  }

  function row(...cells) {
    const tr = document.createElement('tr');
    for (const c of cells) { const td = document.createElement('td'); td.append(c); tr.append(td); }
    return tr;
  }

  const current = () => users.find((u) => u.username === sessionName() && u.active) || null;

  function render() {
    const cur = current();
    if (!cur) setSession(null); // covers a leaver whose session was still open
    $('step1').hidden = !!cur || !!pending;
    $('step2').hidden = !pending || !!cur;
    $('signed').hidden = !cur;

    if (cur) {
      $('who').textContent = `${cur.name} (${cur.role}, ${cur.group})`;
      const admin = $('admin');
      admin.hidden = !canAdmin(cur);
      $('no-admin').hidden = canAdmin(cur);
      if (canAdmin(cur)) {
        const body = $('admin-users');
        body.replaceChildren();
        for (const u of users) {
          const btn = el('button', 'Leaver');
          btn.type = 'button';
          btn.disabled = !u.active || u.username === cur.username;
          btn.addEventListener('click', () => {
            try { leaver(users, current(), u.username); save(); say(`${u.name} marked as leaver.`); } catch (e) { say(e.message); }
            render();
          });
          body.append(row(u.name, u.group, u.role, u.active ? 'Active' : 'Left', btn));
        }
      }
    }

    const demo = $('demo-users');
    demo.replaceChildren();
    for (const u of users) demo.append(row(u.username, DEMO_PASSWORDS[u.username] || '(shown once at creation)', `${u.group}, ${u.role}`, u.active ? 'Active' : 'Left'));

    const sel = $('auth-user');
    const keep = sel.value;
    sel.replaceChildren(...users.map((u) => { const o = el('option', u.username); o.value = u.username; return o; }));
    if (users.some((u) => u.username === keep)) sel.value = keep;
    tick();
  }

  // Demo authenticator: in real life this code lives on the user's phone, never on the page.
  async function tick() {
    const u = users.find((x) => x.username === $('auth-user').value);
    if (!u) return;
    $('auth-secret').textContent = u.secret;
    $('auth-code').textContent = await totp(u.secret);
    $('auth-left').textContent = String(30 - (Math.floor(Date.now() / 1000) % 30));
  }

  const loadFailures = () => {
    try { const f = JSON.parse(localStorage.getItem(FAILURES_KEY)); return f && typeof f === 'object' && !Array.isArray(f) ? f : {}; } catch (e) { return {}; }
  };
  const saveFailures = (f) => { try { localStorage.setItem(FAILURES_KEY, JSON.stringify(f)); } catch (e) { /* storage blocked */ } };
  const lockMessage = (seconds) => `Too many failed attempts. Try again in ${seconds} seconds.`;

  $('step1').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('username').value.trim().toLowerCase();
    const failures = loadFailures();
    const wait = lockedSeconds(failures, username);
    if (wait) { $('password').value = ''; return say(lockMessage(wait)); } // refused even if the password would be right
    const r = await checkPassword(users, username, $('password').value);
    $('password').value = '';
    if (r.error) {
      if (!r.disabled) { recordFailure(failures, username); saveFailures(failures); } // a leaver with the right password is not a failed guess
      return say(r.error);
    }
    pending = r.user;
    say('Password accepted. Now enter the code from the authenticator.');
    render();
    $('code').focus();
  });

  $('step2').addEventListener('submit', async (e) => {
    e.preventDefault();
    const failures = loadFailures();
    const wait = lockedSeconds(failures, pending.username);
    if (wait) { $('code').value = ''; pending = null; render(); return say(lockMessage(wait)); }
    const r = await checkCode(pending, $('code').value);
    $('code').value = '';
    if (r.error) {
      if (!r.disabled) { recordFailure(failures, pending.username); saveFailures(failures); }
      return say(r.error);
    }
    clearFailures(failures, pending.username);
    saveFailures(failures);
    save(); // remembers the code just used (user.lastStep)
    setSession(pending.username);
    pending = null;
    say('');
    render();
  });

  $('cancel').addEventListener('click', () => { pending = null; say(''); render(); });
  $('signout').addEventListener('click', () => { setSession(null); say('Signed out.'); render(); });

  $('joiner-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { user, password } = await joiner(users, current(), $('j-name').value, $('j-group').value);
      save();
      say(`Joiner created. Username: ${user.username}, password: ${password} (shown once, write it down).`);
      e.target.reset();
    } catch (err) { say(err.message); }
    render();
  });

  $('reset').addEventListener('click', async () => {
    setSession(null);
    pending = null;
    try { localStorage.removeItem(FAILURES_KEY); } catch (e) { /* ignore */ } // a reset also lifts any lockout
    users = await seedUsers();
    save();
    say('Demo data reset.');
    render();
  });

  window.addEventListener('storage', (e) => { if (e.key === USERS_KEY) { users = load() || users; render(); } });
  $('auth-user').addEventListener('change', tick);
  setInterval(tick, 1000);

  (async () => {
    users = load() || (await seedUsers());
    save();
    render();
  })();
} else {
  module.exports = { hashPassword, base32decode, totp, matchTotp, verifyTotp, makeUser, seedUsers, checkPassword, checkCode, canAdmin, joiner, leaver, lockedSeconds, recordFailure, clearFailures, MAX_FAILURES, LOCK_MS, GROUPS };
}
