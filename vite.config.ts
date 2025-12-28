import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
        alias: {
            "@": "/src",
        },
    },
    server: {
        port: 8080,
    },
}));
