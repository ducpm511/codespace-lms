// vite.config.ts
import { defineConfig } from "file:///D:/My%20Documents/CodeSpace/system-projects/LMS/.claude/worktrees/codespace-t3-8-learn-fe-b4590f/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.43_terser@5.50.0/node_modules/vite/dist/node/index.js";
import react from "file:///D:/My%20Documents/CodeSpace/system-projects/LMS/.claude/worktrees/codespace-t3-8-learn-fe-b4590f/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@20.19.43_terser@5.50.0_/node_modules/@vitejs/plugin-react/dist/index.js";
import { viteStaticCopy } from "file:///D:/My%20Documents/CodeSpace/system-projects/LMS/.claude/worktrees/codespace-t3-8-learn-fe-b4590f/node_modules/.pnpm/vite-plugin-static-copy@2.3.2_vite@5.4.21_@types+node@20.19.43_terser@5.50.0_/node_modules/vite-plugin-static-copy/dist/index.js";
var PYODIDE_FILES = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json"
];
var vite_config_default = defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        ...PYODIDE_FILES.map((f) => ({
          src: `node_modules/pyodide/${f}`,
          dest: "pyodide"
        })),
        // Monaco AMD build phục vụ tại /monaco/vs (self-host, không CDN).
        { src: "node_modules/monaco-editor/min/vs", dest: "monaco" }
      ]
    })
  ],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? 3e3}`,
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: "node"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxNeSBEb2N1bWVudHNcXFxcQ29kZVNwYWNlXFxcXHN5c3RlbS1wcm9qZWN0c1xcXFxMTVNcXFxcLmNsYXVkZVxcXFx3b3JrdHJlZXNcXFxcY29kZXNwYWNlLXQzLTgtbGVhcm4tZmUtYjQ1OTBmXFxcXGFwcHNcXFxcd2ViXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxNeSBEb2N1bWVudHNcXFxcQ29kZVNwYWNlXFxcXHN5c3RlbS1wcm9qZWN0c1xcXFxMTVNcXFxcLmNsYXVkZVxcXFx3b3JrdHJlZXNcXFxcY29kZXNwYWNlLXQzLTgtbGVhcm4tZmUtYjQ1OTBmXFxcXGFwcHNcXFxcd2ViXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9NeSUyMERvY3VtZW50cy9Db2RlU3BhY2Uvc3lzdGVtLXByb2plY3RzL0xNUy8uY2xhdWRlL3dvcmt0cmVlcy9jb2Rlc3BhY2UtdDMtOC1sZWFybi1mZS1iNDU5MGYvYXBwcy93ZWIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyB2aXRlU3RhdGljQ29weSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5JztcblxuLy8gQXNzZXQgcnVudGltZSBjXHUxRUU3YSBQeW9kaWRlIChucG0gcGFja2FnZSkgXHUwMTExXHUwMUIwXHUxRUUzYyBwaFx1MUVFNWMgdlx1MUVFNSB0XHUxRUExaSAvcHlvZGlkZS8gXHUwMTExXHUxRUMzIHdvcmtlciBuXHUxRUExcCBMT0NBTCxcbi8vIGtoXHUwMEY0bmcgcGhcdTFFRTUgdGh1XHUxRUQ5YyBDRE4gbFx1MDBGQWMgY2hcdTFFQTF5LiBDaFx1MUVDOSBjXHUxRUE3biBjXHUwMEUxYyBmaWxlIGxcdTAwRjVpICsgc3RkbGliIChraFx1MDBGNG5nIGRcdTAwRjluZyBnXHUwMEYzaSAud2hsIHRoXHUwMEVBbSkuXG5jb25zdCBQWU9ESURFX0ZJTEVTID0gW1xuICAncHlvZGlkZS5tanMnLFxuICAncHlvZGlkZS5hc20ubWpzJyxcbiAgJ3B5b2RpZGUuYXNtLndhc20nLFxuICAncHl0aG9uX3N0ZGxpYi56aXAnLFxuICAncHlvZGlkZS1sb2NrLmpzb24nLFxuXTtcblxuLy8gaHR0cHM6Ly92aXRlLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB2aXRlU3RhdGljQ29weSh7XG4gICAgICB0YXJnZXRzOiBbXG4gICAgICAgIC4uLlBZT0RJREVfRklMRVMubWFwKChmKSA9PiAoe1xuICAgICAgICAgIHNyYzogYG5vZGVfbW9kdWxlcy9weW9kaWRlLyR7Zn1gLFxuICAgICAgICAgIGRlc3Q6ICdweW9kaWRlJyxcbiAgICAgICAgfSkpLFxuICAgICAgICAvLyBNb25hY28gQU1EIGJ1aWxkIHBoXHUxRUU1YyB2XHUxRUU1IHRcdTFFQTFpIC9tb25hY28vdnMgKHNlbGYtaG9zdCwga2hcdTAwRjRuZyBDRE4pLlxuICAgICAgICB7IHNyYzogJ25vZGVfbW9kdWxlcy9tb25hY28tZWRpdG9yL21pbi92cycsIGRlc3Q6ICdtb25hY28nIH0sXG4gICAgICBdLFxuICAgIH0pLFxuICBdLFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiBOdW1iZXIocHJvY2Vzcy5lbnYuV0VCX1BPUlQgPz8gNTE3MyksXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6IGBodHRwOi8vbG9jYWxob3N0OiR7cHJvY2Vzcy5lbnYuQVBJX1BPUlQgPz8gMzAwMH1gLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHRlc3Q6IHtcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIGVudmlyb25tZW50OiAnbm9kZScsXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNmYsU0FBUyxvQkFBb0I7QUFDMWhCLE9BQU8sV0FBVztBQUNsQixTQUFTLHNCQUFzQjtBQUkvQixJQUFNLGdCQUFnQjtBQUFBLEVBQ3BCO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNGO0FBR0EsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sZUFBZTtBQUFBLE1BQ2IsU0FBUztBQUFBLFFBQ1AsR0FBRyxjQUFjLElBQUksQ0FBQyxPQUFPO0FBQUEsVUFDM0IsS0FBSyx3QkFBd0IsQ0FBQztBQUFBLFVBQzlCLE1BQU07QUFBQSxRQUNSLEVBQUU7QUFBQTtBQUFBLFFBRUYsRUFBRSxLQUFLLHFDQUFxQyxNQUFNLFNBQVM7QUFBQSxNQUM3RDtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU0sT0FBTyxRQUFRLElBQUksWUFBWSxJQUFJO0FBQUEsSUFDekMsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUSxvQkFBb0IsUUFBUSxJQUFJLFlBQVksR0FBSTtBQUFBLFFBQ3hELGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsRUFDZjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
