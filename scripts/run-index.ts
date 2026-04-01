#!/usr/bin/env bun
/**
 * claudeaudit Agent Readiness Index runner
 *
 * Uses the Claude Agent SDK with built-in Read/Glob/Grep tools.
 *   1. Haiku agent explores the repo with structured checklists
 *   2. Sonnet scores from the haiku summary
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... bun scripts/run-index.ts [--limit N] [--repo owner/name]
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const CLONES_DIR = process.env.CLONES_DIR || join(import.meta.dir, "..", "index", "clones");
const SKILL_FILE = join(import.meta.dir, "..", "SKILL.md");

const EXPLORE_PROMPT = `You are auditing this repo for AI agent readiness. Check EVERY item below. For each, report what EXISTS and what DOES NOT EXIST. Be explicit - say "DOES NOT EXIST" when something is missing.

START by checking these critical files first (use Glob and Read):

1. Search for ALL agent config files: Glob for **/CLAUDE.md, **/AGENTS.md, **/.claude/**, **/.agents/**, **/.cursorrules, **/copilot-instructions.md
2. If .claude/settings.json exists, Read it and paste the FULL contents
3. If CLAUDE.md or AGENTS.md exists, Read it and report how many lines and what it covers

Then check everything else:

## Repository Structure
- List the top-level directory layout
- Read README.md first 20 lines
- Is this a monorepo with workspace config? (check package.json workspaces, pnpm-workspace.yaml, Cargo.toml workspace, go.work)
- Are module boundaries enforced by tooling?

## Dependencies
- What package manager and lock file?
- Is there a single setup command? (check Makefile, package.json scripts, bin/setup)
- Does .devcontainer/ exist?
- Does Dockerfile exist?

## Tests
- Count test files (Glob for **/*.test.*, **/*_test.*, **/test_*.*)
- What framework? Where is the test command documented?
- How many CI workflow files in .github/workflows/?

## Code Quality
- Check for: .pre-commit-config.yaml, .husky/pre-commit, .lefthook.yml
- Check for Claude hooks: PreToolUse/PostToolUse in .claude/settings.json
- What linter/formatter configs exist? (Glob for .eslintrc*, .prettierrc*, ruff.toml, biome.json, .golangci.*, rustfmt.toml)

## Conventions
- Does CONTRIBUTING.md exist? How many lines?
- Are conventions documented in CLAUDE.md or AGENTS.md specifically? (NOT in CONTRIBUTING.md)

## Scalability
- Does the app bind ports? Grep for common port patterns. Are they configurable via env var?
- Is this a CLI tool, library, or server?
- What system deps beyond the language runtime?
- Does docker-compose use host networking or host PID?

