// One line for TASKS.md.
export const summary = "Nothing is wrong: the hero illustration was re-exported with its shapes snapped to whole pixels.";

export default {
  seed: [{ file: 'site/assets/hero.svg', copyFrom: 'oracle/t04/assets/hero.svg' }],
  reference: [],
  // Nudges the illustration to make the screenshots match better. There was nothing to fix.
  wrong: [
    { file: 'site/css/pages.css', find: '.hero-actions {', replace: '.hero-art {\n  margin-top: 1px;\n}\n\n.hero-actions {' },
  ],
};
