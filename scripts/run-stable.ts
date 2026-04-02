#!/usr/bin/env bun
/**
 * claudeaudit stable scoring via deterministic bash signals + API scoring
 *
 * 1. Runs gather-signals.sh on the repo (deterministic, no LLM variance)
 * 2. Sends signals + rubric to Claude for scoring (single API call)
 *
 * Usage:
 *   CLAUDEAUDIT_ANT_API_KEY=sk-... bun scripts/run-stable.ts --repo facebook-react --runs 5
 *   CLAUDEAUDIT_ANT_API_KEY=sk-... bun scripts/run-stable.ts --repo facebook-react --runs 5 --model claude-sonnet-4-6-20250514
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { $ } from "bun";

const CLONES_DIR = process.env.CLONES_DIR || join(import.meta.dir, "..", "index", "clones");
const SKILL_FILE = join(import.meta.dir, "..", "SKILL.md");
const GATHER_SCRIPT = process.env.GATHER_SCRIPT || "/home/exedev/claudeaudit/skill/scripts/gather-signals.sh";

const SIGNALS_DIR = join(import.meta.dir, "..", "index", "signals");
const SCRATCH_DIR = join(import.meta.dir, "..", "index", "_scratch");

async function gatherSignals(repoDir: string): Promise<string> {
  const result = await $`bash ${GATHER_SCRIPT} ${repoDir}`.text();
  return result;
}

async function gatherSignalsCached(repoName: string, repoDir: string): Promise<string> {
  const cacheFile = join(SIGNALS_DIR, `${repoName.replace("/", "-")}.txt`);
  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile, "utf-8");
  }
  const signals = await gatherSignals(repoDir);
  mkdirSync(SIGNALS_DIR, { recursive: true });
  writeFileSync(cacheFile, signals);
  return signals;
}

async function shallowClone(fullName: string): Promise<string> {
  const dirName = fullName.replace("/", "-");
  const cloneDir = join(SCRATCH_DIR, dirName);
  if (existsSync(cloneDir)) {
    return cloneDir;
  }
  mkdirSync(SCRATCH_DIR, { recursive: true });
  console.error(`  cloning ${fullName} (shallow)...`);
  await $`git clone --depth 1 --quiet https://github.com/${fullName}.git ${cloneDir}`;
  return cloneDir;
}

function deleteClone(cloneDir: string) {
  rmSync(cloneDir, { recursive: true, force: true });
}

function buildScoringPrompt(signals: string, rubric: string, repoName: string): string {
  return `You are scoring a repository for AI agent readiness. You have been given deterministic signal data gathered from the repository. Score all 14 categories (0-3) based on the rubric below.

IMPORTANT:
- Score based ONLY on the signal data provided. Do not speculate about what might exist beyond what's shown.
- Be honest, not generous. A 2 is good. A 3 is exceptional.
- Follow the maturity level pseudocode EXACTLY.

## Rubric

${rubric}

## Signal Data for ${repoName}

${signals}

## Required Output

First, output brief reasoning for each category (1-2 sentences each, not paragraphs). Then output the audit report in exactly this format:

\`\`\`
claudeaudit - ${repoName}

{Level} ({next_level_blocker})

  docs {s}  structure {s}  bootstrap {s}  tests {s}  perms {s}  hooks {s}  rules {s}  worktree {s}  sandbox {s}
  feedback {s}  errors {s}  types {s}  determinism {s}  locality {s}

Top fixes:
1. {Concrete action} -> {what it unlocks}
2. {Concrete action} -> {what it unlocks}
3. {Concrete action} -> {what it unlocks}
\`\`\``;
}

function extractScores(text: string): Record<string, number> | null {
  const categories = [
    "docs", "structure", "bootstrap", "tests", "perms", "hooks", "rules", "worktree", "sandbox",
    "feedback", "errors", "types", "determinism", "locality",
  ];
  const scores: Record<string, number> = {};
  for (const cat of categories) {
    const match = text.match(new RegExp(`${cat}\\s+(\\d)`));
    if (match) scores[cat] = parseInt(match[1]);
  }
  return Object.keys(scores).length >= 10 ? scores : null;
}

function extractLevel(text: string): string | null {
  const match = text.match(/\b(Bad|Ok|Good|Great)\b/);
  return match ? match[1] : null;
}

async function scoreFromSignals(
  client: Anthropic,
  signals: string,
  repoName: string,
  rubric: string,
  model: string,
): Promise<{ scores: Record<string, number>; level: string; elapsed: number; input_tokens: number; output_tokens: number } | null> {
  const scoringPrompt = buildScoringPrompt(signals, rubric, repoName);
  const start = Date.now();

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0,
    messages: [{ role: "user", content: scoringPrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const elapsed = parseFloat(((Date.now() - start) / 1000).toFixed(1));
  const scores = extractScores(text);
  const level = extractLevel(text);
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  if (scores && level) {
    console.error(`  ${level.padEnd(5)} ${elapsed}s (${inputTokens}in/${outputTokens}out) ${JSON.stringify(scores)}`);
    return { scores, level, elapsed, input_tokens: inputTokens, output_tokens: outputTokens };
  } else {
    console.error(`  warning: could not extract scores (${elapsed}s)`);
    console.error(`  response tail: ${text.slice(-400)}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const repoIdx = args.indexOf("--repo");
  const singleRepo = repoIdx >= 0 ? args[repoIdx + 1] : null;
  const runsIdx = args.indexOf("--runs");
  const numRuns = runsIdx >= 0 ? parseInt(args[runsIdx + 1]) : 1;
  const modelIdx = args.indexOf("--model");
  const model = modelIdx >= 0 ? args[modelIdx + 1] : "claude-opus-4-6";
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 100;
  const offsetIdx = args.indexOf("--offset");
  const offset = offsetIdx >= 0 ? parseInt(args[offsetIdx + 1]) : 0;
  const useAll = args.includes("--all");
  const fromJsonIdx = args.indexOf("--from-json");
  const fromJson = fromJsonIdx >= 0 ? args[fromJsonIdx + 1] : null;

  const apiKey = process.env.CLAUDEAUDIT_ANT_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("error: set CLAUDEAUDIT_ANT_API_KEY or ANTHROPIC_API_KEY");
    process.exit(1);
  }
  if (!existsSync(GATHER_SCRIPT)) {
    console.error(`error: gather-signals.sh not found at ${GATHER_SCRIPT}`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const skillContent = readFileSync(SKILL_FILE, "utf-8");
  const rubricEnd = skillContent.indexOf("## Running the audit");
  const rubric = rubricEnd > 0 ? skillContent.slice(0, rubricEnd) : skillContent;

  // Build repo list: { name: "owner/repo" | "dir-name", fullName?: "owner/repo" }
  let repos: { name: string; fullName?: string }[];

  if (fromJson) {
    // Read from repos.json - shallow clone, gather, score, delete
    const data = JSON.parse(readFileSync(fromJson, "utf-8"));
    repos = data.repos.slice(offset, offset + limit).map((r: any) => ({
      name: r.full_name,
      fullName: r.full_name,
    }));
  } else if (singleRepo) {
    repos = [{ name: singleRepo }];
  } else if (useAll) {
    repos = readdirSync(CLONES_DIR)
      .filter((d) => statSync(join(CLONES_DIR, d)).isDirectory())
      .slice(offset, offset + limit)
      .map((d) => ({ name: d }));
  } else {
    console.error("error: specify --repo <name>, --all, or --from-json <path>");
    process.exit(1);
  }

  console.error(`Auditing ${repos.length} repo(s), ${numRuns} run(s) each, model: ${model}\n`);

  const allResults: any[] = [];

  for (const repo of repos) {
    const displayName = repo.fullName || repo.name;
    console.error(`[${displayName}]`);

    let signals: string;
    let cloneDir: string | null = null;

    try {
      if (repo.fullName) {
        // Check for cached signals first
        const cacheFile = join(SIGNALS_DIR, `${repo.fullName.replace("/", "-")}.txt`);
        if (existsSync(cacheFile)) {
          signals = readFileSync(cacheFile, "utf-8");
          console.error(`  signals: cached (${signals.length} chars)`);
        } else {
          // Also check if we have a local clone already
          const localClone = join(CLONES_DIR, repo.fullName.replace("/", "-"));
          if (existsSync(localClone)) {
            signals = await gatherSignalsCached(repo.fullName, localClone);
            console.error(`  signals: from existing clone (${signals.length} chars)`);
          } else {
            cloneDir = await shallowClone(repo.fullName);
            signals = await gatherSignalsCached(repo.fullName, cloneDir);
            console.error(`  signals: gathered (${signals.length} chars)`);
          }
        }
      } else {
        // Local clone in CLONES_DIR
        const repoDir = join(CLONES_DIR, repo.name);
        if (!existsSync(repoDir)) {
          console.error(`  SKIP: not found`);
          continue;
        }
        signals = await gatherSignals(repoDir);
      }
    } catch (e: any) {
      console.error(`  SKIP: clone/gather failed: ${e.message}`);
      if (cloneDir) deleteClone(cloneDir);
      continue;
    }

    // Delete scratch clone now that we have signals cached
    if (cloneDir) {
      deleteClone(cloneDir);
      cloneDir = null;
    }

    const runResults: { scores: Record<string, number>; level: string; elapsed: number; input_tokens: number; output_tokens: number }[] = [];

    for (let i = 0; i < numRuns; i++) {
      try {
        const result = await scoreFromSignals(client, signals, displayName, rubric, model);
        if (result) runResults.push(result);
      } catch (e: any) {
        console.error(`  ERROR: ${e.message}`);
      }
    }

    if (runResults.length > 0) {
      const totalIn = runResults.reduce((s, r) => s + r.input_tokens, 0);
      const totalOut = runResults.reduce((s, r) => s + r.output_tokens, 0);
      const entry: any = {
        repo: displayName,
        level: runResults[0].level,
        scores: runResults[0].scores,
        elapsed: runResults[0].elapsed,
        tokens: { input: totalIn, output: totalOut },
      };

      // If multiple runs, add stability info
      if (runResults.length >= 2) {
        const categories = Object.keys(runResults[0].scores);
        let stable = 0;
        for (const cat of categories) {
          const vals = runResults.map((r) => r.scores[cat]);
          if (Math.min(...vals) === Math.max(...vals)) stable++;
        }
        entry.stability = `${stable}/${categories.length}`;
        entry.all_scores = runResults.map((r) => r.scores);
        entry.all_levels = runResults.map((r) => r.level);
      }

      allResults.push(entry);
      console.log(JSON.stringify(entry));
    }
    console.error("");
  }

  // Summary
  console.error(`=== DONE: ${allResults.length}/${repos.length} repos scored ===`);
  const levels = { Bad: 0, Ok: 0, Good: 0, Great: 0 };
  for (const r of allResults) {
    levels[r.level as keyof typeof levels]++;
  }
  console.error(`Levels: Bad=${levels.Bad} Ok=${levels.Ok} Good=${levels.Good} Great=${levels.Great}`);

  // Cost
  const PRICING: Record<string, { input: number; output: number }> = {
    "claude-opus-4-6": { input: 15, output: 75 },
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-haiku-4-5-20251001": { input: 0.80, output: 4 },
  };
  const pricing = PRICING[model] || PRICING["claude-opus-4-6"];
  const totalIn = allResults.reduce((s, r) => s + (r.tokens?.input || 0), 0);
  const totalOut = allResults.reduce((s, r) => s + (r.tokens?.output || 0), 0);
  const costIn = (totalIn / 1_000_000) * pricing.input;
  const costOut = (totalOut / 1_000_000) * pricing.output;
  const totalCost = costIn + costOut;
  console.error(`Tokens: ${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out`);
  console.error(`Cost: $${totalCost.toFixed(2)} ($${(totalCost / allResults.length).toFixed(3)}/repo)`);
}

main();
