import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    // The upstream tests cover the tracked-link redirects; the YKM fork's
    // direct-link default is switched off for them (lib/ykm/direct-links.ts).
    env: { YKM_TRACKED_LINKS: "1" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
