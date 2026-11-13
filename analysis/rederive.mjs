// Reads the fields that come from an agent's transcript again, with the current
// parser, so a parser fixed after a run still gives that run's right values.
// runs.jsonl is never edited: the analysis merges these in and lists what changed.
import { parseStream, readStatus } from '../runner/transcript.mjs';

const CLAIM = { done: true, not_done: false };
// fields a record already had, compared to say what changed
const COMPARED = ['turns', 'claimed_done', 'false_done'];

export function rederive(record, transcriptText) {
  const parsed = parseStream(transcriptText);
  const claimed = CLAIM[readStatus(parsed.finalText)] ?? null;
  const known = typeof record.success === 'boolean';
  return {
    turns: parsed.turns,
    claimed_done: claimed,
    false_done: claimed === null || !known ? null : claimed && !record.success,
    agent_seconds: parsed.agentSeconds,
    result_count: parsed.results,
  };
}

// readTranscript(record) -> the transcript's text, or null when there is none.
export function applyTranscripts(records, readTranscript) {
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
    const fresh = rederive(record, text);
    const fields = COMPARED.filter((f) => f in record && record[f] !== fresh[f]);
    if (fields.length > 0) changed.push({ run_id: record.run_id, attempt: record.attempt, fields });
    return { ...record, ...fresh };
  });
  return { records: merged, changed, checked, missing };
}
