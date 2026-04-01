# Agentic Ergonomics Rubric

The current claudeaudit skill measures whether a repo is *set up* for agents (right files, right config). This document captures the missing dimension: whether a repo is actually *pleasant and productive* for agents to work in. These are the things that determine whether an agent thrives or burns tokens spinning its wheels.

The current categories were designed from the "repo maintainer setting up for agents" perspective. What's missing is the "agent actually working in the repo" perspective.

## Proposed categories

### Feedback loop speed

How fast can the agent verify its change is correct?

"Tests exist" is not the same as "the agent can verify a change in under 30 seconds." A repo with a 45-minute CI suite and no way to run a single test is terrible for agents even if it technically scores well on Self-verification.

| Score | Criteria |
|-------|----------|
| 0 | No way to verify changes locally, or verification takes > 5 minutes for a single-file change |
| 1 | Full test suite runs locally but takes minutes. No way to scope to a single test or module |
| 2 | Agent can run a single relevant test or a scoped subset in under 30 seconds. Fast lint/typecheck available |
| 3 | Sub-second feedback on most changes via type checker, watcher, or incremental build. Scoped test runs are the documented default, not an afterthought |

Signals to check:
- Time to run the full test suite
- Whether a single-test command exists and is documented (e.g., `pytest path/to/test.py::test_name`, `mix test test/foo_test.exs:42`)
- Whether there's a fast typecheck or lint that catches errors before running tests
- Watch mode or incremental compilation available

### Error signal quality

When something breaks, does the agent get a useful signal or noise?

Good error messages are documentation the agent consumes every single iteration. A clear "expected User, got nil on line 43" is worth more than a 200-line stack trace through framework internals.

| Score | Criteria |
|-------|----------|
| 0 | Errors are cryptic, stack traces are unfiltered, failures don't point to the relevant code |
| 1 | Framework defaults are in place but error output is noisy. Agent has to parse through irrelevant frames to find the actual problem |
| 2 | Error output is concise and points to user code, not framework internals. Test failures show expected vs actual clearly |
| 3 | Custom error handling that produces agent-friendly output. Errors include context about what to fix, not just what went wrong. Stack traces are filtered to relevant frames |

Signals to check:
- Run a failing test and look at the output: is the cause obvious in the first 5 lines?
- Do compilation/type errors point to the exact line and explain the mismatch?
- Are there custom error formatters or is it raw framework output?
- Do build errors distinguish between user mistakes and environment issues?

### Type system and static analysis

Does the codebase give the agent fast, reliable feedback through types and static analysis?

A well-typed TypeScript codebase with strict mode gives the agent instant feedback on mistakes without running anything. An untyped Python codebase with no mypy means the agent is flying blind until runtime.

| Score | Criteria |
|-------|----------|
| 0 | No type system, no static analysis. Agent discovers mistakes only at runtime |
| 1 | Types exist but are partial, loose, or not enforced (e.g., TypeScript with `any` everywhere, Python with sparse type hints and no mypy) |
| 2 | Types cover critical paths and are enforced in CI. Agent can typecheck before running tests. Major interfaces are well-typed |
| 3 | Strict type checking across the codebase. Types serve as documentation: the agent can understand function contracts from signatures alone. Static analysis catches common mistakes before any code runs |

Signals to check:
- TypeScript strict mode, mypy strict, Rust (inherently typed), Go (inherently typed)
- Percentage of `any` types or untyped functions
- Whether typecheck runs in CI
- Whether typecheck is fast enough to run on every change (< 10 seconds)

### Incremental verifiability

Can the agent verify a change to one module without running everything?

| Score | Criteria |
|-------|----------|
| 0 | All-or-nothing: the only way to verify is running the entire suite |
| 1 | Tests can technically be scoped by file path but there's no guidance on how, and some tests have hidden cross-dependencies |
| 2 | Per-module or per-package test/lint/typecheck commands exist. Tests are isolated and don't depend on run order |
| 3 | Module boundaries are enforced so changes to one module can be verified entirely within that module. Dependency graph is explicit and tooling respects it |

Signals to check:
- Can you run tests for just one directory/package/module?
- Do tests have hidden dependencies on other tests or shared mutable state?
- Is there a monorepo tool (nx, turborepo, bazel) that understands the dependency graph?
- Does CI run affected tests only, or everything?

### Determinism

Does the same command give the same result every time?

Flaky tests, non-deterministic builds, time-dependent behavior, and tests that depend on network calls mean the agent can't trust its own feedback loop.

| Score | Criteria |
|-------|----------|
| 0 | Tests are flaky, builds are non-reproducible, or tests depend on external services without mocks |
| 1 | Most tests pass consistently but some are known-flaky or time-dependent. Build is mostly reproducible with lock files |
| 2 | Tests are deterministic and isolated. External dependencies are mocked or stubbed for tests. No time-dependent or order-dependent tests |
| 3 | Full reproducibility: seeded randomness, hermetic builds, no network in tests. Any non-determinism is explicitly flagged and quarantined |

Signals to check:
- Run the test suite twice: same results?
- Are there sleeps, retries, or "eventually consistent" patterns in tests?
- Do tests hit real network endpoints?
- Are there known-flaky tests that are skipped or retried?
- Lock files present and used consistently

### Codebase coupling

Can work be broken into small, independent changes?

Tightly coupled code means the agent has to hold more context and is more likely to break something unrelated. Loosely coupled code lets the agent make small, safe changes.

| Score | Criteria |
|-------|----------|
| 0 | God objects, circular dependencies, global mutable state. Every change risks breaking something unrelated |
| 1 | Some module boundaries exist but cross-module dependencies are common. Changing one feature often requires touching 5+ files |
| 2 | Clear module boundaries with defined interfaces. Most features can be changed by touching 1-3 files. Dependency direction is mostly one-way |
| 3 | Strict module boundaries enforced by tooling. Dependency injection or clear interfaces between modules. Agent can confidently change one module without understanding the entire codebase |

Signals to check:
- Average number of files changed per recent commit (proxy for coupling)
- Circular dependency detection (e.g., madge, deptry)
- Whether imports cross module boundaries freely or go through defined interfaces
- God files (files > 1000 lines that do too many things)

## Integration with the existing skill

These categories could be:

1. **A separate maturity dimension** - "Config Readiness" (current skill) vs "Ergonomic Readiness" (this rubric). Two separate scores.
2. **Woven into existing categories** - Upgrade Self-verification to include feedback loop speed, add Error quality as a signal in Code quality hooks, etc.
3. **A replacement for the weaker current categories** - Swap out Sandbox compatibility and Worktree readiness (aspirational for most repos) with Feedback loop speed and Determinism (universally relevant).

Option 3 is the most opinionated. Option 1 is the safest. The right answer probably depends on whether we want one score or two.

## Measurement challenge

These categories are harder to audit than "does this file exist." Some require actually running commands and timing them (feedback loop speed), reading error output (error quality), or analyzing dependency graphs (coupling). The audit skill would need to:

- Run the test suite (or a subset) and measure time
- Intentionally break something and check error output quality
- Analyze import graphs or use existing tooling (madge, deptry, etc.)
- Check for type coverage metrics

This makes the audit more active (running things) vs the current passive approach (reading files). That's a significant change in how the skill operates and what permissions it needs.
