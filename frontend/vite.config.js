import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import inject from "@rollup/plugin-inject";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load env from root directory
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  
  return {
    plugins: [
      react(),
      inject({
        Buffer: ["buffer", "Buffer"],
      }),
    ],
    optimizeDeps: {
      include: ["buffer"],
    },
    envDir: path.resolve(__dirname, '..'), // Load .env from root
  };
});
