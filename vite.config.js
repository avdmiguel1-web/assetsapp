import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const flespiToken = env.VITE_FLESPI_TOKEN ||
    "OWuoCjZ6RDjJAr1cwbAg78Fw7O4cX4WRVehf5QvVput3ZdzaxqXqgTN6z5fTUCqd";

  return {
    plugins: [react()],
    // Build output dir (Capacitor reads from here)
    build: { outDir: "dist" },
    server: {
      port: 5174,
      proxy: {
        "/flespi": {
          target: "https://flespi.io",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/flespi/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("Authorization", `FlespiToken ${flespiToken}`);
              proxyReq.setHeader("Accept", "application/json");
            });
            proxy.on("proxyRes", (proxyRes, req) => {
              console.log(`[Proxy] ${proxyRes.statusCode} ← ${req.url}`);
            });
            proxy.on("error", (err, req) => {
              console.error(`[Proxy ERR] ${req.url}:`, err.message);
            });
          },
        },
      },
    },
  };
});
