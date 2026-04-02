---
name: claudeaudit
description: Audit any repository for AI agent readiness — how well can Claude Code (or any AI coding agent) understand, run, verify, and scale across this codebase? Use this skill whenever the user asks to audit, assess, or score a repo's agent-readiness, mentions "claudeaudit", or asks how to make their repo better for AI agents. Also trigger when users ask about improving their claude.md, CLAUDE.md, or .claude/ configuration, or want to know if their repo is "ready for Claude Code."
---

# claudeaudit

Assess how ready a repository is for autonomous AI agent work. Produce a structured audit with a maturity level (L0–L3), per-category scores, and concrete next steps.

## Repository context

- Recent commits: !`git log --oneline -20`
- File count: !`git ls-files --cached --others --exclude-standard | wc -l`

## How to run

1. Identify the repository root (the directory containing `.git/`)
2. Run through each audit category below, checking for the listed signals
3. Score each category 0–3
4. Compute the overall maturity level
5. Output the audit report

## Maturity levels

- **Bad — Readable**: The agent can understand the repo (has documentation, clear structure)
- **Ok — Runnable**: The agent can bootstrap and verify the app (deps install, app starts, tests pass)
- **Good — Safe**: The agent can work confidently (linting hooks, permissions, formatting rules)
- **Great — Scalable**: The agent can run in parallel sessions (worktrees, sandboxes, no collisions)

Overall level is computed mechanically - see "Computing the maturity level" below. Do not eyeball it.

---

## Audit categories

### Bad — Readable

#### 1. Agent documentation (`/3`)

Check for the presence and quality of agent-oriented documentation. This is distinct from general project docs — it's specifically about whether an AI agent can orient itself.

| Score | Criteria |
|-------|----------|
| 0 | No agent-oriented documentation of any kind. No CLAUDE.md, no .agents/, no .cursorrules, no copilot-instructions.md |
| 1 | Agent docs exist but are thin (< 20 lines, or just boilerplate). Or: a substantial agent skill exists (e.g., .agents/skills/) but no root-level orientation doc covering project architecture and conventions |
| 2 | Agent docs cover project purpose, architecture, conventions, and how to run/test - agent can orient itself without reading every source file. Accepted formats: CLAUDE.md, AGENTS.md, .agents/skills/ with comprehensive SKILL.md, .cursorrules, .github/copilot-instructions.md, or any structured agent-oriented doc. A single @import to a comprehensive file counts if that file covers the same ground |
| 3 | Multi-level agent docs: root-level orientation plus sub-module documentation (subdirectory docs, @imports, or skill reference files that provide module-specific guidance). Docs cover not just what to do but what NOT to do (anti-patterns, decision rationale). Score 3 requires depth across the codebase, not just one thorough top-level file |

Signals to check:
- `CLAUDE.md`, `AGENTS.md`, or `.claude/` at repo root
- `.agents/`, `.agents/skills/` with skill files
- Subdirectory agent docs (e.g., `src/CLAUDE.md`, `lib/CLAUDE.md`)
- `.cursorrules`, `.github/copilot-instructions.md`, or similar
- Whether docs mention: architecture, conventions, testing approach, common pitfalls
- If agent docs exist in a non-CLAUDE.md format (AGENTS.md, .agents/skills/, .cursorrules), recommend adding a CLAUDE.md with an @import pointing to the existing docs. This makes the content discoverable by Claude Code without duplicating it

#### 2. Repository structure (`/3`)

Can the agent understand the codebase layout without guessing?

| Score | Criteria |
|-------|----------|
| 0 | Flat or chaotic structure, no clear entry points |
| 1 | Standard framework layout (e.g., Phoenix, Rails, Next.js) — agent can infer structure from convention |
| 2 | Agent can find entry points and module boundaries without guessing. README or docs explain the layout, not just list it |
| 3 | Module boundaries are enforced, not just documented (workspace configs, import restrictions, clear package boundaries). Entry points are obvious from structure alone |

