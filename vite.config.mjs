import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    lib: {
      entry: 'src/boot.js',
      name: 'PRAE', 
      fileName: (fmt) => `praetorius.${fmt}.js`,
      formats: ['umd','es']
    },
    rollupOptions: { output: { assetFileNames: `praetorius.[name].[ext]` } }
  }
});
