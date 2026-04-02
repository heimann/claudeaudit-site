=== CLAUDEAUDIT SIGNALS ===
repo_root: /tmp/claudeaudit-site/index/_scratch/anuraghazra-github-readme-stats

## Agent Documentation
FILE: CLAUDE.md DOES NOT EXIST
FILE: AGENTS.md DOES NOT EXIST
FILE: .claude/CLAUDE.md DOES NOT EXIST
FILE: .claude/settings.json DOES NOT EXIST
FILE: .cursorrules DOES NOT EXIST
FILE: .github/copilot-instructions.md DOES NOT EXIST

### Subdirectory agent docs

## Repository Structure
### Top-level layout
api
codecov.yml
CODE_OF_CONDUCT.md
CONTRIBUTING.md
eslint.config.mjs
express.js
jest.bench.config.js
jest.config.js
jest.e2e.config.js
LICENSE
package.json
package-lock.json
powered-by-vercel.svg
readme.md
scripts
SECURITY.md
src
tests
themes
vercel.json

### README

## Dependencies
FILE: package.json
{
  "name": "github-readme-stats",
  "version": "1.0.0",
  "description": "Dynamically generate stats for your GitHub readme",
  "keywords": [
    "github-readme-stats",
    "readme-stats",
    "cards",
    "card-generator"
  ],
  "main": "src/index.js",
  "type": "module",
  "homepage": "https://github.com/anuraghazra/github-readme-stats",
  "bugs": {
    "url": "https://github.com/anuraghazra/github-readme-stats/issues"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/anuraghazra/github-readme-stats.git"
  },
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage",
    "test:watch": "node --experimental-vm-modules node_modules/jest/bin/jest.js --watch",
    "test:update:snapshot": "node --experimental-vm-modules node_modules/jest/bin/jest.js -u",
    "test:e2e": "node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.e2e.config.js",
    "theme-readme-gen": "node scripts/generate-theme-doc",
    "preview-theme": "node scripts/preview-theme",
    "close-stale-theme-prs": "node scripts/close-stale-theme-prs",
    "generate-langs-json": "node scripts/generate-langs-json",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky",
    "lint": "npx eslint --max-warnings 0 \"./src/**/*.js\" \"./scripts/**/*.js\" \"./tests/**/*.js\" \"./api/**/*.js\" \"./themes/**/*.js\"",
    "bench": "node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.bench.config.js"
  },
  "author": "Anurag Hazra",
  "license": "MIT",
  "devDependencies": {
    "@actions/core": "^2.0.1",
    "@actions/github": "^6.0.1",
---END---
### Lock files
package-lock.json: EXISTS
### Setup
.devcontainer: EXISTS
Dockerfile: DOES NOT EXIST
.nvmrc: 22

## Tests
test_file_count: 29
ci_workflow_count: 14
codeql-analysis.yml
deploy-prep.py
deploy-prep.yml
e2e-test.yml
empty-issues-closer.yml
generate-theme-doc.yml
label-pr.yml
ossf-analysis.yml
preview-theme.yml
prs-cache-clean.yml

## Code Quality
.pre-commit-config.yaml: DOES NOT EXIST
FILE: .husky/pre-commit
npm test
npm run lint
npx lint-staged
---END---
.lefthook.yml: DOES NOT EXIST
### Linter/formatter configs
.eslintrc.json: EXISTS
eslint.config.mjs: EXISTS
.prettierrc.json: EXISTS

## Conventions
CONTRIBUTING.md: 111 lines
# Contributing to [github-readme-stats](https://github.com/anuraghazra/github-readme-stats)

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

-   Reporting [an issue](https://github.com/anuraghazra/github-readme-stats/issues/new?assignees=&labels=bug&template=bug_report.yml).
-   [Discussing](https://github.com/anuraghazra/github-readme-stats/discussions) the current state of the code.
-   Submitting [a fix](https://github.com/anuraghazra/github-readme-stats/compare).
-   Proposing [new features](https://github.com/anuraghazra/github-readme-stats/issues/new?assignees=&labels=enhancement&template=feature_request.yml).
-   Becoming a maintainer.

## All Changes Happen Through Pull Requests

Pull requests are the best way to propose changes. We actively welcome your pull requests:

1.  Fork the repo and create your branch from `master`.
2.  If you've added code that should be tested, add some tests' examples.
3.  If you've changed APIs, update the documentation.
4.  Issue that pull request!

## Under the hood of github-readme-stats
---END---

## Scalability
no env-based port config found
app_type: unknown

## Ergonomics
### npm scripts with watch/dev
no watch/dev scripts
### Determinism
sleep_pattern_count_in_tests: 0
### Largest source files
 14799 total
  1105 ./src/translations.js
   965 ./src/cards/top-languages.js
   886 ./tests/renderTopLanguagesCard.test.js
   687 ./scripts/preview-theme.js
   602 ./src/cards/stats.js
   507 ./tests/fetchStats.test.js
   481 ./src/cards/wakatime.js
   472 ./tests/renderStatsCard.test.js
   467 ./themes/index.js
   412 ./tests/api.test.js

=== END SIGNALS ===
