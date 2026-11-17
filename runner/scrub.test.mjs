import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scrub, secretValues, scrubTree } from './scrub.mjs';

test('known secret values are replaced wherever they appear', () => {
  const out = scrub('key=abc123secretvalue and again abc123secretvalue', ['abc123secretvalue']);
  assert.equal(out, 'key=[REDACTED] and again [REDACTED]');
});

test('anything shaped like an Anthropic key is replaced even when not known', () => {
  assert.equal(scrub('export ANTHROPIC_API_KEY=sk-ant-api03-AbC_d-123456789xyz done', []), 'export ANTHROPIC_API_KEY=[REDACTED] done');
  assert.equal(scrub('{"k":"sk-ant-oat01-ZZZZZZZZZZZZZZZZ"}', []), '{"k":"[REDACTED]"}');
});

test('short or empty "secrets" are ignored so ordinary text is not mangled', () => {
  assert.equal(scrub('a b c', ['', 'a', null, undefined]), 'a b c');
});

test('secretValues collects the values of the credential variables that are set', () => {
  const env = { ANTHROPIC_API_KEY: 'sk-ant-xxxxxxxxxxxxxxxx', ANTHROPIC_AUTH_TOKEN: 'tok-yyyyyyyyyy', PATH: '/usr/bin', CLAUDE_CODE_OAUTH_TOKEN: '', DEEPSEEK_API_KEY: 'sk-ds-zzzzzzzzzz' };
  assert.deepEqual(secretValues(env).sort(), ['sk-ant-xxxxxxxxxxxxxxxx', 'sk-ds-zzzzzzzzzz', 'tok-yyyyyyyyyy']);
});

// docs/pilot-isolation-breach.md: an agent's npm search returned package maintainers' email
// addresses, and env dumps showed the sandbox's proxy logins. Neither belongs in results/.
test('email addresses are replaced, wherever they appear', () => {
  assert.equal(scrub('maintainer jane.doe@example.org wrote', []), 'maintainer [EMAIL] wrote');
  assert.equal(scrub('{"email":"npm@3rd-Eden.com","username":"x"}', []), '{"email":"[EMAIL]","username":"x"}');
  assert.equal(scrub('Acme Developer <dev@acme.example> 1794599950 +0000', []), 'Acme Developer <[EMAIL]> 1794599950 +0000');
});

// In a transcript, text sits inside JSON strings: a line break before an address is the two
// characters \\n, and the n must stay (seen in two pilot transcripts).
test('an address or a secret variable right after a JSON escape keeps the escape intact', () => {
  const json = JSON.stringify({ text: 'card contains:\n```\ncustomer.support.team@acmestorefront.example\n```' });
  const out = scrub(json, []);
  assert.deepEqual(JSON.parse(out), { text: 'card contains:\n```\n[EMAIL]\n```' });
  const env = JSON.stringify({ out: 'HOME=/r\nCLOUDSDK_PROXY_PASSWORD=c92ea0a34f0b\nPATH=/bin' });
  assert.deepEqual(JSON.parse(scrub(env, [])), { out: 'HOME=/r\nCLOUDSDK_PROXY_PASSWORD=[REDACTED]\nPATH=/bin' });
});

test('package names, versions and local hosts are not taken for addresses', () => {
  for (const text of ['@playwright/test@1.63.0', 'npm install @testivai/mcp', 'node@22', 'pkg@^2.1.3']) {
    assert.equal(scrub(text, []), text, text);
  }
});

test('logins inside URLs and secret-named variables in an environment dump are replaced', () => {
  assert.equal(scrub('ALL_PROXY=http://srt.Y2Fs%3D:cf370ed7afe2@127.0.0.1:3128', []), 'ALL_PROXY=http://[REDACTED]@127.0.0.1:3128');
  assert.equal(scrub('CLOUDSDK_PROXY_PASSWORD=c92ea0a34f0b6aba\\nHOME=/r/home', []), 'CLOUDSDK_PROXY_PASSWORD=[REDACTED]\\nHOME=/r/home');
  assert.equal(scrub('CLAUDE_CODE_MESSAGING_TOKEN=abc123xyz HOME=/r', []), 'CLAUDE_CODE_MESSAGING_TOKEN=[REDACTED] HOME=/r');
  assert.equal(scrub('GIT_CONFIG_KEY_0=safe.directory', []), 'GIT_CONFIG_KEY_0=safe.directory', 'a variable that only names a key is kept');
  assert.equal(scrub('see https://registry.npmjs.org/-/v1/search?text=x', []), 'see https://registry.npmjs.org/-/v1/search?text=x');
});

test('scrubTree cleans the results already written, and says which files it changed', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-scrub-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'transcripts'));
  fs.writeFileSync(path.join(dir, 'transcripts', 'p-1.jsonl'), '{"content":"maintainer jane@example.org"}\n');
  fs.writeFileSync(path.join(dir, 'transcripts', 'p-2.jsonl'), '{"content":"nothing to hide"}\n');
  fs.writeFileSync(path.join(dir, 'picture.png'), 'jane@example.org');
  assert.deepEqual(scrubTree(dir, []), [path.join(dir, 'transcripts', 'p-1.jsonl')]);
  assert.equal(fs.readFileSync(path.join(dir, 'transcripts', 'p-1.jsonl'), 'utf8'), '{"content":"maintainer [EMAIL]"}\n');
  assert.equal(fs.readFileSync(path.join(dir, 'picture.png'), 'utf8'), 'jane@example.org', 'only text results are rewritten');
  assert.deepEqual(scrubTree(dir, []), [], 'a second pass changes nothing');
});
