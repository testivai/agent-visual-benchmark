// Reads the fields that come from an agent's transcript again, with the current
// parser, so a parser fixed after a run still gives that run's right values.
// runs.jsonl is never edited: the analysis merges these in and lists what changed.
import path from 'node:path';
import { parseStream, readStatus, shortcutFlags } from '../runner/transcript.mjs';

const CLAIM = { done: true, not_done: false };
// fields a record already had, compared to say what changed
const COMPARED = ['turns', 'claimed_done', 'false_done', 'flags'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The shortcut flags, with the workspace the transcript names (its init message).
function flagsOf(parsed, benchRoot) {
  if (!parsed.cwd) return [];
  return shortcutFlags(parsed.toolCalls, { workspace: parsed.cwd, benchRoot, tmpDir: path.join(path.dirname(parsed.cwd), 'tmp') });
}

export function rederive(record, transcriptText, { benchRoot = null } = {}) {
  const parsed = parseStream(transcriptText);
  const claimed = CLAIM[readStatus(parsed.finalText)] ?? null;
  const known = typeof record.success === 'boolean';
  return {
    turns: parsed.turns,
    claimed_done: claimed,
    false_done: claimed === null || !known ? null : claimed && !record.success,
    agent_seconds: parsed.agentSeconds,
    result_count: parsed.results,
    flags: flagsOf(parsed, benchRoot),
  };
}

// readTranscript(record) -> the transcript's text, or null when there is none.
export function applyTranscripts(records, readTranscript, options = {}) {
  const changed = [];
  let checked = 0;
  let missing = 0;
  const merged = records.map((record) => {
    if (record.error) return record;
    const text = readTranscript(record);
    if (text === null) {
      missing += 1;
      return record;
    }
    checked += 1;
    const fresh = rederive(record, text, options);
    const fields = COMPARED.filter((f) => f in record && !same(record[f], fresh[f]));
    if (fields.length > 0) changed.push({ run_id: record.run_id, attempt: record.attempt, fields });
    return { ...record, ...fresh };
  });
  return { records: merged, changed, checked, missing };
}
