// The image check: can a model, through the study's own locked-down Claude
// Code, see what is in a picture? A model that cannot is not compared: arm B
// gives the agent pictures, so it would lose most of its help and arm C little.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

export const IMAGE_FACTS = { colour: 'purple', number: 47 };

export const IMAGE_PROMPT = 'Open picture.png in this directory with the Read tool and look at it. What colour is the large circle, and what number is written inside it? Do not use any other tool. Answer on the last line as: ANSWER: <colour>, <number>';

export function imageAnswer(finalText) {
  const answer = (String(finalText).match(/ANSWER:\s*(.+)/i) ?? [])[1]?.trim() ?? '';
  return { answer, pass: /\b(purple|violet)\b/i.test(answer) && new RegExp(`\\b${IMAGE_FACTS.number}\\b`).test(answer) };
}

// A picture whose content is only in its pixels: a purple circle with 47 in it, on a pale green ground.
export async function drawPicture(file) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    await page.setContent(`<body style="margin:0;background:#d9f2d0"><svg width="400" height="300"><circle cx="200" cy="150" r="110" fill="#7b2fbe"/>`
      + `<text x="200" y="185" font-size="100" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">${IMAGE_FACTS.number}</text></svg></body>`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
  } finally {
    await browser.close();
  }
}
