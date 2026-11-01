import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { componentTagger } from "lovable-tagger";
import path from "path";

// Backend the dev server proxies to. The browser only ever talks to this dev
// server (same-origin `/api/...`), so no CORS is involved at all — and it keeps
// working when the app is opened through a remote preview host, where a hardcoded
// http://localhost:5000 in the page would point at the viewer's own machine.
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || "http://localhost:5000";

export default defineConfig(({ mode }) => ({
    plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: {
        port: 8080,
        host: "0.0.0.0",
        // Vite's default host allow-list answers remote preview hosts (e.g.
        // 8080-<sandbox>.e2b.app) with 403 "Blocked request. This host is not
        // allowed", so the page never loads. Dev server only — no prod impact.
        allowedHosts: true,
        proxy: {
            "/api": { target: API_PROXY_TARGET, changeOrigin: true },
        },
    },
}));
