// One run: build the workspace, start the agent, score what it leaves.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWorkspace } from './workspace.mjs';
import { buildSettings, buildMcpConfig, buildClaudeArgs, buildAgentEnv } from './claude.mjs';
import { runAgent } from './agent.mjs';
import { parseStream, readStatus, shortcutFlags } from './transcript.mjs';
import { classifyAgentRun, runOutcome } from './outcome.mjs';
import { startupProblems } from './startup.mjs';
import { usageLimit, runCost } from './limits.mjs';
import { snapshotFiles, tamperCheck } from './tamper.mjs';
import { scoreWorkspace, finalDiff } from './score.mjs';
import { scrub, secretValues } from './scrub.mjs';
import { browsersPath } from './templates.mjs';
import { freePort } from '../harness/run-specs.mjs';

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

// What a run must be able to read: the browsers and the Node that runs the tests.
export function readNeeds() {
  return [browsersPath(), path.resolve(process.execPath, '..', '..')];
}

export function prepareRunDir(runDir, { arm, config, benchRoot, ws }) {
  fs.mkdirSync(path.join(runDir, 'home', '.claude'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'tmp'), { recursive: true });
  const settingsFile = writeJson(path.join(runDir, 'settings.json'), buildSettings({
    arm, benchRoot, homeDir: os.homedir(), isolation: config.isolation, allowedNetwork: config.allowedNetwork, readNeeds: readNeeds(),
  }));
  const mcp = buildMcpConfig({ arm, workspace: ws, nodePath: process.execPath });
  const mcpConfigFile = mcp ? writeJson(path.join(runDir, 'mcp.json'), mcp) : null;
  return { settingsFile, mcpConfigFile };
}

function baseRecord({ run, phase, attempt, task, config, context }) {
  return {
    phase,
    run_id: run.runId,
    order: run.order,
    attempt,
    task: run.task,
    task_type: task.type,
    task_category: task.category,
    arm: run.arm,
    repeat: run.repeat,
    started_at: new Date().toISOString(),
    model_id: config.agent.id,
    model: config.agent.model,
    provider: config.agent.provider,
    config_hash: context.configHash,
    bench_commit: context.benchCommit,
    versions: context.versions,
  };
}

// Claude Code prices every token at Anthropic's rates; another provider's
// model is priced from the config.
function costFields(parsed, agent) {
  const prices = agent.pricesPerMillionUsd;
  return prices
    ? { cost_usd: runCost(parsed.tokens, prices), cost_source: 'provider prices', claude_code_cost_estimate: parsed.costUsd }
    : { cost_usd: parsed.costUsd, cost_source: 'Claude Code estimate', claude_code_cost_estimate: parsed.costUsd };
}

function agentFields(parsed, agentRes, stopReason) {
  return {
    seconds: Math.round(agentRes.seconds * 10) / 10,
    stop_reason: stopReason,
    model_reported: parsed.model,
    models_used: parsed.models,
    claude_code_version: parsed.claudeCodeVersion,
    tools: parsed.tools,
    turns: parsed.turns,
    tokens: parsed.tokens,
    status_line: readStatus(parsed.finalText),
    permission_denials: parsed.permissionDenials,
  };
}

async function scoreFields({ benchRoot, run, ws, before, parsed, resultsDir, attempt, secrets }) {
  const tamper = tamperCheck(before, snapshotFiles(ws));
  const scored = await scoreWorkspace({ benchRoot, taskId: run.task, ws });
  const diff = finalDiff(ws);
  fs.writeFileSync(path.join(resultsDir, 'diffs', `${run.runId}-a${attempt}.patch`), scrub(diff.text, secrets));
  const outcome = runOutcome({ score: scored.score, collateral: scored.collateral, tampered: tamper.tampered, status: readStatus(parsed.finalText) });
  return {
    ...outcome,
    functional: scored.functional,
    tampered: tamper.tampered,
    tamper_paths: tamper.tamperPaths,
    site_files_changed: tamper.siteChanges.length,
    other_changes: tamper.otherChanges,
    diff_stats: diff.stats,
    flags: shortcutFlags(parsed.toolCalls, { workspace: ws, benchRoot }),
    score_failures: scored.failures,
    error: scored.score === 'error' || scored.collateral === 'error'
      ? { stage: 'score', message: [...scored.failures.score, ...scored.failures.collateral].join(' / ').slice(0, 1000) }
      : null,
  };
}

// context: { templateDir, configHash, benchCommit, versions, extraEnv, keepRunDir }
export async function runOne({ benchRoot, config, run, phase, attempt, resultsDir, context }) {
  const task = JSON.parse(fs.readFileSync(path.join(benchRoot, 'tasks', run.task, 'task.json'), 'utf8'));
  const record = baseRecord({ run, phase, attempt, task, config, context });
  const secrets = secretValues(process.env);
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-'));
  try {
    const ws = buildWorkspace({ benchRoot, taskId: run.task, arm: run.arm, templateDir: context.templateDir, runDir });
    const before = snapshotFiles(ws);
    const { settingsFile, mcpConfigFile } = prepareRunDir(runDir, { arm: run.arm, config, benchRoot, ws });
    const agentRes = await runAgent({
      command: config.agent.command,
      args: buildClaudeArgs({ agent: config.agent, prompt: task.prompt, settingsFile, instructionsFile: path.join(ws, 'CLAUDE.md'), mcpConfigFile }),
      cwd: ws,
      env: buildAgentEnv({ baseEnv: process.env, runDir, port: await freePort(), browsersPath: browsersPath(), agent: config.agent, extraEnv: context.extraEnv ?? {} }),
      timeLimitMs: config.agent.timeLimitMinutes * 60 * 1000,
      transcriptFile: path.join(resultsDir, 'transcripts', `${run.runId}-a${attempt}.jsonl`),
      secrets,
      onStartup: (init) => startupProblems(init, { arm: run.arm, model: config.agent.model }),
    });
    const parsed = parseStream(agentRes.stdout);
    const limit = agentRes.timedOut || agentRes.stoppedAtStartup ? null : usageLimit(parsed, agentRes);
    const { stopReason, error } = limit
      ? { stopReason: 'limit', error: { stage: 'limit', message: limit.message, resume_at: limit.resetAt } }
      : classifyAgentRun({ parsed, agentRes, config, arm: run.arm });
    Object.assign(record, agentFields(parsed, agentRes, stopReason), costFields(parsed, config.agent));
    if (error) return { ...record, error };
    return { ...record, ...(await scoreFields({ benchRoot, run, ws, before, parsed, resultsDir, attempt, secrets })) };
  } catch (err) {
    return { ...record, error: { stage: 'setup', message: scrub(String(err.stack ?? err.message), secrets).slice(0, 2000) } };
  } finally {
    if (!context.keepRunDir) fs.rmSync(runDir, { recursive: true, force: true });
  }
}
