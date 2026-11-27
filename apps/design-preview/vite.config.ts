import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: "es2022", sourcemap: true },
  server: { port: 4174, strictPort: true },
  preview: { port: 4174, strictPort: true },
});
