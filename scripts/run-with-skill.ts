#!/usr/bin/env bun
/**
 * claudeaudit stability test via Claude Agent SDK + skill
 *
 * Installs the claudeaudit skill into the target repo, then asks
 * the SDK to run it - same as a user would in Claude Code.
 *
 * Usage:
 *   CLAUDEAUDIT_ANT_API_KEY=sk-... bun scripts/run-with-skill.ts --repo facebook-react --runs 5
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CLONES_DIR = join(import.meta.dir, "..", "index", "clones");
const SKILL_SOURCE = join(import.meta.dir, "..", "SKILL.md");

function installSkill(repoDir: string) {
  const targetDir = join(repoDir, ".claude", "skills", "claudeaudit");
  const targetFile = join(targetDir, "SKILL.md");
  // Also copy the gather-signals script
  const scriptDir = join(targetDir, "scripts");

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetFile, readFileSync(SKILL_SOURCE, "utf-8"));

  // Copy gather-signals.sh if it exists in the main repo
  const gatherScript = join(import.meta.dir, "..", "..", "claudeaudit", "skill", "scripts", "gather-signals.sh");
  if (existsSync(gatherScript)) {
    mkdirSync(scriptDir, { recursive: true });
    writeFileSync(join(scriptDir, "gather-signals.sh"), readFileSync(gatherScript, "utf-8"));
  }
}

async function runAudit(repoDir: string, repoName: string, runNum: number): Promise<any> {
  console.error(`  [run ${runNum}] starting audit of ${repoName}...`);
  const start = Date.now();

  let resultText = "";

  for await (const message of query({
    prompt: "Run claudeaudit on this repository. Output the full audit report.",
    options: {
      cwd: repoDir,
      settingSources: ["project"],
      allowedTools: ["Skill", "Read", "Glob", "Grep", "Bash", "Agent"],
      permissionMode: "bypassPermissions",
      maxTurns: 80,
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      resultText = (message as any).result ?? "";
    }
    if (message.type === "result" && message.subtype === "error") {
      throw new Error(`Agent error: ${(message as any).error}`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`  [run ${runNum}] done in ${elapsed}s`);

  return { run: runNum, elapsed: parseFloat(elapsed), result: resultText };
}

function extractScores(text: string): Record<string, number> | null {
  // Try to parse the compact score line from the report:
  //   docs 1  structure 2  bootstrap 1  tests 2  perms 0  hooks 1  rules 0  worktree 2  sandbox 2
  //   feedback 1  errors 1  types 3  determinism 2  locality 2
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

async function main() {
  const args = process.argv.slice(2);
  const repoIdx = args.indexOf("--repo");
  const repoName = repoIdx >= 0 ? args[repoIdx + 1] : "facebook-react";
  const runsIdx = args.indexOf("--runs");
  const numRuns = runsIdx >= 0 ? parseInt(args[runsIdx + 1]) : 5;

  // Set API key
  if (process.env.CLAUDEAUDIT_ANT_API_KEY) {
    process.env.ANTHROPIC_API_KEY = process.env.CLAUDEAUDIT_ANT_API_KEY;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("error: set CLAUDEAUDIT_ANT_API_KEY or ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const repoDir = join(CLONES_DIR, repoName);
  if (!existsSync(repoDir)) {
    console.error(`error: repo not found at ${repoDir}`);
    process.exit(1);
  }

  console.error(`Installing claudeaudit skill into ${repoName}...`);
  installSkill(repoDir);

  console.error(`Running ${numRuns} audits of ${repoName}...\n`);

  const allScores: Record<string, number>[] = [];
  const results: any[] = [];

  for (let i = 1; i <= numRuns; i++) {
    try {
      const result = await runAudit(repoDir, repoName, i);
      results.push(result);
      const scores = extractScores(result.result);
      if (scores) {
        allScores.push(scores);
        console.error(`  scores: ${JSON.stringify(scores)}`);
      } else {
        console.error(`  warning: could not extract scores from run ${i}`);
      }
    } catch (e: any) {
      console.error(`  ERROR on run ${i}: ${e.message}`);
    }
    console.error("");
  }

  // Stability analysis
  if (allScores.length >= 2) {
    console.error("=== STABILITY ANALYSIS ===");
    const categories = Object.keys(allScores[0]);
    let stableCount = 0;
    let totalCount = 0;

    for (const cat of categories) {
      const vals = allScores.map((s) => s[cat]).filter((v) => v !== undefined);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const stable = min === max;
      if (stable) stableCount++;
      totalCount++;
      console.error(`  ${cat.padEnd(14)} ${vals.join(", ")}${stable ? "" : ` [UNSTABLE: ${min}-${max}]`}`);
    }

    console.error(`\nStability: ${stableCount}/${totalCount} categories (${((stableCount / totalCount) * 100).toFixed(0)}%)`);
  }

  // Output full results as JSON
  console.log(JSON.stringify({ repo: repoName, runs: numRuns, scores: allScores, results: results.map(r => ({ run: r.run, elapsed: r.elapsed })) }, null, 2));
}

main();
