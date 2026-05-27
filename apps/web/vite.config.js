import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg"],
            manifest: {
                name: "Zoho Sprints Power Grid",
                short_name: "Power Grid",
                theme_color: "#0f172a",
                background_color: "#f8fafc",
                display: "standalone",
                start_url: "/",
                icons: [
                    {
                        src: "/favicon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                    },
                ],
            },
        }),
    ],
    server: {
        port: 5173,
    },
});
