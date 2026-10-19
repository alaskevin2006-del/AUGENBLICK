import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // 本地安全删除钩子会拦截 vite 清空 dist；改为构建前手动清理。
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      // 引擎 Web 化产物（npm 包形态引用，契约§五）。相对路径，保证 Linux/Docker 可构建。
      "@znawca": fileURLToPath(new URL("../../../znawca/src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/media": "http://localhost:8000",
    },
  },
});
