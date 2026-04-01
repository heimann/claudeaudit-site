# Eval Plan for claudeaudit

## Goal

Build an eval suite to measure whether the claudeaudit skill produces accurate, well-structured audit reports. Use the skill-creator plugin (`/skill-creator claudeaudit`) to run the eval loop.

## Why evals

The audit skill makes qualitative judgments - scoring categories 0-3 based on what it finds in a repo. We need to verify:

- Scores are accurate (not inflated, not missed signals)
- Output format matches the spec (grouped by maturity level, no /27 total)
- Recommendations are grounded in files that actually exist (not hallucinated)
- The skill outperforms Claude without the skill (baseline comparison)

## Test fixtures: real repos, not synthetic

We decided against building synthetic fixture repos. Synthetic fixtures only test whether the skill can pattern-match on obvious signals ("no CLAUDE.md exists, score 0"). The hard part is judgment on real-world ambiguity: a thin CLAUDE.md that doesn't actually help, tests that exist but don't catch regressions, structure that's "clear enough" but undocumented.

Use real public repos pinned to specific commit SHAs for reproducibility. The repos should not change between eval runs.

### Maturity spread needed

Pick 4-6 repos across the maturity spectrum:

- **Bad (Readable at best)**: A popular repo with minimal docs, no CLAUDE.md, no agent config. Should score poorly across the board.
- **Ok (Runnable)**: A well-documented project with good tests and CI, but no CLAUDE.md or agent-specific config. Runnable but not agent-ready.
- **Good (Safe)**: A repo with CLAUDE.md, linter hooks, permissions config, documented conventions.
- **Great (Scalable)**: A repo with full agent config, worktree safety, containerized dev environment.
- **claudeaudit itself**: We know exactly what's here. No tests, no CI, no linter, but has a CLAUDE.md now. Should score Bad/Ok at best.

### Selection criteria

- Pin to a specific commit SHA (not HEAD)
- Avoid repos with axios 1.14.1 or 0.30.4 (compromised versions from the March 2026 supply chain attack - check lock files)
- Prefer repos with clear expected scores so assertions are meaningful
- Mix of languages/frameworks to test the skill's generality

## Assertions

For each test case, define assertions that can be graded programmatically:

### Format assertions (all fixtures)
- Output contains a maturity level label (Bad/Ok/Good/Great)
- Scores are grouped by level (Readable/Runnable/Safe/Scalable headers present)
- No `/27` total appears anywhere
- Each category has a score in `{n}/3` format
- Sub-score blocks appear for categories below 3

### Accuracy assertions (per fixture)
- Maturity level matches expected value (or is within one level)
- Known-zero categories score 0 (e.g., a repo with no tests should score 0 on Self-verification)
- Known-high categories score >= 2
- Recommendations reference files that exist in the fixture repo

### Quality assertions
- Recommendations are actionable (not "improve X" but "add Y to Z")
- Findings cite specific file paths
- No hallucinated files or configs mentioned

## Running the evals

The skill-creator framework handles the mechanics:

1. Define test prompts in `evals/evals.json` (e.g., "audit this repo for AI agent readiness")
2. Each test case points at a fixture repo directory
3. Framework spawns paired subagents: one with the skill, one without (baseline)
4. Grader agent evaluates assertions against outputs
5. HTML viewer shows side-by-side results for human review
6. Iterate on the skill based on findings

Results go in `claudeaudit-workspace/iteration-N/`.

## Agent Readiness Index

Beyond evals, run the skill against the top 250 GitHub repos (by stars) on a weekly cadence to produce a public index of AI agent readiness adoption across the open source ecosystem.

### Why

- Track how the ecosystem is evolving: are popular projects adding CLAUDE.md, agent config, better test ergonomics?
- Create a public leaderboard/dataset that shows adoption trends over time
- Generate real-world signal about which audit categories are most commonly weak (informs skill priorities)
- Marketing for claudeaudit itself: "X% of the top 250 repos score Good or better"

### How

- Pull the top 250 repos by stars from the GitHub API weekly
- Run claudeaudit against each repo at its current HEAD
- Store results as structured data: repo, date, maturity level, per-category scores
- Track changes week-over-week (did a repo's score go up? did they add a CLAUDE.md?)
- Publish the index on claudeaudit.dev

### Data to capture per repo per week

- Repo name, stars, primary language
- Commit SHA at time of audit
- Overall maturity level
- All 9 category scores
- Delta from previous week (if any)

### Open design questions

- How to run 250 audits cheaply? Each audit uses significant tokens. Batch during off-peak? Use a smaller model for the bulk run and spot-check with the full model?
- Where to store the historical data? SQLite in this repo? A separate data repo? S3?
- What does the public-facing index look like on claudeaudit.dev? Table? Charts over time?
- Should repos be notified/credited when their score improves? (Could drive adoption)

## Scoring stability

A key eval dimension: does the same repo at the same commit SHA get the same scores every time? If not, the skill's judgments aren't reliable enough to publish as an index or use as a benchmark.

### What to measure

- Run the skill N times (5-10) against the same repo at the same commit
- Record all 9 category scores and the overall maturity level per run
- Compute per-category variance, stddev, and the range (max - min)
- Track whether the maturity level ever changes across runs (this is the most visible instability)

### Acceptable drift

- Maturity level should be identical across all runs for a given repo/commit. If it flips between Ok and Good across runs, the skill is unreliable.
- Individual category scores drifting by 1 point occasionally is tolerable (judgment calls on ambiguous signals). Drifting by 2+ points means the criteria are underspecified.
- Format and structure should never vary.

### What drift tells us

- High variance on a specific category means that category's rubric is too subjective or the signals are ambiguous. Tighten the criteria or add more concrete signals to check.
- Consistent drift on a specific repo means something about that repo's setup is genuinely ambiguous. That's useful information: it might mean the rubric has a gap.
- If the skill is stable on simple repos (clearly Bad or clearly Great) but unstable on middle-tier repos, that confirms the judgment problem is in the gray areas.

### How to use stability data

- Categories with high variance are the ones to improve first in the skill
- Stability scores could be reported alongside the index: "this repo's score has been stable at Good for 4 weeks" vs "this repo's score fluctuates between Ok and Good"
- For the weekly index, consider running each repo 3 times and taking the median to smooth out noise

## Open questions

- How to make fixture repos available to the eval subagents? Clone them into a fixtures/ directory? Or point at local clones?
- Should we test the skill against monorepos vs single-project repos specifically?
- How much do we care about token efficiency? The skill could be optimized to audit faster with fewer reads.
