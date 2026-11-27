// Run: node contact.test.js (fake data only). Ticket creation is tested in automation.test.js.
const assert = require('assert');
const fs = require('fs');
const c = require('./contact.js');

// Validation messages
assert.deepEqual(c.validate({ name: 'Ann', email: 'ann@example.com', message: 'Hello, I need a new logo.' }), {});
const all = c.validate({ name: ' ', email: '', message: 'short' });
assert.deepEqual(Object.keys(all), ['name', 'email', 'message']);
assert.match(c.validate({ name: 'A', email: 'ann@', message: 'long enough message' }).email, /name@example\.com/);
assert.equal(c.validate({ name: 'A', email: 'a@b.co', message: 'x'.repeat(1001) }).message, 'Please keep the message under 1000 characters.');

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

// Favicon: the file exists and every page links it, so browsers never fall back to a missing /favicon.ico
const icon = fs.readFileSync(__dirname + '/favicon.svg', 'utf8');
assert.ok(icon.startsWith('<svg') && icon.includes('viewBox="0 0 64 64"') && icon.length < 4000, 'favicon.svg is a small SVG');
const pages = fs.readdirSync(__dirname).filter((n) => n.endsWith('.html'));
assert.ok(pages.length >= 7, 'found the site pages');
for (const p of pages) {
  const count = fs.readFileSync(__dirname + '/' + p, 'utf8').split('<link rel="icon" href="favicon.svg" type="image/svg+xml">').length - 1;
  assert.equal(count, 1, p + ' links the favicon once');
}

console.log('all tests passed');
