/** @type {import('tailwindcss').Config} */
export default {
  // the UI builds most of its markup in JS strings, so the app scripts are scanned too
  content: ["./index.html", "./src/**/*.js", "./public/app/**/*.js"],
  // classes assembled at runtime from a variable (opium stat cards: `bg-${color}-100 text-${color}-600`)
  safelist: [{ pattern: /^(bg|text)-(teal|emerald|sky|indigo|orange|rose|amber|blue|slate)-(100|600)$/ }],
  theme: { extend: {} },
};
