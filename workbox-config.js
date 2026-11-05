module.exports = {
  swSrc: 'src/service-worker.ts',   // your custom SW (TypeScript)
  swDest: 'dist/service-worker.js', // output SW written to Vite's build dir
  globDirectory: 'dist',            // Vite build output
  globPatterns: [
    '**/*.{js,css,html,ico,png,svg,json,txt}'
  ],
};