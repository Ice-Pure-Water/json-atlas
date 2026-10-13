import { defineConfig } from 'vite';
import { resolve } from 'node:path';

function manualChunks(id) {
  if (!id.includes('/node_modules/')) return;
  if (id.includes('/@xyflow/')) return 'vendor-graph';
  if (id.includes('/@codemirror/') || id.includes('/codemirror/') || id.includes('/@lezer/')) {
    return 'vendor-editor';
  }
  if (id.includes('/tabulator-tables/')) return 'vendor-table';
  if (id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
  if (id.includes('/react/')) return 'vendor-react';
  if (
    id.includes('/yaml/') ||
    id.includes('/smol-toml/') ||
    id.includes('/papaparse/') ||
    id.includes('/lossless-json/')
  ) {
    return 'vendor-data';
  }
}

export default defineConfig({
  // Relative asset URLs support both local hosting and the GitHub Pages project path.
  base: './',
  build: {
    // The JSON tree editor is lazy-loaded only when its view is opened. Its upstream
    // single-file distribution is ~831 KB minified / ~242 KB gzip, so keep the
    // default warning strict for eager chunks while allowing that one async chunk.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        workspace: resolve(import.meta.dirname, 'workspace.html'),
      },
      output: { manualChunks, onlyExplicitManualChunks: true },
      onwarn(warning, defaultHandler) {
        // React Flow ships a harmless `use client` directive in its browser build.
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          warning.id?.includes('/node_modules/@xyflow/react/')
        ) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
});
