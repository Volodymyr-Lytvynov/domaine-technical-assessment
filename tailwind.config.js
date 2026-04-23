/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: 'dm-',
  content: [
    './blocks/**/*.liquid',
    './snippets/**/*.liquid',
    './sections/**/*.liquid',
    './templates/**/*.liquid',
    './layout/**/*.liquid',
    './assets/**/*.js',
  ],
  // Scope Preflight so Tailwind's base reset only applies inside `.dm-scope`,
  // which prevents collisions with Horizon's existing global CSS.
  important: '.dm-scope',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: '#0A4874',
        sale: '#FF0000',
        ink: '#111111',
        hairline: '#E8E8E8',
      },
      fontFamily: {
        display: [
          '"Libre Franklin"',
          '"Franklin Gothic ATF"',
          '"Franklin Gothic"',
          '"Arial Narrow"',
          'sans-serif',
        ],
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
