import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "supabase/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    environment: "jsdom",
    globals: true,
    env: {
      VITE_SUPABASE_URL: "https://dummy.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "dummy-key",
    },
  },
})