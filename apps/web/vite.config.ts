import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Asset runtime của Pyodide (npm package) được phục vụ tại /pyodide/ để worker nạp LOCAL,
// không phụ thuộc CDN lúc chạy. Chỉ cần các file lõi + stdlib (không dùng gói .whl thêm).
const PYODIDE_FILES = [
  'pyodide.mjs',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        ...PYODIDE_FILES.map((f) => ({
          src: `node_modules/pyodide/${f}`,
          dest: 'pyodide',
        })),
        // Monaco AMD build phục vụ tại /monaco/vs (self-host, không CDN).
        { src: 'node_modules/monaco-editor/min/vs', dest: 'monaco' },
        // BlockSpace (P11, AGPL-3.0 — apps/studio) phục vụ tại /studio/editor/. `pnpm --filter @lms/studio build`
        // phải chạy trước (turbo lo qua devDependency `@lms/studio`).
        { src: '../studio/dist/*', dest: 'studio/editor' },
      ],
    }),
  ],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT ?? 3000}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
