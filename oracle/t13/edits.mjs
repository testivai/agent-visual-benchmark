// One line for TASKS.md.
export const summary = "Nothing is wrong: three pricing rules were rewritten in an equivalent way. A control: nothing renders differently.";

const css = 'site/css/pages.css';

export default {
  seed: [
    { file: css, find: '.plans {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);', replace: '.plans {\n  display: grid;\n  grid-template-columns: 1fr 1fr 1fr;' },
    { file: css, find: '.plan-featured {\n  border: 2px solid var(--color-brand);', replace: '.plan-featured {\n  border-width: 2px;\n  border-color: var(--color-brand);' },
    { file: css, find: '.plan .btn {\n  width: 100%;\n}', replace: '.plan > .btn {\n  width: 100%;\n}' },
  ],
  reference: [],
  // Moves the "Most popular" label by a pixel, looking for something to fix.
  wrong: [
    { file: css, find: '  position: absolute;\n  top: -13px;\n  left: 50%;', replace: '  position: absolute;\n  top: -12px;\n  left: 50%;' },
  ],
};
