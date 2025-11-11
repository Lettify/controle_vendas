import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "./client",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          const manualMap = [
            {
              pattern: /(node_modules\/react\/?|node_modules\/react-dom\/?|node_modules\/scheduler\/)/,
              chunk: "react-vendor",
            },
            {
              pattern: /node_modules\/@tanstack\/react-query\//,
              chunk: "react-query",
            },
            {
              pattern: /node_modules\/@trpc\//,
              chunk: "trpc-vendor",
            },
            {
              pattern: /node_modules\/recharts\//,
              chunk: "charts",
            },
            {
              pattern: /node_modules\/lucide-react\//,
              chunk: "icons",
            },
            {
              pattern: /node_modules\/@radix-ui\//,
              chunk: "radix",
            },
            {
              pattern: /node_modules\/sonner\//,
              chunk: "notifications",
            },
            {
              pattern: /node_modules\/html-to-image\//,
              chunk: "export-tools",
            },
            {
              pattern: /node_modules\/wouter\//,
              chunk: "router",
            },
          ];

          for (const { pattern, chunk } of manualMap) {
            if (pattern.test(id)) {
              return chunk;
            }
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/trpc": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
