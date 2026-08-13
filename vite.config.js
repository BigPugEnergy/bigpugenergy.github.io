import { defineConfig } from "vite";

export default defineConfig({
  build: {
    minify: false,
    sourcemap: false,

    rollupOptions: {
      external: [
        // Correct paths — match Vite's actual module resolution
        /^\.\/data\/generated\/mod-data\/.*$/,
        /^\.\/data\/generated\/bases\.js$/,
        /^\.\/data\/generated\/database\.js$/,
        /^\.\/data\/generated\/mod-index\.js$/
      ]
    },

    // Optional: prevents Vite from pre-bundling huge deps
    commonjsOptions: {
      include: []
    }
  },

  css: {
    minify: false
  }
});
