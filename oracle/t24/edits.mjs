// One line for TASKS.md.
export const summary = "Nothing is wrong: the workshop picture was exported larger and is displayed at the same size. A control: no pixel is flagged.";

export default {
  seed: [{ file: 'site/assets/workshop.png', copyFrom: 'oracle/t24/assets/workshop.png' }],
  reference: [],
  // Changes how the browser scales the picture, looking for something to fix.
  wrong: [
    { file: 'site/css/pages.css', find: '.story-art {\n  border-radius: var(--radius-lg);\n}', replace: '.story-art {\n  border-radius: var(--radius-lg);\n  image-rendering: pixelated;\n}' },
  ],
};
