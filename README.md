# Northlight Studio website

A plain HTML site for Northlight Studio, a 25-person design studio. No frameworks, no build step.

## Files

- `index.html`: the whole site.
- `.github/workflows/deploy.yml`: deploys the site to GitHub Pages on every push to `main`.

## Preview locally

Open `index.html` in a browser.

## Deploying

One-time setup: in the repo go to **Settings → Pages** and set **Source** to **GitHub Actions**.
After that, every push to `main` publishes the site. The URL is shown in the workflow run.
