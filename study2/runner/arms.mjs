// Study 2's arms, B and C, and the app each is built from: the drawn site, a
// server, and the arm's files (study2/arms/<arm>/files/: study 1's packages,
// study 1's Playwright config without the functional tests, study 1's visual
// test for the site's one page). The instructions are study 1's shape, with
// study 1's line for each arm.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../harness/workspace.mjs';
import { visualLine } from '../../runner/arms.mjs';

const STUDY2 = path.join(REPO_ROOT, 'study2');

export const ARMS = ['B', 'C'];
export const PROMPT = 'The site looks different since the last change. Can you take a look and fix it?';
// The stylesheet the mutations are in, relative to the app.
export const CSS_FILE = 'site/css/styles.css';

const manifest = () => JSON.parse(fs.readFileSync(path.join(STUDY2, 'sites', 'manifest.json'), 'utf8'));
export const SITES = manifest().chosen.map((name) => name.replace(/^startbootstrap-/, ''));
export const siteDir = (site) => path.join(STUDY2, 'sites', site, 'site');
export const armFilesDir = (arm) => path.join(STUDY2, 'arms', arm, 'files');

export function instructionsFor(arm) {
  return fs.readFileSync(path.join(STUDY2, 'app', 'CLAUDE.md'), 'utf8').replace('{{VISUAL_LINE}}', visualLine(arm));
}

// The site, the server and the arm's files, in dest.
export function assembleApp({ site, arm, dest }) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(siteDir(site), path.join(dest, 'site'), { recursive: true });
  fs.copyFileSync(path.join(STUDY2, 'app', 'server.js'), path.join(dest, 'server.js'));
  fs.cpSync(armFilesDir(arm), dest, { recursive: true });
  return dest;
}
