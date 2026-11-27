# Northlight Studio website

A plain HTML site for Northlight Studio, a 25-person design studio. No frameworks, no build step.

## Files

- `index.html`: the whole site.
- `.github/workflows/deploy.yml`: deploys the site to GitHub Pages on every push to `main`.

## Preview locally

Run `npm run serve` and open http://127.0.0.1:4173/ (the rules and health files load over http, so opening `index.html` straight from disk will show errors).

## Deploying

One-time setup: in the repo go to **Settings → Pages** and set **Source** to **GitHub Actions**.
After that, every push to `main` publishes the site. The URL is shown in the workflow run.

## Tests

Browser tests (Playwright) live in `tests/`. They need Node.js; the site itself has no build step.

```
npm ci
npx playwright install chromium
npx playwright test                                              # starts a local server automatically
SITE_URL=https://st3gosur.github.io/northlight-SG/ npx playwright test   # or test any address
```

They check that typed script text stays plain text, that a Sales user cannot see the admin section, that empty forms explain what is missing, that every page has a content security policy, that the repository holds no password or key, sign-in hardening, and accessibility (axe-core). The workflow runs them before every deploy. See `RISKS.md` for the risks behind them.
