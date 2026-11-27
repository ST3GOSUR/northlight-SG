# Risks and fixes

The five biggest risks for a small studio like Northlight, what we already do about them in this repository, and what is still to do.
This site is a **learning model**: all people and data are fake, and everything runs in the browser. Real fixes for risks 4 and 5 need a server.

| # | Risk | How bad | Status |
|---|------|---------|--------|
| 1 | Phishing | High | Partly covered |
| 2 | Malware | High | Partly covered |
| 3 | Injected script text (XSS) | Medium | Covered and tested |
| 4 | Access control only in the browser | High (real use) | Known limit of the model |
| 5 | Secrets and personal data in a public repository | High | Covered and tested |

## 1. Phishing

**What can go wrong.** Someone gets a message that looks like it is from Finance, IT or a client. It asks them to sign in on a fake page, hand over a one-time code, pay an invoice or open a file. One click can give an attacker a password, a code or a foothold. Our training case is exactly this: three people got an invoice email and one opened the attachment.

**Fixes.**
- *Already here:* sign-in needs a password and a one-time code. A one-time code works **once** and five wrong attempts lock the username for a minute, so a stolen code cannot simply be replayed or guessed (see `staff.js`, tested in `tests/staff-security.spec.js`).
- *To do:* switch on SPF, DKIM and DMARC for the studio's email domain so fake mail from our own name is rejected. Prefer passkeys over typed codes, because a typed code can still be phished.
- *People:* never type a code or password because a message asked you to. Check the real sender address and hover over links. Report anything odd as a ticket in the help desk, and treat "someone clicked" as P1.

## 2. Malware

**What can go wrong.** A booby-trapped attachment, download or macro installs software that steals files, locks them for ransom, or spreads to other laptops.

**Fixes.**
- *Already here:* `tools/pc-health.js` reports whether the firewall is on and when the last update was installed, and fails if updates are more than 60 days old. The pages load no outside scripts, and the content security policy blocks plug-ins (`object-src 'none'`).
- *To do:* keep antivirus and automatic updates on for every laptop. Block macros and `.exe` or `.js` files in email. Give people normal accounts, not administrator ones, for daily work. Keep backups that an infected laptop cannot reach, and test restoring one.
- *If it happens:* disconnect the laptop from the network, do not switch it off, raise a P1 ticket, and change the passwords used on it from a clean device.

## 3. Injected script text (XSS)

**What can go wrong.** Text typed into a form, such as `<script>` or an image with an `onerror`, is later shown on a page as real code and runs in another person's browser.

**Fixes.**
- *Already here:* every page shows typed text with `textContent`, never as HTML. Every page also carries a **content security policy** that only allows scripts and styles from our own files (no inline code or inline styles), so injected code would be blocked even if it got in. `tests/xss.spec.js` types script-like text into the website form, the help desk and a reply, and checks it appears as plain text and never runs. `tests/csp.spec.js` checks every page has the policy.
- *Limit:* GitHub Pages cannot send HTTP headers, so the policy is a meta tag. A meta tag cannot stop other sites framing ours, and it only protects what comes after it.

## 4. Access control only in the browser

**What can go wrong.** The staff page hides the admin section from non-IT users, and the test `tests/staff-admin.spec.js` proves it. But "hidden" is not "secure": anyone can open the browser's developer tools, edit the saved data or the page's code and make themselves IT. The one-time code keys and password hashes are also readable in the browser's storage.

**Fixes.**
- *Real systems:* check who the user is and what they may do **on a server**, never only in the page. Keep sessions, password hashes and one-time code keys on the server, not in the browser.
- *Here:* this is the stated limit of the learning model. The staff page says so, and the tests only prove the page behaves as designed.

## 5. Secrets and personal data in a public repository

**What can go wrong.** A password, key or a real person's details gets committed. This repository and its website are public, so it is published, and git history keeps it even after the file is deleted. It nearly happened here: an exported snapshot contained a real email address.

**Fixes.**
- *Already here:* `tests/secrets.spec.js` scans every tracked file for private keys, cloud and GitHub tokens, key strings and passwords assigned in code, and the build fails if it finds one. The only passwords in the repository are the fake demo accounts, which are shown on the staff page on purpose. `.gitignore` keeps exports, snapshots and test output out. The export buttons warn that the files hold everything in the browser.
- *To do:* turn on GitHub **secret scanning and push protection** in the repository settings. Use fake data only in anything committed.
- *If a real secret leaks:* revoke or rotate it straight away. Deleting the file is not enough, because it stays in history.
