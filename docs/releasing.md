# Releasing

[← Back to the README](../README.md)

## Branches

- **`dev`** is where work happens. `.github/workflows/ci.yml` type-checks, tests and builds every
  push to `dev` (and every pull request), so the Actions tab shows whether `dev` is healthy.
- **`main`** is what's live. Every push to `main` rebuilds and publishes the site, so nothing is
  pushed to `main` directly.

## Making a release

1. Make sure CI is green on `dev`.
2. Open a pull request from `dev` into `main`.
3. Merge it with **Create a merge commit** (not squash, so the two branches stay in step).
4. The site rebuilds (see below). If `main` ever gets a commit `dev` doesn't have, merge `main`
   into `dev` before the next release.

## Publishing (GitHub Pages)

`.github/workflows/pages.yml` runs on every push to `main`: it type-checks, runs the tests, builds
`dist/index.html` and publishes it to https://jjdogs.github.io/VBTS/. If the checks fail, nothing
is published. Watch a deploy in the repository's **Actions** tab.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. On a free
GitHub plan, Pages needs the repository to be public.

## Preview of `dev`

To try changes before a release, a build of `dev` can be published to the claude.ai artifact
https://claude.ai/artifact/8fhKrUyeQKGS67sYM1JnDC. It isn't updated automatically. Buttons that save
a file don't work in the preview (it blocks downloads); they work on the live site.

## Workflows

| Workflow | When | What |
|---|---|---|
| `ci.yml` | every push to `dev`, every pull request | type-check, tests, build |
| `pages.yml` | every push to `main` | type-check, tests, build, publish to GitHub Pages |
| `verse-api.yml` | Mondays 06:17 UTC, or by hand | reads Epic's Verse API reference; opens a pull request into `dev` if it changed (see [Verse API data](verse-api.md)) |
