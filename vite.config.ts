import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  base: "./",
  plugins: [react(), mkcert()],
  server: {
    port: 5173,
  },
});

