import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { componentTagger } from "lovable-tagger";
import path from "path";

export default defineConfig(({ mode }) => {
    // Vite normally exposes only VITE_* variables to the browser. Expo uses
    // EXPO_PUBLIC_API_URL, so expose that public URL too and load .env values for
    // the dev proxy (process.env alone does not contain Vite's .env values).
    const env = loadEnv(mode, process.cwd(), "");
    const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5000";

    return {
        plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
        resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
        envPrefix: ["VITE_", "EXPO_PUBLIC_"],
        server: {
            port: 8080,
            host: "0.0.0.0",
            // Vite's default host allow-list answers remote preview hosts (e.g.
            // 8080-<sandbox>.e2b.app) with 403 "Blocked request. This host is not
            // allowed", so the page never loads. Dev server only — no prod impact.
            allowedHosts: true,
            proxy: {
                "/api": { target: apiProxyTarget, changeOrigin: true },
            },
        },
    };
});
