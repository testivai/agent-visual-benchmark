// One line for TASKS.md.
export const summary = "The web font's URL is wrong, so every page falls back to a system font.";

const css = 'site/css/tokens.css';

export default {
  seed: [
    { file: css, find: "url('../fonts/acme-sans.woff2')", replace: "url('../font/acme-sans.woff2')" },
  ],
  reference: 'revert',
  // Names system fonts that look close, and leaves the web font failing.
  wrong: [
    { file: css, find: "--font-sans: 'Acme Sans', system-ui, sans-serif;", replace: "--font-sans: 'Acme Sans', 'Inter', 'Helvetica Neue', Arial, sans-serif;" },
  ],
  accepted: {
    'root-relative-url': [
      { file: css, find: "url('../font/acme-sans.woff2')", replace: "url('/fonts/acme-sans.woff2')" },
    ],
  },
};
