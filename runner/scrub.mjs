// Removes credentials from anything written to results/ (transcripts, diffs, errors).

const CREDENTIAL_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'DEEPSEEK_API_KEY'];
const KEY_SHAPE = /sk-ant-[A-Za-z0-9_-]{8,}/g;
const MIN_SECRET = 8;

export function secretValues(env = process.env) {
  return CREDENTIAL_VARS.map((name) => env[name]).filter((v) => typeof v === 'string' && v.length >= MIN_SECRET);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function scrub(text, secrets = secretValues()) {
  let out = String(text ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= MIN_SECRET) {
      out = out.replace(new RegExp(escape(secret), 'g'), '[REDACTED]');
    }
  }
  return out.replace(KEY_SHAPE, '[REDACTED]');
}