## Ergonomics
- Is there a watch mode? (check package.json scripts for "watch", "dev")
- TypeScript: Read tsconfig.json and check "strict" field
- Python: check for mypy config in pyproject.toml
- Grep test files for sleep/setTimeout patterns (report count)
- List the 10 largest source files by line count (use Glob + Read to check sizes)
- Are there source files over 1000 lines? List them with line counts.`;

async function runAgent(prompt: string, cwd: string, model: string): Promise<{ text: string; costUsd: number }> {
  const q = query({
    prompt,
    options: {
      allowedTools: ["Read", "Glob", "Grep", "Bash"],
      permissionMode: "bypassPermissions",
      model,
      cwd,
      maxTurns: 50,
    },
  });

  let resultText = "";
  let costUsd = 0;

  for await (const message of q) {
    if (message.type === "result" && message.subtype === "success") {
      resultText = message.result;
      costUsd = (message as any).cost_usd ?? 0;
    }
    if (message.type === "result" && message.subtype === "error") {
      throw new Error(`Agent error: ${(message as any).error}`);
    }
  }

  return { text: resultText, costUsd };
}

async function scoreRepo(repoDir: string, repoName: string, rubric: string): Promise<any> {
  // Phase 1: Haiku explores
  console.error(`  [haiku] exploring ${repoName}...`);
  const exploration = await runAgent(EXPLORE_PROMPT, repoDir, "haiku");
  console.error(`    haiku: $${exploration.costUsd.toFixed(4)}`);

  // Phase 2: Sonnet scores
  console.error(`  [sonnet] scoring ${repoName}...`);
  const scoring = await runAgent(
    `You are scoring a repository audit. Score all 14 categories 0-3 based on the signal data. Follow the maturity level pseudocode EXACTLY. Output ONLY valid JSON with this structure: {"repo":"${repoName}","level":"Bad|Ok|Good|Great","config":{"agent_docs":N,"repo_structure":N,"dep_bootstrap":N,"self_verification":N,"permissions":N,"code_quality":N,"rules_conventions":N,"worktree":N,"sandbox":N},"ergonomics":{"feedback_loop":N,"error_signal":N,"type_system":N,"determinism":N,"change_locality":N}}\n\n## Rubric\n\n${rubric}\n\n## Signal Data for ${repoName}\n\n${exploration.text}`,
    repoDir,
    "sonnet",
  );
  console.error(`    sonnet: $${scoring.costUsd.toFixed(4)}`);

  // Extract JSON - find the outermost balanced braces
  let depth = 0, start = -1, end = -1;
  for (let i = 0; i < scoring.text.length; i++) {
    if (scoring.text[i] === '{') { if (start === -1) start = i; depth++; }
    if (scoring.text[i] === '}') { depth--; if (depth === 0 && start !== -1) { end = i + 1; break; } }
  }
  if (start === -1 || end === -1) throw new Error(`No JSON in sonnet response for ${repoName}`);
  const parsed = JSON.parse(scoring.text.slice(start, end));
  parsed.audit_date = new Date().toISOString().split("T")[0];
  parsed.audit_model = "claude-sonnet-4-6";
  parsed.explore_model = "claude-haiku-4-5";
  parsed.cost = {
    haiku: exploration.costUsd,
    sonnet: scoring.costUsd,
    total: exploration.costUsd + scoring.costUsd,
  };
  return parsed;
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 100;
  const repoIdx = args.indexOf("--repo");
  const singleRepo = repoIdx >= 0 ? args[repoIdx + 1] : null;

  const skillContent = readFileSync(SKILL_FILE, "utf-8");
  const rubric = skillContent.split("## How to run")[0];

  const knownOrgs: Record<string, string> = {
    "django-django": "django/django", "facebook-react": "facebook/react",
    "fastapi": "fastapi/fastapi", "flutter-flutter": "flutter/flutter",
    "golang-go": "golang/go", "langflow-ai-langflow": "langflow-ai/langflow",
    "microsoft-vscode": "microsoft/vscode", "n8n-io-n8n": "n8n-io/n8n",
    "ohmyzsh-ohmyzsh": "ohmyzsh/ohmyzsh", "ollama-ollama": "ollama/ollama",
    "openclaw-openclaw": "openclaw/openclaw", "rustdesk-rustdesk": "rustdesk/rustdesk",
    "Significant-Gravitas-AutoGPT": "Significant-Gravitas/AutoGPT",
    "supabase-supabase": "supabase/supabase", "vercel-next.js": "vercel/next.js",
    "yt-dlp-yt-dlp": "yt-dlp/yt-dlp",
  };

  let repos: { dir: string; name: string }[];
  if (singleRepo) {
    const dirName = singleRepo.replace("/", "-");
    repos = [{ dir: join(CLONES_DIR, dirName), name: singleRepo }];
  } else {
    repos = readdirSync(CLONES_DIR)
      .filter((d) => statSync(join(CLONES_DIR, d)).isDirectory())
      .slice(0, limit)
      .map((d) => ({ dir: join(CLONES_DIR, d), name: knownOrgs[d] || d.replace("-", "/") }));
  }

  console.error(`Auditing ${repos.length} repos...\n`);
  let totalCost = 0;

  for (const repo of repos) {
    try {
      console.error(`[${repo.name}]`);
      const result = await scoreRepo(repo.dir, repo.name, rubric);
      totalCost += result.cost.total;
      console.log(JSON.stringify(result));
      console.error(`  -> ${result.level} ($${result.cost.total.toFixed(4)})\n`);
    } catch (e: any) {
      console.error(`  ERROR: ${e.message}\n`);
    }
  }

  console.error(`\nTotal cost: $${totalCost.toFixed(4)}`);
}

main();
