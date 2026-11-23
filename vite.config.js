import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Directives like "use client" are harmless in a browser bundle, so ignore that warning.
const quietDirectives = (level, log, defaultHandler) => {
  if (log.code === 'MODULE_LEVEL_DIRECTIVE') return;
  defaultHandler(level, log);
};

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      onLog: quietDirectives,
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'emoji', test: /node_modules[\\/]emoji-picker-react/, priority: 20 },
            { name: 'icons', test: /node_modules[\\/]lucide-react/, priority: 10 },
          ],
        },
      },
    },
  },
});
