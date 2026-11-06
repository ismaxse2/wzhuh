import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { GITHUB_PAGES_BASE, githubPagesFallback } from "./build/githubPages";

export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? GITHUB_PAGES_BASE : "/",
  plugins: [react(), tailwindcss(), githubPagesFallback()],
}));
