import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import inject from "@rollup/plugin-inject";

export default defineConfig({
  plugins: [
    react(),
    inject({
      Buffer: ["buffer", "Buffer"],
    }),
  ],
  optimizeDeps: {
    include: ["buffer"],
  },
  define: {
    'process.env.SERVER': JSON.stringify(process.env.SERVER || 'development'),
    'process.env.BACKEND_URI': JSON.stringify(process.env.BACKEND_URI || 'http://localhost:8000'),
  },
});