Signals to check:
- Standard framework conventions followed
- README.md with project overview
- Clear separation of concerns (not everything in one directory)
- For monorepos: workspace config, package boundaries documented

---

### Ok — Runnable

#### 3. Dependency bootstrapping (`/3`)

Can the agent go from a fresh clone to a running app?

| Score | Criteria |
|-------|----------|
| 0 | No setup instructions. Missing lock files. Undocumented system dependencies |
| 1 | Setup instructions exist but require human judgment (e.g., "install Postgres" with no version or method specified) |
| 2 | A single documented command gets the agent from clone to running/testable (e.g., `mix setup`, `make dev`, `docker compose up`). Lock files present. System deps documented or containerized. If env vars are needed, `.env.example` or `.env.template` exists |
| 3 | Truly zero-friction: one command from clone to running. A devcontainer, Docker Compose, or well-configured setup script that handles everything (language runtime, system deps, database, seed data) with no manual steps. No manual env var setup required. The agent doesn't need to know what language version to install or what system packages are needed. Two-step processes (e.g., "install tool X then run make dev") are a 2, not a 3 |

Signals to check:
- `mix setup` / `npm install` / `make` / `docker compose` scripts
- `.env.example` or `.env.template` (NOT `.env` committed — that's a different problem)
- `Dockerfile`, `docker-compose.yml`, `.devcontainer/`
- `Makefile`, `Justfile`, or `bin/setup` scripts
- System dependency documentation (database, Redis, etc.)
- Lock files present and not stale (`mix.lock`, `package-lock.json`, `Cargo.lock`)

#### 4. Self-verification (`/3`)

Can the agent confirm the app works end-to-end without asking a human?

| Score | Criteria |
|-------|----------|
| 0 | No tests, or tests that don't run without manual setup |
| 1 | Unit tests exist, pass, and the agent knows which command to run (documented or inferable from manifest) |
| 2 | Tests cover critical paths and catch real regressions, not just token coverage. Test database seeds automatically. CI config shows canonical test commands. Agent can run the full suite without manual intervention |
| 3 | All of score 2, plus: agent can run scoped tests (single file or module) for fast feedback. Test output is agent-friendly (quiet/summary mode available or output is concise by default). E2E or integration tests exist for critical user flows, not just unit tests. Seed data available if applicable |

Signals to check:
- Test files exist and follow framework conventions
- Test runner documented or inferable (`mix test`, `pytest`, `cargo test`)
- `priv/repo/seeds.exs`, `db/seeds.rb`, seed scripts
- E2E test setup (Playwright, Cypress, Wallaby configs)
- CI config (`.github/workflows/`, `.gitlab-ci.yml`) — shows the canonical test commands
- Test database config (can tests run without a pre-existing database?)
- Whether test commands support quiet/silent modes that only output on failure (e.g., `pytest -q`, `mix test --quiet`, `npm test -- --silent`) — noisy pass output wastes agent context window

---

### Good — Safe

#### 5. Permissions and tool access (`/3`)

Is the agent's access properly scoped?

| Score | Criteria |
|-------|----------|
| 0 | No agent permissions config of any kind. No `.claude/settings.json`, no `.agents/` capability scoping, no tool restrictions in any agent config format |
| 1 | Agent permissions config exists but is overly permissive (e.g., allows all bash) or overly restrictive (blocks test runners). Or: agent skills/docs exist that implicitly scope work but no explicit permission boundaries |
| 2 | Agent tool access is explicitly scoped: test commands, build tools, linters are pre-approved, dangerous operations are gated. Accepted formats: `.claude/settings.json` with `allowedTools`, `.agents/` with capability definitions, `.cursorrules` with tool restrictions, or equivalent |
| 3 | All of score 2, plus at least two of: (a) explicit deny list for dangerous operations, (b) custom skills or hooks for project workflows, (c) MCP or tool servers configured, (d) tool access documented in agent docs. Permissions show intentional design, not just a basic allow list |

Signals to check:
- `.claude/settings.json` at repo root (allowedTools, blockedTools)
- `.agents/` with capability scoping or permission boundaries
- `.cursorrules` with tool restrictions
- Custom skills (`.claude/skills/`, `.claude/commands/`, `.agents/skills/`)
- Whether test/build/lint commands are pre-approved in any config
- MCP or tool server configs
- Tool access documented in agent docs

#### 6. Code quality hooks (`/3`)

Are there automated guardrails the agent can lean on?

| Score | Criteria |
|-------|----------|
| 0 | No linter, no formatter, no hooks of any kind |
| 1 | Linter/formatter config exists but no automation (agent has to know to run it) |
| 2 | Automated enforcement exists: git hooks (pre-commit, husky, lefthook), Claude hooks (PreToolUse/PostToolUse in settings.json), or CI checks. Config is consistent with what CI runs |
| 3 | Hooks are set up AND documented in agent docs. Agent knows: what runs automatically, what format to follow, what will fail CI. Lint/format commands are in the permissions allowlist |

Signals to check:
- Claude hooks: PreToolUse/PostToolUse in `.claude/settings.json` (e.g., block --no-verify, auto-format)
- Git hooks: `.pre-commit-config.yaml`, `.husky/`, `.lefthook.yml`
- Linter configs: `.credo.exs`, `.eslintrc`, `ruff.toml`, `rustfmt.toml`
- Formatter configs: `.formatter.exs`, `.prettierrc`
- Whether agent docs mention lint/format commands
- CI pipeline includes lint/format checks
- When recommending hooks, prefer Claude hooks (PreToolUse/PostToolUse) over git hooks - they are more relevant for agent workflows and don't require git hook installation
- Whether lint/format commands are configured for minimal output on success (agents don't need 200 lines of "all clear")

#### 7. Rules and conventions (`/3`)

Does the repo encode its opinions so the agent follows them?

| Score | Criteria |
|-------|----------|
| 0 | No documented conventions in prose or agent-oriented docs. Linter/formatter config files alone do not count - they enforce style but don't tell the agent about project-specific patterns, naming, architecture decisions, or workflow expectations |
| 1 | Basic conventions mentioned in README, CONTRIBUTING.md, or similar (e.g., "we use Tailwind", "commits should be conventional"). Or: conventions are inferable from well-configured linter/formatter/editorconfig files, but not explained in prose |
| 2 | Conventions are specific enough to follow without seeing examples: naming patterns, error handling approach, testing expectations. In CLAUDE.md or well-structured docs |
| 3 | Conventions are machine-enforceable where possible (linter rules, not just prose). Rules reference WHY, not just WHAT. Covers commit format, PR conventions, module boundaries, error handling, test structure |

Signals to check:
- CLAUDE.md convention sections
- `CONTRIBUTING.md`
- Architecture decision records (ADRs) in `docs/`
- Naming patterns consistent across codebase
- Error handling patterns documented
- Commit message conventions (conventional commits, etc.)

---

### Great — Scalable

#### 8. Worktree readiness (`/3`)

Can multiple agent sessions work in parallel without conflicts?

| Score | Criteria |
|-------|----------|
Score based on **actual collision risk**, not just configuration presence. A stateless CLI tool or pure library has no collision surface and should score well without explicit worktree config.

| Score | Criteria |
|-------|----------|
| 0 | Hardcoded absolute paths, state written outside repo, port collisions likely. Multiple sessions WILL interfere |
| 1 | Relative paths used but shared state issues likely (single SQLite file, hardcoded ports with no override, shared tmp dirs). Multiple sessions MIGHT interfere |
| 2 | Either: (a) the app has no collision surface (stateless CLI, library, no ports, no local DB), or (b) ports and database URLs are configurable via env vars, no repo-external state. Could work in parallel worktrees with minor env tweaks |
| 3 | Explicitly designed for parallel sessions: ports derived from env var or worktree path, database per-worktree or per-session, no singleton resources. Or containerized so each session is isolated. Or: app is inherently stateless AND documents this fact for agent confidence |

Signals to check:
- Does the app bind ports? If yes, are they configurable via env var (not just CLI flag)?
- Does the app write local state (SQLite, PID files, lock files, Unix sockets)?
- Hardcoded absolute paths (`/home/`, `/Users/`, `/tmp/specific-name`)
- Shared cache directories (e.g., appdirs, XDG cache with fixed paths)
- For web apps: `PORT` env var support is the minimum bar
- Docker Compose with configurable service names/ports
- For stateless tools (CLI, library, build tool): inherently low-risk, score based on whether any shared state exists at all

#### 9. Sandbox compatibility (`/3`)

Can the agent build, test, and develop in a restricted environment (container, VM, CI runner) without host-specific resources?

Score based on **actual friction**, not container config presence. A trivially simple app with no system deps is inherently sandbox-compatible and should score well even without a Dockerfile.

| Score | Criteria |
|-------|----------|
| 0 | Dev workflow requires resources sandboxes typically cannot provide: GPU/display server, host network/PID namespace, specific OS services, or undocumented system packages with no install path |
| 1 | Dev workflow mostly works in a sandbox but has friction: needs system packages that are documented but not automated (e.g., "install FFmpeg"), or some features fail without host access. External API keys needed but not documented |
| 2 | Dev workflow runs in a sandbox with minimal setup. Either: (a) the app has few enough system deps that standard language runtimes suffice (e.g., pure Node.js, pure Python with no native extensions), or (b) a Dockerfile/devcontainer automates the heavier setup. External deps are optional or mockable. Network requirements documented |
| 3 | Explicitly sandbox-ready: Dockerfile or devcontainer tested in restricted environments, external deps stubbed for dev, no host resource assumptions. `.claude/settings.json` permissions pre-configured. Or: the app is trivially portable (no system deps, no network, no external services) AND documents this fact |

Signals to check:
- System dependency weight: does the app need only a language runtime, or also native packages, databases, display servers?
- `Dockerfile`, `docker-compose.yml`, `.devcontainer/` (important for heavy deps, less important for trivially portable apps)
- External service dependencies (APIs, databases, cloud services) and whether they have dev/mock modes
- Network egress requirements documented
- Whether the app actually runs in a fresh container or VM (not just "has a Dockerfile")
- `.claude/settings.json` configured for sandbox permissions

---

## Ergonomics

A separate dimension from config readiness. Config readiness measures whether the repo is *set up* for agents. Ergonomics measures whether the repo is *pleasant and productive* for agents to work in. Config is a baseline you set up once; ergonomics improves continuously over time.

Ergonomics scores are reported as flat scores (no maturity level) and do not affect the config readiness maturity level. They are independent dimensions.

All ergonomics signals are measured passively (reading files, git metadata, file stats). No application code is executed.

### 10. Feedback loop (`/3`)

How fast can the agent verify its change is correct? "Tests exist" is not the same as "the agent can verify a change in under 30 seconds."

| Score | Criteria |
|-------|----------|
| 0 | No way to verify changes, or test suite is monolithic with no scoping |
| 1 | Tests exist and run locally but are all-or-nothing. No documented way to run a single test or scoped subset |
| 2 | Scoped test command exists and is documented (e.g., `pytest path::test`, `mix test file:line`). Fast lint or typecheck available as a pre-test check |
| 3 | Scoped tests are the documented default. Watch mode or incremental build configured. Agent can get feedback on a single-file change in seconds, not minutes |

Signals to check:
- Whether a scoped test command is documented (in CLAUDE.md, README, or test config)
- Watch mode config (jest --watch, mix test --watch, tsc --watch, nodemon)
- Whether tests support parallel execution
- Test suite size (number of test files as a rough proxy for suite runtime)
- Whether there's a fast typecheck or lint that runs before the full suite

### 11. Error signal quality (`/3`)

When something breaks, does the agent get a useful signal or noise? This category is harder to assess passively - score based on configuration and framework choice rather than actual output.

| Score | Criteria |
|-------|----------|
| 0 | No test framework, or a framework known for cryptic output with no customization |
| 1 | Standard framework with default error output. No custom reporters, no stack trace filtering, no error formatters configured |
| 2 | Configured for concise output: custom test reporter, `--tb=short` or equivalent as default, stack trace filtering, or a framework with naturally concise errors (Go, Rust, Elm) |
| 3 | Custom error formatters or structured error types with context fields. Test output is explicitly optimized for readability (custom reporters, filtered frames, expected-vs-actual formatting) |

Signals to check:
- Test reporter configuration (mocha reporter, pytest conftest, jest config)
- Stack trace filtering config (--tb=short defaults, --no-stack-trace)
- Custom exception/error classes with context fields
- Framework choice (Go/Rust/Elm naturally concise vs raw Java/C++ stack traces)
- Error formatter or pretty-printer configs

### 12. Type system and static analysis (`/3`)

Does the codebase give the agent fast, reliable feedback through types and static analysis before running anything?

| Score | Criteria |
|-------|----------|
| 0 | No type system, no static analysis. Agent discovers mistakes only at runtime. Or: dynamically typed language with no type annotations and no linter |
| 1 | Types exist but are partial, loose, or not enforced. TypeScript without strict mode, Python with sparse hints and no mypy, prevalent `any`/`Any` usage |
| 2 | Types cover critical paths and are enforced in CI. Typecheck runs as part of the dev workflow. Major interfaces are well-typed. Minimal `any` usage |
| 3 | Strict type checking across the codebase (TypeScript strict, mypy strict, Rust, Go). Types serve as documentation - agent can understand function contracts from signatures alone. Static analysis catches common mistakes before any code runs |

Signals to check:
- TypeScript: `strict: true` in tsconfig.json
- Python: mypy/pyright config with strict mode
- Rust, Go: inherently typed (score based on whether the type system is leveraged well)
- Prevalence of `any` / `Any` / untyped functions
- Whether typecheck runs in CI
- Type coverage tooling configured

### 13. Determinism (`/3`)

Does the same command give the same result every time? Flaky tests, time-dependent behavior, and network calls in tests mean the agent cannot trust its own feedback loop.

| Score | Criteria |
|-------|----------|
| 0 | Tests depend on external services (third-party APIs, cloud endpoints) with no mocking. Or: known-flaky tests with no quarantine strategy. Note: tests hitting a local test server started by a fixture are NOT external - they are a timing dependency (score 1), not a network dependency (score 0) |
| 1 | Most tests are stable but some have timing dependencies (sleeps, retries, timeouts, or local HTTP server fixtures). External deps are partially mocked. Lock files present |
| 2 | Tests are isolated: external deps mocked/stubbed, no sleeps or timing-dependent assertions, no network calls in test files. Lock files used consistently |
| 3 | Full determinism: seeded randomness, hermetic builds, no network in tests. Any non-determinism is explicitly quarantined (marked flaky, skipped in CI, or run separately) |

Signals to check:
- `sleep`, `time.sleep`, `setTimeout` patterns in test files
- `retry`, `retries`, `flaky` annotations in test configs
- Network calls in test files (fetch, http, requests, axios)
- Random usage without seeding in test files
- Mock/stub/fake patterns in test files (indicates external deps are isolated)
- Test config timeouts and retry settings

### 14. Change locality (`/3`)

Can the agent understand and change one part of the codebase without loading everything? Combines coupling (how many files must change) with digestibility (how many files must be read).

| Score | Criteria |
|-------|----------|
| 0 | God files (large files doing multiple unrelated things), circular dependencies, global mutable state. Average commit touches 5+ files. Agent must understand the entire codebase to change anything |
| 1 | Some module boundaries but files are large (many > 500 lines). Cross-module dependencies are common. Average commit touches 3-5 files |
| 2 | Clear module boundaries with defined interfaces. Most files are < 500 lines. Average commit touches 1-3 files. Modules have clear entry points (barrel exports, __init__.py with __all__) |
| 3 | Strict module boundaries enforced by tooling. Files are focused (< 300 lines typical). Dependency direction is one-way. Agent can confidently change one module by reading only that module's files |

Large files (> 1000 lines) are NOT automatically god files. Use judgment:
- Generated files, data files, type definitions, and test fixtures that are large but single-purpose: do NOT penalize. Note them as generated/data in the report.
- Files that mix multiple concerns (routing + business logic + helpers, or a class that handles UI + state + networking): these are god files. Penalize.
- The test: if an agent needs to change one behavior in the file, does it need to understand the whole file? If yes, it's a god file.

Signals to check:
- Largest source files by line count (top 10, excluding generated/vendor/lock files)
- Average files changed per commit (last 50 commits via git log --stat)
- Barrel exports or public API definitions (__init__.py, index.ts re-exports)
- Circular dependencies between sibling modules
- Directory nesting depth
- God files (files > 1000 lines)

---

## Output format

Produce the audit as a structured report:

```
claudeaudit - {repo_name}

{Level} ({next_level_blocker})

  docs {s}  structure {s}  bootstrap {s}  tests {s}  perms {s}  hooks {s}  rules {s}  worktree {s}  sandbox {s}
  feedback {s}  errors {s}  types {s}  determinism {s}  locality {s}

Top fixes:
1. {Concrete action} -> {what it unlocks}
2. {Concrete action} -> {what it unlocks}
3. {Concrete action} -> {what it unlocks}
```

Guidelines for the report:
- **Level line**: Show the level (Bad/Ok/Good/Great) and what's blocking the next level. E.g., "Ok (permissions blocks Safe)" or "Great (all tiers passed)".
- **Score line**: Compact single-line scores, just the numbers. No /3 suffix, no category full names. Keep it scannable.
- **Top fixes**: List only the 3-5 highest-impact fixes, ordered by what unblocks the next maturity level first. Each fix should be one concrete sentence with a specific file or command, not a paragraph. Include what it unlocks (e.g., "-> unlocks Safe", "-> types 1->2").
- **No detailed sub-score blocks by default**. The top fixes ARE the actionable output. If the user asks for details on a specific category, provide them then.
- Keep the entire report under 15 lines. Brevity is the point.

After presenting the report, offer to fix the gaps step by step. Start with the fix that unblocks the next maturity level. Ask the user what they want to tackle before starting any work.

## Running the audit

Use a two-phase approach: fast exploration first, then judgment-based scoring.

### Phase 1: Explore (parallel, use fast model)

Spawn 5 exploration agents in parallel using the Agent tool with `model: "haiku"`. Each agent explores one signal group and returns a structured facts-only report. Point each agent at the repo root directory.

Each agent's prompt should begin with "Explore the repository at {repo_root} and report FACTS ONLY. Use the Glob tool to find files, the Read tool to read them, and the Grep tool to search contents. Avoid using the Bash tool unless you really need it - it triggers permission prompts that interrupt the user." followed by one of these signal checklists:

**Agent 1: Documentation and Structure**
- Does CLAUDE.md exist at root? If yes, how many lines? What does it cover?
- Does .claude/ directory exist? What's in it? (settings.json, skills/, commands/)
- Are there subdirectory CLAUDE.md files? (check src/, lib/, test/, app/, etc.)
- Does .cursorrules or .github/copilot-instructions.md exist?
- Are there @import directives in any CLAUDE.md files?
- What topics do the agent docs cover? (architecture, conventions, testing, pitfalls, anti-patterns)
- What's the top-level directory layout? List all directories and key root files.
- Does README.md (or README.rst) exist? Summarize the first 30 lines.
- Are there clear entry points? (main files, index files, __main__.py, etc.)
- Is it a monorepo? If so, workspace config? (package.json workspaces, go.work, etc.)
- Are module boundaries enforced? (import restrictions, tsconfig paths, workspace configs, linter rules)

**Agent 2: Dependencies and Testing**
- What package manager is used? (npm, pip, cargo, mix, go mod, uv, etc.)
- Does a lock file exist? (package-lock.json, Cargo.lock, mix.lock, go.sum, uv.lock, etc.)
- Is there a single setup command? (Makefile target, bin/setup, docker compose, etc.) Or multiple steps?
- Does .env.example or .env.template exist?
- Does Dockerfile or .devcontainer/ exist? Is it for dev or just deployment?
- What system dependencies are needed beyond the language runtime? (databases, native libs, etc.)
- Is there a .tool-versions, .nvmrc, .python-version, or similar runtime version file?
- Do test files exist? What framework? How many test files?
- What's the test command? Is it documented? Where?
- Does CI config exist? (.github/workflows/, .gitlab-ci.yml) What does it run?
- Can tests be scoped to a single file or test? Is this documented?
- Is there a quiet/summary mode for test output? (e.g., pytest -q, mocha --reporter min)
- Do E2E/integration tests exist? (Playwright, Cypress, Selenium, Wallaby, etc.)
- Are there seed files or test fixtures?

**Agent 3: Permissions, Quality, and Conventions**
- Does .claude/settings.json exist? If yes, paste the full contents.
- Are there allowedTools? blockedTools? List them.
- Are there custom skills in .claude/skills/ or .claude/commands/? List them with descriptions.
- Are there hooks? (PreToolUse, PostToolUse) What do they do?
- Does .claude/mcp.json exist?
- Pre-commit hooks? (.pre-commit-config.yaml, .husky/, .lefthook.yml) What do they run?
- Linter configs? (.eslintrc*, .credo.exs, ruff.toml, rustfmt.toml, .rubocop.yml, biome.json)
- Formatter configs? (.prettierrc*, .formatter.exs, .editorconfig)
- Does CI run lint/format checks? Which ones?
- Do local hooks match what CI checks?
- Does CONTRIBUTING.md exist? What does it cover?
- Are conventions documented in CLAUDE.md or agent docs? What specifically?
- Are there ADRs in docs/?
- What naming patterns are documented or inferable from config?
- Are commit message conventions documented?
- Are there machine-enforceable convention rules? (linter rules that encode project patterns, not just style)

**Agent 4: Scalability**
- Are there hardcoded ports in config files? Search for port numbers in config/source.
- Are there hardcoded absolute paths? (/home/, /Users/, /tmp/specific-name)
- Does the app bind network ports? If so, configurable via env var or only CLI flag?
- Does the app use SQLite or local databases? Hardcoded or configurable path?
- Are there PID files, lock files, or Unix sockets with fixed paths?
- Is there shared state outside the repo directory? (cache dirs, appdirs, XDG dirs)
- Is this a CLI tool, library, or server? What kind of app is it?
- What system dependencies does the app need beyond the language runtime? List all.
- Does Dockerfile exist? Does it work for dev or just deployment?
- Does docker-compose exist? Does it use host networking, host PID, or privileged mode?
- Does .devcontainer/ exist?
- Are there external API dependencies? Do they have mock/dev modes?
- Does the app need network egress for development or testing?
- Are there native extensions or OS-specific packages needed?

**Agent 5: Ergonomics**
- How many test files exist? Roughly how large is the test suite?
- Is there a scoped test command documented? (e.g., `pytest path::test_name`, `mix test file:line`, `go test -run Name`, `mocha --grep`)
- Is there a watch mode or file watcher configured? (e.g., jest --watch, mix test --watch, nodemon, tsc --watch)
- Is there an incremental build or typecheck that runs faster than the full suite?
- Does the test runner support parallel execution? Is it configured?
- Is there a custom test reporter configured? (e.g., pytest conftest customization, mocha reporter setting, jest config)
- Are there custom exception/error classes in the codebase? Do they include context fields?
- Is stack trace filtering configured? (e.g., pytest --tb=short as default, jest --no-stack-trace)
- What test framework is used? (Note: Rust, Elm, Go have naturally concise error output)
- Is there a type system? What kind? (TypeScript, mypy, Rust, Go, Flow, etc.)
- For TypeScript: is strict mode enabled in tsconfig.json? Check the `strict` field.
- For Python: does mypy.ini, pyproject.toml [tool.mypy], or setup.cfg [mypy] exist? Is strict mode on?
- Search for `any` type usage: how prevalent is it? (grep for `: any` in TypeScript, `Any` in Python)
- Does CI run a typecheck step? (tsc --noEmit, mypy, pyright, etc.)
- Search test files for patterns suggesting non-determinism: `sleep`, `time.sleep`, `setTimeout`, `retry`, `retries`, `flaky`, network calls (`fetch`, `http`, `requests.get`, `axios`), `random`/`Math.random` without seeding
- Are there known-flaky test annotations? Do test configs set timeouts or retries?
- Are external services mocked in tests? (check for mock/stub/fake patterns)
- Are there files > 500 lines? List them with line counts. (Note: git log stats and largest file data are pre-injected in the "Repository context" section above - use that data rather than running commands)
- Check for barrel exports or public API definitions (__init__.py with __all__, index.ts re-exports)

Each agent should output a structured facts-only report. Wait for all 5 agents to complete before proceeding.

### Phase 2: Score (judgment, use current model)

Once all exploration agents return, assemble their signal reports into a single evidence document. Then score each of the 9 categories against the rubric above.

For each category:
1. Review the relevant signals from the exploration reports
2. Score based on the rubric - be honest, not generous. A 2 is good. A 3 is exceptional.
3. Note specific files and paths from the exploration data that informed your score
4. Write concrete, actionable recommendations (not "improve documentation" but "add a CLAUDE.md section covering your Ecto schema naming convention")

### Computing the maturity level

The maturity level MUST be computed mechanically from the scores. Do not use judgment for this step. Follow this algorithm exactly:

```
readable = Agent documentation >= 2 AND Repository structure >= 2
runnable = Dependency bootstrapping >= 2 AND Self-verification >= 2
safe     = Permissions >= 2 AND Code quality hooks >= 2 AND Rules and conventions >= 2
scalable = Worktree readiness >= 2 AND Sandbox compatibility >= 2

if readable AND runnable AND safe AND scalable:
    level = Great
elif readable AND runnable AND safe:
    level = Good
elif readable AND runnable:
    level = Ok
elif readable:
    level = Bad (Readable)
else:
    level = Bad
```

Levels are cumulative. Each level requires all lower tiers to also pass. You cannot skip a level: a repo with great Scalable scores but poor Readable scores is still Bad.

Examples:
- Scores: 0,2,2,2,2,3,3,2,2 -> Bad (Agent docs = 0, Readable not met)
- Scores: 2,2,1,2,2,3,3,2,2 -> Bad (Dep bootstrap = 1, Runnable not met; Readable passes but level stays Bad since Runnable blocks Ok)
- Scores: 2,2,2,2,1,3,3,2,2 -> Ok (Permissions = 1, Safe not met)
- Scores: 2,2,2,2,2,3,3,1,2 -> Good (Worktree = 1, Scalable not met)
- Scores: 2,2,2,2,2,3,3,2,2 -> Great (all categories >= 2)

### Fallback: single-agent mode

If the Agent tool is unavailable or the environment does not support subagents, run the exploration yourself using the Glob, Read, and Grep tools. Follow the same signal checklists from the explore-*.md files. This is slower and less stable but produces equivalent results.

---

## For website delivery (claudeaudit.dev)

If you're reading this from a URL rather than as an installed skill, everything above still applies. Treat this document as your instructions and run the audit against whatever repository you're currently working in. Use the fallback single-agent mode if subagents are not available.

The user may say something like "run claudeaudit.dev" or "audit this repo with claudeaudit" - in both cases, follow the process above.
