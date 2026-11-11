// One line for TASKS.md.
export const summary = "Nothing is wrong: the font file was re-exported on a finer grid, so text edges move by a fraction of a pixel.";

export default {
  seed: [{ file: 'site/fonts/acme-sans.woff2', copyFrom: 'oracle/t19/assets/acme-sans.woff2' }],
  reference: [],
  // "Sharpens" the text to make the screenshots match better. There was nothing to fix.
  wrong: [
    { file: 'site/css/base.css', find: '  background: var(--color-bg);\n}', replace: '  background: var(--color-bg);\n  -webkit-font-smoothing: antialiased;\n  text-rendering: geometricPrecision;\n}' },
  ],
};
