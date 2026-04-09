import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
// Merge `Transport/.env` with root `.env` (same VITE_ prefix). Transport overrides duplicate keys.
export default defineConfig(({ mode }) => {
  const rootDir = __dirname;
  const transportDir = path.resolve(__dirname, "Transport");
  const rootEnv = loadEnv(mode, rootDir, "VITE_");
  const transportEnv = loadEnv(mode, transportDir, "VITE_");
  const mergedViteEnv = { ...rootEnv, ...transportEnv };
  const defineEnv = Object.fromEntries(
    Object.entries(mergedViteEnv).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  );

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        // Allows frontend to use same-origin "/api" in dev.
        // Production should route "/api" via your reverse proxy to the backend.
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@transport": path.resolve(__dirname, "./Transport"),
      },
    },
    define: defineEnv,
  };
});
