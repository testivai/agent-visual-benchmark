// One line for TASKS.md.
export const summary = "The hero illustration was saved with a taller artboard, which pushes the page down.";

const svg = 'site/assets/hero.svg';

export default {
  seed: [
    { file: svg, find: 'viewBox="0 0 420 280" width="420" height="280"', replace: 'viewBox="0 0 420 380" width="420" height="380"' },
  ],
  reference: 'revert',
  // Forces the image box back to its old height: the drawing is squeezed into it, smaller than designed.
  wrong: [
    { file: 'site/css/pages.css', find: '.hero-actions {', replace: '.hero-art {\n  height: 280px;\n}\n\n.hero-actions {' },
  ],
};
