// Study 2's rendering drift (study2/PREREGISTRATION.md, section 4): S3 and S4
// baselines are recorded under one setting that changes how the machine draws
// the page but no CSS, the way a different machine's font setup does. The
// setting is the first in a fixed list under which every view of every site is
// flagged by both arms' checks while the DOM and computed styles stay as they
// are. Geometry may move: hinting changes how wide text is drawn.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { diffSnapshots } from '../oracle/lib/compare.mjs';
import { captureSite, effectOf, siteViews } from './validity.mjs';
import { withTempDir } from '../runner/tempdir.mjs';

const fontRule = (edits) => `<match target="font">${edits}</match>`;

export const DRIFT_SETTINGS = [
  {
    name: 'font-hinting-full',
    fontconfig: fontRule('<edit name="hinting" mode="assign"><bool>true</bool></edit><edit name="hintstyle" mode="assign"><const>hintfull</const></edit>'),
  },
  { name: 'font-antialias-off', fontconfig: fontRule('<edit name="antialias" mode="assign"><bool>false</bool></edit>') },
  { name: 'no-subpixel-positioning', args: ['--disable-font-subpixel-positioning'] },
  { name: 'angle-swiftshader', args: ['--use-angle=swiftshader', '--use-gl=angle'] },
];

export const fontconfigText = (rule) => '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>'
  + `<include ignore_missing="no">/etc/fonts/fonts.conf</include>${rule}</fontconfig>`;

// A browser that draws under the setting, for the length of work.
export async function withDriftBrowser(setting, work) {
  return withTempDir('avb-s2-drift-', async (dir) => {
    const env = { ...process.env };
    if (setting.fontconfig) {
      env.FONTCONFIG_FILE = path.join(dir, 'fonts.conf');
      fs.writeFileSync(env.FONTCONFIG_FILE, fontconfigText(setting.fontconfig));
    }
    const browser = await chromium.launch({ args: setting.args ?? [], env });
    try {
      return await work(browser);
    } finally {
      await browser.close();
    }
  });
}

const GEOMETRY = new Set(['x', 'y', 'w', 'h', 'tx', 'ty', 'tw', 'th', 'vis', 'top', 'scrollW', 'scrollH']);
const DOM = new Set(['@exists', '@extra', 'text', 'natural', 'src', 'href', 'title']);

function kindOf(entry) {
  const field = entry.split('|')[2];
  if (GEOMETRY.has(field)) return 'geometry';
  return DOM.has(field) ? 'dom' : 'styles';
}

function pixelProblems(pixels) {
  const out = [];
  for (const [view, p] of Object.entries(pixels)) {
    if (!p) continue;
    if (!p.playwright) out.push(`${view}: arm B's check does not flag it`);
    if (!(p.testivai > 0)) out.push(`${view}: arm C's check does not flag it`);
  }
  return out;
}

// What keeps a drifted capture from being pure rendering drift, in words.
// pixels: per view, as effectOf (validity.mjs) gives them.
export function driftProblems(clean, drifted, pixels) {
  const errors = Object.entries(drifted.views).filter(([, v]) => v.error).map(([id, v]) => `${id}: ${v.error}`);
  if (errors.length > 0) return errors;
  const entries = diffSnapshots(clean, drifted);
  return [
    ...entries.filter((e) => kindOf(e) === 'dom').map((e) => `the DOM differs: ${e}`),
    ...entries.filter((e) => kindOf(e) === 'styles').map((e) => `computed styles differ: ${e}`),
    ...pixelProblems(pixels),
  ];
}

// sites: [{ name, siteDir, pages }]. Tries the settings in order and stops at
// the first with no problem on any site.
export async function chooseDrift(browser, { sites, settings = DRIFT_SETTINGS }) {
  const clean = {};
  for (const site of sites) clean[site.name] = await captureSite(browser, site.siteDir, siteViews(site.pages));
  const tried = [];
  for (const setting of settings) {
    const problems = {};
    const pixels = {};
    await withDriftBrowser(setting, async (drifting) => {
      for (const site of sites) {
        const drifted = await captureSite(drifting, site.siteDir, siteViews(site.pages));
        pixels[site.name] = effectOf(clean[site.name], drifted).pixels;
        problems[site.name] = driftProblems(clean[site.name], drifted, pixels[site.name]);
      }
    });
    tried.push({ name: setting.name, problems, pixels });
    if (Object.values(problems).every((p) => p.length === 0)) return { chosen: setting.name, tried };
  }
  return { chosen: null, tried };
}
