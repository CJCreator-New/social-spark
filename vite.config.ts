import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

const SUPABASE_PROJECT_URL = "https://mbxlvsftyifovbkpsvyw.supabase.co";

export default defineConfig({
  plugins: [react(), mcpPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Proxy Supabase Edge Function calls through the dev server so the
      // browser sees them as same-origin, avoiding CORS preflight failures
      // during local development (see src/lib/functionsBaseUrl.ts).
      "/functions/v1": {
        target: SUPABASE_PROJECT_URL,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("three")) {
              return "three";
            }
            if (id.includes("gsap")) {
              return "gsap";
            }
            if (id.includes("@radix-ui")) {
              return "radix";
            }
            if (id.includes("@tanstack")) {
              return "tanstack";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
