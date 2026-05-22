import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("src/pages/Admin")) return "admin";
          if (id.includes("html2canvas")) return "html2canvas";
          if (id.includes("calendarSchedule")) return "calendarSchedule";
          if (!id.includes("node_modules")) return;

          if (id.includes("/@supabase/")) return "supabase";
          if (id.includes("/@tanstack/react-query")) return "query";
          if (id.includes("/react-router-dom")) return "router";
          if (id.includes("/framer-motion")) return "motion";
          if (id.includes("/jspdf")) return "pdf";
          if (id.includes("/recharts")) return "charts";
          if (id.includes("/date-fns")) return "date-fns";
          if (id.includes("/react-hook-form") || id.includes("/@hookform/")) return "forms";
          if (id.includes("/lucide-react")) return "icons";
          if (id.includes("/@radix-ui/")) return "radix";
          if (id.includes("/next-themes")) return "themes";
          if (id.includes("/vaul")) return "drawer";
          if (id.includes("/class-variance-authority") || id.includes("/clsx") || id.includes("/tailwind-merge")) return "ui-utils";
          if (id.includes("/zod")) return "zod";
          if (id.includes("/input-otp")) return "otp";
          if (id.includes("/diff-match-patch")) return "diff";
          if (id.includes("/embla-carousel-react")) return "carousel";
          if (id.includes("/react-day-picker")) return "day-picker";
          if (id.includes("/react-resizable-panels")) return "panels";
          if (id.includes("/sonner")) return "sonner";
          if (id.includes("/cmdk")) return "cmdk";
          if (id.includes("/react-dom")) return "react-dom";
          if (id.includes("/react/jsx-runtime") || id.includes("/react/jsx-dev-runtime") || id.endsWith("/react/index.js")) return "react";

          return "vendor";
        },
      },
    },
  },
})
