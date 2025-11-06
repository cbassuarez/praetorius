import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    lib: {
      entry: 'src/boot.js',
      name: 'PraetoriusPortfolio',
      fileName: (fmt) => `praetorius.${fmt}.js`,
      formats: ['umd','es']
    },
    rollupOptions: { output: { assetFileNames: `praetorius.[name].[ext]` } }
  }
});
