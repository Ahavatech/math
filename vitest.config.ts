import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globalSetup: ["./tests/unit/database/global-setup.ts"],
    globals: true,
    fileParallelism: false,
  },
  ssr: {
    // Vite externalizes node_modules deps for SSR/test by default,
    // which loads them via plain Node resolution and bypasses
    // resolve.alias entirely — that's why the next/server alias below
    // had no effect on next-auth's own internal import of it. Forcing
    // next-auth through Vite's own resolver makes the alias apply.
    noExternal: ["next-auth"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/shims/server-only.ts"),
      // next's package.json has no "exports" map, so Vite's resolver
      // (unlike Node's own extensionless CJS resolution, which real
      // Next.js/next-auth rely on) can't find the bare "next/server"
      // specifier next-auth imports. Point it straight at the file.
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
    },
  },
});
