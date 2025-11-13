import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/boot.js',
      name: 'PRAE',                              // ← UMD global: window.PRAE
      fileName: (fmt) => `praetorius.${fmt}.js`,
      formats: ['es', 'umd']                     // ← produce both
    },
    rollupOptions: {
      output: {
        assetFileNames: `praetorius.[name].[ext]`
      }
    }
  }
});
