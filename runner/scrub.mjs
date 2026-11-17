// Removes credentials from anything written to results/ (transcripts, diffs, errors).
import fs from 'node:fs';
import path from 'node:path';

const CREDENTIAL_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'DEEPSEEK_API_KEY'];
const KEY_SHAPE = /sk-ant-[A-Za-z0-9_-]{8,}/g;
const MIN_SECRET = 8;

export function secretValues(env = process.env) {
  return CREDENTIAL_VARS.map((name) => env[name]).filter((v) => typeof v === 'string' && v.length >= MIN_SECRET);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Also kept out of results/ (docs/pilot-isolation-breach.md): email addresses
// (an npm search returned package maintainers'), logins inside URLs and the
// values of secret-named variables (an env dump showed the sandbox's proxy logins).
// A match starts at the start of the text, after a character that cannot be
// part of it, or after a JSON escape such as \n (in a transcript, text sits
// inside JSON strings, and the n of \n must not be taken into the match).
const START = String.raw`(?<=^|\\[nrtbf"/]|[^A-Za-z0-9._%+\\-])`;
const EMAIL = new RegExp(`${START}[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}\\b`, 'g');
const URL_LOGIN = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@"'\\]+@/gi;
const SECRET_VAR = new RegExp(`${START}([A-Z0-9_]*(?:PASSWORD|TOKEN|SECRET|API_KEY))=[^\\s"'\\\\]+`, 'g');

export function scrub(text, secrets = secretValues()) {
  let out = String(text ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= MIN_SECRET) {
      out = out.replace(new RegExp(escape(secret), 'g'), '[REDACTED]');
    }
  }
  return out
    .replace(KEY_SHAPE, '[REDACTED]')
    .replace(URL_LOGIN, '$1[REDACTED]@')
    .replace(SECRET_VAR, '$1=[REDACTED]')
    .replace(EMAIL, '[EMAIL]');
}

const TEXT_RESULTS = ['.jsonl', '.json', '.patch', '.md', '.csv', '.txt', '.log'];

// Applies scrub to every text result under dir, in place (results written
// before a scrub rule existed). Returns the files it changed.
export function scrubTree(dir, secrets = secretValues()) {
  const changed = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      changed.push(...scrubTree(file, secrets));
    } else if (TEXT_RESULTS.includes(path.extname(entry.name))) {
      const text = fs.readFileSync(file, 'utf8');
      const clean = scrub(text, secrets);
      if (clean !== text) {
        fs.writeFileSync(file, clean);
        changed.push(file);
      }
    }
  }
  return changed;
}
