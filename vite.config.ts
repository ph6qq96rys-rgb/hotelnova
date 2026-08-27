import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("axios") || id.includes("jwt-decode")) return "vendor-http";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("react")) return "vendor-react";
          return "vendor";
        },
      },
    },
  },

  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "https://localhost:44303",
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
    },
  },
});
